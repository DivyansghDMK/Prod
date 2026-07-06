"use strict";

const { HttpError } = require("../utils/httpError");
const { createReportRepository } = require("./report.repository");
const { createPatientRepository } = require("../patients/patient.repository");
const { createDeviceRepository } = require("../devices/device.repository");
const {
  validateReportPayload,
  validateReportReviewPayload,
  validateReportUploadPayload,
  parseReportQuery,
} = require("./report.validation");

const ORG_SCOPED_ROLES = new Set([
  "HCP_ADMIN", "HCP_CLINICAL", "DOCTOR_ADMIN", "DOCTOR_CLINICAL", "RECEPTIONIST",
]);

function _resolveOrgId(callerRole, callerOrg, queryOrgId) {
  if (callerRole === "SUPER_ADMIN") return queryOrgId || null;
  return callerOrg?.id || null;
}

function _assertOwnership(report, callerRole, callerOrg) {
  if (!ORG_SCOPED_ROLES.has(callerRole)) return;
  if (report.organization_id !== callerOrg?.id) {
    throw new HttpError("Report not found", 404);
  }
}

class ReportService {
  constructor(
    repository = createReportRepository(),
    patientRepository = createPatientRepository(),
    deviceRepository = createDeviceRepository()
  ) {
    this.repository = repository;
    this.patientRepository = patientRepository;
    this.deviceRepository = deviceRepository;
  }

  async createReport(payload, caller) {
    const validation = validateReportPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    if (caller.role !== "SUPER_ADMIN") {
      if (!caller.organization?.id) throw new HttpError("Organization context missing", 403);
      data.organization_id = caller.organization.id;
    }

    // Verify patient exists and belongs to the same org
    const patient = await this.patientRepository.findById(data.patient_id);
    if (!patient || (caller.role !== "SUPER_ADMIN" && patient.organization_id !== data.organization_id)) {
      throw new HttpError("Patient not found or belongs to another organization", 400);
    }

    // Verify device exists (if provided)
    if (data.device_id) {
      const device = await this.deviceRepository.findById(data.device_id);
      if (!device || (caller.role !== "SUPER_ADMIN" && device.organization_id !== data.organization_id)) {
        throw new HttpError("Device not found or belongs to another organization", 400);
      }
    }

    data.created_by = caller.user?.id || null;
    return this.repository.create(data);
  }

  async uploadReport(payload, caller) {
    const fs = require("fs");
    const path = require("path");

    // ── Idempotency Check (by checksum) ─────────────────────────────────────
    if (payload.files && payload.files.length > 0) {
      for (const file of payload.files) {
        if (file.checksum) {
          const query = `
            SELECT rf.*, r.organization_id
            FROM report_files rf
            JOIN reports r ON r.id = rf.report_id
            WHERE rf.checksum = $1
            LIMIT 1;
          `;
          const { rows } = await this.repository.db.query(query, [file.checksum]);
          if (rows[0]) {
            // Delete temp file if present
            if (file.temp_path && fs.existsSync(file.temp_path)) {
              try { fs.unlinkSync(file.temp_path); } catch (e) {}
            }
            const existingReport = await this.repository.findById(rows[0].report_id);
            return {
              status: "success",
              message: "Report already uploaded (idempotent)",
              report: existingReport,
              files: [rows[0]],
            };
          }
        }
      }
    }

    // ── Normalize Report Type ────────────────────────────────────────────────
    let reportType = payload.report_type || "12_LEAD";
    const typeLower = String(reportType).toLowerCase();
    if (typeLower.includes("hrv")) {
      reportType = "HRV";
    } else if (typeLower.includes("hyper")) {
      reportType = "HYPERKALEMIA";
    } else if (typeLower.includes("12") || typeLower.includes("lead") || typeLower.includes("twelve")) {
      reportType = "12_LEAD";
    } else {
      reportType = "HOLTER";
    }
    payload.report_type = reportType;

    // ── Resolve Organization ID via Device Serial or Caller ────────────────
    let organizationId = payload.organization_id || caller.organization?.id;
    const deviceSerial = payload.machine_serial || payload.device_id || payload.RhythmUltra_serial;
    let resolvedDevice = null;

    if (deviceSerial) {
      const query = `
        SELECT * FROM devices
        WHERE machine_serial = $1 OR rhythmulta_serial = $1
        LIMIT 1;
      `;
      const { rows } = await this.repository.db.query(query, [deviceSerial]);
      resolvedDevice = rows[0] || null;
      if (resolvedDevice) {
        organizationId = resolvedDevice.organization_id;
        payload.device_id = resolvedDevice.id;
      }
    }

    if (!organizationId) {
      throw new HttpError("Unable to determine organization for this upload", 400);
    }
    payload.organization_id = organizationId;

    // ── Resolve or Create Patient dynamically if missing ────────────────────
    let patientId = payload.patient_id;
    if (!patientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
      const patientName = payload.patient_name || payload.patientName || "Offline Sync Patient";
      const names = String(patientName).split(" ");
      const firstName = names[0] || "Offline";
      const lastName = names.slice(1).join(" ") || "Sync";

      const findQuery = `
        SELECT id FROM patients
        WHERE organization_id = $1 AND deleted_at IS NULL
          AND (patient_id = $2 OR (first_name = $3 AND last_name = $4))
        LIMIT 1;
      `;
      const { rows } = await this.repository.db.query(findQuery, [
        organizationId,
        payload.patient_id || "OFFLINE-SYNC",
        firstName,
        lastName
      ]);

      if (rows[0]) {
        patientId = rows[0].id;
      } else {
        const createQuery = `
          INSERT INTO patients (organization_id, patient_id, first_name, last_name, gender)
          VALUES ($1, $2, $3, $4, 'UNKNOWN')
          RETURNING id;
        `;
        const { rows: newRows } = await this.repository.db.query(createQuery, [
          organizationId,
          payload.patient_id || "OFFLINE-SYNC",
          firstName,
          lastName
        ]);
        patientId = newRows[0].id;
      }
    }
    payload.patient_id = patientId;

    // ── Resolve Doctor by Name or ID ─────────────────────────────────────────
    if (payload.doctorName || payload.doctor_name) {
      const docName = payload.doctorName || payload.doctor_name;
      const query = `
        SELECT id FROM users
        WHERE organization_id = $1 AND full_name ILIKE $2
        LIMIT 1;
      `;
      const { rows } = await this.repository.db.query(query, [organizationId, `%${docName}%`]);
      if (rows[0]) {
        payload.doctor_id = rows[0].id;
      }
    }

    // ── Validate modified payload ────────────────────────────────────────────
    const validation = validateReportUploadPayload(payload);
    if (!validation.ok) {
      if (payload.files) {
        for (const file of payload.files) {
          if (file.temp_path && fs.existsSync(file.temp_path)) {
            try { fs.unlinkSync(file.temp_path); } catch (e) {}
          }
        }
      }
      throw new HttpError("Validation failed", 400, validation.errors);
    }

    const data = validation.data;
    const files = data.files;
    delete data.files;

    data.created_by = caller.user?.id || null;

    const result = await this.repository.createWithFiles(data, files);
    return {
      status: "success",
      message: "Report and files metadata uploaded successfully",
      report: result.report,
      files: result.files,
    };
  }

