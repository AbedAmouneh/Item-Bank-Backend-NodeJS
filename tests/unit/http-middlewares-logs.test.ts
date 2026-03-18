import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  redactHeaders,
  redactSensitiveData,
  shouldLogBody,
  shouldLogRequest,
  truncateBody,
} from '../../platform/http/logs/redact';
import {
  auditLog,
  requestSizeLimit,
  requireAuthentication,
  securityHeaders,
  validateContentType,
} from '../../platform/http/middlewares/security';

const logger = {
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../utils/logger', () => ({
  createChildLogger: vi.fn(() => logger),
}));

describe('http logs + middleware helpers', () => {
  beforeEach(() => {
    logger.warn.mockReset();
  });

  test('redacts sensitive nested fields and arrays', () => {
    const input = {
      email: 'alice@test.local',
      password: 'secret',
      profile: {
        accessToken: 'abc',
        nested: [{ apiKey: '123' }, { safe: 'ok' }],
      },
    };

    const redacted = redactSensitiveData(input) as any;
    expect(redacted.email).toBe('alice@test.local');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.profile.accessToken).toBe('[REDACTED]');
    expect(redacted.profile.nested[0].apiKey).toBe('[REDACTED]');
    expect(redacted.profile.nested[1].safe).toBe('ok');
  });

  test('header redaction and body/request logging gates work', () => {
    expect(
      redactHeaders({ authorization: 'x', cookie: 'y', accept: 'z' })
    ).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      accept: 'z',
    });

    expect(shouldLogBody('/api/upload')).toBe(false);
    expect(shouldLogBody('/api/v1/users')).toBe(true);

    expect(shouldLogRequest('/health')).toBe(false);
    expect(shouldLogRequest('/wp-admin/admin.php')).toBe(false);
    expect(shouldLogRequest('/api/v1/users')).toBe(true);
  });

  test('truncateBody returns marker only for oversized payload', () => {
    const small = { a: 1 };
    expect(truncateBody(small, 100)).toEqual(small);

    const big = { data: 'x'.repeat(200) };
    const truncated = truncateBody(big, 50) as any;
    expect(truncated._truncated).toBe(true);
    expect(truncated._originalLength).toBeGreaterThan(50);
    expect(String(truncated.data).length).toBe(50);
  });

  test('security middleware enforces content type and size/auth checks', async () => {
    const sent: any[] = [];
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn((body: unknown) => {
        sent.push(body);
        return reply;
      }),
      headers: vi.fn(),
    } as any;

    await validateContentType({ method: 'POST', headers: {} } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(400);

    await requestSizeLimit(
      { headers: { 'content-length': String(11 * 1024 * 1024) } } as any,
      reply
    );
    expect(reply.status).toHaveBeenCalledWith(413);

    await requireAuthentication({ user: null } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(401);

    await securityHeaders({} as any, reply);
    expect(reply.headers).toHaveBeenCalled();

    await expect(auditLog({} as any, reply)).resolves.toBeUndefined();
    expect(sent.length).toBeGreaterThanOrEqual(3);
  });

  test('securityFilter blocks malicious url/user-agent and allows valid', async () => {
    const { securityFilter } =
      await import('../../platform/http/middlewares/security-filter');

    const makeReply = () => {
      const reply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;
      return reply;
    };

    const faviconReply = makeReply();
    await securityFilter(
      {
        url: '/favicon.ico',
        headers: {},
        ip: '1.1.1.1',
      } as any,
      faviconReply
    );
    expect(faviconReply.status).toHaveBeenCalledWith(204);

    const blockedReply = makeReply();
    await securityFilter(
      {
        url: '/wp-admin/admin.php',
        headers: { 'user-agent': 'Mozilla' },
        ip: '2.2.2.2',
      } as any,
      blockedReply
    );
    expect(blockedReply.status).toHaveBeenCalledWith(404);
    expect(logger.warn).toHaveBeenCalled();

    const blockedUaReply = makeReply();
    await securityFilter(
      {
        url: '/api/ok',
        headers: { 'user-agent': 'sqlmap/1.0' },
        ip: '3.3.3.3',
      } as any,
      blockedUaReply
    );
    expect(blockedUaReply.status).toHaveBeenCalledWith(404);

    const okReply = makeReply();
    await expect(
      securityFilter(
        {
          url: '/api/ok',
          headers: { 'user-agent': 'Mozilla/5.0' },
          ip: '4.4.4.4',
        } as any,
        okReply
      )
    ).resolves.toBeUndefined();
    expect(okReply.status).not.toHaveBeenCalled();
  });
});
