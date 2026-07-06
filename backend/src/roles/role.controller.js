const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRoleService } = require("./role.service");
const { createRoleRepository } = require("./role.repository");
const { createPermissionRepository } = require("../permissions/permission.repository");

function getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createRoleService(createRoleRepository(pool), createPermissionRepository(pool));
}

const createRole = asyncHandler(async (req, res) => {
  const service = getService(req);
  const role = await service.createRole(req.body || {});
  res.status(201).json({ message: "Role created successfully", data: role });
});

const listRoles = asyncHandler(async (req, res) => {
  const service = getService(req);
  const result = await service.listRoles(req.query || {});
  res.json({ message: "Roles fetched successfully", ...result });
});

const getRoleById = asyncHandler(async (req, res) => {
  const service = getService(req);
  const role = await service.getRoleById(req.params.id);
  res.json({ message: "Role fetched successfully", data: role });
});

const updateRole = asyncHandler(async (req, res) => {
  const service = getService(req);
  const role = await service.updateRole(req.params.id, req.body || {});
  res.json({ message: "Role updated successfully", data: role });
});

const deleteRole = asyncHandler(async (req, res) => {
  const service = getService(req);
  await service.deleteRole(req.params.id);
  res.status(204).send();
});

const roleErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message, errors: err.details || undefined });
  }
  return next(err);
};

module.exports = { createRole, listRoles, getRoleById, updateRole, deleteRole, roleErrorHandler };

