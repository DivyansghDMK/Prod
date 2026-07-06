-- CardioX PostgreSQL schema
-- Production foundation for a multi-tenant healthcare SaaS

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE organization_type AS ENUM ('HCP', 'DOCTOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE organization_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE device_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'RETIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE patient_gender AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('PENDING', 'UNDER_REVIEW', 'REVIEWED', 'SIGNED_OFF', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type organization_type NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  gst TEXT,
  license_number TEXT,
  status organization_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  password_hash TEXT,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rhythmulta_serial TEXT NOT NULL,
  machine_serial TEXT NOT NULL,
  license_id TEXT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  status device_status NOT NULL DEFAULT 'ACTIVE',
  activated_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  age INTEGER,
  gender patient_gender DEFAULT 'UNKNOWN',
  phone TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_assignments (
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (patient_id, doctor_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  report_status report_status NOT NULL DEFAULT 'PENDING',
  s3_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_organization_id ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_location_id ON devices(location_id);
CREATE INDEX IF NOT EXISTS idx_patients_organization_id ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_organization_id ON reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_device_id ON reports(device_id);
CREATE INDEX IF NOT EXISTS idx_reports_doctor_id ON reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_assignments_doctor_id ON doctor_assignments(doctor_id);

ALTER TABLE organizations
  ADD CONSTRAINT fk_organizations_created_by
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO roles (name, description)
VALUES
  ('SUPER_ADMIN', 'Platform super administrator'),
  ('HCP_ADMIN', 'Healthcare provider administrator'),
  ('HCP_CLINICAL', 'Healthcare provider clinical user'),
  ('DOCTOR_ADMIN', 'Doctor organization administrator'),
  ('DOCTOR_CLINICAL', 'Doctor organization clinical user'),
  ('RECEPTIONIST', 'Front desk or intake staff')
ON CONFLICT (name) DO NOTHING;

COMMIT;
