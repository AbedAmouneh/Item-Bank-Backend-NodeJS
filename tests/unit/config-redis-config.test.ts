import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function applyRequiredEnv(overrides: Record<string, string> = {}): void {
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] =
    'postgresql://app_test_user:app_test_password@localhost:5433/app_test';
  process.env['DB_HOST'] = 'localhost';
  process.env['DB_PORT'] = '5433';
  process.env['DB_NAME'] = 'app_test';
  process.env['DB_USER'] = 'app_test_user';
  process.env['DB_PASSWORD'] = 'app_test_password';
  process.env['JWT_SECRET'] = 'test-jwt-secret-should-be-at-least-32';
  process.env['COOKIE_SECRET'] = 'test-cookie-secret-should-be-32char';
  process.env['AWS_REGION'] = 'eu-west-1';

  delete process.env['REDIS_URL'];
  delete process.env['REDIS_PASSWORD'];

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

describe('config and redis-config utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    applyRequiredEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('uses hardcoded test safeguard values', async () => {
    applyRequiredEnv({
      TEST_DB_NAME_SUFFIX: '_prod_override_attempt',
      ALLOW_UNSAFE_TEST_TARGETS: 'true',
    });

    const { config } = await import('../../utils/config');

    expect(config.testSafeguards.dbHostAllowlist).toEqual([
      'localhost',
      '127.0.0.1',
      'postgres',
      'db',
    ]);
    expect(config.testSafeguards.dbNameSuffix).toBe('_test');
    expect(config.testSafeguards.awsS3Endpoint).toBe('http://localhost:4566');
    expect(config.testSafeguards.allowUnsafeTestTargets).toBe(false);
  });

  test('parses redis host/port/password from REDIS_URL', async () => {
    applyRequiredEnv({
      REDIS_URL: 'redis://:secret@redis:6380/0',
    });

    const { getRedisConnectionOptions } =
      await import('../../utils/redis-config');

    expect(getRedisConnectionOptions()).toEqual({
      host: 'redis',
      port: 6380,
      password: 'secret',
    });
  });

  test('falls back to explicit redis host values when REDIS_URL is absent', async () => {
    applyRequiredEnv({
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6399',
      REDIS_PASSWORD: 'abc',
    });

    const { getRedisConnectionOptions } =
      await import('../../utils/redis-config');

    expect(getRedisConnectionOptions()).toEqual({
      host: '127.0.0.1',
      port: 6399,
      password: 'abc',
    });
  });
});
