import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SESSION_CACHE_PREFIX, REDIS_MAX_RETRIES } from '../constants';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: REDIS_MAX_RETRIES,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

/** Verify connectivity — called at server startup */
export async function connectRedis(): Promise<void> {
  await redis.connect();
  await redis.ping();
}

// ── Session helpers ─────────────────────────────────────────────────────────

export const sessionStore = {
  set: (sessionId: string, userId: string): Promise<'OK'> =>
    redis.setex(
      `${SESSION_CACHE_PREFIX}${sessionId}`,
      config.SESSION_TTL_SECONDS,
      JSON.stringify({ id: userId }),
    ),

  get: async (sessionId: string): Promise<{ id: string } | null> => {
    const raw = await redis.get(`${SESSION_CACHE_PREFIX}${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as { id: string };
  },

  del: (sessionId: string): Promise<number> =>
    redis.del(`${SESSION_CACHE_PREFIX}${sessionId}`),
};

export type SessionStore = typeof sessionStore;
