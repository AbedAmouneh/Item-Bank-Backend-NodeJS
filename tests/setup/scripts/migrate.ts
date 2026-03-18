import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Pool } from 'pg';

import { config } from '../../../utils/config';
import { assertSafeTestDatabaseTarget } from '../../../utils/test-safeguards';
import { MigrationFile, orderMigrationFiles } from './migration-order';

interface MigrationRecord {
  version: string;
  checksum: string;
}

function ensureTestMode(): void {
  if (config.server.env !== 'test') {
    throw new Error('Migration runner requires NODE_ENV=test.');
  }
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function main(): Promise<void> {
  ensureTestMode();
  assertSafeTestDatabaseTarget(
    config.database.host,
    config.database.name,
    'Migration database'
  );

  const tablesDir = resolve(__dirname, '../tables');
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const allEntries = await readdir(tablesDir);
    const fileNames = allEntries
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const rawFiles: MigrationFile[] = [];
    for (const fileName of fileNames) {
      const fullPath = join(tablesDir, fileName);
      rawFiles.push({
        fileName,
        version: fileName.replace(/\.sql$/, ''),
        sql: await readFile(fullPath, 'utf8'),
      });
    }

    const files = orderMigrationFiles(rawFiles);

    for (const file of files) {
      const fileChecksum = checksum(file.sql);

      const existing = await client.query<MigrationRecord>(
        `
          SELECT version, checksum
          FROM schema_migrations
          WHERE version = $1
        `,
        [file.version]
      );

      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== fileChecksum) {
          throw new Error(
            `Checksum mismatch for migration "${file.version}". Existing migration was modified.`
          );
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(file.sql);
        await client.query(
          `
            INSERT INTO schema_migrations (version, checksum)
            VALUES ($1, $2)
          `,
          [file.version, fileChecksum]
        );
        await client.query('COMMIT');
        console.log(`Applied migration: ${file.version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Migrations completed.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
