"use strict";

/**
 * auth.service.js
 * Orchestrates the full authentication flow:
 *   sendOtp   → validates phone, calls OtpService
 *   verifyOtp → validates OTP, loads user + org + role + permissions,
 *               issues access token, creates session, returns full context
 *   refresh   → validates refresh token, issues new access token (+ rotates refresh)
 *   logout    → revokes the current session
 *   getMe     → load fresh user context by userId
 */

const bcrypt = require("bcryptjs");
const { HttpError } = require("../utils/httpError");
const { createAuthRepository }  = require("./auth.repository");
const { createOtpService }      = require("./otp.service");
const { createSessionService }  = require("./session.service");
const { signAccessToken }       = require("./jwt.service");

// ─── Phone validation ────────────────────────────────────────────────────────
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;

function _normalizePhone(raw) {
  const phone = String(raw || "").trim();
  if (!phone) throw new HttpError("Phone number is required", 400);
  if (!PHONE_RE.test(phone)) throw new HttpError("Invalid phone number format", 400);
  return phone;
}

// ─── Build the enriched response context ────────────────────────────────────
async function _buildUserContext(rawUser, authRepository) {
  if (!rawUser) throw new HttpError("User not found", 404);

  if (rawUser.status !== "ACTIVE") {
    throw new HttpError(`Account is ${rawUser.status.toLowerCase()}`, 403);
  }

  const permissions = await authRepository.findPermissionsByRoleId(rawUser.role_id);

  return {
    user: {
      id:        rawUser.id,
      fullName:  rawUser.full_name,
      email:     rawUser.email,
      phone:     rawUser.phone,
      status:    rawUser.status,
    },
    organization: rawUser.org_id
      ? {
          id:     rawUser.org_id,
          name:   rawUser.org_name,
          type:   rawUser.org_type,
          status: rawUser.org_status,
        }
      : null,
    role:        rawUser.role_name || null,
    roleId:      rawUser.role_id   || null,
    permissions,
  };
}

// ─── Service class ───────────────────────────────────────────────────────────

class AuthService {
  constructor(authRepository = createAuthRepository()) {
    this.authRepository = authRepository;
    this.otpService     = createOtpService(authRepository);
    this.sessionService = createSessionService(authRepository);
  }

