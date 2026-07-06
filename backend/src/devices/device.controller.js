"use strict";

/**
 * device.controller.js
 * Thin HTTP layer — parses requests, delegates to DeviceService, shapes responses.
 * All business logic and RBAC scoping lives in the service.
 */

const { asyncHandler }       = require("../utils/asyncHandler");
const { HttpError }          = require("../utils/httpError");
const { createDeviceService } = require("./device.service");

// ─── DI helper ───────────────────────────────────────────────────────────────

function _getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createDeviceService(pool);
}

/**
 * Build a caller context object from the authenticated request.
 * The authenticate() middleware populates req.user, req.organization, req.role.
 */
function _caller(req) {
  return {
    user:         req.user         || null,
    role:         req.role         || null,
    organization: req.organization || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /devices/register
// Body: { organization_id?, rhythmulta_serial, machine_serial, ... }
// ─────────────────────────────────────────────────────────────────────────────
const registerDevice = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const device  = await service.registerDevice(req.body || {}, _caller(req));
  res.status(201).json({
    message: "Device registered successfully",
    data:    device,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devices
// Query: page, limit, search, status, activation_status, organization_id
// ─────────────────────────────────────────────────────────────────────────────
const listDevices = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result  = await service.listDevices(req.query || {}, _caller(req));
  res.json({
    message: "Devices fetched successfully",
    ...result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devices/online
// ─────────────────────────────────────────────────────────────────────────────
const listOnlineDevices = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const data    = await service.listOnlineDevices(req.query || {}, _caller(req));
  res.json({
    message: "Online devices fetched successfully",
    data,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devices/offline
// ─────────────────────────────────────────────────────────────────────────────
const listOfflineDevices = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const data    = await service.listOfflineDevices(req.query || {}, _caller(req));
  res.json({
    message: "Offline devices fetched successfully",
    data,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devices/:id
// ─────────────────────────────────────────────────────────────────────────────
const getDeviceById = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const device  = await service.getDeviceById(req.params.id, _caller(req));
  res.json({
    message: "Device fetched successfully",
    data:    device,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devices/:id/history
// Query: page, limit
// ─────────────────────────────────────────────────────────────────────────────
const getDeviceHistory = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result  = await service.getDeviceHistory(
    req.params.id,
    req.query || {},
    _caller(req)
  );
  res.json({
    message: "Device heartbeat history fetched successfully",
    ...result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /devices/:id
// Body: partial device fields
// ─────────────────────────────────────────────────────────────────────────────
const updateDevice = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const device  = await service.updateDevice(req.params.id, req.body || {}, _caller(req));
  res.json({
    message: "Device updated successfully",
    data:    device,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /devices/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteDevice = asyncHandler(async (req, res) => {
  const service = _getService(req);
  await service.deleteDevice(req.params.id, _caller(req));
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /devices/heartbeat
// Body: { device_id, app_version?, firmware_version?, status?, ip_address? }
// ─────────────────────────────────────────────────────────────────────────────
const recordHeartbeat = asyncHandler(async (req, res) => {
  const service    = _getService(req);
  const heartbeat  = await service.recordHeartbeat(req.body || {});
  res.status(201).json({
    message: "Heartbeat recorded successfully",
    data:    heartbeat,
  });
});

// ─── Module-scoped error handler ─────────────────────────────────────────────
const deviceErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }
  return next(err);
};

module.exports = {
  registerDevice,
  listDevices,
  listOnlineDevices,
  listOfflineDevices,
  getDeviceById,
  getDeviceHistory,
  updateDevice,
  deleteDevice,
  recordHeartbeat,
  deviceErrorHandler,
};
