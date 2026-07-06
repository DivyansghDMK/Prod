-- CardioX Device Management schema
-- Migration 004: Extended devices table + device_heartbeats

BEGIN;

-- ─── Extend the existing devices table ──────────────────────────────────────
-- (devices table already exists from 001_initial.sql)
-- We add the new columns required by Device Management v2.

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS device_name       TEXT,
  ADD COLUMN IF NOT EXISTS firmware_version  TEXT,
  ADD COLUMN IF NOT EXISTS software_version  TEXT,
  ADD COLUMN IF NOT EXISTS hardware_version  TEXT,
  ADD COLUMN IF NOT EXISTS activation_status TEXT    NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS last_sync         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip_address        TEXT,
  ADD COLUMN IF NOT EXISTS mac_address       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Unique constraints on serial numbers (idempotent)
DO $$ BEGIN
  ALTER TABLE devices ADD CONSTRAINT uq_devices_rhythmulta_serial UNIQUE (rhythmulta_serial);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE devices ADD CONSTRAINT uq_devices_machine_serial UNIQUE (machine_serial);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Device Heartbeats ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_heartbeats (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  heartbeat_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_version      TEXT,
  firmware_version TEXT,
  status           TEXT        NOT NULL DEFAULT 'ONLINE',
  ip_address       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_id      ON device_heartbeats(device_id);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_heartbeat_time ON device_heartbeats(heartbeat_time DESC);
CREATE INDEX IF NOT EXISTS idx_devices_activation_status        ON devices(activation_status);
CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat           ON devices(last_heartbeat DESC);

-- ─── Permissions for device management ──────────────────────────────────────
INSERT INTO permissions (name, description)
VALUES
  ('device:update',  'Update device details'),
  ('device:delete',  'Delete / retire a device'),
  ('device:heartbeat', 'Send device heartbeat (machine-to-server)')
ON CONFLICT (name) DO NOTHING;

-- ─── Role → Permission wiring ────────────────────────────────────────────────
-- SUPER_ADMIN: full device access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'SUPER_ADMIN'
  AND  p.name IN (
    'device:create','device:view','device:update','device:delete','device:heartbeat'
  )
ON CONFLICT DO NOTHING;

-- HCP_ADMIN: manage own org's devices
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'HCP_ADMIN'
  AND  p.name IN (
    'device:create','device:view','device:update','device:heartbeat'
  )
ON CONFLICT DO NOTHING;

-- HCP_CLINICAL: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'HCP_CLINICAL'
  AND  p.name IN ('device:view')
ON CONFLICT DO NOTHING;

-- RECEPTIONIST: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'RECEPTIONIST'
  AND  p.name IN ('device:view')
ON CONFLICT DO NOTHING;

-- DOCTOR roles: no device permissions (intentional omission)

COMMIT;
