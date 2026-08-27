import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { resourceTypeEnum, permissionEnum } from './enums';

export const shares = pgTable('shares', {
  id:           uuid('id').primaryKey().defaultRandom(),
  resourceType: resourceTypeEnum('resource_type').notNull(),
  // Polymorphic — either files.id or folders.id depending on resourceType
  resourceId:   uuid('resource_id').notNull(),
  ownerId:      uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sharedWithId: uuid('shared_with_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permission:   permissionEnum('permission').notNull().default('view'),
  // null = share never expires
  expiresAt:    timestamp('expires_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

export type Share    = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
