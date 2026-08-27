import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { FileService } from './files.service';
import { AppError } from '../../utils/AppError';

interface FileControllerDeps {
  fileService: FileService;
  logger:      Logger;
}

// ── Validation schemas ──────────────────────────────────────────────────────
const renameSchema = z.object({
  name: z.string().min(1).max(255).trim(),
});

const starSchema = z.object({
  isStarred: z.boolean(),
});

const moveSchema = z.object({
  folderId: z.string().uuid().nullable(),
});

const listQuerySchema = z.object({
  folderId: z.string().optional(),
  q:        z.string().optional(),
  starred:  z.enum(['true', 'false']).optional(),
  trash:    z.enum(['true', 'false']).optional(),
});

export class FileController {
  private readonly fileService: FileService;
  private readonly logger:      Logger;

  constructor({ fileService, logger }: FileControllerDeps) {
    this.fileService = fileService;
    this.logger      = logger;
  }

  // ── GET /files ──────────────────────────────────────────────────────────────
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listQuerySchema.parse(req.query);
      const files = await this.fileService.listFiles(req.userId!, query);
      res.json({ success: true, data: files });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /files/:id/download ─────────────────────────────────────────────────
  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const url = await this.fileService.getDownloadUrl(id, req.userId!);
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /files/:id/thumbnail ────────────────────────────────────────────────
  thumbnail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const url = await this.fileService.getThumbnailUrl(id, req.userId!);
      if (!url) {
        // Thumbnail not yet ready — return 202 Accepted
        res.status(202).json({
          success: true,
          data:    null,
          message: 'Thumbnail not yet available',
        });
        return;
      }
      res.json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /files/:id/rename ─────────────────────────────────────────────────
  rename = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = renameSchema.parse(req.body);
      const file = await this.fileService.renameFile(id, req.userId!, name);
      res.json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /files/:id/star ───────────────────────────────────────────────────
  star = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { isStarred } = starSchema.parse(req.body);
      const file = await this.fileService.starFile(id, req.userId!, isStarred);
      res.json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /files/:id/move ───────────────────────────────────────────────────
  move = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { folderId } = moveSchema.parse(req.body);
      const file = await this.fileService.moveFile(id, req.userId!, folderId);
      res.json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /files/:id ───────────────────────────────────────────────────────
  softDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.fileService.softDeleteFile(id, req.userId!);
      res.json({ success: true, message: 'File moved to trash' });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /files/:id/restore ─────────────────────────────────────────────────
  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const file = await this.fileService.restoreFile(id, req.userId!);
      res.json({ success: true, data: file });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /files/:id/permanent ─────────────────────────────────────────────
  hardDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.fileService.hardDeleteFile(id, req.userId!);
      res.json({ success: true, message: 'File permanently deleted' });
    } catch (err) {
      next(err);
    }
  };
}
