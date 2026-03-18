import { describe, expect, test, vi } from 'vitest';

import {
  requestSizeLimit,
  requireAuthentication,
  securityHeaders,
  validateContentType,
} from '../../platform/http/middlewares/security';

function makeRequest(overrides: Record<string, any> = {}): any {
  return {
    method: 'GET',
    headers: {},
    user: undefined,
    ...overrides,
  };
}

function makeReply(): any {
  const reply: any = { headers: vi.fn() };
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply;
}

describe('validateContentType', () => {
  test('passes through GET requests regardless of content-type', async () => {
    const req = makeRequest({ method: 'GET' });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('passes through POST with application/json', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('passes through POST with application/json; charset=utf-8', async () => {
    const req = makeRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('rejects POST without content-type', async () => {
    const req = makeRequest({ method: 'POST', headers: {} });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_CONTENT_TYPE' }),
      })
    );
  });

  test('rejects PUT with text/plain content-type', async () => {
    const req = makeRequest({
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
    });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  test('rejects PATCH with form-data content-type', async () => {
    const req = makeRequest({
      method: 'PATCH',
      headers: { 'content-type': 'multipart/form-data' },
    });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  test('passes through DELETE without content-type', async () => {
    const req = makeRequest({ method: 'DELETE', headers: {} });
    const reply = makeReply();

    await validateContentType(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });
});

describe('requestSizeLimit', () => {
  test('passes through request under size limit', async () => {
    const req = makeRequest({ headers: { 'content-length': '1024' } });
    const reply = makeReply();

    await requestSizeLimit(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('rejects request over 10MB', async () => {
    const overLimit = (11 * 1024 * 1024).toString();
    const req = makeRequest({ headers: { 'content-length': overLimit } });
    const reply = makeReply();

    await requestSizeLimit(req, reply);

    expect(reply.status).toHaveBeenCalledWith(413);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'REQUEST_TOO_LARGE' }),
      })
    );
  });

  test('passes through request without content-length', async () => {
    const req = makeRequest({ headers: {} });
    const reply = makeReply();

    await requestSizeLimit(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('passes through request exactly at 10MB', async () => {
    const exact = (10 * 1024 * 1024).toString();
    const req = makeRequest({ headers: { 'content-length': exact } });
    const reply = makeReply();

    await requestSizeLimit(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });
});

describe('securityHeaders', () => {
  test('sets all required security headers', async () => {
    const req = makeRequest();
    const reply = makeReply();

    await securityHeaders(req, reply);

    expect(reply.headers).toHaveBeenCalledWith(
      expect.objectContaining({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      })
    );
  });
});

describe('requireAuthentication', () => {
  test('passes through when user is present', async () => {
    const req = makeRequest({ user: { id: 1, role: 'user', email: 'u@test.local', is_active: true } });
    const reply = makeReply();

    await requireAuthentication(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('returns 401 when no user', async () => {
    const req = makeRequest();
    const reply = makeReply();

    await requireAuthentication(req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      })
    );
  });
});
