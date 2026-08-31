import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import type { PublicLinkController } from './public-links.controller';

export function createPublicLinkRoutes(controller: PublicLinkController): Router {
  const router = Router();

  // ── Authenticated routes ───────────────────────────────────────────────────
  router.post('/',    authenticate, controller.create);   // POST   /public
  router.get('/',     authenticate, controller.list);     // GET    /public
  router.delete('/:id', authenticate, controller.revoke); // DELETE /public/:id

  // ── Unauthenticated public resolution route ────────────────────────────────
  // Must be registered after collection routes so it doesn't conflict
  router.get('/:token', controller.resolve);               // GET    /public/:token

  return router;
}
