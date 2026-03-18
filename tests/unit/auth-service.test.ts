import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AuthService } from '../../controllers/authController/service';
import { config } from '../../utils/config';

const {
  mockFindUserByEmail,
  mockFindUserById,
  mockHandleFailedLogin,
  mockHandleSuccessfulLogin,
  mockCreateSession,
  mockCreateUser,
  mockDeactivateSession,
  mockFindSessionByRefreshToken,
  mockUpdateSession,
} = vi.hoisted(() => ({
  mockFindUserByEmail: vi.fn(),
  mockFindUserById: vi.fn(),
  mockHandleFailedLogin: vi.fn(),
  mockHandleSuccessfulLogin: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCreateUser: vi.fn(),
  mockDeactivateSession: vi.fn(),
  mockFindSessionByRefreshToken: vi.fn(),
  mockUpdateSession: vi.fn(),
}));

vi.mock('../../controllers/authController/repository', () => {
  return {
    AuthRepository: function () {
      return {
        findUserByEmail: mockFindUserByEmail,
        findUserById: mockFindUserById,
        handleFailedLogin: mockHandleFailedLogin,
        handleSuccessfulLogin: mockHandleSuccessfulLogin,
        createSession: mockCreateSession,
        createUser: mockCreateUser,
        deactivateSession: mockDeactivateSession,
        findSessionByRefreshToken: mockFindSessionByRefreshToken,
        updateSession: mockUpdateSession,
      };
    },
  };
});

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../utils/csrf', () => ({
  generateCsrfToken: () => 'mock-csrf-token',
  storeCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: '1',
    email: 'admin@test.local',
    password_hash: bcrypt.hashSync('correct-password', 10),
    role: 'admin',
    is_active: true,
    failed_login_attempts: 0,
    locked_until: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeRequest(): any {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'TestAgent/1.0' },
  };
}

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  // --- login ---

  test('login succeeds with valid credentials', async () => {
    const user = makeUser();
    mockFindUserByEmail.mockResolvedValue(user);
    mockHandleSuccessfulLogin.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue(undefined);

    const result = await authService.login(
      { email: 'admin@test.local', password: 'correct-password' },
      makeRequest()
    );

    expect(result.user.email).toBe('admin@test.local');
    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.csrf_token).toBe('mock-csrf-token');
    expect(mockHandleSuccessfulLogin).toHaveBeenCalledWith(expect.anything());
  });

  test('login throws for unknown user', async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@test.local', password: 'pass' }, makeRequest())
    ).rejects.toThrow('Invalid credentials');
  });

  test('login throws for disabled account', async () => {
    mockFindUserByEmail.mockResolvedValue(makeUser({ is_active: false }));

    await expect(
      authService.login({ email: 'admin@test.local', password: 'pass' }, makeRequest())
    ).rejects.toThrow('Account is disabled');
  });

  test('login throws for locked account', async () => {
    const future = new Date(Date.now() + 60000);
    mockFindUserByEmail.mockResolvedValue(
      makeUser({ locked_until: future })
    );

    await expect(
      authService.login({ email: 'admin@test.local', password: 'pass' }, makeRequest())
    ).rejects.toThrow('Account is temporarily locked');
  });

  test('login throws for missing password hash', async () => {
    mockFindUserByEmail.mockResolvedValue(makeUser({ password_hash: null }));

    await expect(
      authService.login({ email: 'admin@test.local', password: 'pass' }, makeRequest())
    ).rejects.toThrow('Invalid credentials');
  });

  test('login increments failed attempts on wrong password', async () => {
    mockFindUserByEmail.mockResolvedValue(
      makeUser({ failed_login_attempts: 2 })
    );
    mockHandleFailedLogin.mockResolvedValue(undefined);

    await expect(
      authService.login(
        { email: 'admin@test.local', password: 'wrong-password' },
        makeRequest()
      )
    ).rejects.toThrow('Invalid credentials');

    expect(mockHandleFailedLogin).toHaveBeenCalledWith(expect.anything(), 3);
  });

  test('login generates valid JWT token', async () => {
    const user = makeUser();
    mockFindUserByEmail.mockResolvedValue(user);
    mockHandleSuccessfulLogin.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue(undefined);

    const result = await authService.login(
      { email: 'admin@test.local', password: 'correct-password' },
      makeRequest()
    );

    const decoded = jwt.verify(result.token, config.security.jwtSecret) as any;
    expect(decoded.sub).toBe(1);
    expect(decoded.email).toBe('admin@test.local');
    expect(decoded.role).toBe('admin');
  });

  // --- register ---

  test('register creates user with hashed password', async () => {
    mockFindUserByEmail.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: 5 });
    mockFindUserById.mockResolvedValue(
      makeUser({ id: 5, email: 'newuser@test.local' })
    );

    const result = await authService.register({
      email: 'newuser@test.local',
      password: 'password123',
      role: 'user',
    });

    expect(result.id).toBe(5);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@test.local',
        role: 'user',
        is_active: true,
        failed_login_attempts: 0,
      })
    );
    const callArgs = mockCreateUser.mock.calls[0][0];
    expect(callArgs.password_hash).not.toBe('password123');
    expect(callArgs.password_hash).toMatch(/^\$2[aby]?\$/);
  });

  test('register throws if email already exists', async () => {
    mockFindUserByEmail.mockResolvedValue(makeUser());

    await expect(
      authService.register({
        email: 'admin@test.local',
        password: 'pass',
        role: 'user',
      })
    ).rejects.toThrow('Email already registered');
  });

  test('register throws when email is missing', async () => {
    await expect(
      authService.register({
        password: 'pass',
        role: 'user',
      } as any)
    ).rejects.toThrow('Email is required');
  });

  test('register throws when password is missing', async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    await expect(
      authService.register({
        email: 'newuser@test.local',
        role: 'user',
      } as any)
    ).rejects.toThrow('Password is required');
  });

  // --- logout ---

  test('logout deactivates session', async () => {
    mockDeactivateSession.mockResolvedValue(undefined);

    await authService.logout('some-token');

    expect(mockDeactivateSession).toHaveBeenCalledWith('some-token');
  });

  // --- refreshToken ---

  test('refreshToken generates new tokens', async () => {
    const user = makeUser();
    mockFindSessionByRefreshToken.mockResolvedValue({
      id: 10,
      user_id: 1,
    });
    mockFindUserById.mockResolvedValue(user);
    mockUpdateSession.mockResolvedValue(undefined);

    const result = await authService.refreshToken('old-refresh-token');

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.csrf_token).toBe('mock-csrf-token');
    expect(mockUpdateSession).toHaveBeenCalledWith(
      10,
      expect.any(String),
      expect.any(String)
    );
  });

  test('refreshToken throws for invalid refresh token', async () => {
    mockFindSessionByRefreshToken.mockResolvedValue(null);

    await expect(authService.refreshToken('bad-token')).rejects.toThrow(
      'Invalid refresh token'
    );
  });

  test('refreshToken throws when user not found', async () => {
    mockFindSessionByRefreshToken.mockResolvedValue({
      id: 10,
      user_id: 999,
    });
    mockFindUserById.mockResolvedValue(null);

    await expect(authService.refreshToken('token')).rejects.toThrow(
      'User not found'
    );
  });

  test('refreshToken throws for inactive user', async () => {
    mockFindSessionByRefreshToken.mockResolvedValue({
      id: 10,
      user_id: 1,
    });
    mockFindUserById.mockResolvedValue(makeUser({ is_active: false }));

    await expect(authService.refreshToken('token')).rejects.toThrow(
      'User not found or inactive'
    );
  });
});
