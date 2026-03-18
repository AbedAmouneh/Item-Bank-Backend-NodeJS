-- Baseline deterministic users for test fixtures
DELETE FROM users
WHERE email IN ('fixture_admin@test.local', 'fixture_user@test.local');

INSERT INTO users (
  email,
  password_hash,
  role,
  is_active
)
VALUES
  ('fixture_admin@test.local', NULL, 'admin', TRUE),
  ('fixture_user@test.local', NULL, 'user', TRUE);
