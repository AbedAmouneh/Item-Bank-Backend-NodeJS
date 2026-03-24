-- migrations/add_assessments.sql

CREATE TYPE assessment_type AS ENUM ('quiz', 'exam');

CREATE TABLE assessments (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id             INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title                 VARCHAR(255) NOT NULL,
  description           TEXT,
  type                  assessment_type NOT NULL DEFAULT 'exam',
  time_limit_mins       INTEGER,
  max_attempts          INTEGER NOT NULL DEFAULT 1,
  passing_score_percent NUMERIC(5,2) NOT NULL DEFAULT 70,
  question_count        INTEGER NOT NULL DEFAULT 10,
  randomize_questions   BOOLEAN NOT NULL DEFAULT TRUE,
  anti_cheat_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assessment_question_pool (
  id            SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id   BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, question_id)
);

CREATE TABLE attempts (
  id              SERIAL PRIMARY KEY,
  assessment_id   INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,
  score_percent   NUMERIC(5,2),
  passed          BOOLEAN,
  auto_submitted  BOOLEAN NOT NULL DEFAULT FALSE,
  status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attempt_questions (
  attempt_id  INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE attempt_answers (
  id             SERIAL PRIMARY KEY,
  attempt_id     INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id    BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer         JSONB NOT NULL DEFAULT '{}',
  is_correct     BOOLEAN,
  points_awarded NUMERIC(10,2),
  saved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE attempt_violations (
  id             SERIAL PRIMARY KEY,
  attempt_id     INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  violation_type VARCHAR(50) NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessments_tenant  ON assessments(tenant_id);
CREATE INDEX idx_assessments_course  ON assessments(course_id);
CREATE INDEX idx_attempts_user       ON attempts(user_id);
CREATE INDEX idx_attempts_assessment ON attempts(assessment_id);
CREATE INDEX idx_attempt_answers     ON attempt_answers(attempt_id);
CREATE INDEX idx_violations_attempt  ON attempt_violations(attempt_id);
