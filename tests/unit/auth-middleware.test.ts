import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  authenticateToken,
  optionalAuth,
  requireAnyRole,
  requirePermission,
  requireRole,
} from '../../platform/http/middlewares/auth';
import { config } from '../../utils/config';

const { mockDebug, mockError, mockWarn } = vi.hoisted(() => ({
  mockDebug: vi.fn(),
  mockError: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    debug: mockDebug,
    error: mockError,
    warn: mockWarn,
  }),
}));

function makeRequest(cookies: Record<string, string> = {}, user?: any): any {
  return {
    cookies,
    headers: {},
    user,
  };
}

function makeReply(): any {
  const reply: any = {};
  reply.status = vi.fn().mockReturnValue(reply);
  reply.code = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply;
}

function signToken(payload: Record<string, any>): string {
  return jwt.sign(payload, config.security.jwtSecret, { expiresIn: '1h' });
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- authenticateToken ---

  test('returns 401 when no access_token cookie is present', async () => {
    const req = makeRequest();
    const reply = makeReply();

    await authenticateToken(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      })
    );
  });

  test('populates request.user for a valid token', async () => {
    const token = signToken({
      sub: 42,
      email: 'admin@test.local',
      role: 'admin',
      is_active: true,
    });
    const req = makeRequest({ access_token: token });
    const reply = makeReply();

    await authenticateToken(req, reply);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(42);
    expect(req.user.email).toBe('admin@test.local');
    expect(req.user.tenant_id).toBeDefined();
    expect(reply.status).not.toHaveBeenCalled();
  });

  test('returns 401 for disabled account', async () => {
    const token = signToken({
      sub: 1,
      email: 'disabled@test.local',
      role: 'user',
      is_active: false,
    });
    const req = makeRequest({ access_token: token });
    const reply = makeReply();

    await authenticateToken(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'ACCOUNT_DISABLED' }),
      })
    );
  });

  test('returns TOKEN_EXPIRED for expired token', async () => {
    const token = jwt.sign(
      {
        sub: 1,
        email: 'u@test.local',
        role: 'user',
        is_active: true,
      },
      config.security.jwtSecret,
      { expiresIn: '-1s' }
    );
    const req = makeRequest({ access_token: token });
    const reply = makeReply();

    await authenticateToken(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
      })
    );
  });

  test('returns INVALID_TOKEN for malformed token', async () => {
    const req = makeRequest({ access_token: 'not.a.jwt' });
    const reply = makeReply();

    await authenticateToken(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_TOKEN' }),
      })
    );
  });

  // --- requireRole ---

  test('allows matching role', async () => {
    const middleware = requireRole('org_admin');
    const req = makeRequest(
      {},
      {
        id: 1,
        tenant_id: 1,
        email: 'admin@test.local',
        roles: ['org_admin'],
      }
    );
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('returns 403 for wrong role', async () => {
    const middleware = requireRole('org_admin');
    const req = makeRequest({}, { id: 1, tenant_id: 1, email: 'u@test.local', roles: ['user'] });
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INSUFFICIENT_ROLE' }),
      })
    );
  });

  test('returns 401 when no user is present', async () => {
    const middleware = requireRole('user');
    const req = makeRequest();
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  // --- requireAnyRole ---

  test('allows when user has one of the required roles', async () => {
    const middleware = requireAnyRole(['org_admin', 'user']);
    const req = makeRequest({}, { id: 1, tenant_id: 1, email: 'u@test.local', roles: ['user'] });
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('rejects when user has none of the required roles', async () => {
    const middleware = requireAnyRole(['org_admin']);
    const req = makeRequest({}, { id: 1, tenant_id: 1, email: 'u@test.local', roles: ['user'] });
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
  });

  // --- requirePermission ---

  test('allows when user is authenticated (permissions removed)', async () => {
    const middleware = requirePermission('read');
    const req = makeRequest({}, { id: 1, tenant_id: 1, email: 'a@test.local', roles: ['org_admin'] });
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('allows any authenticated user (permissions removed)', async () => {
    const middleware = requirePermission('users:delete');
    const req = makeRequest({}, { id: 1, tenant_id: 1, email: 'u@test.local', roles: ['user'] });
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('returns 401 when no user for requirePermission', async () => {
    const middleware = requirePermission('read');
    const req = makeRequest();
    const reply = makeReply();

    await middleware(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  // --- optionalAuth ---

  test('does nothing when no token is provided', async () => {
    const req = makeRequest();
    const reply = makeReply();

    await optionalAuth(req, reply);

    expect(req.user).toBeUndefined();
    expect(reply.status).not.toHaveBeenCalled();
  });

  test('populates user when valid token is provided', async () => {
    const token = signToken({
      sub: 7,
      email: 'opt@test.local',
      role: 'user',
      is_active: true,
    });
    const req = makeRequest({ access_token: token });
    const reply = makeReply();

    await optionalAuth(req, reply);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(7);
    expect(req.user.tenant_id).toBeDefined();
    expect(req.user.roles).toBeDefined();
  });

  test('silently ignores invalid token in optionalAuth', async () => {
    const req = makeRequest({ access_token: 'garbage' });
    const reply = makeReply();

    await optionalAuth(req, reply);

    expect(req.user).toBeUndefined();
    expect(reply.status).not.toHaveBeenCalled();
  });

  test('does not populate user when is_active is false in optionalAuth', async () => {
    const token = signToken({
      sub: 8,
      email: 'inactive@test.local',
      role: 'user',
      is_active: false,
    });
    const req = makeRequest({ access_token: token });
    const reply = makeReply();

    await optionalAuth(req, reply);

    expect(req.user).toBeUndefined();
  });
});
