/**
 * One-time migration: creates the question_order table.
 * Run once from the project root: node migrate-question-order.js
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'item_bank',
  user: process.env.DB_USER || 'item_bank',
  password: process.env.DB_PASSWORD || 'item_bank_password',
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS question_order (
        user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        position    INT    NOT NULL,
        PRIMARY KEY (user_id, question_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_question_order_user
        ON question_order (user_id, position)
    `);
    console.log('✓ Migration complete: question_order table created');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
