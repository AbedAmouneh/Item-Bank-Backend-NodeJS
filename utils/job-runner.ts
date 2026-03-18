import { Queue, Worker } from 'bullmq';

import { jobTracker } from './job-tracker';
import { createChildLogger } from './logger';
import {
  getRedisConnectionOptions,
  RedisConnectionOptions,
} from './redis-config';

const logger = createChildLogger('job-runner');

interface JobConfig {
  name: string;
  queueName: string;
  schedulePattern: string;
  handler: (jobId: string) => Promise<any>;
  options?: {
    removeOnComplete?: number;
    removeOnFail?: number;
  };
}

export class JobRunner {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisConfig: RedisConnectionOptions;

  constructor() {
    this.redisConfig = getRedisConnectionOptions();
  }

  async scheduleJob(config: JobConfig): Promise<void> {
    const { name, queueName, schedulePattern, handler, options = {} } = config;

    // Create queue if not exists
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.redisConfig,
      });
      this.queues.set(queueName, queue);
    }

    const queue = this.queues.get(queueName)!;

    // Create worker if not exists
    if (!this.workers.has(queueName)) {
      logger.info(`Creating worker for queue: ${queueName}`);
      const worker = new Worker(
        queueName,
        async job => {
          const jobId = job.id || 'unknown';
          logger.info(`Worker processing job ${jobId} for ${name}`);

          await jobTracker.markJobRunning(name);

          try {
            const result = await handler(jobId);
            await jobTracker.markJobCompleted(name);
            return result;
          } catch (error) {
            await jobTracker.markJobFailed(name, error);
            throw error;
          }
        },
        {
          connection: this.redisConfig,
        }
      );

      worker.on('completed', job => {
        logger.info(`Job ${job.id} (${name}) completed successfully`);
      });

      worker.on('failed', (job, error) => {
        logger.error(
          { jobId: job?.id, error, jobName: name },
          `Job ${name} failed`
        );
      });

      worker.on('ready', () => {
        logger.info(`Worker for ${queueName} is ready to process jobs`);
      });

      worker.on('error', error => {
        logger.error({ error, queueName }, `Worker error for ${queueName}`);
      });

      this.workers.set(queueName, worker);
    }

    // Check if job should be scheduled
    const shouldRun = await jobTracker.shouldRunJob(name, schedulePattern);

    if (!shouldRun) {
      logger.info(
        `Job ${name} already properly scheduled, skipping BullMQ setup`
      );
      return;
    }

    // Clean up existing jobs for this name
    const repeatableJobs = await queue.getRepeatableJobs();
    const existingJobs = repeatableJobs.filter(job => job.name === name);
    for (const job of existingJobs) {
      await queue.removeRepeatableByKey(job.key);
      logger.info(
        `Removed old BullMQ job ${name} with pattern: ${job.pattern}`
      );
    }

    // Schedule new job
    await queue.add(
      name,
      {},
      {
        repeat: { pattern: schedulePattern },
        removeOnComplete: options.removeOnComplete || 10,
        removeOnFail: options.removeOnFail || 5,
      }
    );

    logger.info(`Job ${name} scheduled with pattern: ${schedulePattern}`);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down job runner...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      logger.info(`Stopping worker: ${name}`);
      await worker.close();
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      logger.info(`Closing queue: ${name}`);
      await queue.close();
    }

    this.workers.clear();
    this.queues.clear();

    logger.info('Job runner shutdown completed');
  }
}

export const jobRunner = new JobRunner();
