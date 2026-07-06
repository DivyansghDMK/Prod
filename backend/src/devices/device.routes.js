"use strict";

/**
 * device.routes.js
 * Express router for the /devices namespace.
 *
 * RBAC matrix:
 * ─────────────────────────────────────────────────────
 *  Route                      Permission required
 * ─────────────────────────────────────────────────────
 *  POST   /register           device:create
 *  GET    /                   device:view
 *  GET    /online             device:view
 *  GET    /offline            device:view
 *  GET    /:id                device:view
 *  GET    /:id/history        device:view
 *  PUT    /:id                device:update
 *  DELETE /:id                device:delete
 *  POST   /heartbeat          device:heartbeat
 * ─────────────────────────────────────────────────────
 *
 * All routes require a valid JWT via authenticate().
 * Specific permissions are enforced by authorize().
 *
 * NOTE: Static paths (/online, /offline, /register, /heartbeat)
 * are declared BEFORE the /:id parameterised routes to avoid
 * Express matching "online" as a device UUID.
 */

const router = require("express").Router();

const { authenticate }  = require("../middleware/auth");
const { authorize }     = require("../middleware/roles");

const {
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
} = require("./device.controller");

// ── All device routes require authentication ──────────────────────────────
router.use(authenticate);

// ── Static routes (must come before /:id) ─────────────────────────────────

// Register a new device
router.post(
  "/register",
  authorize("device:create"),
  registerDevice
);

// Heartbeat endpoint — typically called by the device itself
// Permission: device:heartbeat (granted to SUPER_ADMIN and HCP_ADMIN)
router.post(
  "/heartbeat",
  authorize("device:heartbeat"),
  recordHeartbeat
);

// Online devices list
router.get(
  "/online",
  authorize("device:view"),
  listOnlineDevices
);

// Offline devices list
router.get(
  "/offline",
  authorize("device:view"),
  listOfflineDevices
);

// ── Collection route ───────────────────────────────────────────────────────
router.get(
  "/",
  authorize("device:view"),
  listDevices
);

// ── Per-device routes ──────────────────────────────────────────────────────

// Heartbeat history for a specific device
router.get(
  "/:id/history",
  authorize("device:view"),
  getDeviceHistory
);

router.get(
  "/:id",
  authorize("device:view"),
  getDeviceById
);

router.put(
  "/:id",
  authorize("device:update"),
  updateDevice
);

router.delete(
  "/:id",
  authorize("device:delete"),
  deleteDevice
);

// ── Module-scoped error handler ────────────────────────────────────────────
router.use(deviceErrorHandler);

module.exports = router;
