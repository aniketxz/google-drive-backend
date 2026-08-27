import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import type { AuthController } from './auth.controller';

/**
 * Factory function receives the already-instantiated controller
 * so routes stay decoupled from construction/DI.
 */
export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  // ── Google OAuth flow ──────────────────────────────────────────────────────
  // GET /auth/google → redirect to Google consent screen
  router.get('/google', controller.googleLogin);

  // GET /auth/google/callback → handle OAuth code exchange
  router.get('/google/callback', ...controller.googleCallback);

  // GET /auth/failure → OAuth failure fallback
  router.get('/failure', controller.googleFailure);

  // ── Protected endpoints ────────────────────────────────────────────────────
  // POST /auth/logout
  router.post('/logout', authenticate, controller.logout);

  // GET /auth/me
  router.get('/me', authenticate, controller.me);

  return router;
}
