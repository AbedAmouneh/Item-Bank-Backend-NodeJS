import { beforeEach, describe, expect, test, vi } from 'vitest';

import { securityFilter } from '../../platform/http/middlewares/security-filter';
import {
  isBlockedUrl,
  isBlockedUserAgent,
} from '../../platform/http/security-patterns';

const { mockWarn } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    warn: mockWarn,
  }),
}));

function makeRequest(url: string, userAgent = 'Mozilla/5.0'): any {
  return {
    url,
    headers: { 'user-agent': userAgent },
    ip: '1.2.3.4',
  };
}

function makeReply(): any {
  const reply: any = {};
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply;
}

describe('security filter middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns 204 for /favicon.ico', async () => {
    const req = makeRequest('/favicon.ico');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).toHaveBeenCalledWith(204);
  });

  test('blocks WordPress scanning URLs with 404', async () => {
    const req = makeRequest('/wp-admin/install.php');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(mockWarn).toHaveBeenCalled();
  });

  test('blocks .env access attempts', async () => {
    const req = makeRequest('/.env');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  test('blocks .git access attempts', async () => {
    const req = makeRequest('/.git/config');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  test('blocks PHP file requests', async () => {
    const req = makeRequest('/shell.php');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  test('blocks scanner user agents', async () => {
    const req = makeRequest('/api/health', 'sqlmap/1.5');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
  });

  test('allows legitimate requests through', async () => {
    const req = makeRequest('/api/items');
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });

  test('allows requests with empty user-agent', async () => {
    const req = makeRequest('/api/health', '');
    // Override to simulate missing header
    req.headers = {};
    const reply = makeReply();

    await securityFilter(req, reply);

    expect(reply.status).not.toHaveBeenCalled();
  });
});

describe('security patterns', () => {
  // --- isBlockedUrl ---

  test('blocks WordPress paths', () => {
    expect(isBlockedUrl('/wp-admin/')).toBe(true);
    expect(isBlockedUrl('/wp-content/uploads')).toBe(true);
    expect(isBlockedUrl('/wp-json/wp/v2')).toBe(true);
    expect(isBlockedUrl('/xmlrpc.php')).toBe(true);
  });

  test('blocks common attack vectors', () => {
    expect(isBlockedUrl('/.env')).toBe(true);
    expect(isBlockedUrl('/.git/HEAD')).toBe(true);
    expect(isBlockedUrl('/admin/')).toBe(true);
    expect(isBlockedUrl('/phpmyadmin/')).toBe(true);
  });

  test('blocks CMS scanning paths', () => {
    expect(isBlockedUrl('/drupal/')).toBe(true);
    expect(isBlockedUrl('/joomla/')).toBe(true);
    expect(isBlockedUrl('/magento/')).toBe(true);
  });

  test('allows legitimate API paths', () => {
    expect(isBlockedUrl('/api/items')).toBe(false);
    expect(isBlockedUrl('/api/auth/login')).toBe(false);
    expect(isBlockedUrl('/health')).toBe(false);
  });

  // --- isBlockedUserAgent ---

  test('blocks known scanner user agents', () => {
    expect(isBlockedUserAgent('sqlmap/1.5')).toBe(true);
    expect(isBlockedUserAgent('Nikto/2.1.6')).toBe(true);
    expect(isBlockedUserAgent('python-requests/2.28')).toBe(true);
    expect(isBlockedUserAgent('Googlebot/2.1')).toBe(true);
    expect(isBlockedUserAgent('masscan/1.3')).toBe(true);
  });

  test('allows normal browser user agents', () => {
    expect(
      isBlockedUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120'
      )
    ).toBe(false);
  });

  test('allows empty user agent', () => {
    expect(isBlockedUserAgent('')).toBe(false);
  });
});
