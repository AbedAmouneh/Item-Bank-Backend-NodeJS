-- 1. Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  plan        VARCHAR(50) NOT NULL DEFAULT 'trial',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed: create a default tenant for all existing data
INSERT INTO tenants (name, slug, status, plan)
SELECT 'Default Organisation', 'default', 'active', 'standard'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'default');

-- 3. users: add nullable column, backfill, then add NOT NULL constraint
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE users SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- 4. item_banks
ALTER TABLE item_banks ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE item_banks SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_banks' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE item_banks ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- 5. questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE questions SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE questions ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- 6. courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE courses SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE courses ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- 7. notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE notifications SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- 8. user_roles join table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(50) NOT NULL,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role, tenant_id)
);

-- 9. Migrate existing role column → user_roles
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT
  id,
  CASE role
    WHEN 'admin' THEN 'org_admin'
    ELSE role
  END,
  tenant_id
FROM users
ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug      ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_users_tenant      ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_item_banks_tenant ON item_banks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_questions_tenant  ON questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant    ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user   ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);
