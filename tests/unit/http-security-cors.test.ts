import { describe, expect, test, vi } from 'vitest';

vi.mock('../../utils/config', () => ({
  config: {
    cors: {
      origin: 'https://app.example.com',
      credentials: true,
    },
  },
}));

const { corsConfig } = await import('../../platform/http/cors');
import {
  BLOCKED_PATTERNS,
  BLOCKED_USER_AGENTS,
  isBlockedUrl,
  isBlockedUserAgent,
} from '../../platform/http/security-patterns';

describe('platform/http security + cors helpers', () => {
  test('security pattern lists are defined', () => {
    expect(BLOCKED_PATTERNS.length).toBeGreaterThan(10);
    expect(BLOCKED_USER_AGENTS.length).toBeGreaterThan(5);
  });

  test('isBlockedUrl flags known scanner paths', () => {
    expect(isBlockedUrl('/wp-admin/admin.php')).toBe(true);
    expect(isBlockedUrl('/.env')).toBe(true);
    expect(isBlockedUrl('/random/path')).toBe(false);
  });

  test('isBlockedUserAgent flags bots and scanners', () => {
    expect(isBlockedUserAgent('Googlebot/2.1')).toBe(true);
    expect(isBlockedUserAgent('sqlmap/1.8')).toBe(true);
    expect(isBlockedUserAgent('Mozilla/5.0 Safari')).toBe(false);
  });

  test('cors origin callback allows localhost and configured origins', () => {
    const originHandler = corsConfig.origin as (
      origin: string | undefined,
      callback: (error: Error | null, success: boolean) => void
    ) => void;

    const allow = (origin: string | undefined) =>
      new Promise<boolean>((resolve, reject) => {
        originHandler(origin, (error, success) => {
          if (error) return reject(error);
          resolve(success);
        });
      });

    return Promise.all([
      expect(allow(undefined)).resolves.toBe(true),
      expect(allow('http://localhost:3000')).resolves.toBe(true),
      expect(allow('http://127.0.0.1:3001')).resolves.toBe(true),
      expect(allow('https://app.example.com')).resolves.toBe(true),
    ]);
  });

  test('cors origin callback rejects unknown origins', async () => {
    const originHandler = corsConfig.origin as (
      origin: string | undefined,
      callback: (error: Error | null, success: boolean) => void
    ) => void;

    await expect(
      new Promise<boolean>((resolve, reject) => {
        originHandler('https://evil.example.com', (error, success) => {
          if (error) return reject(error);
          resolve(success);
        });
      })
    ).rejects.toThrow(/not allowed by cors/i);
  });

  test('cors static options are set', () => {
    expect(corsConfig.credentials).toBe(true);
    expect(corsConfig.methods).toEqual([
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'OPTIONS',
    ]);
    expect(corsConfig.allowedHeaders).toContain('X-CSRF-Token');
  });
});
