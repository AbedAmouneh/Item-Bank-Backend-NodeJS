const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'spelling_dictation'`);
    console.log('Migration complete: spelling_dictation added to question_type enum');
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);
