import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import type { Logger } from 'pino';

import type { Config } from '../../config';
import { s3Client } from '../../utils/s3';
import type { PublicLinkRepository } from './public-links.repository';
import type { FileRepository } from '../files/files.repository';
import type { FolderRepository } from '../folders/folders.repository';
import type { PublicLink } from '../../db/schema/public_links';
import { AppError } from '../../utils/AppError';
import { ERROR_CODES } from '../../constants';

interface PublicLinkServiceDeps {
  publicLinkRepository: PublicLinkRepository;
  fileRepository:       FileRepository;
  folderRepository:     FolderRepository;
  config:               Config;
  logger:               Logger;
}

export interface CreatePublicLinkInput {
  resourceType: 'file' | 'folder';
  resourceId:   string;
  expiresAt?:   string | Date | null;
}

export type ResolvedPublicResource =
  | {
      type: 'file';
      file: {
        id:           string;
        originalName: string;
        mimeType:     string;
        size:         number;
        createdAt:    Date;
      };
      url: string;
    }
  | {
      type: 'folder';
      folder: {
        id:        string;
        name:      string;
        createdAt: Date;
      };
      subfolders: Array<{
        id:        string;
        name:      string;
        createdAt: Date;
      }>;
      files: Array<{
        id:           string;
        originalName: string;
        mimeType:     string;
        size:         number;
        createdAt:    Date;
      }>;
    };

export class PublicLinkService {
  private readonly publicLinkRepository: PublicLinkRepository;
  private readonly fileRepository:       FileRepository;
  private readonly folderRepository:     FolderRepository;
  private readonly config:               Config;
  private readonly logger:               Logger;

  constructor({
    publicLinkRepository,
    fileRepository,
    folderRepository,
    config,
    logger,
  }: PublicLinkServiceDeps) {
    this.publicLinkRepository = publicLinkRepository;
    this.fileRepository       = fileRepository;
    this.folderRepository     = folderRepository;
    this.config               = config;
    this.logger               = logger;
  }

  /**
   * Create a new public share link with an unguessable token.
   */
  async createLink(
    ownerId: string,
    input: CreatePublicLinkInput,
  ): Promise<PublicLink> {
    // 1. Validate resource ownership and active status
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

    const token = nanoid(21);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    const link = await this.publicLinkRepository.create({
      token,
      resourceType: input.resourceType,
      resourceId:   input.resourceId,
      ownerId,
      expiresAt,
    });

    this.logger.info(
      { linkId: link.id, ownerId, resourceType: input.resourceType, resourceId: input.resourceId },
      'Public link created',
    );

    return link;
  }

  /**
   * List all active public links created by the current user.
   */
  async listMyLinks(ownerId: string): Promise<PublicLink[]> {
    return this.publicLinkRepository.findByOwner(ownerId);
  }

  /**
   * Resolve a public link token to access resource content without authentication.
   */
  async resolve(token: string): Promise<ResolvedPublicResource> {
    const link = await this.publicLinkRepository.findByToken(token);
    if (!link) {
      throw new AppError(404, 'Public link not found', ERROR_CODES.PUBLIC_LINK_NOT_FOUND);
    }

    // Check expiration
    if (link.expiresAt && new Date(link.expiresAt) <= new Date()) {
      throw new AppError(410, 'Public link has expired', ERROR_CODES.PUBLIC_LINK_EXPIRED);
    }

    if (link.resourceType === 'file') {
      const file = await this.fileRepository.findById(link.resourceId);
      if (!file || file.deletedAt) {
        throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);
      }

      const command = new GetObjectCommand({
        Bucket:                     file.s3Bucket,
        Key:                        file.s3Key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      });

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: this.config.PRESIGNED_URL_EXPIRES,
      });

      this.logger.debug({ token, fileId: file.id }, 'Public link resolved to file');

      return {
        type: 'file',
        file: {
          id:           file.id,
          originalName: file.originalName,
          mimeType:     file.mimeType,
          size:         file.size,
          createdAt:    file.createdAt,
        },
        url,
      };
    }

    if (link.resourceType === 'folder') {
      const folder = await this.folderRepository.findById(link.resourceId);
      if (!folder || folder.deletedAt) {
        throw new AppError(404, 'Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
      }

      const subfolders = await this.folderRepository.listByParent(folder.ownerId, folder.id);
      const files = await this.fileRepository.listByOwner(folder.ownerId, {
        folderId: folder.id,
        trash:    false,
      });

      this.logger.debug({ token, folderId: folder.id }, 'Public link resolved to folder');

      return {
        type: 'folder',
        folder: {
          id:        folder.id,
          name:      folder.name,
          createdAt: folder.createdAt,
        },
        subfolders: subfolders.map((f) => ({
          id:        f.id,
          name:      f.name,
          createdAt: f.createdAt,
        })),
        files: files.map((f) => ({
          id:           f.id,
          originalName: f.originalName,
          mimeType:     f.mimeType,
          size:         f.size,
          createdAt:    f.createdAt,
        })),
      };
    }

    throw new AppError(500, 'Unknown resource type', ERROR_CODES.INTERNAL_SERVER_ERROR);
  }

  /**
   * Revoke / delete a public link by ID.
   */
  async revokeLink(id: string, ownerId: string): Promise<void> {
    const deleted = await this.publicLinkRepository.delete(id, ownerId);
    if (!deleted) {
      throw new AppError(404, 'Public link not found', ERROR_CODES.PUBLIC_LINK_NOT_FOUND);
    }

    this.logger.info({ linkId: id, ownerId }, 'Public link revoked');
  }
}
