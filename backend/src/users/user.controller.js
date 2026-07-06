const { HttpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");
const { createUserService } = require("./user.service");
const { createUserRepository } = require("./user.repository");
const { createRoleRepository } = require("../roles/role.repository");

function getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createUserService(createUserRepository(pool), createRoleRepository(pool));
}

function _caller(req) {
  return {
    user: req.user,
    organization: req.organization,
    role: req.role,
    permissions: req.permissions || [],
  };
}

const createUser = asyncHandler(async (req, res) => {
  const service = getService(req);
  const user = await service.createUser(req.body || {}, _caller(req));
  res.status(201).json({ message: "User created successfully", data: user });
});

const listUsers = asyncHandler(async (req, res) => {
  const service = getService(req);
  const result = await service.listUsers(req.query || {}, _caller(req));
  res.json({ message: "Users fetched successfully", ...result });
});

const getUserById = asyncHandler(async (req, res) => {
  const service = getService(req);
  const user = await service.getUserById(req.params.id, _caller(req));
  res.json({ message: "User fetched successfully", data: user });
});

const updateUser = asyncHandler(async (req, res) => {
  const service = getService(req);
  const user = await service.updateUser(req.params.id, req.body || {}, _caller(req));
  res.json({ message: "User updated successfully", data: user });
});

const deleteUser = asyncHandler(async (req, res) => {
  const service = getService(req);
  await service.deleteUser(req.params.id, _caller(req));
  res.status(204).send();
});

const userErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message, errors: err.details || undefined });
  }
  return next(err);
};

module.exports = { createUser, listUsers, getUserById, updateUser, deleteUser, userErrorHandler };

