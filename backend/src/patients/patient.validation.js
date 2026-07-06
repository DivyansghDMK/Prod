"use strict";

/**
 * patient.validation.js
 * Pure validation functions for Patient and PatientVisit payloads.
 * No side effects — always returns { ok, data } or { ok: false, errors }.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_GENDERS = ["MALE", "FEMALE", "OTHER", "UNKNOWN"];

const VALID_BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN",
];

const VALID_VISIT_TYPES = [
  "CONSULTATION",
  "FOLLOW_UP",
  "ECG",
  "HOLTER",
  "EMERGENCY",
  "TELECONSULT",
  "OTHER",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function isValidDate(v) {
  if (!v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v) {
  // Allow +, digits, spaces, dashes, parentheses — at least 7 chars
  return /^\+?[\d\s\-().]{7,20}$/.test(v);
}

// ─── Patient payload ─────────────────────────────────────────────────────────

/**
 * Validate a patient create or update payload.
 *
 * @param {object} payload
 * @param {{ partial?: boolean }} opts
 * @returns {{ ok: boolean, data?: object, errors?: object }}
 */
function validatePatientPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};

  const data = {
    // Identifiers
    organization_id: opt(payload.organization_id),
    patient_id:      opt(payload.patient_id),       // MRN — optional

    // Name
    first_name: opt(payload.first_name),
    last_name:  opt(payload.last_name),

    // Demographics
    gender:        opt(payload.gender)        || "UNKNOWN",
    date_of_birth: opt(payload.date_of_birth) || null,
    blood_group:   opt(payload.blood_group)   || null,

    // Contact
    phone: opt(payload.phone),
    email: opt(payload.email),

    // Address & notes
    address: opt(payload.address),
    notes:   opt(payload.notes),

    // Emergency contact — accepts { name, phone, relationship }
    emergency_contact: payload.emergency_contact || null,
  };

  // ── Required on CREATE ──────────────────────────────────────────────────────
  if (!partial) {
    if (!data.organization_id) {
      errors.organization_id = "organization_id is required";
    } else if (!isUUID(data.organization_id)) {
      errors.organization_id = "organization_id must be a valid UUID";
    }

    if (!data.first_name) {
      errors.first_name = "first_name is required";
    }
  }

  // ── Conditional validations (create AND update) ───────────────────────────

  if (partial && data.organization_id && !isUUID(data.organization_id)) {
    errors.organization_id = "organization_id must be a valid UUID";
  }

  if (data.gender && !VALID_GENDERS.includes(data.gender)) {
    errors.gender = `gender must be one of: ${VALID_GENDERS.join(", ")}`;
  }

  if (data.blood_group && !VALID_BLOOD_GROUPS.includes(data.blood_group)) {
    errors.blood_group = `blood_group must be one of: ${VALID_BLOOD_GROUPS.join(", ")}`;
  }

  if (data.date_of_birth && !isValidDate(data.date_of_birth)) {
    errors.date_of_birth = "date_of_birth must be a valid ISO date (YYYY-MM-DD)";
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = "email must be a valid email address";
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = "phone must be a valid phone number";
  }

  // Emergency contact structure check
  if (
    data.emergency_contact !== null &&
    typeof data.emergency_contact !== "object"
  ) {
    errors.emergency_contact = "emergency_contact must be an object { name, phone, relationship }";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

// ─── Patient Visit payload ────────────────────────────────────────────────────

/**
 * Validate a patient visit creation payload.
 *
 * @param {object} payload
 * @returns {{ ok: boolean, data?: object, errors?: object }}
 */
function validateVisitPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};

  const data = {
    organization_id: opt(payload.organization_id),
    doctor_id:       opt(payload.doctor_id)   || null,
    device_id:       opt(payload.device_id)   || null,
    visit_type:      opt(payload.visit_type)  || "CONSULTATION",
    visit_date:      opt(payload.visit_date)  || null,   // defaults to NOW() in DB
    symptoms:        opt(payload.symptoms),
    diagnosis:       opt(payload.diagnosis),
    notes:           opt(payload.notes),
  };

  if (!data.organization_id) {
    errors.organization_id = "organization_id is required";
  } else if (!isUUID(data.organization_id)) {
    errors.organization_id = "organization_id must be a valid UUID";
  }

  if (data.doctor_id && !isUUID(data.doctor_id)) {
    errors.doctor_id = "doctor_id must be a valid UUID";
  }

  if (data.device_id && !isUUID(data.device_id)) {
    errors.device_id = "device_id must be a valid UUID";
  }

  if (!VALID_VISIT_TYPES.includes(data.visit_type)) {
    errors.visit_type = `visit_type must be one of: ${VALID_VISIT_TYPES.join(", ")}`;
  }

  if (data.visit_date && !isValidDate(data.visit_date)) {
    errors.visit_date = "visit_date must be a valid ISO date/datetime";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

// ─── Search/filter query params ───────────────────────────────────────────────

/**
 * Parse and sanitize patient list / search query params.
 *
 * @param {object} query  – raw req.query
 * @returns {{ page, limit, offset, search, phone, mrn, gender, dateFrom, dateTo, organizationId }}
 */
function parsePatientQuery(query = {}) {
  const page   = Math.max(parseInt(query.page,  10) || 1, 1);
  const limit  = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    search:         opt(query.search)          || null,   // name full-text
    phone:          opt(query.phone)           || null,
    mrn:            opt(query.mrn)             || null,   // patient_id field
    gender:         opt(query.gender)          || null,
    dateFrom:       opt(query.date_from)       || null,
    dateTo:         opt(query.date_to)         || null,
    organizationId: opt(query.organization_id) || null,
  };
}

module.exports = {
  validatePatientPayload,
  validateVisitPayload,
  parsePatientQuery,
  VALID_GENDERS,
  VALID_BLOOD_GROUPS,
  VALID_VISIT_TYPES,
};
