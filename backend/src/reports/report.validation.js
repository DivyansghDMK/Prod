"use strict";

const VALID_REPORT_TYPES = ["12_LEAD", "HOLTER", "HRV", "HYPERKALEMIA"];
const VALID_REPORT_STATUSES = ["GENERATING", "GENERATED", "REVIEW_PENDING", "APPROVED", "REJECTED"];
const VALID_REVIEW_DECISIONS = ["APPROVED", "REJECTED", "NEEDS_REVISION"];
const VALID_FILE_TYPES = ["PDF", "JSON", "WAVEFORM", "THUMBNAIL", "OTHER"];

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

function validateReportPayload(payload, { partial = false } = {}) {
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
    report_type: opt(payload.report_type),
    report_status: opt(payload.report_status) || "GENERATING",
    pdf_s3_key: opt(payload.pdf_s3_key),
    json_s3_key: opt(payload.json_s3_key),
    waveform_s3_key: opt(payload.waveform_s3_key),
    thumbnail_s3_key: opt(payload.thumbnail_s3_key),
    ai_summary: opt(payload.ai_summary),
    ai_confidence: payload.ai_confidence !== undefined ? parseFloat(payload.ai_confidence) : null,
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

  if (payload.report_status !== undefined && data.report_status && !VALID_REPORT_STATUSES.includes(data.report_status)) {
    errors.report_status = `report_status must be one of: ${VALID_REPORT_STATUSES.join(", ")}`;
  }

  if (data.ai_confidence !== null && (isNaN(data.ai_confidence) || data.ai_confidence < 0 || data.ai_confidence > 1)) {
    errors.ai_confidence = "ai_confidence must be a number between 0.0 and 1.0";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

function validateReportReviewPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};
  const data = {
    decision: opt(payload.decision),
    comments: opt(payload.comments),
  };

  if (!data.decision) {
    errors.decision = "decision is required";
  } else if (!VALID_REVIEW_DECISIONS.includes(data.decision)) {
    errors.decision = `decision must be one of: ${VALID_REVIEW_DECISIONS.join(", ")}`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

function validateReportUploadPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: { _: "Request body must be a JSON object" } };
  }

  const errors = {};
  
  // Standard report details validation
  const reportValidation = validateReportPayload(payload);
  if (!reportValidation.ok) {
    return reportValidation;
  }

  const data = {
    ...reportValidation.data,
    files: Array.isArray(payload.files) ? payload.files : [],
  };

  const fileErrors = [];
  data.files = data.files.map((file, index) => {
    const fileData = {
      file_type: opt(file.file_type),
      s3_key: opt(file.s3_key),
      file_size: file.file_size ? parseInt(file.file_size, 10) : null,
      checksum: opt(file.checksum),
    };

    const itemErrors = {};
    if (!fileData.file_type) {
      itemErrors.file_type = "file_type is required";
    } else if (!VALID_FILE_TYPES.includes(fileData.file_type)) {
      itemErrors.file_type = `file_type must be one of: ${VALID_FILE_TYPES.join(", ")}`;
    }

    if (!fileData.s3_key) {
      itemErrors.s3_key = "s3_key is required";
    }

    if (fileData.file_size !== null && isNaN(fileData.file_size)) {
      itemErrors.file_size = "file_size must be a valid integer";
    }

    if (Object.keys(itemErrors).length > 0) {
      fileErrors[index] = itemErrors;
    }

    return fileData;
  });

  if (fileErrors.length > 0) {
    errors.files = fileErrors;
    return { ok: false, errors };
  }

  return { ok: true, data };
}

function parseReportQuery(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    organization_id: opt(query.organization_id) || null,
    patient_id: opt(query.patient_id) || null,
    doctor_id: opt(query.doctor_id) || null,
    device_id: opt(query.device_id) || null,
    visit_id: opt(query.visit_id) || null,
    report_type: opt(query.report_type) || null,
    report_status: opt(query.report_status) || null,
    date_from: opt(query.date_from) || null,
    date_to: opt(query.date_to) || null,
    search: opt(query.search) || null,
  };
}

module.exports = {
  validateReportPayload,
  validateReportReviewPayload,
  validateReportUploadPayload,
  parseReportQuery,
  VALID_REPORT_TYPES,
  VALID_REPORT_STATUSES,
  VALID_REVIEW_DECISIONS,
  VALID_FILE_TYPES,
};
