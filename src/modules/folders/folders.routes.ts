import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import type { FolderController } from './folders.controller';

export function createFolderRoutes(controller: FolderController): Router {
  const router = Router();

  // All folder routes require authentication
  router.use(authenticate);

  // ── Collection routes ──────────────────────────────────────────────────────
  router.post('/',           controller.create);       // POST   /folders
  router.get('/',            controller.listRoot);     // GET    /folders        (root-level)
  router.get('/starred',     controller.listStarred);  // GET    /folders/starred
  router.get('/trash',       controller.listTrashed);  // GET    /folders/trash
  router.delete('/trash',    controller.clearTrash);   // DELETE /folders/trash

  // ── Item routes ────────────────────────────────────────────────────────────
  router.get('/:id',             controller.getContents);   // GET    /folders/:id
  router.get('/:id/tree',        controller.getTree);       // GET    /folders/:id/tree
  router.get('/:id/breadcrumb',  controller.getBreadcrumb); // GET    /folders/:id/breadcrumb
  router.patch('/:id/rename',    controller.rename);        // PATCH  /folders/:id/rename
  router.patch('/:id/star',      controller.star);          // PATCH  /folders/:id/star
  router.delete('/:id',          controller.delete);        // DELETE /folders/:id
  router.post('/:id/restore',    controller.restore);       // POST   /folders/:id/restore

  return router;
}
