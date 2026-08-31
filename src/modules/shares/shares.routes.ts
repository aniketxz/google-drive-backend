import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import type { ShareController } from './shares.controller';

export function createShareRoutes(controller: ShareController): Router {
  const router = Router();

  // All share routes require authentication
  router.use(authenticate);

  // ── Collection / List routes (must be mounted before /:id) ─────────────────
  router.post('/',          controller.create);        // POST   /shares
  router.get('/received',   controller.listReceived);  // GET    /shares/received
  router.get('/sent',       controller.listSent);      // GET    /shares/sent

  // ── Item routes ────────────────────────────────────────────────────────────
  router.patch('/:id',      controller.update);        // PATCH  /shares/:id
  router.delete('/:id',     controller.revoke);        // DELETE /shares/:id

  return router;
}
