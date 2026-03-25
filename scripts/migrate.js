/**
 * migrate.js — applies any pending SQL migrations
 * Run with:  node scripts/migrate.js
 * No TypeScript compilation needed.
 */
'use strict';

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// ── load .env manually (no dotenv dependency needed) ───────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      false,
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const PENDING = ['add_assessments.sql', 'add_assignments.sql'];

async function run() {
  console.log('Connecting to database…');
  const client = await pool.connect();
  console.log('Connected.\n');

  for (const file of PENDING) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⏭  ${file} — file not found, skipping`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`  ⏳ Running ${file}…`);
    try {
      await client.query(sql);
      console.log(`  ✅ ${file} — done`);
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log(`  ✅ ${file} — already applied (table exists)`);
      } else {
        console.error(`  ❌ ${file} — ERROR: ${err.message}`);
      }
    }
  }

  client.release();
  await pool.end();
  console.log('\nAll pending migrations processed.');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
