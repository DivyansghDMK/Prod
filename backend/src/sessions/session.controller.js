"use strict";

const { asyncHandler } = require("../utils/asyncHandler");
const { recordingSessionService } = require("./session.service");

function _getPool(req) {
  return req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
}

const startSession = asyncHandler(async (req, res) => {
  const result = await recordingSessionService.startSession(req.body || {}, _getPool(req));
  res.status(201).json(result);
});

const uploadMetrics = asyncHandler(async (req, res) => {
  const result = await recordingSessionService.uploadMetrics(req.params.id, req.body || {}, _getPool(req));
  res.json(result);
});

const uploadWaveform = asyncHandler(async (req, res) => {
  const result = await recordingSessionService.uploadWaveform(req.params.id, req.body || {}, _getPool(req));
  res.json(result);
});

const endSession = asyncHandler(async (req, res) => {
  const result = await recordingSessionService.endSession(req.params.id, req.body || {}, _getPool(req));
  res.json(result);
});

module.exports = {
  startSession,
  uploadMetrics,
  uploadWaveform,
  endSession,
};
