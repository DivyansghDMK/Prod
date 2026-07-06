"use strict";

/**
 * auth.repository.js
 * Low-level DB access for auth tables: otp_codes and user_sessions.
 * Also provides the enriched user query used during token issuance.
 */

const { getPool } = require("../config/db");

class AuthRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  // ─── OTP ────────────────────────────────────────────────────────────────────

  /**
   * Insert a new OTP record.
   * @param {{ phone: string, otp: string, expiresAt: Date }} data
   * @returns {Promise<object>}
   */
  async createOtp({ phone, otp, expiresAt }) {
    const { rows } = await this.db.query(
      `INSERT INTO otp_codes (phone, otp, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [phone, otp, expiresAt]
    );
    return rows[0];
  }

  /**
   * Soft-invalidate all pending (unverified, unexpired) OTPs for a phone
   * by setting expires_at to NOW() so they fail the valid-OTP check.
   * @param {string} phone
   */
  async expireOtpByPhone(phone) {
    await this.db.query(
      `UPDATE otp_codes
       SET    expires_at = NOW()
       WHERE  phone      = $1
         AND  verified   = FALSE
         AND  expires_at > NOW()`,
      [phone]
    );
  }

  /**
   * Find a valid (unexpired, unverified) OTP for the given phone + code.
   * @param {string} phone
   * @param {string} code
   * @returns {Promise<object|null>}
   */
  async findValidOtp(phone, code) {
    const { rows } = await this.db.query(
      `SELECT *
       FROM   otp_codes
       WHERE  phone      = $1
         AND  otp        = $2
         AND  verified   = FALSE
         AND  expires_at > NOW()
       ORDER  BY created_at DESC
       LIMIT  1`,
      [phone, code]
    );
    return rows[0] || null;
  }

  /**
   * Mark an OTP as verified.
   * @param {string} id  OTP row UUID
   */
  async markOtpVerified(id) {
    await this.db.query(
      `UPDATE otp_codes SET verified = TRUE WHERE id = $1`,
      [id]
    );
  }

  // ─── Sessions ───────────────────────────────────────────────────────────────

  /**
   * Insert a new session.
   * @param {{ userId, refreshTokenHash, deviceName, ipAddress }} data
   * @returns {Promise<object>}
   */
  async createSession({ userId, refreshTokenHash, deviceName, ipAddress, expiresAt }) {
    const { rows } = await this.db.query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, device_name, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, refreshTokenHash, deviceName, ipAddress, expiresAt]
    );
    return rows[0];
  }

  /**
   * Purge expired user sessions from database.
   */
  async deleteExpiredSessions() {
    await this.db.query(
      `DELETE FROM user_sessions WHERE expires_at < NOW()`
    );
  }

  /**
   * Find a session by hashed refresh token.
   * @param {string} hash
   * @returns {Promise<object|null>}
   */
  async findSessionByHash(hash) {
    const { rows } = await this.db.query(
      `SELECT * FROM user_sessions WHERE refresh_token_hash = $1`,
      [hash]
    );
    return rows[0] || null;
  }

  /**
   * Update last_seen to NOW() for a session.
   * @param {string} id  Session row UUID
   */
  async touchSession(id) {
    await this.db.query(
      `UPDATE user_sessions SET last_seen = NOW() WHERE id = $1`,
      [id]
    );
  }

  /**
   * Delete a session by its hashed refresh token (single-device logout).
   * @param {string} hash
   */
  async deleteSessionByHash(hash) {
    await this.db.query(
      `DELETE FROM user_sessions WHERE refresh_token_hash = $1`,
      [hash]
    );
  }

  /**
   * Delete all sessions for a user (logout everywhere).
   * @param {string} userId
   */
  async deleteAllSessionsForUser(userId) {
    await this.db.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * List sessions for a user (meta info only — no hashes).
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async findSessionsByUser(userId) {
    const { rows } = await this.db.query(
      `SELECT id, device_name, ip_address, last_seen, created_at
       FROM   user_sessions
       WHERE  user_id = $1
       ORDER  BY last_seen DESC`,
      [userId]
    );
    return rows;
  }

  // ─── Enriched User ──────────────────────────────────────────────────────────

  /**
   * Find a user by their phone number together with their role, organization,
   * and the full set of permissions granted through that role.
   *
   * @param {string} phone
   * @returns {Promise<object|null>}
   */
  async findUserByPhone(phone) {
    const { rows } = await this.db.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.status,
         u.organization_id,
         u.role_id,
         r.name  AS role_name,
         o.id    AS org_id,
         o.name  AS org_name,
         o.type  AS org_type,
         o.status AS org_status
       FROM   users          u
       LEFT JOIN roles        r ON r.id = u.role_id
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE  u.phone = $1
       LIMIT  1`,
      [phone]
    );
    return rows[0] || null;
  }

  /**
   * Find a user by email or phone, returning the password hash and full details.
   * @param {string} identifier - Email or phone
   * @returns {Promise<object|null>}
   */
  async findUserByIdentifier(identifier) {
    const { rows } = await this.db.query(
      `SELECT
         u.*,
         r.name  AS role_name,
         o.id    AS org_id,
         o.name  AS org_name,
         o.type  AS org_type,
         o.status AS org_status
       FROM   users          u
       LEFT JOIN roles        r ON r.id = u.role_id
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE  u.email = $1 OR u.phone = $1
       LIMIT  1`,
      [identifier]
    );
    return rows[0] || null;
  }

  /**
   * Fetch a user by their UUID, enriched with role and organization.
   *
   * @param {string} id  User UUID
   * @returns {Promise<object|null>}
   */
  async findUserById(id) {
    const { rows } = await this.db.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.status,
         u.organization_id,
         u.role_id,
         r.name  AS role_name,
         o.id    AS org_id,
         o.name  AS org_name,
         o.type  AS org_type,
         o.status AS org_status
       FROM   users          u
       LEFT JOIN roles        r ON r.id = u.role_id
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE  u.id = $1
       LIMIT  1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Fetch all permission names for a given role UUID.
   *
   * @param {string} roleId
   * @returns {Promise<string[]>}
   */
  async findPermissionsByRoleId(roleId) {
    if (!roleId) return [];
    const { rows } = await this.db.query(
      `SELECT p.name
       FROM   role_permissions rp
       JOIN   permissions      p  ON p.id = rp.permission_id
       WHERE  rp.role_id = $1`,
      [roleId]
    );
    return rows.map((r) => r.name);
  }
}

function createAuthRepository(pool) {
  return new AuthRepository(pool);
}

module.exports = { AuthRepository, createAuthRepository };
