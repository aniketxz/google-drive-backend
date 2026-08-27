import { pgTable, uuid, varchar, boolean, timestamp, AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from './users';

export const folders = pgTable('folders', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 255 }).notNull(),
  ownerId:   uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // null = root-level folder
  parentId:  uuid('parent_id').references((): AnyPgColumn => folders.id, { onDelete: 'cascade' }),
  isStarred: boolean('is_starred').notNull().default(false),
  // null = not deleted; soft-delete sets this to current timestamp
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Folder    = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
