import { pgTable, uuid, varchar, bigint, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  googleId:    varchar('google_id', { length: 255 }).notNull().unique(),
  email:       varchar('email', { length: 255 }).notNull().unique(),
  name:        varchar('name', { length: 255 }).notNull(),
  avatar:      varchar('avatar', { length: 512 }),
  // Storage quota in bytes — default 2 GB
  quota:       bigint('quota', { mode: 'number' }).notNull().default(2 * 1024 * 1024 * 1024),
  usedStorage: bigint('used_storage', { mode: 'number' }).notNull().default(0),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
