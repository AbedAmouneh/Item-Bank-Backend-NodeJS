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

  // --- pool event callbacks ---

  test('pool error event logs the error', async () => {
    await import('../../platform/database/connection');

    const errorCb = poolOnMock.mock.calls.find(
      ([e]: [string]) => e === 'error'
    )?.[1] as (err: Error) => void;

    const err = new Error('pool exploded');
    errorCb(err);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: err }),
      'Database pool error'
    );
  });

  test('pool connect event logs debug message', async () => {
    await import('../../platform/database/connection');

    const connectCb = poolOnMock.mock.calls.find(
      ([e]: [string]) => e === 'connect'
    )?.[1] as () => void;

    connectCb();

    expect(logger.debug).toHaveBeenCalledWith(
      'New database connection established'
    );
  });

  test('pool remove event logs debug message', async () => {
    await import('../../platform/database/connection');

    const removeCb = poolOnMock.mock.calls.find(
      ([e]: [string]) => e === 'remove'
    )?.[1] as () => void;

    removeCb();

    expect(logger.debug).toHaveBeenCalledWith(
      'Database connection removed from pool'
    );
  });

  // --- getSSLConfig branches ---

  test('reads CA cert from file when existsSync returns true', async () => {
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
        caCert: undefined,
      },
      server: { env: 'production' },
    });
    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => 'CA-CERT-CONTENT'),
    }));

    await import('../../platform/database/connection');

    expect(poolOptions.ssl).toEqual({
      rejectUnauthorized: true,
      ca: 'CA-CERT-CONTENT',
    });
  });

  test('falls back to rejectUnauthorized:false when readFileSync throws', async () => {
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
        caCert: undefined,
      },
      server: { env: 'production' },
    });
    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => {
        throw new Error('permission denied');
      }),
    }));

    await import('../../platform/database/connection');

    expect(poolOptions.ssl).toEqual({ rejectUnauthorized: false });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ caPath: expect.any(String) }),
      'Failed to read CA certificate file, falling back to basic SSL'
    );
  });

  test('uses rejectUnauthorized:false for prod host with no cert and no cert file', async () => {
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
        caCert: undefined,
      },
      server: { env: 'production' },
    });
    // fs mock from setupCommonMocks already has existsSync → false

    await import('../../platform/database/connection');

    expect(poolOptions.ssl).toEqual({ rejectUnauthorized: false });
  });

  // --- close() error path ---

  test('close() logs error and rethrows when pool.end() fails', async () => {
    const err = new Error('pool end failed');
    poolEndMock.mockRejectedValueOnce(err);

    const { db } = await import('../../platform/database/connection');

    await expect(db.close()).rejects.toThrow('pool end failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: err.message }),
      'Error closing database pool'
    );
  });

  // --- healthCheck() failure ---

  test('healthCheck returns false when query throws', async () => {
    poolConnectMock.mockRejectedValueOnce(new Error('no connection'));

    const { db } = await import('../../platform/database/connection');

    await expect(db.healthCheck()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Database health check failed'
    );
  });

  // --- getClient() ---

  test('getClient returns a pool client', async () => {
    const { db } = await import('../../platform/database/connection');

    const client = await db.getClient();

    expect(poolConnectMock).toHaveBeenCalled();
    expect(client).toBeDefined();
  });

  // --- logPoolStats() ---

  test('logPoolStats logs info for normal utilization and warns for waiting requests', async () => {
    const { db } = await import('../../platform/database/connection');

    // Default pool: totalCount=3, idleCount=2, waitingCount=1, max=5 → 60% utilization
    db.logPoolStats();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ utilizationPercent: 60 }),
      'Database connection pool statistics'
    );
    // waitingCount=1 > 0 → also warns about waiting requests
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ waiting: 1 }),
      'Requests waiting for database connections'
    );
  });

  test('logPoolStats warns for high pool utilization (>80%)', async () => {
    const { db } = await import('../../platform/database/connection');

    // Override pool properties to simulate 100% utilization
    (db as any).pool.totalCount = 5;
    (db as any).pool.idleCount = 0;
    (db as any).pool.waitingCount = 0;

    db.logPoolStats();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ utilizationPercent: 100 }),
      'Database connection pool high utilization detected'
    );
  });

  // --- slow query warning ---

  test('logs slow query warning when duration exceeds 30s', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    setupPgMocks();
    setupCommonMocks();

    let callCount = 0;
    vi.doMock('../../utils/runtime', () => ({
      runtime: {
        now: () => new Date(callCount++ === 0 ? 0 : 31000),
      },
    }));

    const result = { rows: [{ x: 1 }], rowCount: 1 };
    clientQueryMock.mockResolvedValueOnce(result);

    const { db } = await import('../../platform/database/connection');
    await db.query('SELECT slow', []);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 31000 }),
      'Slow query detected'
    );
  });
});
