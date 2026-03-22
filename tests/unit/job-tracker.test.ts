import { beforeEach, describe, expect, test, vi } from 'vitest';

import { JobTracker } from '../../utils/job-tracker';

const { mockQuery, mockInfo, mockError, mockNow } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockInfo: vi.fn(),
  mockError: vi.fn(),
  mockNow: vi.fn<[], Date>(),
}));

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: mockQuery,
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: mockInfo,
    error: mockError,
  }),
}));

vi.mock('../../utils/runtime', () => ({
  runtime: { now: mockNow },
}));

describe('job tracker utility', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInfo.mockReset();
    mockError.mockReset();
    mockNow.mockReset();
    mockNow.mockReturnValue(new Date('2026-03-22T10:30:00.000Z'));
  });

  test('shouldRunJob creates tracker row when job is missing', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue(null as any);
    const createSpy = vi.spyOn(tracker, 'createJob').mockResolvedValue();

    await expect(tracker.shouldRunJob('sync-job', '*/5 * * * *')).resolves.toBe(
      true
    );
    expect(createSpy).toHaveBeenCalledWith('sync-job', '*/5 * * * *');
  });

  test('shouldRunJob updates schedule when cron changes', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue({
      id: 1,
      job_name: 'sync-job',
      schedule_pattern: '*/5 * * * *',
      last_run: null,
      next_run: null,
      status: 'scheduled',
      is_active: true,
    });
    const updateSpy = vi
      .spyOn(tracker, 'updateJobSchedule')
      .mockResolvedValue();

    await expect(
      tracker.shouldRunJob('sync-job', '*/10 * * * *')
    ).resolves.toBe(true);
    expect(updateSpy).toHaveBeenCalledWith('sync-job', '*/10 * * * *');
  });

  test('returns true when next_run is due and not currently running', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue({
      id: 2,
      job_name: 'sync-job',
      schedule_pattern: '*/5 * * * *',
      last_run: null,
      next_run: new Date('2026-03-22T10:00:00.000Z'), // 30 min before mocked now (10:30Z)
      status: 'scheduled',
      is_active: true,
    });

    await expect(tracker.shouldRunJob('sync-job', '*/5 * * * *')).resolves.toBe(
      true
    );
  });

  test('createJob persists schedule with calculated next run', async () => {
    const tracker = new JobTracker();
    mockQuery.mockResolvedValue({ rows: [] });

    await tracker.createJob('analytics-job', '*/15 * * * *');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO jobs'),
      expect.arrayContaining([
        'analytics-job',
        '*/15 * * * *',
        expect.any(Date),
      ])
    );
  });

  test('markJobCompleted exits cleanly if job record is missing', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue(null as any);

    await tracker.markJobCompleted('missing-job');

    expect(mockError).toHaveBeenCalled();
  });

  test('markJobFailed writes failed status update', async () => {
    const tracker = new JobTracker();
    mockQuery.mockResolvedValue({ rows: [] });

    await tracker.markJobFailed('failed-job', new Error('boom'));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'failed'"),
      [expect.any(Date), 'failed-job']
    );
  });

  test('shouldRunJob returns false when next_run is in the future', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue({
      id: 3,
      job_name: 'sync-job',
      schedule_pattern: '*/5 * * * *',
      last_run: null,
      next_run: new Date(Date.now() + 60_000),
      status: 'scheduled',
      is_active: true,
    });

    await expect(tracker.shouldRunJob('sync-job', '*/5 * * * *')).resolves.toBe(
      false
    );
  });

  test('shouldRunJob returns false when job is currently running', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue({
      id: 4,
      job_name: 'sync-job',
      schedule_pattern: '*/5 * * * *',
      last_run: null,
      next_run: new Date(Date.now() - 1000),
      status: 'running',
      is_active: true,
    });

    await expect(tracker.shouldRunJob('sync-job', '*/5 * * * *')).resolves.toBe(
      false
    );
  });

  test('getJobStatus returns first row from DB query', async () => {
    const tracker = new JobTracker();
    const record = {
      id: 5,
      job_name: 'my-job',
      schedule_pattern: '*/5 * * * *',
      last_run: null,
      next_run: null,
      status: 'scheduled' as const,
      is_active: true,
    };
    mockQuery.mockResolvedValue({ rows: [record] });

    const result = await tracker.getJobStatus('my-job');

    expect(result).toEqual(record);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM jobs'),
      ['my-job']
    );
  });

  test('getJobStatus returns null when no rows found', async () => {
    const tracker = new JobTracker();
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await tracker.getJobStatus('missing-job');

    expect(result).toBeNull();
  });

  test('updateJobSchedule issues UPDATE query with new pattern and next run', async () => {
    const tracker = new JobTracker();
    mockQuery.mockResolvedValue({ rows: [] });

    await tracker.updateJobSchedule('sync-job', '*/10 * * * *');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE jobs'),
      ['*/10 * * * *', expect.any(Date), 'sync-job']
    );
  });

  test('markJobRunning issues UPDATE query setting status to running', async () => {
    const tracker = new JobTracker();
    mockQuery.mockResolvedValue({ rows: [] });

    await tracker.markJobRunning('sync-job');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'running'"),
      ['sync-job']
    );
  });

  test('markJobCompleted updates DB with last_run and new next_run', async () => {
    const tracker = new JobTracker();
    vi.spyOn(tracker, 'getJobStatus').mockResolvedValue({
      id: 6,
      job_name: 'sync-job',
      schedule_pattern: '*/5 * * * *',
      last_run: null,
      next_run: null,
      status: 'running',
      is_active: true,
    });
    mockQuery.mockResolvedValue({ rows: [] });

    await tracker.markJobCompleted('sync-job');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'completed'"),
      [expect.any(Date), expect.any(Date), 'sync-job']
    );
  });

  describe('calculateNextRun via createJob', () => {
    test('second interval pattern (*/30 * * * * *) adds seconds', async () => {
      // local 10:30:00 — add 30 seconds → 10:30:30
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 30, 0, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('sec-job', '*/30 * * * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getSeconds()).toBe(30);
      expect(nextRun.getMilliseconds()).toBe(0);
    });

    test('minute interval — no rollover (*/5 * * * *)', async () => {
      // local 10:30 → nextMinute = ceil(31/5)*5 = 35 — stays in same hour
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 30, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('min-job', '*/5 * * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getHours()).toBe(10);
      expect(nextRun.getMinutes()).toBe(35);
    });

    test('minute interval — rollover to next hour (*/30 * * * *)', async () => {
      // local 10:45 → nextMinute = ceil(46/30)*30 = 60 → rollover to 11:00
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 45, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('min-rollover-job', '*/30 * * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getHours()).toBe(11);
      expect(nextRun.getMinutes()).toBe(0);
    });

    test('hour interval — no rollover (0 */6 * * *)', async () => {
      // local 10:30 → nextHour = ceil(11/6)*6 = 12 — stays today
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 30, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('hour-job', '0 */6 * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getDate()).toBe(22);
      expect(nextRun.getHours()).toBe(12);
      expect(nextRun.getMinutes()).toBe(0);
    });

    test('hour interval — rollover to next day (0 */12 * * *)', async () => {
      // local 23:30 → nextHour = ceil(24/12)*12 = 24 → rollover to next day 00:00
      mockNow.mockReturnValue(new Date(2026, 2, 22, 23, 30, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('hour-rollover-job', '0 */12 * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getDate()).toBe(23);
      expect(nextRun.getHours()).toBe(0);
    });

    test('daily pattern — run today when target hour is later (0 14 * * *)', async () => {
      // local 10:30 → currentHour 10 < 14 → set today at 14:00
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 30, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('daily-today-job', '0 14 * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getDate()).toBe(22);
      expect(nextRun.getHours()).toBe(14);
    });

    test('daily pattern — run tomorrow when target hour already passed (0 8 * * *)', async () => {
      // local 10:30 → currentHour 10 >= 8 → set tomorrow at 08:00
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 30, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('daily-tomorrow-job', '0 8 * * *');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      expect(nextRun.getDate()).toBe(23);
      expect(nextRun.getHours()).toBe(8);
    });

    test('default fallback adds 30 minutes for unrecognized pattern', async () => {
      mockNow.mockReturnValue(new Date(2026, 2, 22, 10, 0, 0));
      const tracker = new JobTracker();
      mockQuery.mockResolvedValue({ rows: [] });

      await tracker.createJob('fallback-job', '@weekly');

      const nextRun: Date = mockQuery.mock.calls[0][1][2];
      // local 10:00 + 30 min = 10:30
      expect(nextRun.getHours()).toBe(10);
      expect(nextRun.getMinutes()).toBe(30);
    });
  });
});
