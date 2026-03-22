/**
 * One-time migration: adds the content JSONB column to the questions table.
 * Run once from the project root: node migrate-content-column.js
 * Safe to re-run — uses ADD COLUMN IF NOT EXISTS.
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
        ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✓ Migration complete: content column added to questions table');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
