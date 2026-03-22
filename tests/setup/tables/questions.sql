CREATE TYPE question_type AS ENUM (
    'true_false',
    'short_answer',
    'multiple_choice',
    'essay',
    'fill_in_blanks',
    'fill_in_blanks_image',
    'text_sequencing',
    'image_sequencing',
    'free_hand_drawing',
    'select_correct_word',
    'record_audio',
    'numerical',
    'highlight_correct_word',
    'multiple_hotspots',
    'drag_drop_text',
    'drag_drop_image',
    'text_classification',
    'image_classification',
    'matching'
);

CREATE TYPE question_status AS ENUM (
    'draft',
    'in_review',
    'published'
);

CREATE TABLE questions (
    id BIGSERIAL PRIMARY KEY,
    item_bank_id BIGINT REFERENCES item_banks(id) ON DELETE SET NULL,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    type question_type NOT NULL,
    name VARCHAR(500) NOT NULL,
    text TEXT,
    mark NUMERIC(10,2) NOT NULL DEFAULT 1,
    status question_status NOT NULL DEFAULT 'draft',
    content JSONB NOT NULL DEFAULT '{}',
    rejection_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_owner_id ON questions(owner_id);
CREATE INDEX idx_questions_item_bank_id ON questions(item_bank_id);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_content ON questions USING GIN(content);

-- Tracks custom ordering of questions per user
CREATE TABLE question_order (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    position INT NOT NULL,
    PRIMARY KEY (user_id, question_id),
    UNIQUE (user_id, position)
);

CREATE INDEX idx_question_order_user_id ON question_order(user_id);
CREATE INDEX idx_question_order_position ON question_order(user_id, position);
