-- HTTP Request Logs Table
-- Stores detailed information about every HTTP request to the API

CREATE TABLE IF NOT EXISTS http_logs (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(36) NOT NULL UNIQUE,
    
    -- User information (null for unauthenticated requests)
    user_id BIGINT,
    
    -- Request details
    method VARCHAR(10) NOT NULL,
    path TEXT NOT NULL,
    query_params JSON,
    request_headers JSON,
    request_body JSON,
    
    -- Response details
    response_status INTEGER NOT NULL,
    response_body JSON,
    response_headers JSON,
    
    -- Timing
    duration_ms INTEGER NOT NULL,
    
    -- Client information
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    
    -- Error tracking
    error_message TEXT,
    error_stack TEXT,
    
    -- Timestamps
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_http_logs_user_id ON http_logs(user_id);
CREATE INDEX idx_http_logs_request_id ON http_logs(request_id);
CREATE INDEX idx_http_logs_path ON http_logs(path);
CREATE INDEX idx_http_logs_method ON http_logs(method);
CREATE INDEX idx_http_logs_status ON http_logs(response_status);
CREATE INDEX idx_http_logs_created_on ON http_logs(created_on DESC);
CREATE INDEX idx_http_logs_duration ON http_logs(duration_ms);
CREATE INDEX idx_http_logs_user_created ON http_logs(user_id, created_on DESC);

-- Composite index for common filter combinations
CREATE INDEX idx_http_logs_method_path_created ON http_logs(method, path, created_on DESC);

