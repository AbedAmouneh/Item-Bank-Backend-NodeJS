/**
 * One-time migration: adds reviewer_notes TEXT column to the questions table.
 * Run once from the project root: node migrations/add_reviewer_notes.js
 * Safe to re-run — uses IF NOT EXISTS.
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
      ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS reviewer_notes TEXT
    `);
    console.log('✓ Migration complete: reviewer_notes column added to questions table');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
