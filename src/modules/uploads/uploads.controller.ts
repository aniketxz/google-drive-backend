import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { UploadService } from './uploads.service';
import { AppError } from '../../utils/AppError';

interface UploadControllerDeps {
  uploadService: UploadService;
  logger:        Logger;
}

// ── Validation schemas ──────────────────────────────────────────────────────
const initiateSchema = z.object({
  filename: z.string().min(1).max(255).trim(),
  mimeType: z.string().min(1).max(127).trim(),
  size:     z.number().int().positive(),
  folderId: z.string().uuid().optional().nullable(),
});

const presignPartSchema = z.object({
  partNumber: z.coerce.number().int().min(1).max(10000),
});

const completeSchema = z.object({
  parts: z.array(
    z.object({
      partNumber: z.number().int().min(1).max(10000),
      etag:       z.string().min(1).trim(),
    })
  ).min(1),
});

export class UploadController {
  private readonly uploadService: UploadService;
  private readonly logger:        Logger;

  constructor({ uploadService, logger }: UploadControllerDeps) {
    this.uploadService = uploadService;
    this.logger        = logger;
  }

  // ── POST /uploads/initiate ─────────────────────────────────────────────────
  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filename, mimeType, size, folderId } = initiateSchema.parse(req.body);
      const userId = req.userId!;

      const session = await this.uploadService.initiateUpload(
        userId,
        filename,
        mimeType,
        size,
        folderId ?? null
      );

      res.status(201).json({
        success: true,
        data:    session,
      });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /uploads/:id/parts/:partNumber/presign ──────────────────────────────
  presignPart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uploadId = req.params.id as string;
      const { partNumber } = presignPartSchema.parse(req.params);
      const userId = req.userId!;

      const url = await this.uploadService.getPresignedPartUrl(userId, uploadId, partNumber);

      res.json({
        success: true,
        data:    { url },
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /uploads/:id/complete ─────────────────────────────────────────────
  complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uploadId = req.params.id as string;
      const { parts } = completeSchema.parse(req.body);
      const userId = req.userId!;

      const file = await this.uploadService.completeUpload(userId, uploadId, parts);

      res.json({
        success: true,
        data:    file,
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /uploads/:id/abort ────────────────────────────────────────────────
  abort = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uploadId = req.params.id as string;
      const userId = req.userId!;

      await this.uploadService.abortUpload(userId, uploadId);

      res.json({
        success: true,
        message: 'Upload aborted successfully',
      });
    } catch (err) {
      next(err);
    }
  };
}
