import { Queue, Worker } from 'bullmq';

import { createChildLogger } from './logger';
import {
  getRedisConnectionOptions,
  RedisConnectionOptions,
} from './redis-config';

const logger = createChildLogger('queue-manager');

class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisConfig: RedisConnectionOptions;

  constructor() {
    this.redisConfig = getRedisConnectionOptions();
  }

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.redisConfig,
      });
      this.queues.set(queueName, queue);
      logger.info({ queue_name: queueName }, 'Created queue');
    }

    return this.queues.get(queueName)!;
  }

  async registerWorker(
    queueName: string,
    handler: (jobId: string, data: any) => Promise<any>
  ): Promise<void> {
    if (this.workers.has(queueName)) {
      logger.warn({ queue_name: queueName }, 'Worker already registered');
      return;
    }

    logger.info({ queue_name: queueName }, 'Registering worker');

    const worker = new Worker(
      queueName,
      async job => {
        const jobId = job.id || 'unknown';
        logger.info({ job_id: jobId, queue_name: queueName }, 'Processing job');

        try {
          const result = await handler(jobId, job.data);
          logger.info(
            { job_id: jobId, queue_name: queueName },
            'Job completed'
          );
          return result;
        } catch (error) {
          logger.error(
            { job_id: jobId, queue_name: queueName, error },
            'Job failed'
          );
          throw error;
        }
      },
      {
        connection: this.redisConfig,
      }
    );

    worker.on('completed', job => {
      logger.info(
        { job_id: job.id, queue_name: queueName },
        'Job completed successfully'
      );
    });

    worker.on('failed', (job, error) => {
      logger.error(
        { job_id: job?.id, queue_name: queueName, error },
        'Job failed'
      );
    });

    worker.on('ready', () => {
      logger.info({ queue_name: queueName }, 'Worker ready');
    });

    worker.on('error', error => {
      logger.error({ queue_name: queueName, error }, 'Worker error');
    });

    this.workers.set(queueName, worker);
  }

  async queueJob(
    queueName: string,
    jobName: string,
    data: any = {},
    options: {
      delay?: number;
      priority?: number;
      removeOnComplete?: boolean | number;
      removeOnFail?: boolean | number;
    } = {}
  ): Promise<string> {
    const queue = this.getQueue(queueName);

    const job = await queue.add(jobName, data, {
      ...(options.delay !== undefined && { delay: options.delay }),
      ...(options.priority !== undefined && { priority: options.priority }),
      removeOnComplete: options.removeOnComplete ?? 10,
      removeOnFail: options.removeOnFail ?? 5,
    });

    logger.info(
      { job_id: job.id, queue_name: queueName, job_name: jobName },
      'Job queued'
    );

    return job.id || 'unknown';
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down queue manager');

    for (const [name, worker] of this.workers) {
      logger.info({ worker_name: name }, 'Stopping worker');
      await worker.close();
    }

    for (const [name, queue] of this.queues) {
      logger.info({ queue_name: name }, 'Closing queue');
      await queue.close();
    }

    this.workers.clear();
    this.queues.clear();

    logger.info('Queue manager shutdown completed');
  }
}

export const queueManager = new QueueManager();
