import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import type { Logger } from 'pino';
import type { AuthService } from './auth.service';
import type { Config } from '../../config';
import { AppError } from '../../utils/AppError';
import type { User } from '../../db/schema/users';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_MS, ERROR_CODES } from '../../constants';

interface AuthControllerDeps {
  authService: AuthService;
  config:      Config;
  logger:      Logger;
}

export class AuthController {
  private readonly authService: AuthService;
  private readonly config:      Config;
  private readonly logger:      Logger;

  constructor({ authService, config, logger }: AuthControllerDeps) {
    this.authService = authService;
    this.config      = config;
    this.logger      = logger;
  }

  // ── GET /auth/google ───────────────────────────────────────────────────────
  /** Kicks off the Google OAuth consent flow. */
  googleLogin = passport.authenticate('google', {
    scope:  ['profile', 'email'],
    session: false,
  });

  // ── GET /auth/google/callback ──────────────────────────────────────────────
  /**
   * Passport calls the strategy's verify callback, which upserts the user.
   * On success, we create a Redis session and set the JWT cookie.
   */
  googleCallback = [
    passport.authenticate('google', {
      failureRedirect: '/auth/failure',
      session: false,
    }),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = req.user as User;
        const token = await this.authService.createSession(user.id);

        res.cookie(AUTH_COOKIE_NAME, token, {
          httpOnly: true,
          secure:   this.config.NODE_ENV === 'production',
          sameSite: this.config.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge:   AUTH_COOKIE_MAX_AGE_MS,
        });

        this.logger.info({ userId: user.id }, 'User logged in via Google OAuth');
        // Redirect to frontend after successful login
        res.redirect(this.config.CLIENT_URL);
      } catch (err) {
        next(err);
      }
    },
  ];

  // ── GET /auth/failure ──────────────────────────────────────────────────────
  /** Handles OAuth failure redirect. */
  googleFailure = (_req: Request, res: Response): void => {
    res.status(401).json({ success: false, message: 'Google authentication failed' });
  };

  // ── POST /auth/logout ──────────────────────────────────────────────────────
  /** Deletes the Redis session and clears the cookie. */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.sessionId) throw new AppError(401, 'Not authenticated', ERROR_CODES.UNAUTHENTICATED);

      await this.authService.revokeSession(req.sessionId);

      res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });

      this.logger.info({ userId: req.userId }, 'User logged out');
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /auth/me ───────────────────────────────────────────────────────────
  /** Returns the currently authenticated user's profile. */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) throw new AppError(401, 'Not authenticated', ERROR_CODES.UNAUTHENTICATED);

      const user = await this.authService.getUser(req.userId);

      res.json({
        success: true,
        data: {
          id:          user.id,
          email:       user.email,
          name:        user.name,
          avatar:      user.avatar,
          quota:       user.quota,
          usedStorage: user.usedStorage,
          createdAt:   user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
