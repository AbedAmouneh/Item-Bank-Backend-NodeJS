CREATE TABLE question_tags (
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);
