import { jobRunner } from '../../utils/job-runner';
import { createChildLogger } from '../../utils/logger';
import { queueManager } from '../../utils/queue-manager';
import { JOBS, ON_DEMAND_JOBS } from './config';

const logger = createChildLogger('jobs-server');

async function startJobsServer() {
  try {
    logger.info('Starting jobs server...');

    // Register scheduled jobs
    for (const jobConfig of JOBS) {
      await jobRunner.scheduleJob(jobConfig);
    }

    // Register on-demand job workers
    for (const jobConfig of ON_DEMAND_JOBS) {
      await queueManager.registerWorker(jobConfig.queueName, jobConfig.handler);
    }

    logger.info(
      `Jobs server started successfully with ${JOBS.length} scheduled job(s) and ${ON_DEMAND_JOBS.length} on-demand worker(s) configured`
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start jobs server');
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, gracefully shutting down jobs server...');
  await gracefulShutdown();
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down jobs server...');
  await gracefulShutdown();
});

async function gracefulShutdown() {
  try {
    await jobRunner.shutdown();
    await queueManager.shutdown();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

startJobsServer();
