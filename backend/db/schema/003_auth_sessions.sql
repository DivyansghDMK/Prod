-- CardioX Auth & Session schema
-- Migration 003: OTP codes and user sessions

BEGIN;

-- ─── OTP Codes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT        NOT NULL,
  otp         TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_phone      ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ─── User Sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash  TEXT        NOT NULL UNIQUE,
  device_name         TEXT,
  ip_address          TEXT,
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id            ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token_hash ON user_sessions(refresh_token_hash);

COMMIT;
