import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
  },
}));

describe('platform/database/queries', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  test('QueryBuilder builds SQL and executes with params', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const { createQuery } = await import('../../platform/database/queries');

    const qb = createQuery()
      .select(['u.id', 'u.name'])
      .from('users u')
      .join('roles r', 'u.role_id = r.id')
      .leftJoin('teams t', 'u.team_id = t.id')
      .where('u.id = $1', 7)
      .orderBy('u.name', 'DESC')
      .limit(10)
      .offset(20);

    const built = qb.build();
    expect(built.query).toContain('SELECT u.id, u.name FROM users u');
    expect(built.query).toContain('JOIN roles r ON u.role_id = r.id');
    expect(built.query).toContain('LEFT JOIN teams t ON u.team_id = t.id');
    expect(built.query).toContain('WHERE u.id = $1');
    expect(built.query).toContain('ORDER BY u.name DESC');
    expect(built.query).toContain('LIMIT 10');
    expect(built.query).toContain('OFFSET 20');
    expect(built.params).toEqual([7]);

    const result = await qb.execute();
    expect(result.rows).toEqual([{ id: 1 }]);
  });

  test('findById returns first row or null', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 5, email: 'x@test.local' }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { findById } = await import('../../platform/database/queries');

    await expect(findById('users', 5)).resolves.toEqual({
      id: 5,
      email: 'x@test.local',
    });
    await expect(findById('users', 99)).resolves.toBeNull();
  });

  test('findMany applies conditions ordering limit and offset', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const { findMany } = await import('../../platform/database/queries');

    const rows = await findMany(
      'users',
      { role: 'admin', active: true },
      ['id', 'email'],
      'created_at desc',
      25,
      50
    );

    expect(rows).toHaveLength(2);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('SELECT id, email FROM users');
    expect(sql).toContain('WHERE role = $1 AND active = $2');
    expect(sql).toContain('ORDER BY created_at DESC');
    expect(sql).toContain('LIMIT 25');
    expect(sql).toContain('OFFSET 50');
    expect(params).toEqual(['admin', true]);
  });

  test('create strips timestamps and returns inserted row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 10, name: 'new' }] });

    const { create } = await import('../../platform/database/queries');

    const row = await create('users', {
      email: 'new@test.local',
      created_at: 'should-drop',
      updated_at: 'should-drop',
      role: 'user',
    });

    expect(row.id).toBe(10);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO users (email, role)');
    expect(params).toEqual(['new@test.local', 'user']);
  });

  test('create throws if insert returns no row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { create } = await import('../../platform/database/queries');

    await expect(create('users', { name: 'x' })).rejects.toThrow(
      /failed to create record in users/i
    );
  });

  test('update strips timestamps and returns row or null', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 1, name: 'updated' }] });
    queryMock.mockResolvedValueOnce({ rows: [] });

    const { update } = await import('../../platform/database/queries');

    const updated = await update('users', 1, {
      name: 'updated',
      updated_on: 'drop-me',
      created_on: 'drop-me',
      role: 'admin',
    });

    expect(updated?.name).toBe('updated');

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('name = $2, role = $3');
    expect(params).toEqual([1, 'updated', 'admin']);

    await expect(update('users', 2, { name: 'x' })).resolves.toBeNull();
  });

  test('deleteById returns boolean from rowCount', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rowCount: 0 });

    const { deleteById } = await import('../../platform/database/queries');

    await expect(deleteById('users', 1)).resolves.toBe(true);
    await expect(deleteById('users', 2)).resolves.toBe(false);
  });
});
