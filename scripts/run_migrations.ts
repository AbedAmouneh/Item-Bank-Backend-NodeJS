/**
 * One-off script to apply the pending addon migration files to the dev database.
 * Run with:  npx ts-node scripts/run_migrations.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  database: process.env['DB_NAME'] ?? 'item_bank',
  user: process.env['DB_USER'] ?? 'item_bank',
  password: process.env['DB_PASSWORD'] ?? 'item_bank_password',
});

const MIGRATIONS = [
  'add_user_item_bank_access.sql',
  'add_courses.sql',
  'add_notifications.sql',
  'add_categories.sql',
];

async function main() {
  const client = await pool.connect();
  try {
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(__dirname, '..', 'migrations', file), 'utf8');
      console.log(`Applying ${file}...`);
      await client.query(sql);
      console.log(`  ✓ Done`);
    }
    console.log('\nAll migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
