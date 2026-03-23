CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(60) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  entity_type VARCHAR(50),
  entity_id   INTEGER,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read
  ON notifications(user_id, is_read);
