const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { createPermissionService } = require("./permission.service");
const { createPermissionRepository } = require("./permission.repository");
const { createRoleRepository } = require("../roles/role.repository");

function getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createPermissionService(createPermissionRepository(pool), createRoleRepository(pool));
}

const createPermission = asyncHandler(async (req, res) => {
  const service = getService(req);
  const permission = await service.createPermission(req.body || {});
  res.status(201).json({ message: "Permission created successfully", data: permission });
});

const listPermissions = asyncHandler(async (req, res) => {
  const service = getService(req);
  const result = await service.listPermissions(req.query || {});
  res.json({ message: "Permissions fetched successfully", ...result });
});

const getPermissionById = asyncHandler(async (req, res) => {
  const service = getService(req);
  const permission = await service.getPermissionById(req.params.id);
  res.json({ message: "Permission fetched successfully", data: permission });
});

const updatePermission = asyncHandler(async (req, res) => {
  const service = getService(req);
  const permission = await service.updatePermission(req.params.id, req.body || {});
  res.json({ message: "Permission updated successfully", data: permission });
});

const deletePermission = asyncHandler(async (req, res) => {
  const service = getService(req);
  await service.deletePermission(req.params.id);
  res.status(204).send();
});

const listPermissionsByRole = asyncHandler(async (req, res) => {
  const service = getService(req);
  const permissions = await service.listPermissionsByRole(req.params.roleId);
  res.json({ message: "Role permissions fetched successfully", data: permissions });
});

const setRolePermissions = asyncHandler(async (req, res) => {
  const service = getService(req);
  const permissions = await service.setRolePermissions(req.body || {});
  res.json({ message: "Role permissions updated successfully", data: permissions });
});

const permissionErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message, errors: err.details || undefined });
  }
  return next(err);
};

module.exports = {
  createPermission,
  listPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
  listPermissionsByRole,
  setRolePermissions,
  permissionErrorHandler,
};

