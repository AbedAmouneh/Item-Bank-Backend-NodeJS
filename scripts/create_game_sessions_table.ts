/**
 * One-time setup: creates the game_sessions table in the dev database.
 *
 * Run with:  pnpm ts-node scripts/create_game_sessions_table.ts
 *
 * Safe to run multiple times — uses IF NOT EXISTS on table and indices.
 */

import { Pool } from 'pg';
import { config } from '../utils/config';

async function main(): Promise<void> {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: false,
  });

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game       TEXT NOT NULL CHECK (game IN ('quiz-arcade', 'memory-match', 'answer-runner')),
        score      INTEGER NOT NULL DEFAULT 0,
        accuracy   NUMERIC(5,2) NOT NULL DEFAULT 0,
        total_qs   INTEGER NOT NULL DEFAULT 0,
        correct_qs INTEGER NOT NULL DEFAULT 0,
        item_bank_id INTEGER REFERENCES item_banks(id) ON DELETE SET NULL,
        played_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id    ON game_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_game        ON game_sessions(game);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_item_bank_id ON game_sessions(item_bank_id);
    `);

    console.log('✅  game_sessions table and indices are ready.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
