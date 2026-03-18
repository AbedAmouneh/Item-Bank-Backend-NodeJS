import { db } from '../../platform/database/connection';

export async function beginSuiteTransaction(): Promise<void> {
  await db.query('BEGIN');
}

export async function rollbackSuiteTransaction(): Promise<void> {
  await db.query('ROLLBACK');
}
