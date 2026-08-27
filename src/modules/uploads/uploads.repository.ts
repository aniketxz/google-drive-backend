import { eq, and, sql } from 'drizzle-orm';
import type { DB } from '../../db';
import { uploads } from '../../db/schema/uploads';
import { uploadParts } from '../../db/schema/upload_parts';
import { users } from '../../db/schema/users';
import { files } from '../../db/schema/files';
import type { Upload, NewUpload } from '../../db/schema/uploads';
import type { UploadPart, NewUploadPart } from '../../db/schema/upload_parts';
import type { File, NewFile } from '../../db/schema/files';
import type { User } from '../../db/schema/users';

export class UploadRepository {
  constructor(private readonly db: DB) {}

  /** Inserts a new pending multipart upload session. */
  async create(data: NewUpload): Promise<Upload> {
    const [row] = await this.db.insert(uploads).values(data).returning();
    return row;
  }

  /** Finds a multipart upload session by ID. */
  async findById(id: string): Promise<Upload | undefined> {
    const rows = await this.db
      .select()
      .from(uploads)
      .where(eq(uploads.id, id))
      .limit(1);
    return rows[0];
  }

  /** Updates the status and metadata of an upload session. */
  async updateStatus(id: string, status: Upload['status']): Promise<Upload> {
    const [row] = await this.db
      .update(uploads)
      .set({ status })
      .where(eq(uploads.id, id))
      .returning();
    return row;
  }

  /** Inserts etags and numbers for completed upload parts. */
  async insertParts(parts: NewUploadPart[]): Promise<UploadPart[]> {
    return this.db.insert(uploadParts).values(parts).returning();
  }

  /** Finds a user by ID to inspect quota and storage metrics. */
  async findUserStorage(userId: string): Promise<Pick<User, 'id' | 'quota' | 'usedStorage'> | undefined> {
    const rows = await this.db
      .select({
        id:          users.id,
        quota:       users.quota,
        usedStorage: users.usedStorage,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0];
  }

  /**
   * Completes the upload session in a database transaction:
   * 1. Creates the file record in `files` table.
   * 2. Updates the user's used storage quota.
   * 3. Sets the upload session status to 'completed'.
   */
  async completeUploadTx(
    uploadId: string,
    fileData: NewFile,
    size: number,
  ): Promise<File> {
    return this.db.transaction(async (tx) => {
      // 1. Create file record
      const [file] = await tx.insert(files).values(fileData).returning();

      // 2. Update user's used storage quota
      await tx
        .update(users)
        .set({
          usedStorage: sql`${users.usedStorage} + ${size}`,
          updatedAt:   new Date(),
        })
        .where(eq(users.id, fileData.ownerId));

      // 3. Mark upload session completed
      await tx
        .update(uploads)
        .set({ status: 'completed' })
        .where(eq(uploads.id, uploadId));

      return file;
    });
  }
}
