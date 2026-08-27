import { pgEnum } from 'drizzle-orm/pg-core';

/** Shared across files and folders for sharing/public-link tables */
export const resourceTypeEnum = pgEnum('resource_type', ['file', 'folder']);

/** Upload lifecycle */
export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'uploading',
  'completed',
  'failed',
  'aborted',
]);

/** Async thumbnail generation lifecycle */
export const thumbnailStatusEnum = pgEnum('thumbnail_status', [
  'pending',
  'processing',
  'done',
  'failed',
]);

/** Share permission level */
export const permissionEnum = pgEnum('permission', ['view', 'edit']);
