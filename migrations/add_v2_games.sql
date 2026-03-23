-- 1. Add new game type values to the existing PostgreSQL enum.
--    PostgreSQL requires ALTER TYPE … ADD VALUE for each new value.
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'pixel-dash';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'stack-attack';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'meteor-catcher';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'pixel-craft';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'lava-climb';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'word-blitz';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'number-drop';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'world-explorer';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'pixel-snake';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'bullseye-blaster';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'lab-mixer';
ALTER TYPE game_type ADD VALUE IF NOT EXISTS 'ghost-hunt';

-- 2. Add a JSONB column for game-specific extra statistics.
--    Each game stores its own stats here (e.g. tower_height, ghosts_caught).
ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT NULL;
