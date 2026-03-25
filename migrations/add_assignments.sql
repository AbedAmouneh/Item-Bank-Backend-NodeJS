CREATE TABLE IF NOT EXISTS assignments (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id     INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(255) NOT NULL,
  instructions  TEXT,
  max_score     NUMERIC(10,2) NOT NULL DEFAULT 100,
  due_date      TIMESTAMPTZ,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_components (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  type          VARCHAR(30) NOT NULL,
  prompt        TEXT,
  question_id   BIGINT REFERENCES questions(id) ON DELETE SET NULL,
  max_points    NUMERIC(10,2) NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS assignment_user_assignments (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  submitted_at  TIMESTAMPTZ,
  total_score   NUMERIC(10,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS submission_responses (
  id              SERIAL PRIMARY KEY,
  submission_id   INTEGER NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  component_id    INTEGER NOT NULL REFERENCES assignment_components(id) ON DELETE CASCADE,
  text_answer     TEXT,
  file_url        VARCHAR(500),
  url_answer      VARCHAR(500),
  question_answer JSONB,
  is_correct      BOOLEAN,
  UNIQUE (submission_id, component_id)
);

CREATE TABLE IF NOT EXISTS submission_grades (
  id               SERIAL PRIMARY KEY,
  submission_id    INTEGER NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  graded_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  overall_feedback TEXT,
  graded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id)
);

CREATE TABLE IF NOT EXISTS submission_component_grades (
  id             SERIAL PRIMARY KEY,
  grade_id       INTEGER NOT NULL REFERENCES submission_grades(id) ON DELETE CASCADE,
  component_id   INTEGER NOT NULL REFERENCES assignment_components(id) ON DELETE CASCADE,
  points_awarded NUMERIC(10,2) NOT NULL DEFAULT 0,
  comment        TEXT,
  UNIQUE (grade_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant     ON assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user       ON assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
