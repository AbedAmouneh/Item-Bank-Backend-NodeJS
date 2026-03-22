import { beforeEach, describe, expect, test, vi } from 'vitest';

const queueAdd = vi.fn();
const queueGetRepeatableJobs = vi.fn();
const queueRemoveRepeatableByKey = vi.fn();
const queueClose = vi.fn();
const workerClose = vi.fn();

const QueueMock = vi.fn().mockImplementation(function QueueMockImpl(
  this: any,
  _name: string,
  _opts: unknown
) {
  this.add = queueAdd;
  this.getRepeatableJobs = queueGetRepeatableJobs;
  this.removeRepeatableByKey = queueRemoveRepeatableByKey;
  this.close = queueClose;
});

const WorkerMock = vi.fn().mockImplementation(function WorkerMockImpl(
  this: any,
  _queueName: string,
  _processor: unknown,
  _opts: unknown
) {
  this.on = vi.fn();
  this.close = workerClose;
});

const mockJobTracker = {
  shouldRunJob: vi.fn(),
  markJobRunning: vi.fn(),
  markJobCompleted: vi.fn(),
  markJobFailed: vi.fn(),
};

vi.mock('bullmq', () => ({
  Queue: QueueMock,
  Worker: WorkerMock,
}));

vi.mock('../../utils/job-tracker', () => ({
  jobTracker: mockJobTracker,
}));

