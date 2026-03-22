CREATE TABLE question_order (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position    INT    NOT NULL,
    PRIMARY KEY (user_id, question_id)
);

CREATE INDEX idx_question_order_user ON question_order (user_id, position);
