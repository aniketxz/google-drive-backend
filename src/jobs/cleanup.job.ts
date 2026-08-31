import cron from 'node-cron';
import { lt, isNotNull, and } from 'drizzle-orm';
import { db } from '../db';
import { shares } from '../db/schema/shares';
import { publicLinks } from '../db/schema/public_links';
import { logger } from '../utils/logger';

/**
 * Hourly cleanup job that deletes expired shares and expired public links.
 * Runs at the top of every hour (0 * * * *).
 */
export function startCleanupJob(): cron.ScheduledTask {
  logger.info('Starting expired shares and public links cleanup job (hourly)');

  return cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();

      const deletedShares = await db
        .delete(shares)
        .where(and(isNotNull(shares.expiresAt), lt(shares.expiresAt, now)))
        .returning({ id: shares.id });

      const deletedLinks = await db
        .delete(publicLinks)
        .where(and(isNotNull(publicLinks.expiresAt), lt(publicLinks.expiresAt, now)))
        .returning({ id: publicLinks.id });

      logger.info(
        {
          deletedSharesCount: deletedShares.length,
          deletedLinksCount:  deletedLinks.length,
        },
        'Expired shares and public links cleaned up',
      );
    } catch (err) {
      logger.error({ err }, 'Error during expired shares/links cleanup job');
    }
  });
}
