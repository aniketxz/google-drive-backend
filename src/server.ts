import { config } from './config';
import { logger } from './utils/logger';
import { connectDB } from './db';
import { connectRedis, redis } from './cache/redis';
import { createApp } from './app';
import { startCleanupJob } from './jobs/cleanup.job';
import { SHUTDOWN_TIMEOUT_MS } from './constants';

async function start() {
  await connectDB();
  await connectRedis();

  const app = createApp();

  // Start background jobs
  const cleanupTask = startCleanupJob();

  const server = app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      try {
        cleanupTask.stop();
        await redis.quit();
        logger.info('Connections closed. Goodbye 👋');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

