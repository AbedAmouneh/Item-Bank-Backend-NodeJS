import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function applyBaseTestEnv(overrides: Record<string, string> = {}): void {
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
  delete process.env['ALLOW_UNSAFE_TEST_TARGETS'];
  delete process.env['CI'];

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

beforeEach(() => {
  vi.resetModules();
  applyBaseTestEnv();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('test safeguards', () => {
  test('rejects non-allowlisted database host in test mode', async () => {
    const { assertSafeTestDatabaseTarget } =
      await import('../../utils/test-safeguards');

    expect(() =>
      assertSafeTestDatabaseTarget('prod-db.internal', 'app_test')
    ).toThrow(/host "prod-db\.internal" is not allowed/i);
  });

  test('rejects database names without _test suffix', async () => {
    const { assertSafeTestDatabaseTarget } =
      await import('../../utils/test-safeguards');

    expect(() => assertSafeTestDatabaseTarget('localhost', 'app_prod')).toThrow(
      /must end with "_test"/i
    );
  });

  test('rejects non-allowlisted redis host in test mode', async () => {
    const { assertSafeTestRedisTarget } =
      await import('../../utils/test-safeguards');

    expect(() => assertSafeTestRedisTarget('redis.prod.local')).toThrow(
      /host "redis\.prod\.local" is not allowed/i
    );
  });

  test('rejects non-allowlisted s3 endpoint in test mode', async () => {
    const { assertSafeTestS3Target } =
      await import('../../utils/test-safeguards');

    expect(() =>
      assertSafeTestS3Target('https://s3.amazonaws.com', true)
    ).toThrow(/endpoint "https:\/\/s3\.amazonaws\.com" is not allowed/i);
  });

  test('allows unsafe override only in CI when flag is enabled', async () => {
    applyBaseTestEnv({
      ALLOW_UNSAFE_TEST_TARGETS: 'true',
      CI: 'true',
    });
    vi.resetModules();

    const { assertSafeTestDatabaseTarget } =
      await import('../../utils/test-safeguards');

    expect(() =>
      assertSafeTestDatabaseTarget('prod-db.internal', 'app_prod')
    ).not.toThrow();
  });

  test('throws for local unsafe override attempts', async () => {
    applyBaseTestEnv({
      ALLOW_UNSAFE_TEST_TARGETS: 'true',
      CI: 'false',
    });
    vi.resetModules();

    const { assertSafeTestDatabaseTarget } =
      await import('../../utils/test-safeguards');

    expect(() => assertSafeTestDatabaseTarget('localhost', 'app_test')).toThrow(
      /only allowed in CI/i
    );
  });

  test('fixture safety check fails for invalid configured test target', async () => {
    applyBaseTestEnv({
      DB_HOST: 'prod-db.internal',
      DB_NAME: 'app_test',
    });
    vi.resetModules();

    const { assertFixtureLoadSafety } =
      await import('../../utils/test-safeguards');

    expect(() => assertFixtureLoadSafety()).toThrow(
      /fixture loader database safeguard violation/i
    );
  });
});
