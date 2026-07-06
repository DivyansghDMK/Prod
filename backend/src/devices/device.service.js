"use strict";

/**
 * device.service.js
 * Business-logic layer for Device Management.
 *
 * RBAC enforcement (org-scoped access) lives here so controllers stay thin.
 *
 * Rules enforced:
 *   SUPER_ADMIN  → unrestricted access to all org's devices
 *   HCP_ADMIN    → restricted to their own organization
 *   HCP_CLINICAL → view-only; org-scoped
 *   DOCTOR_*     → no device management (blocked by RBAC permissions in routes)
 */

const { HttpError }            = require("../utils/httpError");
const { createDeviceRepository } = require("./device.repository");
const {
  validateDevicePayload,
  validateHeartbeatPayload,
} = require("./device.validation");

// Roles that are always scoped to their own organization
const ORG_SCOPED_ROLES = new Set(["HCP_ADMIN", "HCP_CLINICAL", "RECEPTIONIST"]);

/**
 * Derive the effective organizationId filter for the calling user.
 * SUPER_ADMIN may pass an explicit organizationId; all other roles are
 * forced to their own org.
 *
 * @param {object}      reqUser  – req.user populated by authenticate()
 * @param {string|null} caller   – req.role
 * @param {object|null} reqOrg   – req.organization
 * @param {string|null} queryOrgId – ?organization_id from query string
 * @returns {string|null}
 */
function _resolveOrgFilter(reqUser, callerRole, reqOrg, queryOrgId) {
  if (callerRole === "SUPER_ADMIN") {
    return queryOrgId || null; // optional filter
  }
  // All other permitted roles: scope to own org
  return reqOrg?.id || null;
}

