import { beforeEach, describe, expect, test, vi } from 'vitest';

import { JobTracker } from '../../utils/job-tracker';

const { mockQuery, mockInfo, mockError } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockInfo: vi.fn(),
  mockError: vi.fn(),
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

describe('job tracker utility', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInfo.mockReset();
    mockError.mockReset();
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
      next_run: new Date(Date.now() - 1000),
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
});
