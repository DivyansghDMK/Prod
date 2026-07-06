"use strict";

const VALID_SESSION_STATUSES = ["RECORDING", "PROCESSING", "COMPLETED", "FAILED"];
const VALID_REPORT_TYPES = ["12_LEAD", "HOLTER", "HRV", "HYPERKALEMIA"];

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

function validateSessionPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};
  const data = {
    organization_id: opt(payload.organization_id),
    patient_id: opt(payload.patient_id),
    visit_id: opt(payload.visit_id),
    doctor_id: opt(payload.doctor_id),
    device_id: opt(payload.device_id),
    report_id: opt(payload.report_id),
    session_status: opt(payload.session_status) || "RECORDING",
    report_type: opt(payload.report_type),
    sampling_rate: payload.sampling_rate !== undefined ? parseInt(payload.sampling_rate, 10) : null,
    lead_count: payload.lead_count !== undefined ? parseInt(payload.lead_count, 10) : null,
    duration_seconds: payload.duration_seconds !== undefined ? parseInt(payload.duration_seconds, 10) : null,
    desktop_version: opt(payload.desktop_version),
    firmware_version: opt(payload.firmware_version),
  };

  if (!partial) {
    if (!data.organization_id) {
      errors.organization_id = "organization_id is required";
    } else if (!isUUID(data.organization_id)) {
      errors.organization_id = "organization_id must be a valid UUID";
    }

    if (!data.patient_id) {
      errors.patient_id = "patient_id is required";
    } else if (!isUUID(data.patient_id)) {
      errors.patient_id = "patient_id must be a valid UUID";
    }

    if (!data.report_type) {
      errors.report_type = "report_type is required";
    } else if (!VALID_REPORT_TYPES.includes(data.report_type)) {
      errors.report_type = `report_type must be one of: ${VALID_REPORT_TYPES.join(", ")}`;
    }
  } else {
    if (payload.organization_id !== undefined && data.organization_id && !isUUID(data.organization_id)) {
      errors.organization_id = "organization_id must be a valid UUID";
    }
    if (payload.patient_id !== undefined && data.patient_id && !isUUID(data.patient_id)) {
      errors.patient_id = "patient_id must be a valid UUID";
    }
    if (payload.report_type !== undefined && data.report_type && !VALID_REPORT_TYPES.includes(data.report_type)) {
      errors.report_type = `report_type must be one of: ${VALID_REPORT_TYPES.join(", ")}`;
    }
  }

  if (data.visit_id && !isUUID(data.visit_id)) {
    errors.visit_id = "visit_id must be a valid UUID";
  }
  if (data.doctor_id && !isUUID(data.doctor_id)) {
    errors.doctor_id = "doctor_id must be a valid UUID";
  }
  if (data.device_id && !isUUID(data.device_id)) {
    errors.device_id = "device_id must be a valid UUID";
  }
  if (data.report_id && !isUUID(data.report_id)) {
    errors.report_id = "report_id must be a valid UUID";
  }

  if (payload.session_status !== undefined && data.session_status && !VALID_SESSION_STATUSES.includes(data.session_status)) {
    errors.session_status = `session_status must be one of: ${VALID_SESSION_STATUSES.join(", ")}`;
  }

  if (data.sampling_rate !== null && isNaN(data.sampling_rate)) {
    errors.sampling_rate = "sampling_rate must be a valid integer";
  }
  if (data.lead_count !== null && isNaN(data.lead_count)) {
    errors.lead_count = "lead_count must be a valid integer";
  }
  if (data.duration_seconds !== null && isNaN(data.duration_seconds)) {
    errors.duration_seconds = "duration_seconds must be a valid integer";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

module.exports = {
  validateSessionPayload,
  VALID_SESSION_STATUSES,
  VALID_REPORT_TYPES,
};
