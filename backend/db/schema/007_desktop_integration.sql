-- CardioX Desktop & ECG Session Integration schema
-- Migration 007: ecg_sessions and desktop_sync_queue

BEGIN;

-- ─── ECG Sessions Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecg_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id          UUID REFERENCES patient_visits(id) ON DELETE SET NULL,
  doctor_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id         UUID REFERENCES devices(id) ON DELETE SET NULL,
  report_id         UUID REFERENCES reports(id) ON DELETE SET NULL, -- link to generated report
  
  session_status    TEXT NOT NULL DEFAULT 'RECORDING',
  report_type       TEXT NOT NULL,
  
  sampling_rate     INTEGER,
  lead_count        INTEGER,
  duration_seconds  INTEGER,
  
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  
  desktop_version   TEXT,
  firmware_version  TEXT,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_ecg_session_status CHECK (session_status IN ('RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  CONSTRAINT chk_ecg_report_type CHECK (report_type IN ('12_LEAD', 'HOLTER', 'HRV', 'HYPERKALEMIA'))
);

CREATE INDEX IF NOT EXISTS idx_ecg_sessions_organization ON ecg_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ecg_sessions_patient      ON ecg_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ecg_sessions_visit        ON ecg_sessions(visit_id);
CREATE INDEX IF NOT EXISTS idx_ecg_sessions_device       ON ecg_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_ecg_sessions_status       ON ecg_sessions(session_status);

-- ─── Desktop Sync Queue Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS desktop_sync_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id         UUID REFERENCES devices(id) ON DELETE SET NULL,
  session_id        UUID REFERENCES ecg_sessions(id) ON DELETE SET NULL,
  
  sync_status       TEXT NOT NULL DEFAULT 'PENDING',
  retry_count       INTEGER NOT NULL DEFAULT 0,
  last_attempt      TIMESTAMPTZ,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_sync_queue_status CHECK (sync_status IN ('PENDING', 'UPLOADING', 'COMPLETE', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_desktop_sync_queue_org    ON desktop_sync_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_desktop_sync_queue_status ON desktop_sync_queue(sync_status);
CREATE INDEX IF NOT EXISTS idx_desktop_sync_queue_sess   ON desktop_sync_queue(session_id);

-- ─── Heartbeat Permissions for Desktop Module ───────────────────────────────
INSERT INTO permissions (name, description)
VALUES
  ('desktop:login',     'Authenticate desktop device'),
  ('desktop:session',   'Manage ECG sessions'),
  ('desktop:sync',      'Manage sync queue uploads'),
  ('desktop:heartbeat', 'Send desktop client heartbeat')
ON CONFLICT (name) DO NOTHING;

-- Wiring to Admin & SUPER_ADMIN (also clinicians can do standard uploads)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r CROSS JOIN permissions p
WHERE  r.name IN ('SUPER_ADMIN', 'HCP_ADMIN', 'HCP_CLINICAL')
  AND  p.name IN ('desktop:login', 'desktop:session', 'desktop:sync', 'desktop:heartbeat')
ON CONFLICT DO NOTHING;

COMMIT;
