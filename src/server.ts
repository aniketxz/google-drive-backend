import { config } from './config';
import { logger } from './utils/logger';
import { connectDB } from './db';
import { connectRedis, redis } from './cache/redis';
import { connectRabbitMQ, closeRabbitMQ } from './queue/connection';
import { createBootstrappedApp } from './bootstrap';

async function bootstrap() {
  // 1. Connect to all infrastructure
  await connectDB();
  await connectRedis();
  await connectRabbitMQ();

  // 2. Wire dependencies and create Express app
  const app = createBootstrappedApp();

  // 3. Start HTTP server
  const server = app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      try {
        await closeRabbitMQ();
        await redis.quit();
        logger.info('All connections closed. Goodbye 👋');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 10 seconds if server hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
