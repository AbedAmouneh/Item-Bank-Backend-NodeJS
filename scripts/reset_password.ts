/**
 * Dev-only utility: list all users and reset every account to a known password.
 *
 * Run with:  npx ts-node scripts/reset_password.ts
 *
 * After running, all credentials match what is documented in .env under
 * the "DEV TEST ACCOUNTS" section.
 */
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

/** Password assigned to the admin account after reset. */
const ADMIN_PASSWORD = 'Admin123!';
/** Password assigned to all non-admin accounts after reset. */
const DEFAULT_PASSWORD = 'Test1234!';

async function main() {
  const pool = new Pool({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 5432),
    database: process.env['DB_NAME'] ?? 'item_bank',
    user: process.env['DB_USER'] ?? 'item_bank',
    password: process.env['DB_PASSWORD'] ?? 'item_bank_password',
  });

  // List all users first
  const all = await pool.query('SELECT id, email, role, is_active FROM users ORDER BY id');
  console.log('All users in DB:');
  console.table(all.rows);

  const adminHash   = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Reset admin accounts
  const admins = await pool.query(
    `UPDATE users
     SET password_hash = $1,
         locked_until = NULL,
         failed_login_attempts = 0
     WHERE role = 'admin'
     RETURNING id, email, role`,
    [adminHash],
  );
  console.log(`\nAdmin accounts reset (→ ${ADMIN_PASSWORD}):`);
  console.table(admins.rows);

  // Reset all non-admin accounts
  const others = await pool.query(
    `UPDATE users
     SET password_hash = $1,
         locked_until = NULL,
         failed_login_attempts = 0
     WHERE role != 'admin'
     RETURNING id, email, role`,
    [defaultHash],
  );
  console.log(`\nNon-admin accounts reset (→ ${DEFAULT_PASSWORD}):`);
  console.table(others.rows);

  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
