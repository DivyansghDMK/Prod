"use strict";

const { getPool } = require("../config/db");

class SessionRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  async create(data, dbClient = this.db) {
    const query = `
      INSERT INTO ecg_sessions (
        organization_id, patient_id, visit_id, doctor_id, device_id, report_id,
        session_status, report_type, sampling_rate, lead_count, duration_seconds,
        started_at, desktop_version, firmware_version, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        COALESCE($7, 'RECORDING'), $8, $9, $10, $11,
        NOW(), $12, $13, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      data.organization_id,
      data.patient_id,
      data.visit_id || null,
      data.doctor_id || null,
      data.device_id || null,
      data.report_id || null,
      data.session_status || "RECORDING",
      data.report_type,
      data.sampling_rate || null,
      data.lead_count || null,
      data.duration_seconds || null,
      data.desktop_version || null,
      data.firmware_version || null,
    ];

    const { rows } = await dbClient.query(query, values);
    return rows[0];
  }

  async findById(id) {
    const query = `
      SELECT s.*,
             o.name AS organization_name,
             (p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
             p.patient_id AS patient_mrn,
             u.full_name AS doctor_name,
             d.device_name,
             d.rhythmulta_serial,
             d.machine_serial
      FROM ecg_sessions s
      LEFT JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN patients p ON p.id = s.patient_id
      LEFT JOIN users u ON u.id = s.doctor_id
      LEFT JOIN devices d ON d.id = s.device_id
      WHERE s.id = $1;
    `;
    const { rows } = await this.db.query(query, [id]);
    return rows[0] || null;
  }

  async update(id, data) {
    const query = `
      UPDATE ecg_sessions
      SET
        visit_id = COALESCE($2, visit_id),
        doctor_id = COALESCE($3, doctor_id),
        device_id = COALESCE($4, device_id),
        report_id = COALESCE($5, report_id),
        session_status = COALESCE($6, session_status),
        sampling_rate = COALESCE($7, sampling_rate),
        lead_count = COALESCE($8, lead_count),
        duration_seconds = COALESCE($9, duration_seconds),
        desktop_version = COALESCE($10, desktop_version),
        firmware_version = COALESCE($11, firmware_version),
        ended_at = COALESCE($12, ended_at),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const values = [
      id,
      data.visit_id ?? null,
      data.doctor_id ?? null,
      data.device_id ?? null,
      data.report_id ?? null,
      data.session_status ?? null,
      data.sampling_rate ?? null,
      data.lead_count ?? null,
      data.duration_seconds ?? null,
      data.desktop_version ?? null,
      data.firmware_version ?? null,
      data.ended_at ?? null,
    ];

    const { rows } = await this.db.query(query, values);
    return rows[0] || null;
  }

  async finish(id, status, reportId = null) {
    const query = `
      UPDATE ecg_sessions
      SET
        session_status = $2,
        report_id = COALESCE($3, report_id),
        ended_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await this.db.query(query, [id, status, reportId || null]);
    return rows[0] || null;
  }
}

function createSessionRepository(pool) {
  return new SessionRepository(pool);
}

module.exports = { SessionRepository, createSessionRepository };
