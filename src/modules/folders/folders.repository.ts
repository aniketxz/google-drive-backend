import {
  eq,
  and,
  or,
  inArray,
  isNull,
  isNotNull,
  sql,
} from 'drizzle-orm';
import type { DB } from '../../db';
import { folders } from '../../db/schema/folders';
import type { Folder, NewFolder } from '../../db/schema/folders';
import { files } from '../../db/schema/files';
import { shares } from '../../db/schema/shares';

export class FolderRepository {
  constructor(private readonly db: DB) {}

  // ── Basic CRUD ─────────────────────────────────────────────────────────────

  async create(data: NewFolder): Promise<Folder> {
    const [row] = await this.db.insert(folders).values(data).returning();
    return row;
  }

  async findById(id: string): Promise<Folder | undefined> {
    const rows = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
      .limit(1);
    return rows[0];
  }

  /**
   * List immediate children of a given parent (or root-level when parentId is null).
   * Excludes soft-deleted folders.
   */
  async listByParent(ownerId: string, parentId: string | null): Promise<Folder[]> {
    return this.db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.ownerId, ownerId),
          parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId),
          isNull(folders.deletedAt),
        ),
      )
      .orderBy(folders.name);
  }

  async updateFolder(id: string, data: Partial<Folder>): Promise<Folder | undefined> {
    const [row] = await this.db
      .update(folders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
      .returning();
    return row;
  }

  async rename(id: string, ownerId: string, name: string): Promise<Folder | undefined> {
    const [row] = await this.db
      .update(folders)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.ownerId, ownerId), isNull(folders.deletedAt)))
      .returning();
    return row;
  }

  /** Soft-delete — sets deletedAt timestamp. ON DELETE CASCADE handles physical children. */
  async softDelete(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db
      .update(folders)
      .set({ deletedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.ownerId, ownerId), isNull(folders.deletedAt)));
    return (result.rowCount ?? 0) > 0;
  }

  async star(id: string, ownerId: string, isStarred: boolean): Promise<Folder | undefined> {
    const [row] = await this.db
      .update(folders)
      .set({ isStarred, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.ownerId, ownerId), isNull(folders.deletedAt)))
      .returning();
    return row;
  }

  // ── Recursive tree (PostgreSQL CTE) ───────────────────────────────────────

  /**
   * Returns the full subtree rooted at `rootId` using a recursive CTE.
   * Result is flat — callers can nest it in memory if needed.
   *
   * SQL shape:
   *   WITH RECURSIVE tree AS (
   *     SELECT * FROM folders WHERE id = $rootId AND owner_id = $ownerId AND deleted_at IS NULL
   *     UNION ALL
   *     SELECT f.* FROM folders f JOIN tree t ON f.parent_id = t.id WHERE f.deleted_at IS NULL
   *   )
   *   SELECT * FROM tree ORDER BY name;
   */
  async getSubtree(rootId: string, ownerId: string): Promise<Folder[]> {
    const result = await this.db.execute<Folder>(sql`
      WITH RECURSIVE tree AS (
        SELECT * FROM folders
        WHERE id = ${rootId}
          AND owner_id = ${ownerId}
          AND deleted_at IS NULL
        UNION ALL
        SELECT f.* FROM folders f
        INNER JOIN tree t ON f.parent_id = t.id
        WHERE f.deleted_at IS NULL
      )
      SELECT
        id,
        name,
        owner_id        AS "ownerId",
        parent_id       AS "parentId",
        is_starred      AS "isStarred",
        deleted_at      AS "deletedAt",
        created_at      AS "createdAt",
        updated_at      AS "updatedAt"
      FROM tree
      ORDER BY name
    `);
    return result.rows;
  }

  /**
   * Returns every ancestor of `folderId` up to root (breadcrumb path).
   *
   * SQL shape:
   *   WITH RECURSIVE ancestors AS (
   *     SELECT * FROM folders WHERE id = $folderId
   *     UNION ALL
   *     SELECT f.* FROM folders f JOIN ancestors a ON f.id = a.parent_id
   *   )
   *   SELECT * FROM ancestors WHERE id != $folderId ORDER BY created_at;
   */
  async getBreadcrumb(folderId: string, ownerId: string): Promise<Folder[]> {
    const result = await this.db.execute<Folder>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT * FROM folders
        WHERE id = ${folderId} AND owner_id = ${ownerId}
        UNION ALL
        SELECT f.* FROM folders f
        INNER JOIN ancestors a ON f.id = a.parent_id
      )
      SELECT
        id,
        name,
        owner_id        AS "ownerId",
        parent_id       AS "parentId",
        is_starred      AS "isStarred",
        deleted_at      AS "deletedAt",
        created_at      AS "createdAt",
        updated_at      AS "updatedAt"
      FROM ancestors
      WHERE id != ${folderId}
      ORDER BY created_at ASC
    `);
    return result.rows;
  }

  /** Checks ownership + existence in a single query (used for access guards). */
  async existsAndOwned(id: string, ownerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, id), eq(folders.ownerId, ownerId), isNull(folders.deletedAt)))
      .limit(1);
    return rows.length > 0;
  }

  /** Starred folders for the user. */
  async listStarred(ownerId: string): Promise<Folder[]> {
    return this.db
      .select()
      .from(folders)
      .where(
        and(eq(folders.ownerId, ownerId), eq(folders.isStarred, true), isNull(folders.deletedAt)),
      )
      .orderBy(folders.name);
  }

  /** Soft-deleted (trash) folders for the user. */
  async listTrashed(ownerId: string): Promise<Folder[]> {
    return this.db
      .select()
      .from(folders)
      .where(and(eq(folders.ownerId, ownerId), isNotNull(folders.deletedAt)))
      .orderBy(folders.deletedAt);
  }

  /** Restore a soft-deleted folder. */
  async restore(id: string, ownerId: string): Promise<Folder | undefined> {
    const [row] = await this.db
      .update(folders)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(folders.id, id), eq(folders.ownerId, ownerId), isNotNull(folders.deletedAt)))
      .returning();
    return row;
  }

  /**
   * Permanently clears all trash (folders and files) for the user.
   * If a file is shared with other users, we do not delete it from PostgreSQL or S3.
   * Instead, we transfer ownership to one of the shared users and remove their share.
   * If no other users point to the file, it is deleted from the DB and queued for S3 deletion.
   */
  async clearTrash(ownerId: string): Promise<{ id: string; s3Key: string }[]> {
    // 1. Get all soft-deleted folders owned by this user
    const deletedFolders = await this.db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.ownerId, ownerId), isNotNull(folders.deletedAt)));
    const deletedFolderIds = deletedFolders.map((f) => f.id);

    // 2. Build conditions to find files to clear (either marked soft-deleted OR inside a soft-deleted folder)
    const fileConditions = [eq(files.ownerId, ownerId)];
    if (deletedFolderIds.length > 0) {
      fileConditions.push(
        or(isNotNull(files.deletedAt), inArray(files.folderId, deletedFolderIds)) as any
      );
    } else {
      fileConditions.push(isNotNull(files.deletedAt) as any);
    }

    const filesToProcess = await this.db
      .select()
      .from(files)
      .where(and(...fileConditions));

    const filesToDeleteS3: { id: string; s3Key: string }[] = [];

    // Process files one by one to check sharing reference rules
    for (const file of filesToProcess) {
      const activeShares = await this.db
        .select()
        .from(shares)
        .where(and(eq(shares.resourceId, file.id), eq(shares.resourceType, 'file')));

      if (activeShares.length > 0) {
        // Transfer ownership to the first shared user (primary recipient)
        const primaryShare = activeShares[0];
        const newOwnerId = primaryShare.sharedWithId;

        await this.db
          .update(files)
          .set({
            ownerId: newOwnerId,
            deletedAt: null, // restore for the new owner
            folderId: null,  // reset to root-level for new owner
            updatedAt: new Date(),
          })
          .where(eq(files.id, file.id));

        // Delete the share reference for the new owner (since they are now the owner)
        await this.db
          .delete(shares)
          .where(and(eq(shares.resourceId, file.id), eq(shares.sharedWithId, newOwnerId)));
      } else {
        // No other users point to this file, we can safely delete from database and S3
        await this.db.delete(files).where(eq(files.id, file.id));
        filesToDeleteS3.push({ id: file.id, s3Key: file.s3Key });
      }
    }

    // 3. Hard delete all soft-deleted folders owned by this user
    await this.db
      .delete(folders)
      .where(and(eq(folders.ownerId, ownerId), isNotNull(folders.deletedAt)));

    return filesToDeleteS3;
  }
}
