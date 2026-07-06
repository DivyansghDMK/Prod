-- CardioX RBAC schema additions

BEGIN;

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_id UUID;

DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT fk_users_role_id
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

INSERT INTO roles (name, description)
VALUES
  ('SUPER_ADMIN', 'Platform super administrator'),
  ('HCP_ADMIN', 'Healthcare provider administrator'),
  ('HCP_CLINICAL', 'Healthcare provider clinical user'),
  ('DOCTOR_ADMIN', 'Doctor organization administrator'),
  ('DOCTOR_CLINICAL', 'Doctor organization clinical user'),
  ('RECEPTIONIST', 'Front desk or intake staff')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description)
VALUES
  ('organization:create', 'Create organizations'),
  ('organization:update', 'Update organizations'),
  ('organization:view', 'View organizations'),
  ('organization:delete', 'Delete organizations'),
  ('patient:create', 'Create patients'),
  ('patient:update', 'Update patients'),
  ('patient:view', 'View patients'),
  ('patient:delete', 'Delete patients'),
  ('report:create', 'Create reports'),
  ('report:view', 'View reports'),
  ('report:approve', 'Approve reports'),
  ('device:create', 'Create devices'),
  ('device:view', 'View devices'),
  ('user:create', 'Create users'),
  ('user:update', 'Update users'),
  ('user:view', 'View users'),
  ('user:delete', 'Delete users'),
  ('license:view', 'View licenses'),
  ('dashboard:view', 'View dashboard')
ON CONFLICT (name) DO NOTHING;

COMMIT;

