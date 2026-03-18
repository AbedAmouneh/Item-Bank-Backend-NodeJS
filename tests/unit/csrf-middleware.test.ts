import { beforeEach, describe, expect, test, vi } from 'vitest';

import { validateCsrf } from '../../platform/http/middlewares/csrf';

const { mockValidateCsrfToken, mockWarn, mockDebug } = vi.hoisted(() => ({
  mockValidateCsrfToken: vi.fn(),
  mockWarn: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('../../utils/csrf', () => ({
  validateCsrfToken: mockValidateCsrfToken,
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    warn: mockWarn,
    debug: mockDebug,
  }),
}));

function makeRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  cookies: Record<string, string> = {}
): any {
  return { method, url, headers, cookies };
}

function makeReply(): any {
  const reply: any = {};
  reply.code = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply;
}

describe('csrf middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- skipped methods ---

  test('skips validation for GET requests', async () => {
    const req = makeRequest('GET', '/api/items');
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(mockValidateCsrfToken).not.toHaveBeenCalled();
  });

  test('skips validation for HEAD requests', async () => {
    const req = makeRequest('HEAD', '/api/health');
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  test('skips validation for OPTIONS requests', async () => {
    const req = makeRequest('OPTIONS', '/api/items');
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  // --- skipped paths ---

  test('skips validation for /auth/login', async () => {
    const req = makeRequest('POST', '/auth/login');
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  test('skips validation for /auth/refresh-token', async () => {
    const req = makeRequest('POST', '/auth/refresh-token');
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  test('skips validation for /ping', async () => {
    const req = makeRequest('POST', '/ping');
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  // --- missing tokens ---

  test('returns 403 when x-csrf-token header is missing', async () => {
    const req = makeRequest('POST', '/api/items', {}, { access_token: 'at' });
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CSRF_TOKEN_MISSING' }),
      })
    );
  });

  test('returns 401 when access_token cookie is missing', async () => {
    const req = makeRequest(
      'POST',
      '/api/items',
      { 'x-csrf-token': 'tok' },
      {}
    );
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  // --- validation results ---

  test('returns 403 when csrf token is invalid', async () => {
    mockValidateCsrfToken.mockResolvedValue(false);

    const req = makeRequest(
      'DELETE',
      '/api/items/1',
      { 'x-csrf-token': 'bad' },
      { access_token: 'at' }
    );
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_CSRF_TOKEN' }),
      })
    );
  });

  test('passes through when csrf token is valid', async () => {
    mockValidateCsrfToken.mockResolvedValue(true);

    const req = makeRequest(
      'PUT',
      '/api/items/1',
      { 'x-csrf-token': 'valid' },
      { access_token: 'at' }
    );
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalled();
  });

  test('validates PATCH requests', async () => {
    mockValidateCsrfToken.mockResolvedValue(true);

    const req = makeRequest(
      'PATCH',
      '/api/settings',
      { 'x-csrf-token': 'tok' },
      { access_token: 'at' }
    );
    const reply = makeReply();

    await validateCsrf(req, reply);

    expect(mockValidateCsrfToken).toHaveBeenCalledWith('at', 'tok');
    expect(reply.code).not.toHaveBeenCalled();
  });
});
