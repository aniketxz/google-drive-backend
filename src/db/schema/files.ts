import { pgTable, uuid, varchar, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { folders } from './folders';
import { thumbnailStatusEnum } from './enums';

export const files = pgTable('files', {
  id:              uuid('id').primaryKey().defaultRandom(),
  originalName:    varchar('original_name', { length: 255 }).notNull(),
  s3Key:           varchar('s3_key', { length: 512 }).notNull().unique(),
  s3Bucket:        varchar('s3_bucket', { length: 255 }).notNull(),
  mimeType:        varchar('mime_type', { length: 127 }).notNull(),
  size:            bigint('size', { mode: 'number' }).notNull(),
  ownerId:         uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // null = root-level file
  folderId:        uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  thumbnailS3Key:  varchar('thumbnail_s3_key', { length: 512 }),
  thumbnailStatus: thumbnailStatusEnum('thumbnail_status').notNull().default('pending'),
  isStarred:       boolean('is_starred').notNull().default(false),
  // null = not deleted; soft-delete sets this to current timestamp
  deletedAt:       timestamp('deleted_at'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
});

export type File    = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
