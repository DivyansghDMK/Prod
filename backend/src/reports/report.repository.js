"use strict";

const { getPool } = require("../config/db");

const REPORT_SELECT = `
  r.id,
  r.organization_id,
  r.patient_id,
  r.visit_id,
  r.doctor_id,
  r.device_id,
  COALESCE(r.report_type_v2, r.report_type) AS report_type,
  COALESCE(r.report_status_v2, r.report_status::text) AS report_status,
  r.pdf_s3_key,
  r.json_s3_key,
  r.waveform_s3_key,
  r.thumbnail_s3_key,
  r.ai_summary,
  r.ai_confidence,
  r.generated_at,
  r.reviewed_at,
  r.approved_at,
  r.created_at,
  r.updated_at,
  r.created_by,
  o.name AS organization_name,
  (p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
  p.patient_id AS patient_mrn,
  u.full_name AS doctor_name,
  d.device_name,
  d.rhythmulta_serial,
  d.machine_serial
`;

class ReportRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  async create(data, client = null) {
    const dbClient = client || this.db;
    const query = `
      INSERT INTO reports (
        organization_id, patient_id, visit_id, doctor_id, device_id,
        report_type, report_type_v2, report_status, report_status_v2,
        pdf_s3_key, json_s3_key, waveform_s3_key, thumbnail_s3_key,
        ai_summary, ai_confidence, generated_at, created_by, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $6, 'PENDING', $7,
        $8, $9, $10, $11,
        $12, $13, COALESCE($14, NOW()), $15, NOW()
      )
      RETURNING *;
    `;
    const values = [
      data.organization_id,
      data.patient_id,
      data.visit_id || null,
      data.doctor_id || null,
      data.device_id || null,
      data.report_type,
      data.report_status || "GENERATING",
      data.pdf_s3_key || null,
      data.json_s3_key || null,
      data.waveform_s3_key || null,
      data.thumbnail_s3_key || null,
      data.ai_summary || null,
      data.ai_confidence !== undefined ? data.ai_confidence : null,
      data.generated_at || null,
      data.created_by || null,
    ];

