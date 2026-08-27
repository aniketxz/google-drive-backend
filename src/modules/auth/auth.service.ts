import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';
import { nanoid } from 'nanoid';
import type { Logger } from 'pino';
import type { Config } from '../../config';
import type { AuthRepository } from './auth.repository';
import type { SessionStore } from '../../cache/redis';
import { signToken } from '../../utils/jwt';
import type { User } from '../../db/schema/users';

interface AuthServiceDeps {
  authRepository: AuthRepository;
  sessionStore:   SessionStore;
  config:         Config;
  logger:         Logger;
}

export class AuthService {
  private readonly authRepository: AuthRepository;
  private readonly sessionStore:   SessionStore;
  private readonly config:         Config;
  private readonly logger:         Logger;

  constructor({ authRepository, sessionStore, config, logger }: AuthServiceDeps) {
    this.authRepository = authRepository;
    this.sessionStore   = sessionStore;
    this.config         = config;
    this.logger         = logger;
  }

  /**
   * Register the Passport Google OAuth 2.0 strategy.
   * Called once at startup, before app.use(passport.initialize()).
   */
  registerPassportStrategy(): void {
    passport.use(
      new GoogleStrategy(
        {
          clientID:     this.config.GOOGLE_CLIENT_ID,
          clientSecret: this.config.GOOGLE_CLIENT_SECRET,
          callbackURL:  this.config.GOOGLE_CALLBACK_URL,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: Profile,
          done: VerifyCallback,
        ) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google'), undefined);

            const user = await this.authRepository.upsert({
              googleId: profile.id,
              email,
              name:   profile.displayName ?? email,
              avatar: profile.photos?.[0]?.value ?? null,
            });

            this.logger.debug({ userId: user.id }, 'Google OAuth user upserted');
            done(null, user);
          } catch (err) {
            done(err as Error, undefined);
          }
        },
      ),
    );

    // Passport requires serialize/deserialize even in stateless JWT mode
    passport.serializeUser((user, done) => done(null, (user as User).id));
    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await this.authRepository.findById(id);
        done(null, user ?? null);
      } catch (err) {
        done(err);
      }
    });
  }

  /**
   * Create a Redis session and return a signed JWT that carries the sessionId.
   */
  async createSession(userId: string): Promise<string> {
    const sessionId = nanoid();
    await this.sessionStore.set(sessionId, userId);
    this.logger.debug({ userId, sessionId }, 'Session created');
    return signToken(sessionId);
  }

  /**
   * Revoke the Redis session identified by sessionId.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionStore.del(sessionId);
    this.logger.debug({ sessionId }, 'Session revoked');
  }

  /**
   * Look up a user by primary key — used for GET /auth/me.
   */
  async getUser(userId: string): Promise<User> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    return user;
  }
}
