import {
  eq,
  and,
  or,
  isNull,
  isNotNull,
  gt,
  lt,
} from 'drizzle-orm';
import type { DB } from '../../db';
import { shares } from '../../db/schema/shares';
import { users } from '../../db/schema/users';
import type { Share, NewShare } from '../../db/schema/shares';
import type { User } from '../../db/schema/users';

export class ShareRepository {
  constructor(private readonly db: DB) {}

  /**
   * Create a new share record.
   */
  async create(data: NewShare): Promise<Share> {
    const [row] = await this.db.insert(shares).values(data).returning();
    return row;
  }

  /**
   * Find a share by its primary key.
   */
  async findById(id: string): Promise<Share | undefined> {
    const rows = await this.db
      .select()
      .from(shares)
      .where(eq(shares.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * Find a share by resource and recipient (to detect duplicate sharing).
   */
  async findByResourceAndRecipient(
    resourceType: 'file' | 'folder',
    resourceId: string,
    sharedWithId: string,
  ): Promise<Share | undefined> {
    const rows = await this.db
      .select()
      .from(shares)
      .where(
        and(
          eq(shares.resourceType, resourceType),
          eq(shares.resourceId, resourceId),
          eq(shares.sharedWithId, sharedWithId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /**
   * Check if a recipient user has an active, non-expired share for a resource.
   */
  async findActiveShare(
    resourceType: 'file' | 'folder',
    resourceId: string,
    userId: string,
  ): Promise<Share | undefined> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(shares)
      .where(
        and(
          eq(shares.resourceType, resourceType),
          eq(shares.resourceId, resourceId),
          eq(shares.sharedWithId, userId),
          or(isNull(shares.expiresAt), gt(shares.expiresAt, now)),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /**
   * Find active shares received by a user (sharedWithId = userId).
   * Excludes expired shares (where expiresAt is set and in the past).
   */
  async findReceivedBy(userId: string): Promise<Share[]> {
    const now = new Date();
    return this.db
      .select()
      .from(shares)
      .where(
        and(
          eq(shares.sharedWithId, userId),
          or(isNull(shares.expiresAt), gt(shares.expiresAt, now)),
        ),
      )
      .orderBy(shares.createdAt);
  }

  /**
   * Find shares created/sent by a user (ownerId = userId).
   */
  async findSentBy(userId: string): Promise<Share[]> {
    return this.db
      .select()
      .from(shares)
      .where(eq(shares.ownerId, userId))
      .orderBy(shares.createdAt);
  }

  /**
   * Update permission and/or expiresAt of a share owned by ownerId.
   */
  async update(
    id: string,
    ownerId: string,
    data: Partial<Pick<Share, 'permission' | 'expiresAt'>>,
  ): Promise<Share | undefined> {
    const [row] = await this.db
      .update(shares)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(shares.id, id), eq(shares.ownerId, ownerId)))
      .returning();
    return row;
  }

  /**
   * Delete / revoke a share owned by ownerId.
   */
  async delete(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db
      .delete(shares)
      .where(and(eq(shares.id, id), eq(shares.ownerId, ownerId)));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find user by email (used to resolve sharedWithId from recipient email).
   */
  async findUserByEmail(email: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0];
  }

  /**
   * Find user by ID (used to attach user info to shares).
   */
  async findUserById(id: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * Purge expired shares (used by hourly cleanup cron).
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(shares)
      .where(and(isNotNull(shares.expiresAt), lt(shares.expiresAt, now)));
    return result.rowCount ?? 0;
  }
}
