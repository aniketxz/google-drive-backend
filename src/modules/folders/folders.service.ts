import type { Logger } from 'pino';
import type { FolderRepository } from './folders.repository';
import type { ShareRepository } from '../shares/shares.repository';
import type { Folder } from '../../db/schema/folders';
import { AppError } from '../../utils/AppError';
import { eventBus } from '../../events';
import { ERROR_CODES, DOMAIN_EVENTS } from '../../constants';

interface FolderServiceDeps {
  folderRepository: FolderRepository;
  shareRepository?: ShareRepository;
  logger:           Logger;
}

export class FolderService {
  private readonly folderRepository: FolderRepository;
  private readonly shareRepository?: ShareRepository;
  private readonly logger:           Logger;

  constructor({ folderRepository, shareRepository, logger }: FolderServiceDeps) {
    this.folderRepository = folderRepository;
    this.shareRepository  = shareRepository;
    this.logger           = logger;
  }

  /**
   * Helper to verify access permissions for a folder (owner or shared recipient).
   */
  private async assertFolderAccess(
    folderId: string,
    userId: string,
    requiredPermission: 'view' | 'edit' = 'view',
  ): Promise<{ folder: Folder; isOwner: boolean }> {
    const folder = await this.folderRepository.findById(folderId);
    if (!folder || folder.deletedAt) {
      throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
    }

    if (folder.ownerId === userId) {
      return { folder, isOwner: true };
    }

    if (!this.shareRepository) {
      throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
    }

    const share = await this.shareRepository.findActiveShare('folder', folder.id, userId);
    if (!share) {
      throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
    }

    if (requiredPermission === 'edit' && share.permission !== 'edit') {
      throw new AppError(403, 'You do not have permission to edit this folder', ERROR_CODES.FORBIDDEN);
    }

    return { folder, isOwner: false };
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async createFolder(
    ownerId:  string,
    name:     string,
    parentId: string | null = null,
  ): Promise<Folder> {
    // If a parentId is supplied, verify it belongs to this user
    if (parentId) {
      const parentExists = await this.folderRepository.existsAndOwned(parentId, ownerId);
      if (!parentExists) {
        throw new AppError(404, 'Parent folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
      }
    }

    const folder = await this.folderRepository.create({
      name,
      ownerId,
      parentId: parentId ?? undefined,
    });

    this.logger.info({ folderId: folder.id, ownerId, parentId }, 'Folder created');
    return folder;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /** List root folders (parentId = null) for the user. */
  async listRoot(ownerId: string): Promise<Folder[]> {
    return this.folderRepository.listByParent(ownerId, null);
  }

  /**
   * Get the contents of a folder: its immediate subfolders.
   * (Files inside the folder are returned by the Files module.)
   */
  async getFolderContents(
    id:     string,
    userId: string,
  ): Promise<{ folder: Folder; children: Folder[] }> {
    const { folder } = await this.assertFolderAccess(id, userId, 'view');
    const children = await this.folderRepository.listByParent(folder.ownerId, id);
    return { folder, children };
  }

  /**
   * Full recursive subtree as a flat list, using PostgreSQL CTE.
   */
  async getTree(id: string, userId: string): Promise<Folder[]> {
    const { folder } = await this.assertFolderAccess(id, userId, 'view');
    return this.folderRepository.getSubtree(id, folder.ownerId);
  }

  /**
   * Ancestor chain from root → parent of the given folder (breadcrumb).
   */
  async getBreadcrumb(id: string, userId: string): Promise<Folder[]> {
    const { folder } = await this.assertFolderAccess(id, userId, 'view');
    return this.folderRepository.getBreadcrumb(id, folder.ownerId);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async renameFolder(id: string, userId: string, name: string): Promise<Folder> {
    const { folder } = await this.assertFolderAccess(id, userId, 'edit');
    const updated = await this.folderRepository.updateFolder(folder.id, { name });
    if (!updated) throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);

    this.logger.info({ folderId: id, name, userId }, 'Folder renamed');
    return updated;
  }

  async starFolder(id: string, ownerId: string, isStarred: boolean): Promise<Folder> {
    const folder = await this.folderRepository.star(id, ownerId, isStarred);
    if (!folder) throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
    return folder;
  }

  // ── Delete / Restore ───────────────────────────────────────────────────────

  async deleteFolder(id: string, ownerId: string): Promise<void> {
    const deleted = await this.folderRepository.softDelete(id, ownerId);
    if (!deleted) throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);

    this.logger.info({ folderId: id, ownerId }, 'Folder soft-deleted');
  }

  async listTrashed(ownerId: string): Promise<Folder[]> {
    return this.folderRepository.listTrashed(ownerId);
  }

  async restoreFolder(id: string, ownerId: string): Promise<Folder> {
    const folder = await this.folderRepository.restore(id, ownerId);
    if (!folder) throw new AppError(404, 'Folder not found in trash', ERROR_CODES.FOLDER_NOT_FOUND);

    this.logger.info({ folderId: id, ownerId }, 'Folder restored');
    return folder;
  }

  async listStarred(ownerId: string): Promise<Folder[]> {
    return this.folderRepository.listStarred(ownerId);
  }

  async clearTrash(ownerId: string): Promise<void> {
    const filesToDelete = await this.folderRepository.clearTrash(ownerId);

    // Emit file.deleted events for files that were physically removed
    for (const file of filesToDelete) {
      this.logger.info({ fileId: file.id, s3Key: file.s3Key }, 'Emitting file.deleted event for cleared file');
      eventBus.emit(DOMAIN_EVENTS.FILE_DELETED, file.id, file.s3Key);
    }

    this.logger.info({ ownerId, clearedCount: filesToDelete.length }, 'Trash cleared successfully');
  }
}
