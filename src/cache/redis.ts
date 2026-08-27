import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
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

const SESSION_PREFIX = 'session:';

export const sessionStore = {
  set: (sessionId: string, userId: string): Promise<'OK'> =>
    redis.setex(
      `${SESSION_PREFIX}${sessionId}`,
      config.SESSION_TTL_SECONDS,
      JSON.stringify({ id: userId }),
    ),

  get: async (sessionId: string): Promise<{ id: string } | null> => {
    const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as { id: string };
  },

  del: (sessionId: string): Promise<number> =>
    redis.del(`${SESSION_PREFIX}${sessionId}`),
};

export type SessionStore = typeof sessionStore;
