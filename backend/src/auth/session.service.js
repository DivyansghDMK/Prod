"use strict";

/**
 * session.service.js
 * Manages user sessions backed by the user_sessions table.
 *
 * Each session stores a sha-256 hash of the refresh token — the raw token
 * is returned to the client once and never stored in plain-text.
 */

const { HttpError } = require("../utils/httpError");
const { generateRefreshToken, hashRefreshToken } = require("./jwt.service");

class SessionService {
  /**
   * @param {import('./auth.repository').AuthRepository} authRepository
   */
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  /**
   * Create a new session, return the raw (unhashed) refresh token.
   *
   * @param {{
   *   userId:     string,
   *   deviceName: string|undefined,
   *   ipAddress:  string|undefined
   * }} opts
   * @returns {Promise<{ refreshToken: string, session: object }>}
   */
  async createSession({ userId, deviceName, ipAddress }) {
    const rawToken = generateRefreshToken();
    const hash     = hashRefreshToken(rawToken);

    // Default to 7 days session expiration
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session  = await this.authRepository.createSession({
      userId,
      refreshTokenHash: hash,
      deviceName: deviceName || null,
      ipAddress:  ipAddress  || null,
      expiresAt,
    });

    return { refreshToken: rawToken, session };
  }

  /**
   * Validate a refresh token string.
   * Updates last_seen on success.
   *
   * @param {string} rawToken
   * @returns {Promise<object>}  The session row including user_id
   */
  async validateRefreshToken(rawToken) {
    const hash    = hashRefreshToken(rawToken);
    const session = await this.authRepository.findSessionByHash(hash);

    if (!session) {
      throw new HttpError("Refresh token is invalid or has been revoked", 401);
    }

    // Reject expired refresh tokens
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      // Auto-revoke expired session record
      await this.revokeSession(rawToken);
      throw new HttpError("Refresh token has expired", 401);
    }

    // Touch last_seen
    await this.authRepository.touchSession(session.id);

    return session;
  }

  /**
   * Clear expired sessions in repository context.
   */
  async cleanupExpiredSessions() {
    await this.authRepository.deleteExpiredSessions();
  }

  /**
   * Revoke a single session by its raw refresh token.
   *
   * @param {string} rawToken
   * @returns {Promise<void>}
   */
  async revokeSession(rawToken) {
    const hash = hashRefreshToken(rawToken);
    await this.authRepository.deleteSessionByHash(hash);
  }

  /**
   * Revoke all sessions for a user (logout everywhere).
   *
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async revokeAllSessions(userId) {
    await this.authRepository.deleteAllSessionsForUser(userId);
  }

  /**
   * List active sessions for a user.
   *
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  async listSessions(userId) {
    return this.authRepository.findSessionsByUser(userId);
  }
}

function createSessionService(authRepository) {
  return new SessionService(authRepository);
}

module.exports = { SessionService, createSessionService };
