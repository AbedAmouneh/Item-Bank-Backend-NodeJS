import { config } from './config';

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().toLowerCase().replace(/\/+$/, '');
}

function shouldEnforceTestSafeguards(): boolean {
  return config.server.env === 'test';
}

function isUnsafeOverrideEnabled(): boolean {
  const requestedOverride = process.env['ALLOW_UNSAFE_TEST_TARGETS'] === 'true';

  if (!requestedOverride) {
    return config.testSafeguards.allowUnsafeTestTargets;
  }

  if (process.env['CI'] !== 'true') {
    throw new Error(
      'Unsafe test target override is only allowed in CI (set CI=true).'
    );
  }

  return true;
}

function assertAllowedHost(
  host: string,
  allowlist: readonly string[],
  resource: string
): void {
  const normalizedHost = normalizeHost(host);
  const normalizedAllowlist = allowlist.map(normalizeHost);

  if (!normalizedAllowlist.includes(normalizedHost)) {
    throw new Error(
      `${resource} safeguard violation: host "${host}" is not allowed in test mode. Allowed hosts: ${allowlist.join(', ')}`
    );
  }
}

export function assertSafeTestDatabaseTarget(
  host: string,
  dbName: string,
  context: string = 'Database'
): void {
  if (!shouldEnforceTestSafeguards() || isUnsafeOverrideEnabled()) {
    return;
  }

  assertAllowedHost(host, config.testSafeguards.dbHostAllowlist, context);

  if (!dbName.endsWith(config.testSafeguards.dbNameSuffix)) {
    throw new Error(
      `${context} safeguard violation: database "${dbName}" must end with "${config.testSafeguards.dbNameSuffix}" in test mode.`
    );
  }
}

export function assertSafeTestRedisTarget(
  host: string,
  context: string = 'Redis'
): void {
  if (!shouldEnforceTestSafeguards() || isUnsafeOverrideEnabled()) {
    return;
  }

  assertAllowedHost(host, config.testSafeguards.redisHostAllowlist, context);
}

export function assertSafeTestS3Target(
  endpoint: string,
  forcePathStyle: boolean,
  context: string = 'S3'
): void {
  if (!shouldEnforceTestSafeguards() || isUnsafeOverrideEnabled()) {
    return;
  }

  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const allowedEndpoints =
    config.testSafeguards.s3EndpointAllowlist.map(normalizeEndpoint);

  if (!allowedEndpoints.includes(normalizedEndpoint)) {
    throw new Error(
      `${context} safeguard violation: endpoint "${endpoint}" is not allowed in test mode. Allowed endpoints: ${config.testSafeguards.s3EndpointAllowlist.join(', ')}`
    );
  }

  if (!forcePathStyle) {
    throw new Error(
      `${context} safeguard violation: forcePathStyle must be true in test mode.`
    );
  }
}

export function assertFixtureLoadSafety(): void {
  if (config.server.env !== 'test') {
    throw new Error(
      'Fixture loader safeguard violation: NODE_ENV must be test for fixture loading.'
    );
  }

  assertSafeTestDatabaseTarget(
    config.database.host,
    config.database.name,
    'Fixture loader database'
  );
}
