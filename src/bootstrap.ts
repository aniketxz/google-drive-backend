import { createApp } from './app';
import { db } from './db';
import { redis, sessionStore } from './cache/redis';
import { eventBus } from './events';
import { logger } from './utils/logger';

/**
 * Composition root — manually wires all dependencies and mounts routes.
 *
 * Infrastructure singletons (db, redis, eventBus, logger) are imported
 * directly from their modules since they are stateless singletons.
 *
 * Module classes (repositories → services → controllers) are instantiated
 * explicitly here and injected via constructor arguments.
 *
 * Add each phase's wiring in the sections below as they are implemented.
 */
export function createBootstrappedApp() {
  // ── Phase 2: Auth ─────────────────────────────────────────────────────────
  // const authRepository = new AuthRepository(db);
  // const authService    = new AuthService({ authRepository, redis, sessionStore, config, logger });
  // const authController = new AuthController({ authService, logger });

  // ── Phase 3: Folders ──────────────────────────────────────────────────────
  // const folderRepository = new FolderRepository(db);
  // const folderService    = new FolderService({ folderRepository, logger });
  // const folderController = new FolderController({ folderService, logger });

  // ── Phase 4: Uploads ──────────────────────────────────────────────────────
  // const uploadRepository = new UploadRepository(db);
  // const uploadService    = new UploadService({ uploadRepository, redis, eventBus, config, logger });
  // const uploadController = new UploadController({ uploadService, logger });

  // ── Phase 5: Files ────────────────────────────────────────────────────────
  // const fileRepository = new FileRepository(db);
  // const fileService    = new FileService({ fileRepository, eventBus, config, logger });
  // const fileController = new FileController({ fileService, logger });

  // ── Phase 7: Shares & Public Links ────────────────────────────────────────
  // const shareRepository      = new ShareRepository(db);
  // const publicLinkRepository = new PublicLinkRepository(db);
  // const shareService         = new ShareService({ shareRepository, logger });
  // const publicLinkService    = new PublicLinkService({ publicLinkRepository, config, logger });
  // const shareController      = new ShareController({ shareService, logger });
  // const publicLinkController = new PublicLinkController({ publicLinkService, logger });

  const app = createApp({
    // authController,
    // folderController,
    // uploadController,
    // fileController,
    // shareController,
    // publicLinkController,
  });

  return app;
}

// Re-export infrastructure so server.ts can reference without re-importing
export { db, redis, sessionStore, eventBus, logger };
