import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AuditLogger } from '../../platform/database/audit-logger';

const { mockQuery, mockError, mockWarn } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockError: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    error: mockError,
    warn: mockWarn,
    debug: vi.fn(),
  }),
}));

vi.mock('../../platform/database/connection', () => ({
  db: { query: mockQuery },
}));

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AuditLogger.clearContext();
    // Reset static queue state that persists between tests
    (AuditLogger as any).processingQueue = false;
    (AuditLogger as any).auditQueue = [];
  });

  // --- context management ---

  test('sets and retrieves audit context', () => {
    AuditLogger.setContext({ userId: 42, ipAddress: '1.2.3.4' });

    const ctx = AuditLogger.getContext();
    expect(ctx.userId).toBe(42);
    expect(ctx.ipAddress).toBe('1.2.3.4');
  });

  test('merges context on successive setContext calls', () => {
    AuditLogger.setContext({ userId: 1 });
    AuditLogger.setContext({ ipAddress: '10.0.0.1' });

    const ctx = AuditLogger.getContext();
    expect(ctx.userId).toBe(1);
    expect(ctx.ipAddress).toBe('10.0.0.1');
  });

  test('clearContext resets to empty', () => {
    AuditLogger.setContext({ userId: 99 });
    AuditLogger.clearContext();

    const ctx = AuditLogger.getContext();
    expect(ctx.userId).toBeUndefined();
  });

  test('runWithContext provides isolated context', () => {
    AuditLogger.setContext({ userId: 1 });

    const innerCtx = AuditLogger.runWithContext(
      { userId: 999, ipAddress: '5.5.5.5' },
      () => AuditLogger.getContext()
    );

    expect(innerCtx.userId).toBe(999);
    expect(innerCtx.ipAddress).toBe('5.5.5.5');
  });

  // --- logQuery filtering ---

  test('skips audit_logs table queries to prevent recursion', async () => {
    await AuditLogger.logQuery('INSERT INTO audit_logs (action) VALUES ($1)', [
      'CREATE',
    ]);

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('skips health check queries', async () => {
    await AuditLogger.logQuery('SELECT 1 AS health_check');

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('skips transaction control statements', async () => {
    await AuditLogger.logQuery('BEGIN');
    await AuditLogger.logQuery('COMMIT');
    await AuditLogger.logQuery('ROLLBACK');

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('skips http_logs and user_sessions queries', async () => {
    await AuditLogger.logQuery('INSERT INTO http_logs (method) VALUES ($1)', [
      'GET',
    ]);
    await AuditLogger.logQuery(
      'UPDATE user_sessions SET is_active = false WHERE id = $1',
      [1]
    );

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('skips pure SELECT queries without mutations', async () => {
    await AuditLogger.logQuery('SELECT * FROM items WHERE id = $1', [1]);

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('skips SELECT COUNT queries', async () => {
    await AuditLogger.logQuery(
      'SELECT COUNT(*) FROM items WHERE active = true'
    );

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('logs INSERT queries', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery('INSERT INTO items (name) VALUES ($1)', [
      'Item A',
    ]);

    // Allow queue processing
    await new Promise(r => setTimeout(r, 50));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.any(Array)
    );
  });

  test('logs UPDATE queries', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery(
      'UPDATE items SET name = $1 WHERE id = $2',
      ['Item B', 5]
    );

    await new Promise(r => setTimeout(r, 50));

    expect(mockQuery).toHaveBeenCalled();
  });

  test('logs DELETE queries', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery('DELETE FROM items WHERE id = $1', [10]);

    await new Promise(r => setTimeout(r, 50));

    expect(mockQuery).toHaveBeenCalled();
  });

  // --- writeAuditLog / processAuditQueue error handling ---

  test('writeAuditLog logs error and processAuditQueue also catches when db write fails', async () => {
    mockQuery.mockRejectedValue(new Error('db write failed'));

    await AuditLogger.logQuery('INSERT INTO items (name) VALUES ($1)', ['Alice']);

    await new Promise(r => setTimeout(r, 50));

    // writeAuditLog: logger.error + throw  →  processAuditQueue: logger.error
    expect(mockError).toHaveBeenCalledTimes(2);
  });

  // --- queueAuditEntry overflow ---

  test('drops entry and warns when auditQueue is at MAX_QUEUE_SIZE', async () => {
    (AuditLogger as any).auditQueue = new Array(10000).fill({
      auditEntry: {},
      originalQuery: 'SELECT 1',
    });

    await AuditLogger.logQuery('INSERT INTO items (name) VALUES ($1)', ['Alice']);

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ queueSize: 10000 }),
      'Audit queue full, dropping audit entry'
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // --- extractEntityId branches ---

  test('extractEntityId matches WHERE identifier = $N', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery(
      'UPDATE app_configs SET value = $1 WHERE identifier = $2',
      ['new-val', 'my-config']
    );

    await new Promise(r => setTimeout(r, 50));

    // entity_id is the 5th param (index 4) in the audit_logs INSERT
    const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[4]).toBe('my-config');
  });

  test('extractEntityId matches WHERE uuid = $N', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery(
      'UPDATE users SET name = $1 WHERE uuid = $2',
      ['Alice', 'some-uuid-value']
    );

    await new Promise(r => setTimeout(r, 50));

    const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[4]).toBe('some-uuid-value');
  });

  test('extractEntityId matches WHERE code = $N', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery(
      'DELETE FROM products WHERE code = $1',
      ['PROD-42']
    );

    await new Promise(r => setTimeout(r, 50));

    const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[4]).toBe('PROD-42');
  });

  test('extractEntityId matches direct literal WHERE id = N', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    // No params array — direct number in query
    await AuditLogger.logQuery('DELETE FROM items WHERE id = 42');

    await new Promise(r => setTimeout(r, 50));

    const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[4]).toBe('42');
  });

  // --- extractNewValues RETURNING path ---

  test('extractNewValues captures returned rows for INSERT...SELECT...RETURNING', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = {
      rows: [{ id: 1, name: 'Alice' }],
      rowCount: 1,
    } as any;

    // No VALUES clause → skips inserted_values path, falls through to RETURNING
    await AuditLogger.logQuery(
      'INSERT INTO items SELECT name FROM staging RETURNING *',
      undefined,
      result
    );

    await new Promise(r => setTimeout(r, 50));

    const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    const newValues = JSON.parse(params[6] as string);
    expect(newValues).toMatchObject({
      returned_data: [{ id: 1, name: 'Alice' }],
      total_rows: 1,
      truncated: false,
    });
  });

  test('extractNewValues truncates returned rows when more than MAX_CAPTURED_ROWS (10)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const manyRows = Array.from({ length: 11 }, (_, i) => ({ id: i }));
    const result = { rows: manyRows, rowCount: 11 } as any;

    await AuditLogger.logQuery(
      'INSERT INTO items SELECT id FROM staging RETURNING *',
      undefined,
      result
    );

    await new Promise(r => setTimeout(r, 50));

    const params: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    const newValues = JSON.parse(params[6] as string);
    expect(newValues.total_rows).toBe(11);
    expect(newValues.returned_data).toHaveLength(10);
    expect(newValues.truncated).toBe(true);
  });

  // --- sanitizeParams branches ---

  test('sanitizeParams converts null param to null', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await AuditLogger.logQuery(
      'INSERT INTO items (a) VALUES ($1)',
      [null]
    );

    await new Promise(r => setTimeout(r, 50));

    const callParams: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    const sanitized = JSON.parse(callParams[10] as string) as unknown[];
    expect(sanitized[0]).toBeNull();
  });

  test('sanitizeParams converts Date param to ISO string', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const date = new Date('2024-01-15T10:00:00.000Z');
    await AuditLogger.logQuery(
      'INSERT INTO items (created_at) VALUES ($1)',
      [date]
    );

    await new Promise(r => setTimeout(r, 50));

    const callParams: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    const sanitized = JSON.parse(callParams[10] as string) as unknown[];
    expect(sanitized[0]).toBe('2024-01-15T10:00:00.000Z');
  });

  test('sanitizeParams falls back to String() for non-serializable objects', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    // Use UPDATE so extractNewValues captures only the SET clause string (not the
    // raw params), avoiding a JSON.stringify failure in writeAuditLog.
    await AuditLogger.logQuery(
      'UPDATE items SET data = $1 WHERE id = $2',
      [circular, 1]
    );

    await new Promise(r => setTimeout(r, 50));

    const callParams: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    const sanitized = JSON.parse(callParams[10] as string) as unknown[];
    expect(typeof sanitized[0]).toBe('string');
  });

  test('sanitizeParams falls back to String() for BigInt params', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    // Use UPDATE for the same reason — BigInt also fails JSON.stringify on its
    // own, but sanitizeParams converts it to a string before that path is hit.
    await AuditLogger.logQuery(
      'UPDATE items SET value = $1 WHERE id = $2',
      [BigInt(42), 1]
    );

    await new Promise(r => setTimeout(r, 50));

    const callParams: unknown[] = mockQuery.mock.calls[0][1] as unknown[];
    const sanitized = JSON.parse(callParams[10] as string) as unknown[];
    expect(sanitized[0]).toBe('42');
  });
});
