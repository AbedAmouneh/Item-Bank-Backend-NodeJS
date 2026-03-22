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
});
