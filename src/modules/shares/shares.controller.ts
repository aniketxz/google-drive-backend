import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { ShareService } from './shares.service';

interface ShareControllerDeps {
  shareService: ShareService;
  logger:       Logger;
}

// ── Validation schemas ──────────────────────────────────────────────────────
const createShareSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId:   z.string().uuid(),
  email:        z.string().email().trim(),
  permission:   z.enum(['view', 'edit']).default('view'),
  expiresAt:    z.string().datetime().optional().nullable(),
});

const updateShareSchema = z.object({
  permission: z.enum(['view', 'edit']).optional(),
  expiresAt:  z.string().datetime().optional().nullable(),
});

export class ShareController {
  private readonly shareService: ShareService;
  private readonly logger:       Logger;

  constructor({ shareService, logger }: ShareControllerDeps) {
    this.shareService = shareService;
    this.logger       = logger;
  }

  // ── POST /shares ───────────────────────────────────────────────────────────
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createShareSchema.parse(req.body);
      const share = await this.shareService.createShare(req.userId!, input);
      res.status(201).json({ success: true, data: share });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /shares/received ───────────────────────────────────────────────────
  listReceived = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.shareService.getReceivedShares(req.userId!);
      res.json({ success: true, data: shares });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /shares/sent ───────────────────────────────────────────────────────
  listSent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.shareService.getSentShares(req.userId!);
      res.json({ success: true, data: shares });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /shares/:id ──────────────────────────────────────────────────────
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const input = updateShareSchema.parse(req.body);
      const share = await this.shareService.updateShare(id, req.userId!, input);
      res.json({ success: true, data: share });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /shares/:id ─────────────────────────────────────────────────────
  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.shareService.revokeShare(id, req.userId!);
      res.json({ success: true, message: 'Share revoked successfully' });
    } catch (err) {
      next(err);
    }
  };
}
