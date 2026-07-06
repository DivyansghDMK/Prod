function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateRolePayload(payload, { partial = false } = {}) {
  const errors = {};
  const data = {
    name: normalizeString(payload.name),
    description: normalizeString(payload.description),
  };

  if (!partial || payload.name !== undefined) {
    if (!data.name) errors.name = "Role name is required";
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

module.exports = { validateRolePayload };

