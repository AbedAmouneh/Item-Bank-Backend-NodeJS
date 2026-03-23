/**
 * One-time migration: adds 'crossword' to the question_type enum.
 * Run once from the project root: node migrate-add-crossword-type.js
 * Safe to re-run — uses ADD VALUE IF NOT EXISTS.
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
    await client.query(`ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'crossword'`);
    console.log("✓ Migration complete: 'crossword' added to question_type enum");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
