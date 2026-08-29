import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import morgan from 'morgan';
import { sql } from 'drizzle-orm';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './db';
import { redis, sessionStore } from './cache/redis';
import { errorHandler } from './middleware/error.middleware';

// Module dependencies
import { AuthRepository } from './modules/auth/auth.repository';
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { createAuthRoutes } from './modules/auth/auth.routes';

import { FolderRepository } from './modules/folders/folders.repository';
import { FolderService } from './modules/folders/folders.service';
import { FolderController } from './modules/folders/folders.controller';
import { createFolderRoutes } from './modules/folders/folders.routes';

import { UploadRepository } from './modules/uploads/uploads.repository';
import { UploadService } from './modules/uploads/uploads.service';
import { UploadController } from './modules/uploads/uploads.controller';
import { createUploadRoutes } from './modules/uploads/uploads.routes';

import { FileRepository } from './modules/files/files.repository';
import { FileService } from './modules/files/files.service';
import { FileController } from './modules/files/files.controller';
import { createFileRoutes } from './modules/files/files.routes';

export function createApp() {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────────
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_URL, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: { write: (msg) => logger.info({ type: 'http' }, msg.trim()) },
    }),
  );
  app.use(passport.initialize());

  // ── Module Wiring & Passport Strategy ────────────────────────────────────
  const authRepo = new AuthRepository(db);
  const authService = new AuthService({ authRepository: authRepo, sessionStore, config, logger });
  authService.registerPassportStrategy();
  const authController = new AuthController({ authService, config, logger });

  const folderRepo = new FolderRepository(db);
  const folderService = new FolderService({ folderRepository: folderRepo, logger });
  const folderController = new FolderController({ folderService, logger });

  const uploadRepo = new UploadRepository(db);
  const uploadService = new UploadService({ uploadRepository: uploadRepo, folderRepository: folderRepo, config, logger });
  const uploadController = new UploadController({ uploadService, logger });

  const fileRepo = new FileRepository(db);
  const fileService = new FileService({ fileRepository: fileRepo, folderRepository: folderRepo, config, logger });
  const fileController = new FileController({ fileService, logger });

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/health', async (_req: Request, res: Response) => {
    const [dbCheck, redisCheck] = await Promise.allSettled([
      db.execute(sql`SELECT 1`),
      redis.ping(),
    ]);

    const services = {
      database: dbCheck.status === 'fulfilled' ? 'ok' : 'error',
      redis: redisCheck.status === 'fulfilled' ? 'ok' : 'error',
    };

    const allHealthy = Object.values(services).every((s) => s === 'ok');

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    });
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/auth', createAuthRoutes(authController));
  app.use('/folders', createFolderRoutes(folderController));
  app.use('/uploads', createUploadRoutes(uploadController));
  app.use('/files', createFileRoutes(fileController));

  // ── Global Error Handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