    const { rows } = await dbClient.query(query, values);
    return rows[0];
  }

  async findById(id) {
    const query = `
      SELECT ${REPORT_SELECT}
      FROM reports r
      LEFT JOIN organizations o ON o.id = r.organization_id
      LEFT JOIN patients p ON p.id = r.patient_id
      LEFT JOIN users u ON u.id = r.doctor_id
      LEFT JOIN devices d ON d.id = r.device_id
      WHERE r.id = $1;
    `;
    const { rows } = await this.db.query(query, [id]);
    return rows[0] || null;
  }

  async findMany({
    organizationId = null,
    patientId = null,
    doctorId = null,
    deviceId = null,
    visitId = null,
    reportType = null,
    reportStatus = null,
    dateFrom = null,
    dateTo = null,
    search = null,
    limit = 20,
    offset = 0,
  } = {}) {
    const { conditions, values, nextP } = this._buildFilters({
      organizationId,
      patientId,
      doctorId,
      deviceId,
      visitId,
      reportType,
      reportStatus,
      dateFrom,
      dateTo,
      search,
    });

    values.push(limit, offset);
    const lp = nextP;
    const op = nextP + 1;

    const query = `
      SELECT ${REPORT_SELECT}
      FROM reports r
      LEFT JOIN organizations o ON o.id = r.organization_id
      LEFT JOIN patients p ON p.id = r.patient_id
      LEFT JOIN users u ON u.id = r.doctor_id
      LEFT JOIN devices d ON d.id = r.device_id
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
      ORDER BY r.created_at DESC
      LIMIT $${lp} OFFSET $${op};
    `;

    const { rows } = await this.db.query(query, values);
    return rows;
  }

  async countMany(filters = {}) {
    const { conditions, values } = this._buildFilters(filters);
    const query = `
      SELECT COUNT(*)::int AS count
      FROM reports r
      LEFT JOIN patients p ON p.id = r.patient_id
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""};
    `;
    const { rows } = await this.db.query(query, values);
    return rows[0]?.count || 0;
  }

  async updateStatus(id, status, reviewerId = null, decision = null, comments = null) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      let approvedAtUpdate = "";
      let reviewedAtUpdate = "";
      const values = [id, status];
      let valIndex = 3;

      if (status === "APPROVED") {
        approvedAtUpdate = `, approved_at = NOW(), approved_by = $${valIndex++}`;
        values.push(reviewerId);
      } else if (status === "REJECTED" || status === "REVIEW_PENDING") {
        reviewedAtUpdate = `, reviewed_at = NOW()`;
      }

      const reportQuery = `
        UPDATE reports
        SET
          report_status_v2 = $2,
          updated_at = NOW()
          ${approvedAtUpdate}
          ${reviewedAtUpdate}
        WHERE id = $1
        RETURNING *;
      `;

      const { rows } = await client.query(reportQuery, values);
      const updatedReport = rows[0];

      if (updatedReport && reviewerId && decision) {
        const reviewQuery = `
          INSERT INTO report_reviews (report_id, reviewer_id, decision, comments)
          VALUES ($1, $2, $3, $4)
          RETURNING *;
        `;
        await client.query(reviewQuery, [id, reviewerId, decision, comments || null]);
      }

      await client.query("COMMIT");
      return updatedReport;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createReview(reportId, reviewerId, data) {
    const query = `
      INSERT INTO report_reviews (report_id, reviewer_id, decision, comments)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await this.db.query(query, [
      reportId,
      reviewerId,
      data.decision,
      data.comments || null,
    ]);
    return rows[0];
  }

  async findReviews(reportId) {
    const query = `
      SELECT rv.*, u.full_name AS reviewer_name
      FROM report_reviews rv
      LEFT JOIN users u ON u.id = rv.reviewer_id
      WHERE rv.report_id = $1
      ORDER BY rv.created_at DESC;
    `;
    const { rows } = await this.db.query(query, [reportId]);
    return rows;
  }

  async createReportFile(reportId, fileData, client = null) {
    const dbClient = client || this.db;
    const query = `
      INSERT INTO report_files (report_id, file_type, s3_key, file_size, checksum)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await dbClient.query(query, [
      reportId,
      fileData.file_type,
      fileData.s3_key,
      fileData.file_size || null,
      fileData.checksum || null,
    ]);
    return rows[0];
  }

  async findReportFiles(reportId) {
    const query = `
      SELECT * FROM report_files
      WHERE report_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.db.query(query, [reportId]);
    return rows;
  }

  async delete(id) {
    const { rowCount } = await this.db.query("DELETE FROM reports WHERE id = $1", [id]);
    return rowCount > 0;
  }

  async createWithFiles(reportData, filesData) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      const report = await this.create(reportData, client);

      const files = [];
      for (const file of filesData) {
        const fileRecord = await this.createReportFile(report.id, file, client);
        files.push(fileRecord);
      }

      await client.query("COMMIT");
      return { report, files };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  _buildFilters({
    organizationId = null,
    patientId = null,
    doctorId = null,
    deviceId = null,
    visitId = null,
    reportType = null,
    reportStatus = null,
    dateFrom = null,
    dateTo = null,
    search = null,
  }) {
    const conditions = [];
    const values = [];
    let p = 1;

    if (organizationId) {
      conditions.push(`r.organization_id = $${p++}`);
      values.push(organizationId);
    }
    if (patientId) {
      conditions.push(`r.patient_id = $${p++}`);
      values.push(patientId);
    }
    if (doctorId) {
      conditions.push(`r.doctor_id = $${p++}`);
      values.push(doctorId);
    }
    if (deviceId) {
      conditions.push(`r.device_id = $${p++}`);
      values.push(deviceId);
    }
    if (visitId) {
      conditions.push(`r.visit_id = $${p++}`);
      values.push(visitId);
    }
    if (reportType) {
      conditions.push(`(r.report_type_v2 = $${p} OR r.report_type = $${p})`);
      values.push(reportType);
      p++;
    }
    if (reportStatus) {
      conditions.push(`(r.report_status_v2 = $${p} OR r.report_status::text = $${p})`);
      values.push(reportStatus);
      p++;
    }
    if (dateFrom) {
      conditions.push(`r.created_at >= $${p++}`);
      values.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`r.created_at <= $${p++}`);
      values.push(dateTo);
    }
    if (search) {
      conditions.push(
        `(p.first_name ILIKE $${p} OR p.last_name ILIKE $${p} OR (p.first_name || ' ' || COALESCE(p.last_name, '')) ILIKE $${p} OR p.patient_id ILIKE $${p})`
      );
      values.push(`%${search}%`);
      p++;
    }

    return { conditions, values, nextP: p };
  }
}

function createReportRepository(pool) {
  return new ReportRepository(pool);
}

module.exports = { ReportRepository, createReportRepository };
