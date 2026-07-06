"use strict";

const VALID_SYNC_STATUSES = ["PENDING", "UPLOADING", "COMPLETE", "FAILED"];

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function opt(v) {
  const s = str(v);
  return s || null;
}

function isUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
}

function validateLoginPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};
  const data = {
    identifier: opt(payload.identifier),
    password: opt(payload.password),
  };

  if (!data.identifier) {
    errors.identifier = "identifier (email or phone) is required";
  }
  if (!data.password) {
    errors.password = "password is required";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

function validateHeartbeatPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};
  const data = {
    device_serial: opt(payload.device_serial),
    app_version: opt(payload.app_version),
    firmware_version: opt(payload.firmware_version),
    sync_status: opt(payload.sync_status),
  };

  if (!data.device_serial) {
    errors.device_serial = "device_serial is required";
  }

  if (data.sync_status && !VALID_SYNC_STATUSES.includes(data.sync_status)) {
    errors.sync_status = `sync_status must be one of: ${VALID_SYNC_STATUSES.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

function validateSyncPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};
  const data = {
    organization_id: opt(payload.organization_id),
    device_id: opt(payload.device_id),
    session_id: opt(payload.session_id),
    sync_status: opt(payload.sync_status) || "PENDING",
  };

  if (!data.organization_id) {
    errors.organization_id = "organization_id is required";
  } else if (!isUUID(data.organization_id)) {
    errors.organization_id = "organization_id must be a valid UUID";
  }

  if (data.device_id && !isUUID(data.device_id)) {
    errors.device_id = "device_id must be a valid UUID";
  }
  if (data.session_id && !isUUID(data.session_id)) {
    errors.session_id = "session_id must be a valid UUID";
  }

  if (data.sync_status && !VALID_SYNC_STATUSES.includes(data.sync_status)) {
    errors.sync_status = `sync_status must be one of: ${VALID_SYNC_STATUSES.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

module.exports = {
  validateLoginPayload,
  validateHeartbeatPayload,
  validateSyncPayload,
  VALID_SYNC_STATUSES,
};
