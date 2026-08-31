import {
  eq,
  and,
  isNotNull,
  lt,
} from 'drizzle-orm';
import type { DB } from '../../db';
import { publicLinks } from '../../db/schema/public_links';
import type { PublicLink, NewPublicLink } from '../../db/schema/public_links';

export class PublicLinkRepository {
  constructor(private readonly db: DB) {}

  /**
   * Create a new public link record.
   */
  async create(data: NewPublicLink): Promise<PublicLink> {
    const [row] = await this.db.insert(publicLinks).values(data).returning();
    return row;
  }

  /**
   * Find a public link by its unique URL token.
   */
  async findByToken(token: string): Promise<PublicLink | undefined> {
    const rows = await this.db
      .select()
      .from(publicLinks)
      .where(eq(publicLinks.token, token))
      .limit(1);
    return rows[0];
  }

  /**
   * Find all active public links created by a specific owner.
   */
  async findByOwner(ownerId: string): Promise<PublicLink[]> {
    return this.db
      .select()
      .from(publicLinks)
      .where(eq(publicLinks.ownerId, ownerId))
      .orderBy(publicLinks.createdAt);
  }

  /**
   * Find a public link by ID.
   */
  async findById(id: string): Promise<PublicLink | undefined> {
    const rows = await this.db
      .select()
      .from(publicLinks)
      .where(eq(publicLinks.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * Revoke / delete a public link by ID and ownerId.
   */
  async delete(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db
      .delete(publicLinks)
      .where(and(eq(publicLinks.id, id), eq(publicLinks.ownerId, ownerId)));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Purge expired public links (used by hourly cleanup cron).
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(publicLinks)
      .where(and(isNotNull(publicLinks.expiresAt), lt(publicLinks.expiresAt, now)));
    return result.rowCount ?? 0;
  }
}
