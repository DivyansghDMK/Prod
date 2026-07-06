const { AppError } = require("../utils/AppError");
const { asyncHandler } = require("../utils/asyncHandler");
const { createOrganizationService } = require("./organization.service");
const { createOrganizationRepository } = require("./organization.repository");

function getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createOrganizationService(createOrganizationRepository(pool));
}

const createOrganization = asyncHandler(async (req, res) => {
  const service = getService(req);
  const organization = await service.createOrganization(req.body || {});
  res.status(201).json({
    message: "Organization created successfully",
    data: organization,
  });
});

const listOrganizations = asyncHandler(async (req, res) => {
  const service = getService(req);
  const result = await service.listOrganizations(req.query || {});
  res.json({
    message: "Organizations fetched successfully",
    ...result,
  });
});

const getOrganizationById = asyncHandler(async (req, res) => {
  const service = getService(req);
  const organization = await service.getOrganizationById(req.params.id);
  res.json({
    message: "Organization fetched successfully",
    data: organization,
  });
});

const updateOrganization = asyncHandler(async (req, res) => {
  const service = getService(req);
  const organization = await service.updateOrganization(req.params.id, req.body || {});
  res.json({
    message: "Organization updated successfully",
    data: organization,
  });
});

const deleteOrganization = asyncHandler(async (req, res) => {
  const service = getService(req);
  await service.deleteOrganization(req.params.id);
  res.status(204).send();
});

const organizationErrorHandler = (err, _req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      errors: err.details || undefined,
    });
  }
  return next(err);
};

module.exports = {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  organizationErrorHandler,
};
