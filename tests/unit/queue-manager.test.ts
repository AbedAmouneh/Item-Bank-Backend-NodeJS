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

  test('returns "unknown" when queue.add returns no id', async () => {
    queueAdd.mockResolvedValue({ id: undefined });

    const { queueManager } = await import('../../utils/queue-manager');
    const jobId = await queueManager.queueJob('imports', 'process-row', {});

    expect(jobId).toBe('unknown');
  });

  test('passes delay and priority options to queue.add when provided', async () => {
    queueAdd.mockResolvedValue({ id: 'job-456' });

    const { queueManager } = await import('../../utils/queue-manager');
    await queueManager.queueJob('imports', 'process-row', { row: 1 }, {
      delay: 500,
      priority: 2,
      removeOnComplete: 20,
      removeOnFail: 10,
    });

    expect(queueAdd).toHaveBeenCalledWith(
      'process-row',
      { row: 1 },
      expect.objectContaining({ delay: 500, priority: 2, removeOnComplete: 20, removeOnFail: 10 })
    );
  });

  test('worker processor calls handler and returns result on success', async () => {
    const handler = vi.fn().mockResolvedValue({ done: true });

    const { queueManager } = await import('../../utils/queue-manager');
    await queueManager.registerWorker('imports', handler);

    // Extract the processor from the Worker constructor call
    const processor = WorkerMock.mock.calls[0][1] as (job: any) => Promise<any>;
    const result = await processor({ id: 'job-1', data: { row: 42 } });

    expect(result).toEqual({ done: true });
    expect(handler).toHaveBeenCalledWith('job-1', { row: 42 });
  });

  test('worker processor uses "unknown" when job.id is undefined', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    const { queueManager } = await import('../../utils/queue-manager');
    await queueManager.registerWorker('imports', handler);

    const processor = WorkerMock.mock.calls[0][1] as (job: any) => Promise<any>;
    await processor({ id: undefined, data: {} });

    expect(handler).toHaveBeenCalledWith('unknown', {});
  });

  test('worker processor re-throws when handler throws', async () => {
    const handlerError = new Error('processing failed');
    const handler = vi.fn().mockRejectedValue(handlerError);

    const { queueManager } = await import('../../utils/queue-manager');
    await queueManager.registerWorker('imports', handler);

    const processor = WorkerMock.mock.calls[0][1] as (job: any) => Promise<any>;
    await expect(processor({ id: 'job-1', data: {} })).rejects.toThrow('processing failed');
  });

  test('worker event callbacks (completed/failed/ready/error) run without throwing', async () => {
    const { queueManager } = await import('../../utils/queue-manager');
    await queueManager.registerWorker('imports', async () => ({ ok: true }));

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
