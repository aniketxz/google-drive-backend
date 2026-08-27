import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../../db/schema/users';
import type { User, NewUser } from '../../db/schema/users';
import * as schema from '../../db/schema';

type DB = NodePgDatabase<typeof schema>;

export class AuthRepository {
  constructor(private readonly db: DB) {}

  /**
   * Find a user by their Google OAuth sub identifier.
   */
  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return rows[0];
  }

  /**
   * Find a user by their primary key (UUID).
   */
  async findById(id: string): Promise<User | undefined> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0];
  }

  /**
   * Insert or update a user on conflict of `google_id`.
   * Always updates `name` and `avatar` to reflect the latest data from Google.
   */
  async upsert(data: NewUser): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.googleId,
        set: {
          name:      data.name,
          avatar:    data.avatar,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }
}
