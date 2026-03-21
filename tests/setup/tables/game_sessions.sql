CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL CHECK (game IN ('quiz-arcade', 'memory-match', 'answer-runner')),
    score INTEGER NOT NULL DEFAULT 0,
    accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_qs INTEGER NOT NULL DEFAULT 0,
    correct_qs INTEGER NOT NULL DEFAULT 0,
    item_bank_id INTEGER REFERENCES item_banks(id) ON DELETE SET NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_game ON game_sessions(game);
CREATE INDEX idx_game_sessions_item_bank_id ON game_sessions(item_bank_id);
