import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { FolderService } from './folders.service';
import { AppError } from '../../utils/AppError';

interface FolderControllerDeps {
  folderService: FolderService;
  logger:        Logger;
}

// ── Request validation schemas ─────────────────────────────────────────────
const createSchema = z.object({
  name:     z.string().min(1).max(255).trim(),
  parentId: z.string().uuid().optional().nullable(),
});

const renameSchema = z.object({
  name: z.string().min(1).max(255).trim(),
});

const starSchema = z.object({
  isStarred: z.boolean(),
});

export class FolderController {
  private readonly folderService: FolderService;
  private readonly logger:        Logger;

  constructor({ folderService, logger }: FolderControllerDeps) {
    this.folderService = folderService;
    this.logger        = logger;
  }

  // ── POST /folders ──────────────────────────────────────────────────────────
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { name, parentId } = createSchema.parse(req.body);

      const folder = await this.folderService.createFolder(userId, name, parentId ?? null);
      res.status(201).json({ success: true, data: folder });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /folders ───────────────────────────────────────────────────────────
  listRoot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folders = await this.folderService.listRoot(req.userId!);
      res.json({ success: true, data: folders });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /folders/starred ───────────────────────────────────────────────────
  listStarred = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folders = await this.folderService.listStarred(req.userId!);
      res.json({ success: true, data: folders });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /folders/trash ─────────────────────────────────────────────────────
  listTrashed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folders = await this.folderService.listTrashed(req.userId!);
      res.json({ success: true, data: folders });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /folders/:id ───────────────────────────────────────────────────────
  getContents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { folder, children } = await this.folderService.getFolderContents(
        id,
        req.userId!,
      );
      res.json({ success: true, data: { folder, children } });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /folders/:id/tree ──────────────────────────────────────────────────
  getTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tree = await this.folderService.getTree(id, req.userId!);
      res.json({ success: true, data: tree });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /folders/:id/breadcrumb ────────────────────────────────────────────
  getBreadcrumb = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const crumbs = await this.folderService.getBreadcrumb(id, req.userId!);
      res.json({ success: true, data: crumbs });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /folders/:id/rename ──────────────────────────────────────────────
  rename = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name } = renameSchema.parse(req.body);
      const folder = await this.folderService.renameFolder(id, req.userId!, name);
      res.json({ success: true, data: folder });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /folders/:id/star ────────────────────────────────────────────────
  star = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { isStarred } = starSchema.parse(req.body);
      const folder = await this.folderService.starFolder(id, req.userId!, isStarred);
      res.json({ success: true, data: folder });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /folders/:id ────────────────────────────────────────────────────
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.folderService.deleteFolder(id, req.userId!);
      res.json({ success: true, message: 'Folder moved to trash' });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /folders/:id/restore ──────────────────────────────────────────────
  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const folder = await this.folderService.restoreFolder(id, req.userId!);
      res.json({ success: true, data: folder });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /folders/trash ──────────────────────────────────────────────────
  clearTrash = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.folderService.clearTrash(req.userId!);
      res.json({ success: true, message: 'Trash cleared successfully' });
    } catch (err) {
      next(err);
    }
  };
}
