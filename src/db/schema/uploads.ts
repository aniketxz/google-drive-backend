import { pgTable, uuid, varchar, bigint, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { folders } from './folders';
import { uploadStatusEnum } from './enums';

export const uploads = pgTable('uploads', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  s3Key:        varchar('s3_key', { length: 512 }).notNull().unique(),
  s3Bucket:     varchar('s3_bucket', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType:     varchar('mime_type', { length: 127 }).notNull(),
  totalSize:    bigint('total_size', { mode: 'number' }).notNull(),
  totalParts:   integer('total_parts').notNull(),
  // The UploadId returned by S3 createMultipartUpload — needed for completeMultipartUpload
  s3UploadId:   varchar('s3_upload_id', { length: 512 }).notNull(),
  status:       uploadStatusEnum('status').notNull().default('pending'),
  // Optional: file will land in this folder on completion
  folderId:     uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export type Upload    = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
