/**
 * One-time migration: adds first_name, last_name, username, phone_number to users table.
 * Run once from the project root: node migrate-profile-columns.js
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
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS first_name   VARCHAR(255),
        ADD COLUMN IF NOT EXISTS last_name    VARCHAR(255),
        ADD COLUMN IF NOT EXISTS username     VARCHAR(100),
        ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50)
    `);
    console.log('✓ Migration complete: profile columns added to users table');

    const result = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
    );
    console.log('  Current columns:', result.rows.map(r => r.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
