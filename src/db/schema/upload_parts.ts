import { pgTable, uuid, integer, varchar, timestamp } from 'drizzle-orm/pg-core';
import { uploads } from './uploads';

export const uploadParts = pgTable('upload_parts', {
  id:         uuid('id').primaryKey().defaultRandom(),
  uploadId:   uuid('upload_id').notNull().references(() => uploads.id, { onDelete: 'cascade' }),
  partNumber: integer('part_number').notNull(),
  // MD5 hash returned by S3 per part — required for completeMultipartUpload
  etag:       varchar('etag', { length: 255 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export type UploadPart    = typeof uploadParts.$inferSelect;
export type NewUploadPart = typeof uploadParts.$inferInsert;
