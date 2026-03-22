import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
  },
}));

vi.mock('../../platform/database/queries', () => ({
  create: mockCreate,
  update: mockUpdate,
}));

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'user@test.local',
    role: 'user',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('AdminRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
  });

  describe('findAll', () => {
    test('returns all users with no WHERE clause when no filters are given', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [makeUser({ id: 1 }), makeUser({ id: 2 }), makeUser({ id: 3 })] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).not.toContain('WHERE');
    });

    test('applies role filter in WHERE clause', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeUser({ role: 'admin' })] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.findAll({ page: 1, limit: 20, role: 'admin' });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('WHERE');
      expect(countCall?.[0]).toContain('role = $1');
      expect(countCall?.[1]).toContain('admin');
    });

    test('applies is_active filter', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.findAll({ page: 1, limit: 20, is_active: false });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('is_active = $1');
      expect(countCall?.[1]).toContain(false);
    });

    test('applies email search with ILIKE and wraps in %', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeUser()] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.findAll({ page: 1, limit: 20, search: 'alice' });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('email ILIKE');
      expect(countCall?.[1]).toContain('%alice%');
    });

    test('combines multiple filters with AND', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeUser()] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.findAll({ page: 1, limit: 20, role: 'user', is_active: true });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('role = $1');
      expect(countCall?.[0]).toContain('is_active = $2');
      expect(countCall?.[0]).toContain('AND');
    });

    test('calculates correct offset for page 3', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.findAll({ page: 3, limit: 10 });

      const [, dataCall] = queryMock.mock.calls;
      const params = dataCall?.[1] as unknown[];
      // last two params are limit and offset
      expect(params?.at(-2)).toBe(10);  // limit
      expect(params?.at(-1)).toBe(20); // offset = (3-1) * 10
    });
  });

  describe('findById', () => {
    test('returns user when found', async () => {
      const user = makeUser();
      queryMock.mockResolvedValueOnce({ rows: [user] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      const result = await repo.findById(1);

      expect(result).toEqual(user);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('FROM users WHERE id = $1'),
        [1]
      );
    });

    test('returns null when user not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('delegates to create helper with is_active=true and 0 failed attempts', async () => {
      const user = makeUser({ role: 'admin' });
      mockCreate.mockResolvedValueOnce(user);

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      const result = await repo.create({
        email: 'admin@test.local',
        password_hash: 'hashed',
        role: 'admin',
      });

      expect(result).toEqual(user);
      expect(mockCreate).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({
          email: 'admin@test.local',
          role: 'admin',
          is_active: true,
          failed_login_attempts: 0,
        }),
        expect.any(Array) // USER_COLUMNS
      );
    });
  });

  describe('update', () => {
    test('falls back to findById and skips update query when no fields are provided', async () => {
      const user = makeUser();
      queryMock.mockResolvedValueOnce({ rows: [user] });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      const result = await repo.update(1, {});

      expect(result).toEqual(user);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalledTimes(1); // only findById
    });

    test('delegates to update helper when email field is provided', async () => {
      const updated = makeUser({ email: 'new@test.local' });
      mockUpdate.mockResolvedValueOnce(updated);

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      const result = await repo.update(1, { email: 'new@test.local' });

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(
        'users',
        1,
        { email: 'new@test.local' },
        expect.any(Array) // USER_COLUMNS
      );
    });

    test('delegates to update helper when role field is provided', async () => {
      const updated = makeUser({ role: 'admin' });
      mockUpdate.mockResolvedValueOnce(updated);

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.update(1, { role: 'admin' });

      expect(mockUpdate).toHaveBeenCalledWith(
        'users',
        1,
        { role: 'admin' },
        expect.any(Array)
      );
    });
  });

  describe('activate', () => {
    test('sets is_active = true for the given user', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.activate(1);

      expect(queryMock).toHaveBeenCalledWith(
        'UPDATE users SET is_active = true WHERE id = $1',
        [1]
      );
    });
  });

  describe('deactivate', () => {
    test('sets user is_active=false and deactivates all their sessions', async () => {
      queryMock
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE users
        .mockResolvedValueOnce({ rowCount: 3 }); // UPDATE user_sessions

      const { AdminRepository } = await import(
        '../../controllers/adminController/repository'
      );
      const repo = new AdminRepository();
      await repo.deactivate(1);

      expect(queryMock).toHaveBeenCalledTimes(2);
      expect(queryMock).toHaveBeenNthCalledWith(
        1,
        'UPDATE users SET is_active = false WHERE id = $1',
        [1]
      );
      expect(queryMock).toHaveBeenNthCalledWith(
        2,
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
        [1]
      );
    });
  });
});
