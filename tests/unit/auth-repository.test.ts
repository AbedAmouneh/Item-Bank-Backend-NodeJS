import { beforeEach, describe, expect, test, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
  },
}));

const mockFindById = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../platform/database/queries', () => ({
  findById: mockFindById,
  update: mockUpdate,
  create: mockCreate,
}));

vi.mock('../../utils/fingerprint', () => ({
  generateFingerprint: vi.fn(() => 'test-fingerprint'),
}));

describe('AuthRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    mockFindById.mockReset();
    mockUpdate.mockReset();
    mockCreate.mockReset();
  });

  describe('findUserByEmail', () => {
    test('returns user when found', async () => {
      const mockUser = {
        id: 1,
        email: 'testuser@test.local',
        role: 'user',
      };

      queryMock.mockResolvedValueOnce({ rows: [mockUser] });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.findUserByEmail('testuser@test.local');

      expect(result).toEqual(mockUser);
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = $1',
        ['testuser@test.local']
      );
    });

    test('returns null when user not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.findUserByEmail('nonexistent@test.local');

      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    test('returns user when found', async () => {
      mockFindById.mockResolvedValueOnce({
        id: 1,
        email: 'testuser@test.local',
      });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.findUserById(1);

      expect(result).toEqual({ id: 1, email: 'testuser@test.local' });
      expect(mockFindById).toHaveBeenCalledWith('users', 1);
    });

    test('returns null when user not found', async () => {
      mockFindById.mockResolvedValueOnce(null);

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.findUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    test('creates user with required fields', async () => {
      const userData = {
        email: 'newuser@test.local',
        password_hash: 'hash123',
        role: 'user',
        is_active: true,
        failed_login_attempts: 0,
      };

      mockCreate.mockResolvedValueOnce({ id: 1, ...userData });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.createUser(userData);

      expect(result).toEqual({ id: 1, ...userData });
      expect(mockCreate).toHaveBeenCalledWith('users', userData);
    });
  });

  describe('updateUser', () => {
    test('updates user successfully', async () => {
      mockUpdate.mockResolvedValueOnce({
        id: 1,
        is_active: false,
      });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.updateUser(1, { is_active: false });

      expect(result).toEqual({ id: 1, is_active: false });
      expect(mockUpdate).toHaveBeenCalledWith('users', 1, {
        is_active: false,
      });
    });
  });

  describe('handleFailedLogin', () => {
    test('increments failed attempts without locking', async () => {
      mockUpdate.mockResolvedValueOnce({ id: 1 });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.handleFailedLogin(1, 3);

      expect(mockUpdate).toHaveBeenCalledWith('users', 1, {
        failed_login_attempts: 3,
      });
    });

    test('locks account after 5 failed attempts', async () => {
      mockUpdate.mockResolvedValueOnce({ id: 1 });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.handleFailedLogin(1, 5);

      const call = mockUpdate.mock.calls[0];
      expect(call?.[0]).toBe('users');
      expect(call?.[1]).toBe(1);
      expect(call?.[2]).toMatchObject({
        failed_login_attempts: 5,
      });
      expect(call?.[2]).toHaveProperty('locked_until');
      expect(call?.[2]?.locked_until).toBeInstanceOf(Date);
    });

    test('locks account with 30 minute duration', async () => {
      mockUpdate.mockResolvedValueOnce({ id: 1 });
      const beforeCall = Date.now();

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.handleFailedLogin(1, 5);

      const call = mockUpdate.mock.calls[0];
      const lockedUntil = call?.[2]?.locked_until as Date;
      const expectedTime = beforeCall + 30 * 60 * 1000; // 30 minutes

      expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(expectedTime - 100);
      expect(lockedUntil.getTime()).toBeLessThanOrEqual(expectedTime + 100);
    });
  });

  describe('handleSuccessfulLogin', () => {
    test('resets failed attempts and updates login times', async () => {
      mockUpdate.mockResolvedValueOnce({ id: 1 });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.handleSuccessfulLogin(1);

      expect(mockUpdate).toHaveBeenCalledWith(
        'users',
        1,
        expect.objectContaining({
          failed_login_attempts: 0,
          locked_until: null,
        })
      );

      const call = mockUpdate.mock.calls[0];
      expect(call?.[2]?.last_login).toBeInstanceOf(Date);
    });
  });

  describe('findSessionByRefreshToken', () => {
    test('returns session when valid token found', async () => {
      const mockSession = {
        id: 1,
        user_id: 1,
        token: 'access-token',
        refresh_token: 'refresh-token',
        is_active: true,
      };

      queryMock.mockResolvedValueOnce({ rows: [mockSession] });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.findSessionByRefreshToken('refresh-token');

      expect(result).toEqual(mockSession);
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT * FROM user_sessions WHERE refresh_token = $1 AND is_active = true AND expires_at > NOW()',
        ['refresh-token']
      );
    });

    test('returns null when session not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      const result = await repo.findSessionByRefreshToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('updateSession', () => {
    test('updates session tokens and activity time', async () => {
      queryMock.mockResolvedValueOnce({});

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.updateSession(1, 'new-token', 'new-refresh-token');

      expect(queryMock).toHaveBeenCalledWith(
        'UPDATE user_sessions SET token = $1, refresh_token = $2, last_activity_at = NOW() WHERE id = $3',
        ['new-token', 'new-refresh-token', 1]
      );
    });
  });

  describe('createSession', () => {
    test('creates session with all metadata', async () => {
      mockCreate.mockResolvedValueOnce({ id: 1 });

      const mockRequest = {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Test Browser 1.0',
        },
      } as any;

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.createSession(1, 'access-token', 'refresh-token', mockRequest);

      expect(mockCreate).toHaveBeenCalledWith(
        'user_sessions',
        expect.objectContaining({
          user_id: 1,
          token: 'access-token',
          refresh_token: 'refresh-token',
          ip_address: '127.0.0.1',
          user_agent: 'Test Browser 1.0',
          fingerprint: 'test-fingerprint',
          is_active: true,
        })
      );

      const call = mockCreate.mock.calls[0];
      expect(call?.[1]?.expires_at).toBeInstanceOf(Date);
      expect(call?.[1]?.last_activity_at).toBeInstanceOf(Date);
    });

    test('handles missing user-agent gracefully', async () => {
      mockCreate.mockResolvedValueOnce({ id: 1 });

      const mockRequest = {
        ip: '127.0.0.1',
        headers: {},
      } as any;

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.createSession(1, 'access-token', 'refresh-token', mockRequest);

      const call = mockCreate.mock.calls[0];
      expect(call?.[1]?.user_agent).toBe('unknown');
    });
  });

  describe('deactivateSession', () => {
    test('deactivates session by token', async () => {
      queryMock.mockResolvedValueOnce({});

      const { AuthRepository } =
        await import('../../controllers/authController/repository/index');

      const repo = new AuthRepository();
      await repo.deactivateSession('access-token');

      expect(queryMock).toHaveBeenCalledWith(
        'UPDATE user_sessions SET is_active = false WHERE token = $1',
        ['access-token']
      );
    });
  });
});
