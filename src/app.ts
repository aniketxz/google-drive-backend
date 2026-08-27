import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import morgan from 'morgan';
import { sql } from 'drizzle-orm';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { db } from './db';
import { redis } from './cache/redis';
import { isRabbitMQHealthy } from './queue/connection';

// Phase 2 routes
import { createAuthRoutes } from './modules/auth/auth.routes';
import type { AuthController } from './modules/auth/auth.controller';

// Phase 3 routes
import { createFolderRoutes } from './modules/folders/folders.routes';
import type { FolderController } from './modules/folders/folders.controller';

// Phase 4 routes
import { createUploadRoutes } from './modules/uploads/uploads.routes';
import type { UploadController } from './modules/uploads/uploads.controller';

// Phase 5 routes
import { createFileRoutes } from './modules/files/files.routes';
import type { FileController } from './modules/files/files.controller';

/**
 * Controllers are injected here by bootstrap.ts.
 * The interface grows as phases are implemented.
 */
export interface AppControllers {
  // Phase 2
  authController:        AuthController;
  // Phase 3
  folderController:      FolderController;
  // Phase 4
  uploadController:      UploadController;
  // Phase 5
  fileController:        FileController;
  // Phase 7
  // shareController:      ShareController;
  // publicLinkController: PublicLinkController;
}

export function createApp(controllers: Partial<AppControllers> = {}) {
  const app = express();

  // ── Security & parsing ────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_URL, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // ── HTTP logging — Morgan piped into Pino ─────────────────────────────────
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: { write: (msg) => logger.info({ type: 'http' }, msg.trim()) },
    }),
  );

  // ── Passport — stateless mode (no session middleware needed) ──────────────
  app.use(passport.initialize());

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/health', async (_req: Request, res: Response) => {
    const [dbCheck, redisCheck] = await Promise.allSettled([
      db.execute(sql`SELECT 1`),
      redis.ping(),
    ]);

    const services = {
      database: dbCheck.status === 'fulfilled' ? 'ok' : 'error',
      redis:    redisCheck.status === 'fulfilled' ? 'ok' : 'error',
      queue:    isRabbitMQHealthy() ? 'ok' : 'error',
    };

    const allHealthy = Object.values(services).every((s) => s === 'ok');

    res.status(allHealthy ? 200 : 503).json({
      status:    allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    });
  });

  // ── Module routes (mounted by bootstrap.ts as phases are implemented) ─────
  if (controllers.authController) {
    app.use('/auth', createAuthRoutes(controllers.authController));
  }
  if (controllers.folderController) {
    app.use('/folders', createFolderRoutes(controllers.folderController));
  }
  if (controllers.uploadController) {
    app.use('/uploads', createUploadRoutes(controllers.uploadController));
  }
  if (controllers.fileController) {
    app.use('/files', createFileRoutes(controllers.fileController));
  }
  // Phase 7: if (controllers.shareController)  app.use('/shares',  createShareRoutes(controllers.shareController));
  //          if (controllers.publicLinkController) app.use('/public', createPublicLinkRoutes(controllers.publicLinkController));

  // ── Global error handler — MUST be last ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
