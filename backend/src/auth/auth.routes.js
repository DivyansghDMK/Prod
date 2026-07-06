"use strict";

/**
 * auth.routes.js
 * Express router for the /auth namespace.
 *
 * Public routes (no JWT required):
 *   POST /auth/send-otp
 *   POST /auth/verify-otp
 *   POST /auth/refresh
 *
 * Protected routes (JWT required via authenticate middleware):
 *   POST /auth/logout
 *   GET  /auth/me
 */

const router = require("express").Router();

const { authenticate } = require("../middleware/auth");
const {
  sendOtp,
  verifyOtp,
  refresh,
  logout,
  getMe,
  login,
  register,
  authErrorHandler,
} = require("./auth.controller");

// ── Public ───────────────────────────────────────────────────────────────────
router.post("/send-otp",   sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh",    refresh);
router.post("/login",      login);
router.post("/register",   register);

// ── Protected ─────────────────────────────────────────────────────────────────
router.post("/logout", authenticate, logout);
router.get("/me",      authenticate, getMe);

// ── Module-scoped error handler ───────────────────────────────────────────────
router.use(authErrorHandler);

module.exports = router;
