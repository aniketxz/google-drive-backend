import type { Logger } from 'pino';
import type { ShareRepository } from './shares.repository';
import type { FileRepository } from '../files/files.repository';
import type { FolderRepository } from '../folders/folders.repository';
import type { Share } from '../../db/schema/shares';
import { AppError } from '../../utils/AppError';
import { eventBus } from '../../events';
import { ERROR_CODES, DOMAIN_EVENTS } from '../../constants';

interface ShareServiceDeps {
  shareRepository:  ShareRepository;
  fileRepository:   FileRepository;
  folderRepository: FolderRepository;
  logger:           Logger;
}

export interface CreateShareInput {
  resourceType: 'file' | 'folder';
  resourceId:   string;
  email:        string;
  permission:   'view' | 'edit';
  expiresAt?:   string | Date | null;
}

export interface UpdateShareInput {
  permission?: 'view' | 'edit';
  expiresAt?:  string | Date | null;
}

export class ShareService {
  private readonly shareRepository:  ShareRepository;
  private readonly fileRepository:   FileRepository;
  private readonly folderRepository: FolderRepository;
  private readonly logger:           Logger;

  constructor({
    shareRepository,
    fileRepository,
    folderRepository,
    logger,
  }: ShareServiceDeps) {
    this.shareRepository  = shareRepository;
    this.fileRepository   = fileRepository;
    this.folderRepository = folderRepository;
    this.logger           = logger;
  }

  /**
   * Share a file or folder with another registered user by their email.
   */
  async createShare(ownerId: string, input: CreateShareInput): Promise<Share> {
    const email = input.email.trim().toLowerCase();

    // 1. Resolve recipient by email
    const recipient = await this.shareRepository.findUserByEmail(email);
    if (!recipient) {
      throw new AppError(404, 'User with this email not found', ERROR_CODES.USER_NOT_FOUND);
    }

    // 2. Prevent self-sharing
    if (recipient.id === ownerId) {
      throw new AppError(400, 'Cannot share a resource with yourself', ERROR_CODES.VALIDATION_ERROR);
    }

    // 3. Verify resource ownership and active status
    if (input.resourceType === 'file') {
      const file = await this.fileRepository.findById(input.resourceId);
      if (!file || file.ownerId !== ownerId || file.deletedAt) {
        throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);
      }
    } else if (input.resourceType === 'folder') {
      const folder = await this.folderRepository.findById(input.resourceId);
      if (!folder || folder.ownerId !== ownerId || folder.deletedAt) {
        throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
      }
    } else {
      throw new AppError(400, 'Invalid resource type', ERROR_CODES.VALIDATION_ERROR);
    }

    // 4. Check for existing active share
    const existing = await this.shareRepository.findByResourceAndRecipient(
      input.resourceType,
      input.resourceId,
      recipient.id,
    );

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    if (existing) {
      const isExpired = existing.expiresAt && new Date(existing.expiresAt) <= new Date();
      if (!isExpired) {
        throw new AppError(
          409,
          'Resource is already shared with this user',
          ERROR_CODES.SHARE_ALREADY_EXISTS,
        );
      }

      // Re-activate previously expired share
      const updated = await this.shareRepository.update(existing.id, ownerId, {
        permission: input.permission,
        expiresAt,
      });

      this.logger.info(
        { shareId: existing.id, ownerId, recipientId: recipient.id },
        'Expired share renewed',
      );
      return updated!;
    }

    // 5. Create new share
    const share = await this.shareRepository.create({
      resourceType: input.resourceType,
      resourceId:   input.resourceId,
      ownerId,
      sharedWithId: recipient.id,
      permission:   input.permission,
      expiresAt,
    });

    eventBus.emit(DOMAIN_EVENTS.SHARE_CREATED, share.id);
    this.logger.info(
      { shareId: share.id, ownerId, sharedWithId: recipient.id, resourceType: input.resourceType },
      'Share created',
    );

    return share;
  }

  /**
   * Enrich share record with resource (file/folder) and user metadata.
   */
  private async enrichShare(share: Share) {
    let resource: Record<string, unknown> | null = null;
    if (share.resourceType === 'file') {
      const file = await this.fileRepository.findById(share.resourceId);
      if (file && !file.deletedAt) {
        resource = {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          thumbnailStatus: file.thumbnailStatus,
          isStarred: file.isStarred,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        };
      }
    } else if (share.resourceType === 'folder') {
      const folder = await this.folderRepository.findById(share.resourceId);
      if (folder && !folder.deletedAt) {
        resource = {
          id: folder.id,
          name: folder.name,
          isStarred: folder.isStarred,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        };
      }
    }

    const [owner, recipient] = await Promise.all([
      this.shareRepository.findUserById(share.ownerId),
      this.shareRepository.findUserById(share.sharedWithId),
    ]);

    return {
      ...share,
      resource,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email, avatar: owner.avatar } : null,
      sharedWith: recipient ? { id: recipient.id, name: recipient.name, email: recipient.email, avatar: recipient.avatar } : null,
    };
  }

  /**
   * List active shares received by user ("Shared with Me"), with enriched metadata.
   */
  async getReceivedShares(userId: string) {
    const rawShares = await this.shareRepository.findReceivedBy(userId);
    return Promise.all(rawShares.map((s) => this.enrichShare(s)));
  }

  /**
   * List shares created by user ("My Shares"), with enriched metadata.
   */
  async getSentShares(userId: string) {
    const rawShares = await this.shareRepository.findSentBy(userId);
    return Promise.all(rawShares.map((s) => this.enrichShare(s)));
  }

  /**
   * Update permission or expiry date on an existing share.
   */
  async updateShare(
    id: string,
    ownerId: string,
    input: UpdateShareInput,
  ): Promise<Share> {
    const share = await this.shareRepository.findById(id);
    if (!share || share.ownerId !== ownerId) {
      throw new AppError(404, 'Share not found', ERROR_CODES.SHARE_NOT_FOUND);
    }

    const updateData: Partial<Pick<Share, 'permission' | 'expiresAt'>> = {};
    if (input.permission !== undefined) {
      updateData.permission = input.permission;
    }
    if (input.expiresAt !== undefined) {
      updateData.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }

    const updated = await this.shareRepository.update(id, ownerId, updateData);
    if (!updated) {
      throw new AppError(404, 'Share not found', ERROR_CODES.SHARE_NOT_FOUND);
    }

    this.logger.info({ shareId: id, ownerId }, 'Share updated');
    return updated;
  }

  /**
   * Revoke/delete a share immediately.
   */
  async revokeShare(id: string, ownerId: string): Promise<void> {
    const deleted = await this.shareRepository.delete(id, ownerId);
    if (!deleted) {
      throw new AppError(404, 'Share not found', ERROR_CODES.SHARE_NOT_FOUND);
    }

    this.logger.info({ shareId: id, ownerId }, 'Share revoked');
  }
}
