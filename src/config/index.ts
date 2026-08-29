import { z } from 'zod';
import dotenv from 'dotenv';
import {
  DEFAULT_PORT,
  DEFAULT_CLIENT_URL,
  DEFAULT_REDIS_URL,
  DEFAULT_RABBITMQ_URL,
  DEFAULT_JWT_EXPIRY,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_PRESIGNED_URL_EXPIRES_SECONDS,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  DEFAULT_MULTIPART_CHUNK_SIZE_BYTES,
  DEFAULT_USER_QUOTA_BYTES,
} from '../constants';

dotenv.config();

const schema = z.object({
  // ── App ────────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(DEFAULT_PORT),
  CLIENT_URL: z.string().url().default(DEFAULT_CLIENT_URL),

  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ── Redis ───────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().default(DEFAULT_REDIS_URL),

  // ── RabbitMQ ────────────────────────────────────────────────────────────────
  RABBITMQ_URL: z.string().default(DEFAULT_RABBITMQ_URL),

  // ── JWT & Sessions ──────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default(DEFAULT_JWT_EXPIRY),
  SESSION_TTL_SECONDS: z.coerce.number().default(DEFAULT_SESSION_TTL_SECONDS),

  // ── Google OAuth ────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // ── AWS S3 ──────────────────────────────────────────────────────────────────
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),
  PRESIGNED_URL_EXPIRES: z.coerce.number().default(DEFAULT_PRESIGNED_URL_EXPIRES_SECONDS),

  // ── File Upload ─────────────────────────────────────────────────────────────
  MAX_FILE_SIZE_BYTES: z.coerce.number().default(DEFAULT_MAX_FILE_SIZE_BYTES),
  MULTIPART_CHUNK_SIZE_BYTES: z.coerce.number().default(DEFAULT_MULTIPART_CHUNK_SIZE_BYTES),
  DEFAULT_USER_QUOTA_BYTES: z.coerce.number().default(DEFAULT_USER_QUOTA_BYTES),
});

export type Config = z.infer<typeof schema>;

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:\n', result.error.format());
  process.exit(1);
}

export const config: Config = result.data;