  async listReports(rawQuery, caller) {
    const q = parseReportQuery(rawQuery);
    const orgId = _resolveOrgId(caller.role, caller.organization, q.organization_id);

    const filters = {
      organizationId: orgId,
      patientId: q.patient_id,
      doctorId: q.doctor_id,
      deviceId: q.device_id,
      visitId: q.visit_id,
      reportType: q.report_type,
      reportStatus: q.report_status,
      dateFrom: q.date_from,
      dateTo: q.date_to,
      search: q.search,
    };

    const [data, total] = await Promise.all([
      this.repository.findMany({ ...filters, limit: q.limit, offset: q.offset }),
      this.repository.countMany(filters),
    ]);

    return {
      data,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  async getReportById(id, caller) {
    const report = await this.repository.findById(id);
    if (!report) throw new HttpError("Report not found", 404);

    _assertOwnership(report, caller.role, caller.organization);
    return report;
  }

  async getReportFiles(id, caller) {
    const report = await this.getReportById(id, caller);
    return this.repository.findReportFiles(report.id);
  }

  async getReportsByPatientId(patientId, rawQuery, caller) {
    const patient = await this.patientRepository.findById(patientId);
    if (!patient) throw new HttpError("Patient not found", 404);
    if (caller.role !== "SUPER_ADMIN" && patient.organization_id !== caller.organization?.id) {
      throw new HttpError("Patient not found", 404);
    }

    const q = parseReportQuery(rawQuery);
    const filters = {
      organizationId: patient.organization_id,
      patientId: patient.id,
      limit: q.limit,
      offset: q.offset,
    };

    const [data, total] = await Promise.all([
      this.repository.findMany(filters),
      this.repository.countMany(filters),
    ]);

    return {
      data,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit) || 1,
      },
    };
  }

  async updateReportStatus(id, payload, caller) {
    const report = await this.getReportById(id, caller);

    const status = payload.status;
    if (!status) throw new HttpError("status is required", 400);

    const VALID_STATUSES = ["GENERATING", "GENERATED", "REVIEW_PENDING", "APPROVED", "REJECTED"];
    if (!VALID_STATUSES.includes(status)) {
      throw new HttpError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    // Strict RBAC: Only doctor or super admin can approve/reject
    if ((status === "APPROVED" || status === "REJECTED") && !caller.permissions.includes("report:approve")) {
      throw new HttpError("Forbidden: Only doctors or administrators can approve/reject reports", 403);
    }

    const decision = status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "NEEDS_REVISION";
    const updated = await this.repository.updateStatus(id, status, caller.user?.id, decision, payload.comments || null);
    return updated;
  }

  async submitReportReview(id, payload, caller) {
    const report = await this.getReportById(id, caller);

    const validation = validateReportReviewPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;
    const reviewerId = caller.user?.id;

    if (!reviewerId) throw new HttpError("Reviewer context missing", 401);

    // Determine target report status based on review decision
    let targetStatus;
    if (data.decision === "APPROVED") {
      targetStatus = "APPROVED";
    } else if (data.decision === "REJECTED") {
      targetStatus = "REJECTED";
    } else {
      targetStatus = "REVIEW_PENDING";
    }

    const updated = await this.repository.updateStatus(id, targetStatus, reviewerId, data.decision, data.comments);
    return {
      report: updated,
      review: {
        report_id: id,
        reviewer_id: reviewerId,
        decision: data.decision,
        comments: data.comments,
      },
    };
  }

  async getPendingReview(rawQuery, caller) {
    const query = {
      ...rawQuery,
      report_status: "REVIEW_PENDING",
    };
    return this.listReports(query, caller);
  }

  async getApproved(rawQuery, caller) {
    const query = {
      ...rawQuery,
      report_status: "APPROVED",
    };
    return this.listReports(query, caller);
  }
}

function createReportService(pool, patientRepository, deviceRepository) {
  return new ReportService(
    createReportRepository(pool),
    patientRepository || createPatientRepository(pool),
    deviceRepository || createDeviceRepository(pool)
  );
}

module.exports = { ReportService, createReportService };
