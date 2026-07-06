"use strict";

/**
 * otp.service.js
 * Generates, stores, and validates 6-digit OTPs.
 *
 * DEV BEHAVIOR: OTPs are logged to the console.
 * PROD BEHAVIOR: Plug in an SMS provider in sendOtp() when ready.
 *
 * Expected env var:
 *   OTP_EXPIRES_MINUTES – how long until the OTP expires (default: 10)
 */

const { HttpError } = require("../utils/httpError");

const OTP_TTL_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || "10", 10);

/** Generate a zero-padded 6-digit OTP. */
function _generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

class OtpService {
  /**
   * @param {import('./auth.repository').AuthRepository} authRepository
   */
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  /**
   * Create a new OTP for the given phone number and persist it.
   * Invalidates any previously un-verified codes for the same phone.
   *
   * @param {string} phone  E.164-formatted phone number
   * @returns {Promise<{ otp: string, expiresAt: Date }>}
   */
  async sendOtp(phone) {
    const otp       = _generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Expire (soft-invalidate) any existing un-verified codes for this phone
    await this.authRepository.expireOtpByPhone(phone);

    // Persist
    await this.authRepository.createOtp({ phone, otp, expiresAt });

    // ─── DEV: log the OTP ───────────────────────────────────────────────────
    const logger = require("../utils/logger");
    logger.info({ phone, otp, expiresAt }, "Generated and persisted OTP for phone");
    // ─────────────────────────────────────────────────────────────────────────
    // TODO: Replace the console.log above with an SMS dispatch when ready.
    // e.g. await twilioClient.messages.create({ to: phone, ... });

    return { otp, expiresAt };
  }

  /**
   * Validate the OTP entered by the user.
   * Marks it as verified on success.
   *
   * @param {string} phone
   * @param {string} code  The 6-digit code entered by the user
   * @returns {Promise<void>}  Throws HttpError on failure
   */
  async verifyOtp(phone, code) {
    const record = await this.authRepository.findValidOtp(phone, code);

    if (!record) {
      throw new HttpError("Invalid or expired OTP", 401);
    }

    await this.authRepository.markOtpVerified(record.id);
  }
}

function createOtpService(authRepository) {
  return new OtpService(authRepository);
}

module.exports = { OtpService, createOtpService };
