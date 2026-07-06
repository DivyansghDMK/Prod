"use strict";

/**
 * device.validation.js
 * Pure validation helpers for device payloads.
 * Returns { ok: true, data } on success or { ok: false, errors } on failure.
 */

const VALID_ACTIVATION_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "RETIRED"];
const VALID_DEVICE_STATUSES     = ["ACTIVE", "INACTIVE", "SUSPENDED", "RETIRED"];
const VALID_HEARTBEAT_STATUSES  = ["ONLINE", "DEGRADED", "ERROR"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function isUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─── Device registration / update ────────────────────────────────────────────

/**
 * Validate a device registration or update payload.
 *
 * @param {object} payload
 * @param {{ partial?: boolean }} opts
 * @returns {{ ok: boolean, data?: object, errors?: object }}
 */
function validateDevicePayload(payload, { partial = false } = {}) {
  const errors = {};

  const data = {
    organization_id:   str(payload.organization_id),
    license_id:        str(payload.license_id)        || null,
    rhythmulta_serial: str(payload.rhythmulta_serial),
    machine_serial:    str(payload.machine_serial),
    device_name:       str(payload.device_name)       || null,
    firmware_version:  str(payload.firmware_version)  || null,
    software_version:  str(payload.software_version)  || null,
    hardware_version:  str(payload.hardware_version)  || null,
    activation_status: str(payload.activation_status) || null,
    status:            str(payload.status)             || null,
    ip_address:        str(payload.ip_address)         || null,
    mac_address:       str(payload.mac_address)        || null,
  };

  // Required on create
  if (!partial) {
    if (!data.organization_id) {
      errors.organization_id = "organization_id is required";
    } else if (!isUUID(data.organization_id)) {
      errors.organization_id = "organization_id must be a valid UUID";
    }

    if (!data.rhythmulta_serial) {
      errors.rhythmulta_serial = "rhythmulta_serial is required";
    }

    if (!data.machine_serial) {
      errors.machine_serial = "machine_serial is required";
    }
  }

  // Conditional: validate UUIDs when provided on partial
  if (partial && data.organization_id && !isUUID(data.organization_id)) {
    errors.organization_id = "organization_id must be a valid UUID";
  }

  // activation_status enum check
  if (data.activation_status && !VALID_ACTIVATION_STATUSES.includes(data.activation_status)) {
    errors.activation_status = `activation_status must be one of: ${VALID_ACTIVATION_STATUSES.join(", ")}`;
  }

  // status enum check
  if (data.status && !VALID_DEVICE_STATUSES.includes(data.status)) {
    errors.status = `status must be one of: ${VALID_DEVICE_STATUSES.join(", ")}`;
  }

  // MAC address format (basic)
  if (data.mac_address && !/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(data.mac_address)) {
    errors.mac_address = "mac_address must be a valid MAC address (e.g. AA:BB:CC:DD:EE:FF)";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

/**
 * Validate an incoming heartbeat payload.
 *
 * @param {object} payload
 * @returns {{ ok: boolean, data?: object, errors?: object }}
 */
function validateHeartbeatPayload(payload) {
  const errors = {};

  const data = {
    device_id:        str(payload.device_id),
    app_version:      str(payload.app_version)      || null,
    firmware_version: str(payload.firmware_version) || null,
    status:           str(payload.status)            || "ONLINE",
    ip_address:       str(payload.ip_address)        || null,
  };

  if (!data.device_id) {
    errors.device_id = "device_id is required";
  } else if (!isUUID(data.device_id)) {
    errors.device_id = "device_id must be a valid UUID";
  }

  if (!VALID_HEARTBEAT_STATUSES.includes(data.status)) {
    errors.status = `status must be one of: ${VALID_HEARTBEAT_STATUSES.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

module.exports = {
  validateDevicePayload,
  validateHeartbeatPayload,
  VALID_ACTIVATION_STATUSES,
  VALID_DEVICE_STATUSES,
  VALID_HEARTBEAT_STATUSES,
};
