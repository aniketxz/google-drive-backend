import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import type { FileController } from './files.controller';

export function createFileRoutes(controller: FileController): Router {
  const router = Router();

  // All file routes require authentication
  router.use(authenticate);

  // ── Collection ─────────────────────────────────────────────────────────────
  // GET  /files?folderId=&q=&starred=true&trash=true
  router.get('/', controller.list);

  // ── Per-file actions ───────────────────────────────────────────────────────
  router.get('/:id/download',   controller.download);       // GET    /files/:id/download
  router.get('/:id/thumbnail',  controller.thumbnail);      // GET    /files/:id/thumbnail
  router.patch('/:id/rename',   controller.rename);         // PATCH  /files/:id/rename
  router.patch('/:id/star',     controller.star);           // PATCH  /files/:id/star
  router.patch('/:id/move',     controller.move);           // PATCH  /files/:id/move
  router.delete('/:id',         controller.softDelete);     // DELETE /files/:id          (trash)
  router.post('/:id/restore',   controller.restore);        // POST   /files/:id/restore
  router.delete('/:id/permanent', controller.hardDelete);   // DELETE /files/:id/permanent

  return router;
}
