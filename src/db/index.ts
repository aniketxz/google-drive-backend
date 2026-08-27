import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from '../config';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;

/** Verify connectivity — called at server startup */
export async function connectDB(): Promise<void> {
  const client = await pool.connect();
  client.release();
  logger.info('PostgreSQL connected');
}
