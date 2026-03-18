import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { auditContext } from '../../platform/http/middlewares/audit-context';
import { config } from '../../utils/config';

const { mockSetContext } = vi.hoisted(() => ({
  mockSetContext: vi.fn(),
}));

vi.mock('../../platform/database/audit-logger', () => ({
  AuditLogger: {
    setContext: mockSetContext,
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

function makeRequest(overrides: Record<string, any> = {}): any {
  return {
    ip: '10.0.0.1',
    headers: { 'user-agent': 'TestAgent/1.0' },
    ...overrides,
  };
}

function makeReply(): any {
  return {};
}

describe('auditContext middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('sets context from request.user when present', async () => {
    const req = makeRequest({ user: { id: 42, role: 'admin', email: 'a@test.local', is_active: true } });
    const reply = makeReply();

    await auditContext(req, reply);

    expect(mockSetContext).toHaveBeenCalledWith({
      userId: 42,
      ipAddress: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
    });
  });

  test('extracts user ID from Bearer token when no request.user', async () => {
    const token = jwt.sign(
      {
        sub: 7,
        email: 'u@test.local',
        role: 'user',
        is_active: true,
      },
      config.security.jwtSecret,
      { expiresIn: '1h' }
    );
    const req = makeRequest({
      headers: {
        authorization: `Bearer ${token}`,
        'user-agent': 'TestAgent/1.0',
      },
    });
    const reply = makeReply();

    await auditContext(req, reply);

    expect(mockSetContext).toHaveBeenCalledWith({
      userId: 7,
      ipAddress: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
    });
  });

  test('sets null userId when no user and no token', async () => {
    const req = makeRequest({ headers: { 'user-agent': 'Bot' } });
    const reply = makeReply();

    await auditContext(req, reply);

    expect(mockSetContext).toHaveBeenCalledWith({
      userId: null,
      ipAddress: '10.0.0.1',
      userAgent: 'Bot',
    });
  });

  test('sets null userId for invalid Bearer token', async () => {
    const req = makeRequest({
      headers: { authorization: 'Bearer invalid.token', 'user-agent': 'X' },
    });
    const reply = makeReply();

    await auditContext(req, reply);

    expect(mockSetContext).toHaveBeenCalledWith({
      userId: null,
      ipAddress: '10.0.0.1',
      userAgent: 'X',
    });
  });

  test('handles missing user-agent header', async () => {
    const req = makeRequest({ headers: {} });
    const reply = makeReply();

    await auditContext(req, reply);

    expect(mockSetContext).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: null })
    );
  });

  test('uses "unknown" when ip is falsy', async () => {
    const req = makeRequest({ ip: '', headers: { 'user-agent': 'X' } });
    const reply = makeReply();

    await auditContext(req, reply);

    expect(mockSetContext).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: 'unknown' })
    );
  });
});