class DeviceService {
  /**
   * @param {import('./device.repository').DeviceRepository} repository
   */
  constructor(repository = createDeviceRepository()) {
    this.repository = repository;
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  /**
   * Register a new device.
   * Enforces unique serials and org ownership.
   *
   * @param {object} payload
   * @param {{ role: string, organization: object|null }} caller
   * @returns {Promise<object>}
   */
  async registerDevice(payload, caller) {
    const validation = validateDevicePayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // Non-superadmin: override org to their own
    if (caller.role !== "SUPER_ADMIN") {
      if (!caller.organization?.id) {
        throw new HttpError("Unable to determine organization", 403);
      }
      data.organization_id = caller.organization.id;
    }

    // Uniqueness: RhythmUltra serial
    const existingRhythm = await this.repository.findByRhythmUltraSerial(data.rhythmulta_serial);
    if (existingRhythm) {
      throw new HttpError(
        `RhythmUltra serial '${data.rhythmulta_serial}' is already registered`,
        409
      );
    }

    // Uniqueness: Machine serial
    const existingMachine = await this.repository.findByMachineSerial(data.machine_serial);
    if (existingMachine) {
      throw new HttpError(
        `Machine serial '${data.machine_serial}' is already registered`,
        409
      );
    }

    return this.repository.create(data);
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  /**
   * List devices with pagination, filtering and search.
   *
   * @param {object} query  – parsed from req.query
   * @param {{ role, organization }} caller
   * @returns {Promise<{ data, pagination }>}
   */
  async listDevices(query = {}, caller = {}) {
    const page   = Math.max(parseInt(query.page,  10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const orgId = _resolveOrgFilter(
      caller.user, caller.role, caller.organization, query.organization_id || null
    );

    const filters = {
      organizationId:  orgId,
      search:          query.search          || null,
      status:          query.status          || null,
      activationStatus: query.activation_status || null,
    };

    const [data, total] = await Promise.all([
      this.repository.findMany({ limit, offset, ...filters }),
      this.repository.countMany(filters),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ─── Get by ID ─────────────────────────────────────────────────────────────

  /**
   * Fetch a single device, enforcing org-scoped access.
   *
   * @param {string} id
   * @param {{ role, organization }} caller
   * @returns {Promise<object>}
   */
  async getDeviceById(id, caller = {}) {
    const device = await this.repository.findById(id);
    if (!device) throw new HttpError("Device not found", 404);

    // Org-scoped roles may only see their own org's devices
    if (
      ORG_SCOPED_ROLES.has(caller.role) &&
      device.organization_id !== caller.organization?.id
    ) {
      throw new HttpError("Device not found", 404); // deliberately opaque
    }

    return device;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Update device metadata.
   *
   * @param {string} id
   * @param {object} payload
   * @param {{ role, organization }} caller
   * @returns {Promise<object>}
   */
  async updateDevice(id, payload, caller = {}) {
    // Verify ownership first
    await this.getDeviceById(id, caller);

    const validation = validateDevicePayload(payload, { partial: true });
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // Check uniqueness only when serials are being changed
    if (data.rhythmulta_serial) {
      const existing = await this.repository.findByRhythmUltraSerial(data.rhythmulta_serial);
      if (existing && existing.id !== id) {
        throw new HttpError(
          `RhythmUltra serial '${data.rhythmulta_serial}' is already in use`,
          409
        );
      }
    }
    if (data.machine_serial) {
      const existing = await this.repository.findByMachineSerial(data.machine_serial);
      if (existing && existing.id !== id) {
        throw new HttpError(
          `Machine serial '${data.machine_serial}' is already in use`,
          409
        );
      }
    }

    const updated = await this.repository.update(id, data);
    if (!updated) throw new HttpError("Device not found", 404);
    return updated;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Delete a device (SUPER_ADMIN only; enforced via RBAC in routes).
   *
   * @param {string} id
   * @param {{ role, organization }} caller
   */
  async deleteDevice(id, caller = {}) {
    await this.getDeviceById(id, caller); // ownership check

    const deleted = await this.repository.delete(id);
    if (!deleted) throw new HttpError("Device not found", 404);
    return true;
  }

  // ─── Heartbeat ───────────────────────────────────────────────────────────

  /**
   * Process an incoming heartbeat from a device.
   *
   * @param {object} payload – { device_id, app_version?, firmware_version?, status?, ip_address? }
   * @returns {Promise<object>}  The heartbeat record
   */
  async recordHeartbeat(payload) {
    const validation = validateHeartbeatPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const { device_id, app_version, firmware_version, status, ip_address } = validation.data;

    // Ensure the device exists
    const device = await this.repository.findById(device_id);
    if (!device) throw new HttpError("Device not found", 404);

    if (device.status === "RETIRED" || device.status === "SUSPENDED") {
      throw new HttpError(`Device is ${device.status.toLowerCase()} and cannot send heartbeats`, 403);
    }

    return this.repository.recordHeartbeat({
      deviceId:        device_id,
      appVersion:      app_version      ?? null,
      firmwareVersion: firmware_version ?? null,
      status:          status           ?? "ONLINE",
      ipAddress:       ip_address       ?? null,
    });
  }

  // ─── Online / Offline ─────────────────────────────────────────────────────

  /**
   * List online devices.
   * @param {object} query
   * @param {{ role, organization }} caller
   */
  async listOnlineDevices(query = {}, caller = {}) {
    const page   = Math.max(parseInt(query.page,  10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const orgId = _resolveOrgFilter(
      caller.user, caller.role, caller.organization, query.organization_id || null
    );

    return this.repository.findOnline({ organizationId: orgId, limit, offset });
  }

  /**
   * List offline devices.
   * @param {object} query
   * @param {{ role, organization }} caller
   */
  async listOfflineDevices(query = {}, caller = {}) {
    const page   = Math.max(parseInt(query.page,  10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const orgId = _resolveOrgFilter(
      caller.user, caller.role, caller.organization, query.organization_id || null
    );

    return this.repository.findOffline({ organizationId: orgId, limit, offset });
  }

  // ─── History ──────────────────────────────────────────────────────────────

  /**
   * Return paginated heartbeat history for a specific device.
   *
   * @param {string} deviceId
   * @param {object} query
   * @param {{ role, organization }} caller
   */
  async getDeviceHistory(deviceId, query = {}, caller = {}) {
    // Ownership / visibility check
    await this.getDeviceById(deviceId, caller);

    const page   = Math.max(parseInt(query.page,  10) || 1, 1);
    const limit  = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.repository.findHeartbeatHistory(deviceId, { limit, offset }),
      this.repository.countHeartbeatHistory(deviceId),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

function createDeviceService(pool) {
  return new DeviceService(createDeviceRepository(pool));
}

module.exports = { DeviceService, createDeviceService };
