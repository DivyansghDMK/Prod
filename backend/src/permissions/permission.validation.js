function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePermissionPayload(payload, { partial = false } = {}) {
  const errors = {};
  const data = {
    name: normalizeString(payload.name),
    description: normalizeString(payload.description),
  };

  if (!partial || payload.name !== undefined) {
    if (!data.name) errors.name = "Permission name is required";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

function validateRolePermissionsPayload(payload) {
  const errors = {};
  const role_id = typeof payload.role_id === "string" ? payload.role_id.trim() : "";
  const permission_ids = Array.isArray(payload.permission_ids)
    ? payload.permission_ids.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (!role_id) errors.role_id = "Role ID is required";
  if (permission_ids.length === 0) errors.permission_ids = "At least one permission ID is required";

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, data: { role_id, permission_ids } };
}

module.exports = { validatePermissionPayload, validateRolePermissionsPayload };