  // ── Send OTP ───────────────────────────────────────────────────────────────
  /**
   * Validate the phone and dispatch an OTP.
   * Does NOT require the user to already exist (the OTP can be used for
   * invite flows later).  Active-user check happens at verify time.
   *
   * @param {string} phone
   * @returns {Promise<{ message: string, expiresAt: Date }>}
   */
  async sendOtp(phone) {
    const normalized = _normalizePhone(phone);
    const { expiresAt } = await this.otpService.sendOtp(normalized);
    return {
      message:   "OTP sent successfully",
      expiresAt,
    };
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  /**
   * Verify the OTP, load the user's full context, issue tokens.
   *
   * @param {string} phone
   * @param {string} code
   * @param {{ deviceName?: string, ipAddress?: string }} meta
   * @returns {Promise<{
   *   user, organization, role, permissions,
   *   accessToken: string, refreshToken: string
   * }>}
   */
  async verifyOtp(phone, code, { deviceName, ipAddress } = {}) {
    const normalized = _normalizePhone(phone);

    // 1. Validate OTP (throws on failure)
    await this.otpService.verifyOtp(normalized, code);

    // 2. Load user
    const rawUser = await this.authRepository.findUserByPhone(normalized);
    const context = await _buildUserContext(rawUser, this.authRepository);

    // 3. Issue access token
    const accessToken = signAccessToken({
      userId:         context.user.id,
      organizationId: context.organization?.id || null,
      role:           context.role,
      permissions:    context.permissions,
    });

    // 4. Create session (returns raw refresh token)
    const { refreshToken } = await this.sessionService.createSession({
      userId:     context.user.id,
      deviceName,
      ipAddress,
    });

    return { ...context, accessToken, refreshToken };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  /**
   * Validate a refresh token, issue a new access token, rotate the refresh token.
   *
   * @param {string} rawRefreshToken
   * @param {{ deviceName?: string, ipAddress?: string }} meta
   * @returns {Promise<{ accessToken: string, refreshToken: string, user, organization, role, permissions }>}
   */
  async refresh(rawRefreshToken, { deviceName, ipAddress } = {}) {
    if (!rawRefreshToken) throw new HttpError("Refresh token is required", 400);

    // 1. Validate old refresh token → get session
    const session = await this.sessionService.validateRefreshToken(rawRefreshToken);

    // 2. Load user
    const rawUser = await this.authRepository.findUserById(session.user_id);
    const context = await _buildUserContext(rawUser, this.authRepository);

    // 3. Revoke old session (rotation)
    await this.sessionService.revokeSession(rawRefreshToken);

    // 4. Issue new tokens
    const accessToken = signAccessToken({
      userId:         context.user.id,
      organizationId: context.organization?.id || null,
      role:           context.role,
      permissions:    context.permissions,
    });

    const { refreshToken } = await this.sessionService.createSession({
      userId:     context.user.id,
      deviceName: deviceName || session.device_name,
      ipAddress:  ipAddress  || session.ip_address,
    });

    return { ...context, accessToken, refreshToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  /**
   * Revoke the current session by raw refresh token.
   * If no refresh token is provided all sessions for the user are revoked.
   *
   * @param {string|null} rawRefreshToken
   * @param {string}      userId
   */
  async logout(rawRefreshToken, userId) {
    if (rawRefreshToken) {
      await this.sessionService.revokeSession(rawRefreshToken);
    } else if (userId) {
      await this.sessionService.revokeAllSessions(userId);
    }
  }

  // ── Get Me ─────────────────────────────────────────────────────────────────
  /**
   * Return the current user's full context.
   *
   * @param {string} userId
   * @returns {Promise<{ user, organization, role, permissions }>}
   */
  async getMe(userId) {
    const rawUser = await this.authRepository.findUserById(userId);
    return _buildUserContext(rawUser, this.authRepository);
  }

  // ── Login with Password ───────────────────────────────────────────────────
  /**
   * Validate email/phone and password, issue tokens.
   */
  async loginWithPassword(identifier, password, { deviceName, ipAddress } = {}) {
    if (!identifier || !password) {
      throw new HttpError("Identifier and password are required", 400);
    }

    const rawUser = await this.authRepository.findUserByIdentifier(identifier);
    if (!rawUser || !rawUser.password_hash) {
      throw new HttpError("Invalid credentials", 401);
    }

    const isValid = await bcrypt.compare(password, rawUser.password_hash);
    if (!isValid) {
      throw new HttpError("Invalid credentials", 401);
    }

    const context = await _buildUserContext(rawUser, this.authRepository);

    const accessToken = signAccessToken({
      userId:         context.user.id,
      organizationId: context.organization?.id || null,
      role:           context.role,
      permissions:    context.permissions,
    });

    const { refreshToken } = await this.sessionService.createSession({
      userId:     context.user.id,
      deviceName: deviceName || "Desktop Client",
      ipAddress,
    });

    return { status: "success", token: accessToken, ...context, accessToken, refreshToken };
  }

  // ── Register with Password ────────────────────────────────────────────────
  async registerWithPassword(payload) {
    const { createUserRepository } = require("../users/user.repository");
    const { createRoleRepository } = require("../roles/role.repository");
    const { createUserService } = require("../users/user.service");

    const userRepo = createUserRepository(this.authRepository.pool);
    const roleRepo = createRoleRepository(this.authRepository.pool);
    const userService = createUserService(userRepo, roleRepo);

    if (payload.password) {
      payload.password_hash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }

    const newUser = await userService.createUser(payload);
    return { status: "success", user: newUser };
  }
}

function createAuthService(pool) {
  return new AuthService(createAuthRepository(pool));
}

module.exports = { AuthService, createAuthService };
