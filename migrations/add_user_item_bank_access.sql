ALTER TABLE users
  ADD COLUMN IF NOT EXISTS course_assignment_mode VARCHAR(20) NOT NULL DEFAULT 'all_access';

CREATE TABLE IF NOT EXISTS user_item_bank_access (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_bank_id INTEGER NOT NULL REFERENCES item_banks(id) ON DELETE CASCADE,
  assigned_by  INTEGER REFERENCES users(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_bank_id)
);
