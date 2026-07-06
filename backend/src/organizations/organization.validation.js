const VALID_ORGANIZATION_TYPES = ["HCP", "DOCTOR"];
const VALID_ORGANIZATION_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateOrganizationPayload(payload, { partial = false } = {}) {
  const errors = {};
  const data = {
    name: normalizeString(payload.name),
    type: normalizeString(payload.type),
    address: normalizeString(payload.address),
    phone: normalizeString(payload.phone),
    email: normalizeString(payload.email),
    gst: normalizeString(payload.gst),
    license_number: normalizeString(payload.license_number),
    status: normalizeString(payload.status),
    created_by: normalizeString(payload.created_by),
  };

  if (!partial || payload.name !== undefined) {
    if (!data.name) errors.name = "Organization name is required";
  }

  if (!partial || payload.type !== undefined) {
    if (!VALID_ORGANIZATION_TYPES.includes(data.type)) {
      errors.type = "Organization type must be HCP or DOCTOR";
    }
  }

  if (!partial || payload.status !== undefined) {
    if (data.status && !VALID_ORGANIZATION_STATUSES.includes(data.status)) {
      errors.status = "Status must be ACTIVE, INACTIVE, or SUSPENDED";
    }
  }

  if (!partial && payload.address === undefined) {
    data.address = "";
  }

  if (!partial && payload.phone === undefined) {
    data.phone = "";
  }

  if (!partial && payload.email === undefined) {
    data.email = "";
  }

  if (!partial && payload.gst === undefined) {
    data.gst = "";
  }

  if (!partial && payload.license_number === undefined) {
    data.license_number = "";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}

module.exports = {
  validateOrganizationPayload,
  VALID_ORGANIZATION_TYPES,
  VALID_ORGANIZATION_STATUSES,
};

