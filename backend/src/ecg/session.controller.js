"use strict";

const { asyncHandler } = require("../utils/asyncHandler");
const { createSessionService } = require("./session.service");

function _getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createSessionService(pool);
}

function _caller(req) {
  return {
    user: req.user || null,
    role: req.role || null,
    organization: req.organization || null,
  };
}

const startSession = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const session = await service.startSession(req.body || {}, _caller(req));
  res.status(201).json({
    status: "success",
    message: "ECG session started successfully",
    data: session,
  });
});

const updateSession = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const session = await service.updateSession(req.params.id, req.body || {}, _caller(req));
  res.json({
    status: "success",
    message: "ECG session updated successfully",
    data: session,
  });
});

const finishSession = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const session = await service.finishSession(req.params.id, req.body || {}, _caller(req));
  res.json({
    status: "success",
    message: "ECG session finished successfully",
    data: session,
  });
});

const getSessionById = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const session = await service.getSessionById(req.params.id, _caller(req));
  res.json({
    status: "success",
    message: "ECG session fetched successfully",
    data: session,
  });
});

module.exports = {
  startSession,
  updateSession,
  finishSession,
  getSessionById,
};
