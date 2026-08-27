import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const schema = z.object({
  // ── App ────────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ── Redis ───────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ── RabbitMQ ────────────────────────────────────────────────────────────────
  RABBITMQ_URL: z.string().default('amqp://localhost'),

  // ── JWT & Sessions ──────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),
  SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7), // 7 days

  // ── Google OAuth ────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // ── AWS S3 ──────────────────────────────────────────────────────────────────
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),
  PRESIGNED_URL_EXPIRES: z.coerce.number().default(900), // 15 min

  // ── File Upload ─────────────────────────────────────────────────────────────
  MAX_FILE_SIZE_BYTES: z.coerce.number().default(1024 * 1024 * 1024),       // 1 GB
  MULTIPART_CHUNK_SIZE_BYTES: z.coerce.number().default(10 * 1024 * 1024),  // 10 MB
  DEFAULT_USER_QUOTA_BYTES: z.coerce.number().default(2 * 1024 * 1024 * 1024), // 2 GB
});

export type Config = z.infer<typeof schema>;

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:\n', result.error.format());
  process.exit(1);
}

export const config: Config = result.data;
