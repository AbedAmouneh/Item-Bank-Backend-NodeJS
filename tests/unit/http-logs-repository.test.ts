import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../../platform/database/connection', () => ({
  db: { query: mockQuery },
}));

import { HttpLogRepository } from '../../platform/http/logs/repository';

const baseLog = {
  requestId: 'req-1',
  method: 'GET',
  path: '/api/items',
  responseStatus: 200,
  durationMs: 42,
  ipAddress: '127.0.0.1',
};

describe('HttpLogRepository', () => {
  let repo: HttpLogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new HttpLogRepository();
  });

  // --- createLog ---

  test('createLog inserts a log row (fire-and-forget)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await repo.createLog(baseLog);

    // Flush the microtask queue so the non-awaited promise resolves
    await new Promise(r => setTimeout(r, 0));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO http_logs'),
      expect.arrayContaining(['req-1', null, 'GET', '/api/items'])
    );
  });

  test('createLog logs to console.error when the DB write fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error('write error'));

    await repo.createLog(baseLog);

    await new Promise(r => setTimeout(r, 0));

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to write HTTP log:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  // --- getErrorLogs ---

  test('getErrorLogs returns error-status rows', async () => {
    const rows = [{ id: 1, response_status: 500 }];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await repo.getErrorLogs();

    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE response_status >= 400'),
      [100]
    );
  });

  test('getErrorLogs passes a custom limit to the query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await repo.getErrorLogs(25);

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [25]);
  });
});
