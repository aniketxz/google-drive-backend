import { logger } from './utils/logger';
import { connectDB } from './db';
import { connectRabbitMQ, closeRabbitMQ } from './queue/connection';

// ── Worker entry point ────────────────────────────────────────────────────────
// The thumbnail consumer is registered here in Phase 6.
// For now this bootstraps the infrastructure connections.

async function startWorker() {
  logger.info('Starting thumbnail worker...');

  await connectDB();
  await connectRabbitMQ();

  // Phase 6: register ThumbnailConsumer here
  logger.info('Thumbnail worker ready — waiting for jobs');

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — worker shutting down`);
    await closeRabbitMQ();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

startWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
