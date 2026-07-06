const VALID_USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "INVITED"];

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateUserPayload(payload, { partial = false } = {}) {
  const errors = {};
  const data = {
    organization_id: normalizeString(payload.organization_id),
    full_name: normalizeString(payload.full_name),
    email: normalizeString(payload.email),
    phone: normalizeString(payload.phone),
    role_id: normalizeString(payload.role_id),
    password_hash: payload.password_hash === undefined ? undefined : normalizeString(payload.password_hash),
    status: normalizeString(payload.status),
  };

  if (!partial || payload.organization_id !== undefined) {
    if (!data.organization_id) errors.organization_id = "Organization ID is required";
  }

  if (!partial || payload.full_name !== undefined) {
    if (!data.full_name) errors.full_name = "Full name is required";
  }

  if (!partial || payload.role_id !== undefined) {
    if (!data.role_id) errors.role_id = "Role ID is required";
  }

  if (!partial || payload.status !== undefined) {
    if (data.status && !VALID_USER_STATUSES.includes(data.status)) {
      errors.status = "Status must be ACTIVE, INACTIVE, SUSPENDED, or INVITED";
    }
  }

  if (!partial && payload.password_hash === undefined) {
    data.password_hash = null;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

module.exports = { validateUserPayload, VALID_USER_STATUSES };

