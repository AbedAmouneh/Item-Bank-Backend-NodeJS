import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Pool } from 'pg';

import { config } from '../../../utils/config';
import { assertFixtureLoadSafety } from '../../../utils/test-safeguards';
import { parseFixtureName } from './fixture-utils';

async function main(): Promise<void> {
  const fixtureName = parseFixtureName(process.argv.slice(2));
  assertFixtureLoadSafety();

  const fixtureDir = resolve(__dirname, `../fixtures/${fixtureName}`);
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  const client = await pool.connect();

  try {
    const entries = await readdir(fixtureDir);
    const sqlFiles = entries.filter(file => file.endsWith('.sql')).sort();

    if (sqlFiles.length === 0) {
      throw new Error(`No fixture SQL files found in ${fixtureDir}`);
    }

    await client.query('BEGIN');

    try {
      for (const file of sqlFiles) {
        const fullPath = join(fixtureDir, file);
        const sql = await readFile(fullPath, 'utf8');
        await client.query(sql);
        console.log(`Loaded fixture file: ${file}`);
      }

      await client.query('COMMIT');
      console.log(`Fixture set "${fixtureName}" loaded successfully.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fixture loading failed:', error);
    process.exit(1);
  });
}
