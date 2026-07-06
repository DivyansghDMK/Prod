-- CardioX Patient Management schema
-- Migration 005: Full patients table rebuild + patient_visits + RBAC

BEGIN;

-- ─── Drop the thin patients table from 001_initial.sql and replace it ────────
-- We must handle the FK from doctor_assignments first.
-- Strategy: ALTER to add missing columns (safe for existing data).

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS patient_id         TEXT,           -- Hospital MRN / external ID
  ADD COLUMN IF NOT EXISTS first_name         TEXT,
  ADD COLUMN IF NOT EXISTS last_name          TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth      DATE,
  ADD COLUMN IF NOT EXISTS email              TEXT,
  ADD COLUMN IF NOT EXISTS blood_group        TEXT,
  ADD COLUMN IF NOT EXISTS address            TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact  JSONB,          -- { name, phone, relationship }
  ADD COLUMN IF NOT EXISTS notes              TEXT,
  ADD COLUMN IF NOT EXISTS updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ;    -- soft-delete sentinel

-- Rename old patient_name to first_name where first_name is still null
-- (safe migration path for any existing rows seeded in development)
UPDATE patients
SET    first_name = patient_name,
       last_name  = ''
WHERE  first_name IS NULL AND patient_name IS NOT NULL;

-- Make first_name NOT NULL after backfill (last_name may stay blank)
ALTER TABLE patients
  ALTER COLUMN first_name SET NOT NULL;

-- gender column already exists as patient_gender enum; keep it.

-- Optional: unique MRN per organization
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_mrn_per_org
  ON patients (organization_id, patient_id)
  WHERE patient_id IS NOT NULL AND deleted_at IS NULL;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_deleted_at       ON patients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_patients_phone            ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_email            ON patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_date_of_birth    ON patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id       ON patients(patient_id);

-- Full-text search index over names
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
  ON patients USING gin (
    (coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops
  );

-- ─── Patient Visits ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_visits (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES patients(id)      ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doctor_id       UUID                 REFERENCES users(id)         ON DELETE SET NULL,
  device_id       UUID                 REFERENCES devices(id)       ON DELETE SET NULL,
  visit_type      TEXT        NOT NULL DEFAULT 'CONSULTATION',
  visit_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symptoms        TEXT,
  diagnosis       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_visits_patient_id      ON patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_organization_id ON patient_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_doctor_id       ON patient_visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_visit_date      ON patient_visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_visits_device_id       ON patient_visits(device_id);

-- ─── New Permissions ─────────────────────────────────────────────────────────
INSERT INTO permissions (name, description)
VALUES
  ('visit:create', 'Create patient visits'),
  ('visit:view',   'View patient visits')
ON CONFLICT (name) DO NOTHING;

-- ─── Role → Permission wiring ─────────────────────────────────────────────────

-- SUPER_ADMIN: full patient + visit access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'SUPER_ADMIN'
  AND  p.name IN (
    'patient:create','patient:view','patient:update','patient:delete',
    'visit:create','visit:view'
  )
ON CONFLICT DO NOTHING;

-- HCP_ADMIN: full patient + visit management within own org
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'HCP_ADMIN'
  AND  p.name IN (
    'patient:create','patient:view','patient:update','patient:delete',
    'visit:create','visit:view'
  )
ON CONFLICT DO NOTHING;

-- HCP_CLINICAL: create + view + update patients; create + view visits
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'HCP_CLINICAL'
  AND  p.name IN (
    'patient:create','patient:view','patient:update',
    'visit:create','visit:view'
  )
ON CONFLICT DO NOTHING;

-- DOCTOR_ADMIN + DOCTOR_CLINICAL: view patients + visits assigned to them
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name IN ('DOCTOR_ADMIN','DOCTOR_CLINICAL')
  AND  p.name IN ('patient:view','visit:view')
ON CONFLICT DO NOTHING;

-- RECEPTIONIST: create + view patients
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
CROSS  JOIN permissions p
WHERE  r.name = 'RECEPTIONIST'
  AND  p.name IN ('patient:create','patient:view')
ON CONFLICT DO NOTHING;

COMMIT;
