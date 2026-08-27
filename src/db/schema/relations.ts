import { relations } from 'drizzle-orm';
import { users } from './users';
import { folders } from './folders';
import { files } from './files';
import { uploads } from './uploads';
import { uploadParts } from './upload_parts';
import { shares } from './shares';
import { publicLinks } from './public_links';

// ── Users ──────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  folders:     many(folders),
  files:       many(files),
  uploads:     many(uploads),
  sharesOwned: many(shares, { relationName: 'owner' }),
  sharesRecv:  many(shares, { relationName: 'recipient' }),
  publicLinks: many(publicLinks),
}));

// ── Folders ────────────────────────────────────────────────────────────────
export const foldersRelations = relations(folders, ({ one, many }) => ({
  owner:    one(users, { fields: [folders.ownerId], references: [users.id] }),
  parent:   one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folder_hierarchy',
  }),
  children: many(folders, { relationName: 'folder_hierarchy' }),
  files:    many(files),
}));

// ── Files ──────────────────────────────────────────────────────────────────
export const filesRelations = relations(files, ({ one }) => ({
  owner:  one(users,   { fields: [files.ownerId],  references: [users.id] }),
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
}));

// ── Uploads ────────────────────────────────────────────────────────────────
export const uploadsRelations = relations(uploads, ({ one, many }) => ({
  user:   one(users,   { fields: [uploads.userId],   references: [users.id] }),
  folder: one(folders, { fields: [uploads.folderId], references: [folders.id] }),
  parts:  many(uploadParts),
}));

// ── Upload Parts ───────────────────────────────────────────────────────────
export const uploadPartsRelations = relations(uploadParts, ({ one }) => ({
  upload: one(uploads, { fields: [uploadParts.uploadId], references: [uploads.id] }),
}));

// ── Shares ─────────────────────────────────────────────────────────────────
export const sharesRelations = relations(shares, ({ one }) => ({
  owner:      one(users, { fields: [shares.ownerId],      references: [users.id], relationName: 'owner' }),
  sharedWith: one(users, { fields: [shares.sharedWithId], references: [users.id], relationName: 'recipient' }),
}));

// ── Public Links ───────────────────────────────────────────────────────────
export const publicLinksRelations = relations(publicLinks, ({ one }) => ({
  owner: one(users, { fields: [publicLinks.ownerId], references: [users.id] }),
}));
