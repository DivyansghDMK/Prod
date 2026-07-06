"use strict";

const { HttpError } = require("../utils/httpError");
const { createDesktopRepository } = require("./desktop.repository");
const { createAuthService } = require("../auth/auth.service");
const { createReportService } = require("../reports/report.service");
const { createReportRepository } = require("../reports/report.repository");
const {
  validateLoginPayload,
  validateHeartbeatPayload,
  validateSyncPayload,
} = require("./desktop.validation");

class DesktopService {
  constructor(
    repository = createDesktopRepository(),
    authService = null,
    reportService = null,
    reportRepository = null
  ) {
    this.repository = repository;
    this.authService = authService || createAuthService();
    this.reportService = reportService || createReportService();
    this.reportRepository = reportRepository || createReportRepository();
  }

  async login(payload, meta = {}) {
    const validation = validateLoginPayload(payload);
    if (!validation.ok) {
      throw new HttpError("Validation failed", 400, validation.errors);
    }
    return this.authService.loginWithPassword(validation.data.identifier, validation.data.password, meta);
  }

  async registerSyncQueueItem(payload, caller) {
    const validation = validateSyncPayload(payload);
    if (!validation.ok) {
      throw new HttpError("Validation failed", 400, validation.errors);
    }

    if (caller.role !== "SUPER_ADMIN" && validation.data.organization_id !== caller.organization?.id) {
      throw new HttpError("Forbidden: Cannot register sync queue item for another organization", 403);
    }

    return this.repository.createSyncItem(validation.data);
  }

  async getPendingSync(query = {}, caller) {
    const orgId = caller.role === "SUPER_ADMIN" ? (query.organization_id || null) : caller.organization?.id;
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 100);
    const offset = Math.max(parseInt(query.offset, 10) || 0, 0);

    return this.repository.getPendingSyncItems(orgId, limit, offset);
  }

  async syncReport(payload, caller) {
    const queueItemId = payload.sync_queue_id;
    if (!queueItemId) {
      throw new HttpError("sync_queue_id is required", 400);
    }

    const queueItem = await this.repository.findSyncItemById(queueItemId);
    if (!queueItem) {
      throw new HttpError("Sync queue item not found", 404);
    }

    if (caller.role !== "SUPER_ADMIN" && queueItem.organization_id !== caller.organization?.id) {
      throw new HttpError("Sync queue item not found", 404); // opaque
    }

    // Attempt upload or verify status
    const status = payload.status || "COMPLETE";
    const updated = await this.repository.updateSyncStatus(queueItemId, status, payload.retry_count || null);
    
    return {
      status: "success",
      message: "Sync queue item updated successfully",
      data: updated,
    };
  }

  async reportUpload(payload, caller) {
    // Direct delegation to reportService
    return this.reportService.uploadReport(payload, caller);
  }

  async reportFiles(payload, caller) {
    const reportId = payload.report_id;
    if (!reportId) {
      throw new HttpError("report_id is required", 400);
    }

    // Verify report exists and belongs to organization
    const report = await this.reportService.getReportById(reportId, caller);

    const fileRecords = [];
    const files = Array.isArray(payload.files) ? payload.files : [payload];

    for (const file of files) {
      if (!file.file_type || !file.s3_key) {
        throw new HttpError("file_type and s3_key are required for each file", 400);
      }
      const record = await this.reportRepository.createReportFile(report.id, {
        file_type: file.file_type,
        s3_key: file.s3_key,
        file_size: file.file_size || null,
        checksum: file.checksum || null,
      });
      fileRecords.push(record);
    }

    return {
      status: "success",
      message: "Report files registered successfully",
      data: fileRecords,
    };
  }

  async getReportStatus(id, caller) {
    const report = await this.reportService.getReportById(id, caller);
    const files = await this.reportRepository.findReportFiles(id);
    
    return {
      status: "success",
      report_id: report.id,
      report_status: report.report_status,
      files: files.map(f => ({
        file_type: f.file_type,
        s3_key: f.s3_key,
        uploaded_at: f.uploaded_at,
      })),
    };
  }

  async heartbeat(payload, caller) {
    const validation = validateHeartbeatPayload(payload);
    if (!validation.ok) {
      throw new HttpError("Validation failed", 400, validation.errors);
    }

    const data = validation.data;
    const device = await this.repository.updateDeviceHeartbeat(
      data.device_serial,
      data.app_version,
      data.firmware_version,
      data.sync_status
    );

    if (!device) {
      throw new HttpError("Device not registered", 404);
    }

    // Check organization isolation
    if (caller.role !== "SUPER_ADMIN" && device.organization_id !== caller.organization?.id) {
      throw new HttpError("Device not registered for this organization", 403);
    }

    return {
      status: "success",
      message: "Device heartbeat processed successfully",
      last_seen: new Date(),
    };
  }
}

function createDesktopService(pool) {
  return new DesktopService(createDesktopRepository(pool));
}

module.exports = { DesktopService, createDesktopService };
