/**
 * Global Application Constants
 *
 * Centralized definition for system-wide constants across authentication,
 * storage, error codes, events, infrastructure, and validation limits.
 */

// ── Auth & Session ────────────────────────────────────────────────────────────
// Cookie names, token expiration times, and session caching keys.
export const AUTH_COOKIE_NAME = 'gdrive_token';
export const SESSION_CACHE_PREFIX = 'session:';
export const DEFAULT_JWT_EXPIRY = '7d';
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days in seconds
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// ── Storage & Quotas ──────────────────────────────────────────────────────────
// File size limits, default user quotas, and chunk sizes for multipart uploads.
export const DEFAULT_USER_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB
export const DEFAULT_MULTIPART_CHUNK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── AWS S3 & Presigned URLs ───────────────────────────────────────────────────
// S3 storage prefixes and validity durations for generated presigned URLs.
export const S3_UPLOAD_PREFIX = 'uploads';
export const DEFAULT_PRESIGNED_URL_EXPIRES_SECONDS = 900; // 15 minutes
export const S3_PART_PRESIGNED_URL_EXPIRES_SECONDS = 3600; // 1 hour

// ── Application Error Codes ───────────────────────────────────────────────────
// Standardized machine-readable error codes returned in API responses.
export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_INVALID: 'SESSION_INVALID',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  FOLDER_NOT_FOUND: 'FOLDER_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  UPLOAD_NOT_FOUND: 'UPLOAD_NOT_FOUND',
  UPLOAD_INVALID_STATUS: 'UPLOAD_INVALID_STATUS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  SHARE_NOT_FOUND: 'SHARE_NOT_FOUND',
  SHARE_ALREADY_EXISTS: 'SHARE_ALREADY_EXISTS',
  PUBLIC_LINK_NOT_FOUND: 'PUBLIC_LINK_NOT_FOUND',
  PUBLIC_LINK_EXPIRED: 'PUBLIC_LINK_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  S3_ERROR: 'S3_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── Domain Events ─────────────────────────────────────────────────────────────
// Event names emitted and listened to via the application EventBus.
export const DOMAIN_EVENTS = {
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  SHARE_CREATED: 'share.created',
} as const;

export type DomainEvent = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

// ── Server & Infrastructure ───────────────────────────────────────────────────
// Network, database, and process lifecycle configuration defaults.
export const DEFAULT_PORT = 3000;
export const DEFAULT_CLIENT_URL = 'http://localhost:5173';
export const DEFAULT_REDIS_URL = 'redis://localhost:6379';
export const DEFAULT_RABBITMQ_URL = 'amqp://localhost';
export const REDIS_MAX_RETRIES = 3;
export const SHUTDOWN_TIMEOUT_MS = 10_000; // 10 seconds
export const EVENT_BUS_MAX_LISTENERS = 50;

// ── Validation Limits ─────────────────────────────────────────────────────────
// Input constraints for request payloads.
export const VALIDATION = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 255,
  MAX_MIME_TYPE_LENGTH: 127,
  MAX_S3_PARTS: 10000,
} as const;
