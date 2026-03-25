/**
 * Applies the two pending migrations that are not yet in the database.
 *
 * Run from the Item-Bank-Backend-NodeJS folder:
 *   npx ts-node scripts/apply_missing_migrations.ts
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

const PENDING = [
  'add_assessments.sql',
  'add_assignments.sql',
];

async function main() {
  const client = await pool.connect();
  try {
    for (const file of PENDING) {
      const sql = readFileSync(join(__dirname, '..', 'migrations', file), 'utf8');
      console.log(`Applying ${file}...`);
      await client.query(sql);
      console.log(`  ✓ Done`);
    }
    console.log('\n✅  All pending migrations applied successfully.');
    console.log('   Restart the backend server (pnpm dev) for changes to take effect.\n');
  } catch (err: any) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
