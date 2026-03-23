CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_categories (
  question_id INTEGER NOT NULL REFERENCES questions(id)  ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_parent  ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_qcat_qid    ON question_categories(question_id);
CREATE INDEX IF NOT EXISTS idx_qcat_catid  ON question_categories(category_id);
