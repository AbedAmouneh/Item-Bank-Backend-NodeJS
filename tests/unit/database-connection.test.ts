import { beforeEach, describe, expect, test, vi } from 'vitest';

let poolOptions: any;
let poolConnectMock: any;
let poolEndMock: any;
let poolOnMock: any;
let clientQueryMock: any;
let clientReleaseMock: any;
const assertSafeDbTarget = vi.fn();
const auditLogQuery = vi.fn();
const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function setupPgMocks() {
  clientQueryMock = vi.fn();
  clientReleaseMock = vi.fn();
  poolConnectMock = vi.fn(async () => ({
    query: clientQueryMock,
    release: clientReleaseMock,
  }));
  poolEndMock = vi.fn();
  poolOnMock = vi.fn();

  vi.doMock('pg', () => ({
    Pool: function MockPool(this: any, opts: unknown) {
      poolOptions = opts;
      this.connect = poolConnectMock;
      this.end = poolEndMock;
      this.on = poolOnMock;
      this.totalCount = 3;
      this.idleCount = 2;
      this.waitingCount = 1;
    },
  }));
}

function setupCommonMocks(configOverride?: Record<string, unknown>) {
  const cfg = {
    database: {
      host: 'localhost',
      port: 5432,
      name: 'app_test',
      user: 'u',
      password: 'p',
      pool: { min: 1, max: 5 },
      caCert: undefined,
    },
    server: {
      env: 'test',
    },
    ...(configOverride ?? {}),
  };

  vi.doMock('../../utils/config', () => ({ config: cfg }));
  vi.doMock('../../utils/test-safeguards', () => ({
    assertSafeTestDatabaseTarget: assertSafeDbTarget,
  }));
  vi.doMock('../../utils/logger', () => ({
    createChildLogger: vi.fn(() => logger),
  }));
  vi.doMock('../../platform/database/audit-logger', () => ({
    AuditLogger: {
      logQuery: auditLogQuery,
      getContext: vi.fn(() => ({ requestId: 'test-request-id' })),
    },
  }));
  vi.doMock('fs', () => ({
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
  }));
}

describe('platform/database/connection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    poolOptions = undefined;
    setupPgMocks();
    setupCommonMocks();
  });

  test('disables ssl for test env and enforces DB safeguard', async () => {
    await import('../../platform/database/connection');

    expect(poolOptions.ssl).toBe(false);
    expect(assertSafeDbTarget).toHaveBeenCalledWith(
      'localhost',
      'app_test',
      'Database connection'
    );
  });

  test('uses configured CA cert for non-local production env', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    setupPgMocks();
    setupCommonMocks({
      database: {
        host: 'prod-db.example.com',
        port: 5432,
        name: 'app_prod',
        user: 'u',
        password: 'p',
        pool: { min: 1, max: 5 },
        caCert: 'CERTDATA',
      },
      server: { env: 'production' },
    });

    await import('../../platform/database/connection');

    expect(poolOptions.ssl).toEqual({
      rejectUnauthorized: true,
      ca: 'CERTDATA',
    });
  });

  test('query success logs metrics and releases client', async () => {
    const result = { rows: [{ x: 1 }], rowCount: 1 };
    clientQueryMock.mockResolvedValueOnce(result);

    const { db } = await import('../../platform/database/connection');
    await expect(db.query('SELECT 1', [123])).resolves.toEqual(result);

    expect(clientQueryMock).toHaveBeenCalledWith('SELECT 1', [123]);
    expect(clientReleaseMock).toHaveBeenCalled();
    expect(auditLogQuery).toHaveBeenCalled();
  });

  test('query failure logs and rethrows', async () => {
    const err = new Error('db failed');
    clientQueryMock.mockRejectedValueOnce(err);

    const { db } = await import('../../platform/database/connection');

    await expect(db.query('SELECT fail', [])).rejects.toThrow('db failed');
    expect(clientReleaseMock).toHaveBeenCalled();
    expect(auditLogQuery).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  test('transaction commits and rollbacks', async () => {
    clientQueryMock.mockResolvedValueOnce(undefined); // BEGIN
    clientQueryMock.mockResolvedValueOnce({ ok: 1 }); // callback query
    clientQueryMock.mockResolvedValueOnce(undefined); // COMMIT

    const { db } = await import('../../platform/database/connection');

    const ok = await db.transaction(async client => {
      await client.query('SELECT 1');
      return 5;
    });
    expect(ok).toBe(5);

    clientQueryMock.mockReset();
    clientQueryMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error('boom')) // callback query
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(
      db.transaction(async client => {
        await client.query('SELECT 2');
        return 10;
      })
    ).rejects.toThrow('boom');
  });

  test('health check, pool status and close work', async () => {
    clientQueryMock.mockResolvedValueOnce({ rows: [{ health_check: 1 }] });

    const { db } = await import('../../platform/database/connection');

    await expect(db.healthCheck()).resolves.toBe(true);
    expect(db.getPoolStats()).toEqual({
      total: 3,
      idle: 2,
      active: 1,
      waiting: 1,
      maxConnections: 5,
      minConnections: 1,
      utilizationPercent: 60,
      availablePercent: 40,
    });

    await db.close();
    expect(poolEndMock).toHaveBeenCalled();
  });
});
