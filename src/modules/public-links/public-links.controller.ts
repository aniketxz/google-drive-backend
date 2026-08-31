import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { PublicLinkService } from './public-links.service';

interface PublicLinkControllerDeps {
  publicLinkService: PublicLinkService;
  logger:            Logger;
}

// ── Validation schemas ──────────────────────────────────────────────────────
const createPublicLinkSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId:   z.string().uuid(),
  expiresAt:    z.string().datetime().optional().nullable(),
});

export class PublicLinkController {
  private readonly publicLinkService: PublicLinkService;
  private readonly logger:            Logger;

  constructor({ publicLinkService, logger }: PublicLinkControllerDeps) {
    this.publicLinkService = publicLinkService;
    this.logger            = logger;
  }

  // ── POST /public ───────────────────────────────────────────────────────────
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createPublicLinkSchema.parse(req.body);
      const link = await this.publicLinkService.createLink(req.userId!, input);
      res.status(201).json({ success: true, data: link });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /public ────────────────────────────────────────────────────────────
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const links = await this.publicLinkService.listMyLinks(req.userId!);
      res.json({ success: true, data: links });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /public/:token (Unauthenticated) ───────────────────────────────────
  resolve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token as string;
      const result = await this.publicLinkService.resolve(token);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /public/:id ─────────────────────────────────────────────────────
  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.publicLinkService.revokeLink(id, req.userId!);
      res.json({ success: true, message: 'Public link revoked successfully' });
    } catch (err) {
      next(err);
    }
  };
}
