"use strict";

/**
 * jwt.service.js
 * Handles JWT access-token generation and verification.
 *
 * Expected env vars:
 *   JWT_SECRET            – signing secret (required)
 *   JWT_ACCESS_EXPIRES_IN – e.g. "15m"  (default: 15m)
 *   JWT_REFRESH_EXPIRES_IN– e.g. "7d"   (default: 7d)
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { HttpError } = require("../utils/httpError");

const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function _secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

/**
 * Sign an access token containing a minimal payload.
 * @param {{ userId, organizationId, role, permissions }} payload
 * @returns {string}
 */
function signAccessToken(payload) {
  return jwt.sign(
    {
      sub:            payload.userId,
      organizationId: payload.organizationId,
      role:           payload.role,
      permissions:    payload.permissions ?? [],
    },
    _secret(),
    { expiresIn: ACCESS_EXPIRES, algorithm: "HS256" }
  );
}

/**
 * Verify and decode an access token.
 * Throws HttpError 401 on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, _secret(), { algorithms: ["HS256"] });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new HttpError("Access token expired", 401);
    }
    throw new HttpError("Invalid access token", 401);
  }
}

/**
 * Generate a cryptographically secure refresh token (opaque string).
 * @returns {string} 64-byte hex string
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Hash a refresh token before storing it in the DB.
 * @param {string} token
 * @returns {string} sha-256 hex hash
 */
function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken };
