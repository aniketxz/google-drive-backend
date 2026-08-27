import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { resourceTypeEnum } from './enums';

export const publicLinks = pgTable('public_links', {
  id:           uuid('id').primaryKey().defaultRandom(),
  // URL-safe random token — shared publicly as /public/:token
  token:        varchar('token', { length: 128 }).notNull().unique(),
  resourceType: resourceTypeEnum('resource_type').notNull(),
  // Polymorphic — either files.id or folders.id depending on resourceType
  resourceId:   uuid('resource_id').notNull(),
  ownerId:      uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // null = link never expires
  expiresAt:    timestamp('expires_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export type PublicLink    = typeof publicLinks.$inferSelect;
export type NewPublicLink = typeof publicLinks.$inferInsert;
