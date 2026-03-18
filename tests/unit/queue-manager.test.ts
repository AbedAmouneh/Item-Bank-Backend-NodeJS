import { beforeEach, describe, expect, test, vi } from 'vitest';

const queueAdd = vi.fn();
const queueClose = vi.fn();
const workerClose = vi.fn();

const QueueMock = vi.fn().mockImplementation(function QueueMockImpl(
  this: any,
  _name: string,
  _opts: unknown
) {
  this.add = queueAdd;
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

vi.mock('bullmq', () => ({
  Queue: QueueMock,
  Worker: WorkerMock,
}));

vi.mock('../../utils/redis-config', () => ({
  getRedisConnectionOptions: () => ({ host: 'localhost', port: 6379 }),
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('queue manager utility', () => {
  beforeEach(() => {
    vi.resetModules();
    queueAdd.mockReset();
    queueClose.mockReset();
    workerClose.mockReset();
    QueueMock.mockClear();
    WorkerMock.mockClear();
  });

  test('queues jobs and returns BullMQ job id', async () => {
    queueAdd.mockResolvedValue({ id: 'job-123' });

    const { queueManager } = await import('../../utils/queue-manager');
    const jobId = await queueManager.queueJob('imports', 'process-row', {
      row: 1,
    });

    expect(jobId).toBe('job-123');
    expect(queueAdd).toHaveBeenCalledWith(
      'process-row',
      { row: 1 },
      expect.objectContaining({ removeOnComplete: 10, removeOnFail: 5 })
    );
  });

  test('does not register the same worker twice for the same queue', async () => {
    const { queueManager } = await import('../../utils/queue-manager');

    await queueManager.registerWorker('imports', async () => ({ ok: true }));
    await queueManager.registerWorker('imports', async () => ({ ok: true }));

    expect(WorkerMock).toHaveBeenCalledTimes(1);
  });

  test('shutdown closes registered workers and queues', async () => {
    queueAdd.mockResolvedValue({ id: 'job-1' });

    const { queueManager } = await import('../../utils/queue-manager');

    await queueManager.queueJob('imports', 'process', {});
    await queueManager.registerWorker('imports', async () => ({ ok: true }));
    await queueManager.shutdown();

    expect(queueClose).toHaveBeenCalled();
    expect(workerClose).toHaveBeenCalled();
  });
});
