import { db } from '../../platform/database/connection';
import { WebServer } from '../../platform/http/web_server';
import { logger } from '../../utils/logger';
import { redis } from '../../utils/redis';

let server: WebServer | null = null;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`${signal} received, but shutdown already in progress`);
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded (30s), forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  const shutdownSteps: Array<{
    name: string;
    fn: () => Promise<void>;
  }> = [
    {
      name: 'Stop accepting new connections',
      fn: async () => {
        if (server) {
          await server.close();
        }
      },
    },
    {
      name: 'Close Redis connections',
      fn: async () => {
        try {
          await redis.disconnect();
        } catch (error) {
          logger.error(error, 'Error disconnecting Redis');
        }
      },
    },
    {
      name: 'Close database connections',
      fn: async () => {
        try {
          await db.close();
        } catch (error) {
          logger.error(error, 'Error closing database');
        }
      },
    },
  ];

  for (const step of shutdownSteps) {
    try {
      logger.info(`Shutdown step: ${step.name}`);
      await step.fn();
      logger.info(`Completed: ${step.name}`);
    } catch (error) {
      logger.error(
        error,
        `Error during shutdown step: ${step.name}, continuing...`
      );
    }
  }

  clearTimeout(shutdownTimeout);
  logger.info('Graceful shutdown completed successfully');
  process.exit(0);
}

async function main(): Promise<void> {
  const isDbHealthy = await db.healthCheck();

  if (!isDbHealthy) {
    logger.error('Database health check failed during initialization');
    throw new Error('Database connection failed');
  }

  try {
    await redis.connect();
    await redis.ping();
    logger.info('Redis connected and responding to ping');
  } catch (error) {
    logger.warn(
      error,
      'Redis connection failed during initialization, continuing without Redis:'
    );
  }

  server = new WebServer();
  await server.start();

  logger.info('Server started successfully, ready to accept connections');
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', error => {
  logger.error(error, 'Uncaught exception, initiating shutdown');
  gracefulShutdown('UNCAUGHT_EXCEPTION').catch(shutdownError => {
    logger.error({ error: shutdownError }, 'Error during graceful shutdown');
    // Continue running instead of exiting to prevent unexpected crashes
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    { reason, promise },
    'Unhandled promise rejection, initiating shutdown'
  );
  gracefulShutdown('UNHANDLED_REJECTION').catch(error => {
    logger.error({ error }, 'Error during graceful shutdown');
    // Continue running instead of exiting to prevent unexpected crashes
  });
});

main().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
