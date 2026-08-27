import { config } from './config';
import { logger } from './utils/logger';
import { connectDB } from './db';
import { connectRedis, redis } from './cache/redis';
import { createBootstrappedApp } from './bootstrap';

// Phase 6: re-add these when RabbitMQ / thumbnail worker is enabled
// import { connectRabbitMQ, closeRabbitMQ } from './queue/connection';

async function bootstrap() {
  // 1. Connect to infrastructure
  await connectDB();
  await connectRedis();

  // Phase 6: await connectRabbitMQ();

  // 2. Wire dependencies and create Express app
  const app = createBootstrappedApp();

  // 3. Trust Nginx reverse proxy — reads real client IP from X-Forwarded-For
  app.set('trust proxy', 1);

  // 4. Start HTTP server
  const server = app.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      try {
        // Phase 6: await closeRabbitMQ();
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
