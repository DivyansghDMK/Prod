-- CardioX ECG Report Management schema
-- Migration 006: Full reports rebuild + report_reviews + report_files + RBAC

BEGIN;

-- ─── Extend the existing thin reports table ──────────────────────────────────
-- reports table already exists from 001_initial.sql.
-- We keep its PKs / FKs and add every new column idempotently.

-- New ENUM types (idempotent)
DO $$ BEGIN
  CREATE TYPE report_type_enum AS ENUM (
    '12_LEAD', 'HOLTER', 'HRV', 'HYPERKALEMIA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status_enum AS ENUM (
    'GENERATING', 'GENERATED', 'REVIEW_PENDING', 'APPROVED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_decision_enum AS ENUM (
    'APPROVED', 'REJECTED', 'NEEDS_REVISION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add the new columns (safe for existing data)
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS visit_id          UUID REFERENCES patient_visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS report_type_v2    TEXT,          -- replaces thin report_type TEXT
  ADD COLUMN IF NOT EXISTS report_status_v2  TEXT NOT NULL DEFAULT 'GENERATING',
  ADD COLUMN IF NOT EXISTS pdf_s3_key        TEXT,
  ADD COLUMN IF NOT EXISTS json_s3_key       TEXT,
  ADD COLUMN IF NOT EXISTS waveform_s3_key   TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_s3_key  TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary        TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence     NUMERIC(5,4),  -- 0.0000 – 1.0000
  ADD COLUMN IF NOT EXISTS generated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by        UUID REFERENCES users(id) ON DELETE SET NULL;

-- Back-fill: copy old report_type to report_type_v2 where still null
UPDATE reports SET report_type_v2 = report_type WHERE report_type_v2 IS NULL;

-- Indexes on reports
CREATE INDEX IF NOT EXISTS idx_reports_visit_id         ON reports(visit_id);
CREATE INDEX IF NOT EXISTS idx_reports_report_type_v2   ON reports(report_type_v2);
CREATE INDEX IF NOT EXISTS idx_reports_report_status_v2 ON reports(report_status_v2);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at     ON reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_approved_at      ON reports(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_by       ON reports(created_by);

-- ─── Report Reviews ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID        NOT NULL REFERENCES reports(id)  ON DELETE CASCADE,
  reviewer_id UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  decision    TEXT        NOT NULL,                        -- APPROVED | REJECTED | NEEDS_REVISION
  comments    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_reviews_report_id   ON report_reviews(report_id);
CREATE INDEX IF NOT EXISTS idx_report_reviews_reviewer_id ON report_reviews(reviewer_id);

-- ─── Report Files ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_files (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID        NOT NULL REFERENCES reports(id)  ON DELETE CASCADE,
  file_type   TEXT        NOT NULL,          -- PDF | JSON | WAVEFORM | THUMBNAIL | OTHER
  s3_key      TEXT        NOT NULL,
  file_size   BIGINT,                        -- bytes
  checksum    TEXT,                          -- SHA-256 hex
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_files_report_id ON report_files(report_id);

-- ─── New Permissions ─────────────────────────────────────────────────────────
INSERT INTO permissions (name, description)
VALUES
  ('report:update',   'Update report metadata / status'),
  ('report:delete',   'Delete a report'),
  ('report:review',   'Submit a review decision on a report'),
  ('report:upload',   'Upload files / register a new report'),
  ('report:download', 'Download report files')
ON CONFLICT (name) DO NOTHING;

-- ─── Role → Permission wiring ─────────────────────────────────────────────────

-- SUPER_ADMIN: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r CROSS JOIN permissions p
WHERE  r.name = 'SUPER_ADMIN'
  AND  p.name IN (
    'report:create','report:view','report:approve','report:update',
    'report:delete','report:review','report:upload','report:download'
  )
ON CONFLICT DO NOTHING;

-- HCP_ADMIN: manage reports in own org
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r CROSS JOIN permissions p
WHERE  r.name = 'HCP_ADMIN'
  AND  p.name IN (
    'report:create','report:view','report:update',
    'report:upload','report:download'
  )
ON CONFLICT DO NOTHING;

-- HCP_CLINICAL: create + view + upload
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r CROSS JOIN permissions p
WHERE  r.name = 'HCP_CLINICAL'
  AND  p.name IN ('report:create','report:view','report:upload','report:download')
ON CONFLICT DO NOTHING;

-- DOCTOR_ADMIN + DOCTOR_CLINICAL: view + review + approve + download
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r CROSS JOIN permissions p
WHERE  r.name IN ('DOCTOR_ADMIN','DOCTOR_CLINICAL')
  AND  p.name IN (
    'report:view','report:approve','report:review','report:download'
  )
ON CONFLICT DO NOTHING;

-- RECEPTIONIST: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r CROSS JOIN permissions p
WHERE  r.name = 'RECEPTIONIST'
  AND  p.name IN ('report:view')
ON CONFLICT DO NOTHING;

COMMIT;
