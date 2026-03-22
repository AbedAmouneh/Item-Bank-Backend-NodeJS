import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ProfileRepository } from '../../controllers/profileController/repository';

const { queryMock, mockFindById } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  mockFindById: vi.fn(),
}));

vi.mock('../../platform/database/connection', () => ({
  db: { query: queryMock },
}));

vi.mock('../../platform/database/queries', () => ({
  findById: mockFindById,
}));

describe('ProfileRepository', () => {
  let repo: ProfileRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ProfileRepository();
  });

  // --- findById ---

  describe('findById', () => {
    test('delegates to findById helper with correct table and columns', async () => {
      const user = { id: 1, email: 'user@test.local', role: 'user', is_active: true };
      mockFindById.mockResolvedValue(user);

      const result = await repo.findById(1);

      expect(result).toEqual(user);
      expect(mockFindById).toHaveBeenCalledWith('users', 1, [
        'id',
        'email',
        'role',
        'is_active',
        'first_name',
        'last_name',
        'username',
        'phone_number',
        'created_at',
      ]);
    });

    test('returns null when user is not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  // --- updateEmail ---

  describe('updateEmail', () => {
    test('runs UPDATE with correct params', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await repo.updateEmail(1, 'new@test.local');

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('UPDATE users SET email = $1');
      expect(params).toEqual(['new@test.local', 1]);
    });
  });

  // --- updateProfile ---

  describe('updateProfile', () => {
    test('runs COALESCE UPDATE with all three fields', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await repo.updateProfile(1, {
        first_name: 'Alice',
        last_name: 'Smith',
        phone_number: '+1234',
      });

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('UPDATE users');
      expect(sql).toContain('COALESCE');
      expect(params).toEqual(['Alice', 'Smith', '+1234', 1]);
    });

    test('passes null for omitted fields', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await repo.updateProfile(2, {});

      const [, params] = queryMock.mock.calls[0];
      expect(params).toEqual([null, null, null, 2]);
    });
  });

  // --- updatePassword ---

  describe('updatePassword', () => {
    test('runs UPDATE with hashed password and userId', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await repo.updatePassword(1, 'hashed-pw');

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('UPDATE users SET password_hash = $1');
      expect(params).toEqual(['hashed-pw', 1]);
    });
  });

  // --- deactivateOtherSessions ---

  describe('deactivateOtherSessions', () => {
    test('runs UPDATE on user_sessions with userId and current token', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      await repo.deactivateOtherSessions(1, 'current-token');

      const [sql, params] = queryMock.mock.calls[0];
      expect(sql).toContain('UPDATE user_sessions SET is_active = false');
      expect(sql).toContain('WHERE user_id = $1');
      expect(params).toEqual([1, 'current-token']);
    });
  });
});
