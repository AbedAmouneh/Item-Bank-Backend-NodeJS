import { describe, expect, test } from 'vitest';

import { db } from '../../platform/database/connection';
import { fixtureUsers } from '../fixtures/users';

const integrationDescribe =
  process.env['CI'] === 'true' ||
  process.env['RUN_INTEGRATION_TESTS'] === 'true'
    ? describe
    : describe.skip;

integrationDescribe('integration: baseline fixtures', () => {
  test('loads deterministic fixture users', async () => {
    const users = fixtureUsers();
    const result = await db.query<{ email: string }>(
      `
      SELECT email
      FROM users
      WHERE email IN ('fixture_admin@test.local', 'fixture_user@test.local')
      ORDER BY email ASC
    `
    );

    expect(result.rows.map(row => row.email)).toEqual(
      users.map(user => user.email)
    );
  });
});
