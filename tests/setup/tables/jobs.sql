CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(255) UNIQUE NOT NULL,
  schedule_pattern VARCHAR(50) NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, running, completed, failed
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_on TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_on TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient querying by job name
CREATE INDEX idx_jobs_job_name ON jobs(job_name);

-- Index for querying active jobs
CREATE INDEX idx_jobs_active ON jobs(is_active, status);

-- Index for next run scheduling
CREATE INDEX idx_jobs_next_run ON jobs(next_run) WHERE is_active = true;