"use strict";

/**
 * auth.controller.js
 * Thin HTTP layer that delegates to AuthService.
 * Handles request parsing, response shaping, and auth-specific error mapping.
 */

const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError }    = require("../utils/httpError");
const { createAuthService } = require("./auth.service");

// ─── Helper: resolve the db pool from the Express app ───────────────────────
function _getService(req) {
  const pool = req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
  return createAuthService(pool);
}

// ─── Helper: extract client IP ──────────────────────────────────────────────
function _getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/send-otp
// Body: { phone }
// ─────────────────────────────────────────────────────────────────────────────
const sendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body || {};
  const service   = _getService(req);
  const result    = await service.sendOtp(phone);
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-otp
// Body: { phone, otp, deviceName? }
// ─────────────────────────────────────────────────────────────────────────────
const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp, deviceName } = req.body || {};

  if (!otp) throw new HttpError("OTP code is required", 400);

  const service = _getService(req);
  const result  = await service.verifyOtp(phone, otp, {
    deviceName: deviceName || req.headers["user-agent"] || "Unknown",
    ipAddress:  _getIp(req),
  });

  res.json({ message: "Authentication successful", ...result });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh
// Body: { refreshToken }
// ─────────────────────────────────────────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const service          = _getService(req);
  const result           = await service.refresh(refreshToken, {
    ipAddress: _getIp(req),
  });

  res.json({ message: "Token refreshed", ...result });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// Headers: Authorization: Bearer <accessToken>
// Body:    { refreshToken? }   — omit to revoke all sessions
// ─────────────────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const userId           = req.user?.id || null;
  const service          = _getService(req);

  await service.logout(refreshToken || null, userId);

  res.json({ message: "Logged out successfully" });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/me
// Requires authenticate() middleware to have populated req.user
// ─────────────────────────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  if (!req.user?.id) throw new HttpError("Not authenticated", 401);

  const service = _getService(req);
  const context = await service.getMe(req.user.id);

  res.json({ message: "User context fetched", ...context });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login (email/password)
// ─────────────────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { identifier, password, deviceName } = req.body || {};
  const service = _getService(req);
  const result = await service.loginWithPassword(identifier, password, {
    deviceName: deviceName || req.headers["user-agent"] || "Desktop Client",
    ipAddress: _getIp(req),
  });
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/register (create user with password)
// ─────────────────────────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const service = _getService(req);
  const result = await service.registerWithPassword(req.body || {});
  res.status(201).json(result);
});

// ─── Auth-specific error handler (mounted after routes) ─────────────────────
const authErrorHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }
  return next(err);
};

module.exports = { sendOtp, verifyOtp, refresh, logout, getMe, login, register, authErrorHandler };
