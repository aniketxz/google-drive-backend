import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import type { Logger } from 'pino';
import type { AuthService } from './auth.service';
import { AppError } from '../../utils/AppError';
import type { User } from '../../db/schema/users';

interface AuthControllerDeps {
  authService: AuthService;
  logger:      Logger;
}

export class AuthController {
  private readonly authService: AuthService;
  private readonly logger:      Logger;

  constructor({ authService, logger }: AuthControllerDeps) {
    this.authService = authService;
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

        res.cookie('gdrive_token', token, {
          httpOnly: true,
          secure:   process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
        });

        this.logger.info({ userId: user.id }, 'User logged in via Google OAuth');
        // Redirect to frontend after successful login
        res.redirect(`${process.env.CLIENT_URL ?? 'http://localhost:3000'}/dashboard`);
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
      if (!req.sessionId) throw new AppError(401, 'Not authenticated', 'UNAUTHENTICATED');

      await this.authService.revokeSession(req.sessionId);

      res.clearCookie('gdrive_token', { httpOnly: true, sameSite: 'lax' });

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
      if (!req.userId) throw new AppError(401, 'Not authenticated', 'UNAUTHENTICATED');

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
