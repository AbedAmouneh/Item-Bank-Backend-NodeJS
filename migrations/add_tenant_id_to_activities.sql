-- Add tenant_id to activities (back-fills from parent course row)
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

UPDATE activities a
SET tenant_id = c.tenant_id
FROM courses c
WHERE a.course_id = c.id
  AND a.tenant_id IS NULL;

DO $$ BEGIN
  ALTER TABLE activities ALTER COLUMN tenant_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- Add tenant_id to course_assignments (back-fills from parent course row)
ALTER TABLE course_assignments
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

UPDATE course_assignments ca
SET tenant_id = c.tenant_id
FROM courses c
WHERE ca.course_id = c.id
  AND ca.tenant_id IS NULL;

DO $$ BEGIN
  ALTER TABLE course_assignments ALTER COLUMN tenant_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;
