CREATE TYPE platform_role AS ENUM ('super_admin', 'sales');

CREATE TABLE platform_users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  platform_role  platform_role NOT NULL,
  first_name     VARCHAR(100),
  last_name      VARCHAR(100),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which sales person owns which tenant
CREATE TABLE tenant_owners (
  tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform_user_id INTEGER NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, platform_user_id)
);

CREATE TABLE subscriptions (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INTEGER UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan                 VARCHAR(50) NOT NULL DEFAULT 'trial',
  seats_purchased      INTEGER NOT NULL DEFAULT 5,
  billing_cycle        VARCHAR(20) NOT NULL DEFAULT 'monthly',
  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ,
  status               VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: give all existing tenants a default subscription
INSERT INTO subscriptions (tenant_id, plan, seats_purchased, status)
SELECT id, 'standard', 50, 'active' FROM tenants;

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_tenant_owners_sales  ON tenant_owners(platform_user_id);

-- Add must_change_password to users for org admin onboarding
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
