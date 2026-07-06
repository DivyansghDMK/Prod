-- CardioX Production Refresh Token Security Enhancements
-- Migration 008: Secure sessions with expires_at field

BEGIN;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Back-fill existing sessions with 7-day default
UPDATE user_sessions
  SET expires_at = created_at + INTERVAL '7 days'
  WHERE expires_at IS NULL;

ALTER TABLE user_sessions
  ALTER COLUMN expires_at SET NOT NULL;

COMMIT;
