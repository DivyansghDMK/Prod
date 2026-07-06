"use strict";

/**
 * middleware/auth.js
 *
 * authenticate()
 * ──────────────
 * Extracts the Bearer JWT from the Authorization header, verifies it, then
 * enriches the request with:
 *
 *   req.user         – { id, fullName, email, phone, status }
 *   req.organization – { id, name, type, status } | null
 *   req.role         – role name string | null
 *   req.permissions  – string[]
 *
 * Throws 401 if no valid token is provided.
 *
 * requireJwt()
 * ────────────
 * Lightweight check: verifies the token exists and is valid but does NOT
 * hydrate the DB-level user context.  Use this only where you need JWT
 * verification without the full user payload (rare).
 */

const { verifyAccessToken } = require("../auth/jwt.service");
const { createAuthRepository } = require("../auth/auth.repository");
const { HttpError } = require("../utils/httpError");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _extractBearer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function _getPool(req) {
  return req.app?.locals?.db?.getPool ? req.app.locals.db.getPool() : null;
}

// ─── authenticate ─────────────────────────────────────────────────────────────

async function authenticate(req, res, next) {
  const token = _extractBearer(req);

  if (!token) {
    return res.status(401).json({ message: "Missing or malformed Bearer token" });
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    // verifyAccessToken already throws HttpError with the right status
    return res.status(err.statusCode || 401).json({ message: err.message });
  }

  try {
    // Re-hydrate from DB so we always have fresh permissions / status
    const repo    = createAuthRepository(_getPool(req));
    const rawUser = await repo.findUserById(decoded.sub);

    if (!rawUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (rawUser.status !== "ACTIVE") {
      return res
        .status(403)
        .json({ message: `Account is ${rawUser.status.toLowerCase()}` });
    }

    const permissions = await repo.findPermissionsByRoleId(rawUser.role_id);

    req.user = {
      id:       rawUser.id,
      fullName: rawUser.full_name,
      email:    rawUser.email,
      phone:    rawUser.phone,
      status:   rawUser.status,
    };

    req.organization = rawUser.org_id
      ? {
          id:     rawUser.org_id,
          name:   rawUser.org_name,
          type:   rawUser.org_type,
          status: rawUser.org_status,
        }
      : null;

    req.role        = rawUser.role_name || null;
    req.permissions = permissions;

    // Keep backward-compat shape used by roles.js middleware
    req.auth = {
      token,
      role:        req.role,
      permissions: req.permissions,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

// ─── requireJwt (lightweight, no DB round-trip) ──────────────────────────────

function requireJwt(req, res, next) {
  const token = _extractBearer(req);

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    const decoded  = verifyAccessToken(token);
    req.auth       = {
      token,
      userId:         decoded.sub,
      organizationId: decoded.organizationId,
      role:           decoded.role,
      permissions:    decoded.permissions || [],
    };
    return next();
  } catch (err) {
    return res.status(err.statusCode || 401).json({ message: err.message });
  }
}

module.exports = { authenticate, requireJwt };