vi.mock('../../utils/redis-config', () => ({
  getRedisConnectionOptions: () => ({ host: 'localhost', port: 6379 }),
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('job runner utility', () => {
  beforeEach(() => {
    vi.resetModules();
    queueAdd.mockReset();
    queueGetRepeatableJobs.mockReset();
    queueRemoveRepeatableByKey.mockReset();
    queueClose.mockReset();
    workerClose.mockReset();
    QueueMock.mockClear();
    WorkerMock.mockClear();

    mockJobTracker.shouldRunJob.mockReset();
    mockJobTracker.markJobRunning.mockReset();
    mockJobTracker.markJobCompleted.mockReset();
    mockJobTracker.markJobFailed.mockReset();
  });

  test('skips queue scheduling when tracker says job should not run', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(false);

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'analytics',
      queueName: 'analytics',
      schedulePattern: '*/5 * * * *',
      handler: async () => ({ ok: true }),
    });

    expect(queueAdd).not.toHaveBeenCalled();
  });

  test('removes previous repeatable jobs and schedules new one', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(true);
    queueGetRepeatableJobs.mockResolvedValue([
      { name: 'analytics', key: 'old-key', pattern: '*/5 * * * *' },
    ]);
    queueAdd.mockResolvedValue({ id: 'new-job' });

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'analytics',
      queueName: 'analytics',
      schedulePattern: '*/10 * * * *',
      handler: async () => ({ ok: true }),
      options: {
        removeOnComplete: 20,
        removeOnFail: 10,
      },
    });

    expect(queueRemoveRepeatableByKey).toHaveBeenCalledWith('old-key');
    expect(queueAdd).toHaveBeenCalledWith(
      'analytics',
      {},
      expect.objectContaining({
        repeat: { pattern: '*/10 * * * *' },
        removeOnComplete: 20,
        removeOnFail: 10,
      })
    );
  });

  test('worker processor calls handler and marks job completed on success', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(true);
    queueGetRepeatableJobs.mockResolvedValue([]);
    queueAdd.mockResolvedValue({ id: 'job-1' });
    mockJobTracker.markJobRunning.mockResolvedValue(undefined);
    mockJobTracker.markJobCompleted.mockResolvedValue(undefined);

    const handler = vi.fn().mockResolvedValue({ done: true });

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'analytics',
      queueName: 'analytics',
      schedulePattern: '*/5 * * * *',
      handler,
    });

    // Extract the processor function passed as the 2nd arg to Worker
    const processor = WorkerMock.mock.calls[0][1] as (job: any) => Promise<any>;
    const result = await processor({ id: 'job-42' });

    expect(result).toEqual({ done: true });
    expect(handler).toHaveBeenCalledWith('job-42');
    expect(mockJobTracker.markJobRunning).toHaveBeenCalledWith('analytics');
    expect(mockJobTracker.markJobCompleted).toHaveBeenCalledWith('analytics');
  });

  test('worker processor uses "unknown" when job.id is undefined', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(true);
    queueGetRepeatableJobs.mockResolvedValue([]);
    queueAdd.mockResolvedValue({ id: 'job-1' });
    mockJobTracker.markJobRunning.mockResolvedValue(undefined);
    mockJobTracker.markJobCompleted.mockResolvedValue(undefined);

    const handler = vi.fn().mockResolvedValue(undefined);

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'analytics',
      queueName: 'analytics',
      schedulePattern: '*/5 * * * *',
      handler,
    });

    const processor = WorkerMock.mock.calls[0][1] as (job: any) => Promise<any>;
    await processor({ id: undefined });

    expect(handler).toHaveBeenCalledWith('unknown');
  });

  test('worker processor marks job failed and re-throws when handler throws', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(true);
    queueGetRepeatableJobs.mockResolvedValue([]);
    queueAdd.mockResolvedValue({ id: 'job-1' });
    mockJobTracker.markJobRunning.mockResolvedValue(undefined);
    mockJobTracker.markJobFailed.mockResolvedValue(undefined);

    const handlerError = new Error('handler exploded');
    const handler = vi.fn().mockRejectedValue(handlerError);

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'analytics',
      queueName: 'analytics',
      schedulePattern: '*/5 * * * *',
      handler,
    });

    const processor = WorkerMock.mock.calls[0][1] as (job: any) => Promise<any>;
    await expect(processor({ id: 'job-42' })).rejects.toThrow('handler exploded');

    expect(mockJobTracker.markJobFailed).toHaveBeenCalledWith('analytics', handlerError);
    expect(mockJobTracker.markJobCompleted).not.toHaveBeenCalled();
  });

  test('worker event callbacks (completed/failed/ready/error) run without throwing', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(true);
    queueGetRepeatableJobs.mockResolvedValue([]);
    queueAdd.mockResolvedValue({ id: 'job-1' });
    mockJobTracker.markJobRunning.mockResolvedValue(undefined);
    mockJobTracker.markJobCompleted.mockResolvedValue(undefined);

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'analytics',
      queueName: 'analytics',
      schedulePattern: '*/5 * * * *',
      handler: async () => ({ ok: true }),
    });

    const workerInstance = WorkerMock.mock.instances[0] as any;
    const onCalls: Array<[string, (...args: any[]) => void]> =
      workerInstance.on.mock.calls;

    const get = (event: string) =>
      onCalls.find(([e]) => e === event)?.[1];

    expect(() => get('completed')?.({ id: 'job-1' })).not.toThrow();
    expect(() => get('failed')?.({ id: 'job-1' }, new Error('fail'))).not.toThrow();
    expect(() => get('ready')?.()).not.toThrow();
    expect(() => get('error')?.(new Error('worker error'))).not.toThrow();
  });

  test('shutdown closes workers and queues', async () => {
    mockJobTracker.shouldRunJob.mockResolvedValue(true);
    queueGetRepeatableJobs.mockResolvedValue([]);
    queueAdd.mockResolvedValue({ id: 'job' });

    const { JobRunner } = await import('../../utils/job-runner');
    const runner = new JobRunner();

    await runner.scheduleJob({
      name: 'imports',
      queueName: 'imports',
      schedulePattern: '*/5 * * * *',
      handler: async () => ({ ok: true }),
    });

    await runner.shutdown();

    expect(queueClose).toHaveBeenCalled();
    expect(workerClose).toHaveBeenCalled();
  });
});
