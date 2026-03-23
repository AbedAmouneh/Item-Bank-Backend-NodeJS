CREATE TYPE activity_type AS ENUM ('quiz', 'survey', 'practice_quiz', 'pdf_book');
CREATE TYPE course_status  AS ENUM ('draft', 'published', 'archived');

CREATE TABLE IF NOT EXISTS courses (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  status       course_status NOT NULL DEFAULT 'draft',
  thumbnail_url TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type        activity_type NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_assignments (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at      TIMESTAMPTZ,
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activities_course ON activities(course_id, position);
CREATE INDEX IF NOT EXISTS idx_assignments_user  ON course_assignments(user_id);
