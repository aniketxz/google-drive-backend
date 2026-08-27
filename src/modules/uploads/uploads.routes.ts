import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import type { UploadController } from './uploads.controller';

export function createUploadRoutes(controller: UploadController): Router {
  const router = Router();

  // All upload routes require authentication
  router.use(authenticate);

  // Initiate a multipart upload session
  router.post('/initiate', controller.initiate);

  // Generate a presigned URL for a specific part upload
  router.get('/:id/parts/:partNumber/presign', controller.presignPart);

  // Complete the multipart upload session
  router.post('/:id/complete', controller.complete);

  // Abort the multipart upload session
  router.post('/:id/abort', controller.abort);

  return router;
}
