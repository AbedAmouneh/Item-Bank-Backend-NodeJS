import { beforeEach, describe, expect, test, vi } from 'vitest';
import { FastifyReply, FastifyRequest } from 'fastify';

import { getMe } from '../../../controllers/authController/handlers/get_me';
import { login } from '../../../controllers/authController/handlers/post_login';
import { logout } from '../../../controllers/authController/handlers/post_logout';
import { refreshToken } from '../../../controllers/authController/handlers/post_refresh_token';
import { register } from '../../../controllers/authController/handlers/post_register';
import { AuthenticatedRequest } from '../../../platform/http/middlewares/auth';

const { mockAuthService } = vi.hoisted(() => ({
  mockAuthService: {
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

vi.mock('../../../controllers/authController/service', () => ({
  AuthService: function () {
    return mockAuthService;
  },
}));

vi.mock('../../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('../../../utils/config', () => ({
  config: {
    server: {
      env: 'test',
    },
  },
}));

vi.mock('../../../utils/date', () => ({
  toIsoString: (date: Date | null) => (date ? date.toISOString() : null),
}));

function makeRequest(overrides: any = {}): FastifyRequest {
  return {
    body: {},
    headers: {},
    cookies: {},
    ...overrides,
  } as any;
}

function makeAuthRequest(overrides: any = {}): AuthenticatedRequest {
  return {
    user: {
      id: 1,
      email: 'admin@test.local',
      role: 'admin',
      is_active: true,
    },
    body: {},
    ...overrides,
  } as any;
}

function makeReply(): FastifyReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as any;
}

describe('Auth Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMe', () => {
    test('returns 200 with user data from request.user', async () => {
      const request = makeAuthRequest({
        user: { id: 42, email: 'me@test.local', role: 'user', is_active: true },
      });
      const reply = makeReply();

      await getMe(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          id: '42',
          email: 'me@test.local',
          role: 'user',
          is_active: true,
        },
      });
    });

    test('returns 401 when request.user is missing and throws', async () => {
      // Omit user so destructuring throws inside the handler's try block
      const request = {} as any;
      const reply = makeReply();

      await getMe(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
    });
  });

  describe('login', () => {
    test('returns tokens on successful login', async () => {
      mockAuthService.login.mockResolvedValue({
        user: { id: 1, email: 'user1@test.local' },
        token: 'token123',
        refreshToken: 'refresh123',
        csrf_token: 'csrf123',
      });

      const request = makeRequest({
        body: { email: 'user1@test.local', password: 'pass123' },
        cookies: {},
      });
      const reply = makeReply();
      reply.setCookie = vi.fn().mockReturnThis();

      await login(request, reply);

      expect(reply.setCookie).toHaveBeenCalledTimes(2);
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ csrf_token: 'csrf123' }),
        })
      );
    });

    test('returns 401 on login error', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const request = makeRequest({
        body: { email: 'user1@test.local', password: 'wrong' },
      });
      const reply = makeReply();

      await login(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'LOGIN_FAILED' }),
        })
      );
    });
  });

  describe('logout', () => {
    test('logs out user successfully', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const request = makeRequest({ cookies: { access_token: 'token123' } });
      const reply = makeReply();
      reply.clearCookie = vi.fn().mockReturnThis();

      await logout(request, reply);

      expect(reply.clearCookie).toHaveBeenCalledTimes(2);
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    test('returns 400 on error', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('Error'));

      const request = makeRequest({ cookies: { access_token: 'token123' } });
      const reply = makeReply();
      reply.clearCookie = vi.fn().mockReturnThis();

      await logout(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('register', () => {
    test('registers user successfully', async () => {
      mockAuthService.register.mockResolvedValue({
        id: 1,
        email: 'newuser@test.local',
        role: 'user',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const request = makeAuthRequest({
        body: {
          email: 'newuser@test.local',
          password: 'pass1234',
          role: 'user',
        },
      });
      const reply = makeReply();

      await register(request, reply);

      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    test('returns 400 on duplicate email', async () => {
      mockAuthService.register.mockRejectedValue(
        new Error('Email already registered')
      );

      const request = makeAuthRequest({
        body: { email: 'existing@test.local', password: 'pass', role: 'user' },
      });
      const reply = makeReply();

      await register(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('refreshToken', () => {
    test('refreshes tokens successfully', async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        token: 'new_token123',
        refreshToken: 'new_refresh123',
        csrf_token: 'new_csrf123',
      });

      const request = makeRequest({
        cookies: { refresh_token: 'old_refresh123' },
      });
      const reply = makeReply();
      reply.setCookie = vi.fn().mockReturnThis();

      await refreshToken(request, reply);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'old_refresh123'
      );
      expect(reply.setCookie).toHaveBeenCalledTimes(2);
      expect(reply.setCookie).toHaveBeenCalledWith(
        'access_token',
        'new_token123',
        expect.any(Object)
      );
      expect(reply.setCookie).toHaveBeenCalledWith(
        'refresh_token',
        'new_refresh123',
        expect.any(Object)
      );
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ csrf_token: 'new_csrf123' }),
        })
      );
    });

    test('returns 401 when refresh token not in cookies', async () => {
      const request = makeRequest({ cookies: {} });
      const reply = makeReply();

      await refreshToken(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'TOKEN_REFRESH_FAILED' }),
        })
      );
    });

    test('returns 401 on refresh error', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const request = makeRequest({
        cookies: { refresh_token: 'invalid_token' },
      });
      const reply = makeReply();

      await refreshToken(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOKEN_REFRESH_FAILED',
            message: 'Invalid refresh token',
          }),
        })
      );
    });
  });
});
