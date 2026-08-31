import {
  eq,
  and,
  or,
  isNull,
  isNotNull,
  ilike,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../db';
import { files } from '../../db/schema/files';
import { users } from '../../db/schema/users';
import type { File, NewFile } from '../../db/schema/files';

// ── Query filter shape used by FileService ────────────────────────────────────
export interface FileListFilters {
  folderId?: string | null; // undefined = don't filter; null = root-level files
  q?:        string;        // search term (ILIKE on original_name)
  starred?:  boolean;
  trash?:    boolean;
}

export class FileRepository {
  constructor(private readonly db: DB) {}

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * Find a single file by ID.
   * Does NOT filter by deletedAt — callers decide what is visible.
   */
  async findById(id: string): Promise<File | undefined> {
    const rows = await this.db
      .select()
      .from(files)
      .where(eq(files.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * List files owned by a user with optional filters.
   * - `trash=true`    → only deleted files
   * - `trash=false/missing` → only active files (deletedAt IS NULL)
   * - `starred=true`  → only starred
   * - `folderId=null` → root-level (folderId IS NULL)
   * - `folderId=<id>` → specific folder
   * - `q=<term>`      → case-insensitive search on originalName
   */
  async listByOwner(ownerId: string, filters: FileListFilters = {}): Promise<File[]> {
    const conditions = [eq(files.ownerId, ownerId)];

    // trash / active filter
    if (filters.trash) {
      conditions.push(isNotNull(files.deletedAt));
    } else {
      conditions.push(isNull(files.deletedAt));
    }

    // folder filter
    if (filters.folderId !== undefined) {
      if (filters.folderId === null) {
        conditions.push(isNull(files.folderId));
      } else {
        conditions.push(eq(files.folderId, filters.folderId));
      }
    }

    // starred filter
    if (filters.starred === true) {
      conditions.push(eq(files.isStarred, true));
    }

    // name search
    if (filters.q) {
      conditions.push(ilike(files.originalName, `%${filters.q}%`));
    }

    return this.db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(files.createdAt);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async updateFile(id: string, data: Partial<File>): Promise<File | undefined> {
    const [row] = await this.db
      .update(files)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(files.id, id), isNull(files.deletedAt)))
      .returning();
    return row;
  }

  async rename(id: string, ownerId: string, originalName: string): Promise<File | undefined> {
    const [row] = await this.db
      .update(files)
      .set({ originalName, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId), isNull(files.deletedAt)))
      .returning();
    return row;
  }

  async star(id: string, ownerId: string, isStarred: boolean): Promise<File | undefined> {
    const [row] = await this.db
      .update(files)
      .set({ isStarred, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId), isNull(files.deletedAt)))
      .returning();
    return row;
  }

  async move(id: string, ownerId: string, folderId: string | null): Promise<File | undefined> {
    const [row] = await this.db
      .update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId), isNull(files.deletedAt)))
      .returning();
    return row;
  }

  // ── Delete / Restore ───────────────────────────────────────────────────────

  /**
   * Soft-delete: sets deletedAt without touching S3.
   * Returns the deleted file row so the caller can decrement usedStorage.
   */
  async softDelete(id: string, ownerId: string): Promise<File | undefined> {
    const [row] = await this.db
      .update(files)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId), isNull(files.deletedAt)))
      .returning();
    return row;
  }

  /**
   * Restore a soft-deleted file (clears deletedAt).
   * Returns the restored file row so the caller can increment usedStorage.
   */
  async restore(id: string, ownerId: string): Promise<File | undefined> {
    const [row] = await this.db
      .update(files)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId), isNotNull(files.deletedAt)))
      .returning();
    return row;
  }

  /**
   * Hard-delete: permanently removes the file record from the DB.
   * Caller is responsible for removing the object from S3 and decrementing usedStorage.
   */
  async hardDelete(id: string, ownerId: string): Promise<File | undefined> {
    const [row] = await this.db
      .delete(files)
      .where(and(eq(files.id, id), eq(files.ownerId, ownerId)))
      .returning();
    return row;
  }

  // ── Quota helpers ──────────────────────────────────────────────────────────

  /**
   * Atomically adjusts usedStorage for a user by `delta` bytes.
   * Pass a negative value to decrement (e.g. on delete).
   */
  async adjustUserStorage(ownerId: string, delta: number): Promise<void> {
    await this.db
      .update(users)
      .set({
        usedStorage: sql`${users.usedStorage} + ${delta}`,
        updatedAt:   new Date(),
      })
      .where(eq(users.id, ownerId));
  }
}
