import {
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Logger } from 'pino';

import type { Config } from '../../config';
import { s3Client } from '../../utils/s3';
import type { FileRepository, FileListFilters } from './files.repository';
import type { FolderRepository } from '../folders/folders.repository';
import type { File } from '../../db/schema/files';
import { AppError } from '../../utils/AppError';
import { eventBus } from '../../events';
import { ERROR_CODES, DOMAIN_EVENTS } from '../../constants';

interface FileServiceDeps {
  fileRepository:   FileRepository;
  folderRepository: FolderRepository;
  config:           Config;
  logger:           Logger;
}

export class FileService {
  private readonly fileRepository:   FileRepository;
  private readonly folderRepository: FolderRepository;
  private readonly config:           Config;
  private readonly logger:           Logger;

  constructor({ fileRepository, folderRepository, config, logger }: FileServiceDeps) {
    this.fileRepository   = fileRepository;
    this.folderRepository = folderRepository;
    this.config           = config;
    this.logger           = logger;
  }

  // ── List ───────────────────────────────────────────────────────────────────

  /**
   * Lists files owned by the user with optional filters.
   * Query params accepted:
   *   folderId  — uuid | "root" (null) | omit for all
   *   q         — search term
   *   starred   — "true"
   *   trash     — "true"
   */
  async listFiles(ownerId: string, rawFilters: Record<string, unknown>): Promise<File[]> {
    const filters: FileListFilters = {};

    if (rawFilters.folderId === 'root' || rawFilters.folderId === 'null') {
      filters.folderId = null;
    } else if (typeof rawFilters.folderId === 'string') {
      filters.folderId = rawFilters.folderId;
    }

    if (typeof rawFilters.q === 'string' && rawFilters.q.trim()) {
      filters.q = rawFilters.q.trim();
    }

    if (rawFilters.starred === 'true' || rawFilters.starred === true) {
      filters.starred = true;
    }

    if (rawFilters.trash === 'true' || rawFilters.trash === true) {
      filters.trash = true;
    }

    return this.fileRepository.listByOwner(ownerId, filters);
  }

  // ── Download ───────────────────────────────────────────────────────────────

  /**
   * Generates a pre-signed S3 URL for downloading the file.
   * TTL = config.PRESIGNED_URL_EXPIRES (default 15 min).
   */
  async getDownloadUrl(fileId: string, ownerId: string): Promise<string> {
    const file = await this.fileRepository.findById(fileId);
    if (!file || file.ownerId !== ownerId || file.deletedAt) {
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

    this.logger.debug({ fileId, ownerId }, 'Download presigned URL generated');
    return url;
  }

  // ── Thumbnail ──────────────────────────────────────────────────────────────

  /**
   * Generates a pre-signed S3 URL for viewing the thumbnail.
   * Returns null if the thumbnail has not been generated yet.
   */
  async getThumbnailUrl(fileId: string, ownerId: string): Promise<string | null> {
    const file = await this.fileRepository.findById(fileId);
    if (!file || file.ownerId !== ownerId || file.deletedAt) {
      throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);
    }

    if (!file.thumbnailS3Key || file.thumbnailStatus !== 'done') {
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: file.s3Bucket,
      Key:    file.thumbnailS3Key,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: this.config.PRESIGNED_URL_EXPIRES,
    });

    this.logger.debug({ fileId }, 'Thumbnail presigned URL generated');
    return url;
  }

  // ── Rename ─────────────────────────────────────────────────────────────────

  async renameFile(fileId: string, ownerId: string, name: string): Promise<File> {
    const file = await this.fileRepository.rename(fileId, ownerId, name);
    if (!file) throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);

    this.logger.info({ fileId, name }, 'File renamed');
    return file;
  }

  // ── Star ───────────────────────────────────────────────────────────────────

  async starFile(fileId: string, ownerId: string, isStarred: boolean): Promise<File> {
    const file = await this.fileRepository.star(fileId, ownerId, isStarred);
    if (!file) throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);

    return file;
  }

  // ── Move ───────────────────────────────────────────────────────────────────

  /**
   * Moves a file to a different folder (or to root if folderId is null).
   * Validates ownership of the destination folder.
   */
  async moveFile(fileId: string, ownerId: string, folderId: string | null): Promise<File> {
    if (folderId) {
      const folderExists = await this.folderRepository.existsAndOwned(folderId, ownerId);
      if (!folderExists) {
        throw new AppError(404, 'Destination folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
      }
    }

    const file = await this.fileRepository.move(fileId, ownerId, folderId);
    if (!file) throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);

    this.logger.info({ fileId, folderId }, 'File moved');
    return file;
  }

  // ── Soft Delete (Trash) ────────────────────────────────────────────────────

  /**
   * Soft-deletes a file (moves to trash). Decrements usedStorage.
   */
  async softDeleteFile(fileId: string, ownerId: string): Promise<void> {
    const file = await this.fileRepository.softDelete(fileId, ownerId);
    if (!file) throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);

    // Decrement usedStorage atomically
    await this.fileRepository.adjustUserStorage(ownerId, -file.size);

    this.logger.info({ fileId, ownerId }, 'File soft-deleted');
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  /**
   * Restores a file from trash. Increments usedStorage.
   */
  async restoreFile(fileId: string, ownerId: string): Promise<File> {
    const file = await this.fileRepository.restore(fileId, ownerId);
    if (!file) throw new AppError(404, 'File not found in trash', ERROR_CODES.FILE_NOT_FOUND);

    // Re-add file size back to usedStorage
    await this.fileRepository.adjustUserStorage(ownerId, file.size);

    this.logger.info({ fileId, ownerId }, 'File restored');
    return file;
  }

  // ── Hard Delete (Permanent) ────────────────────────────────────────────────

  /**
   * Permanently deletes a file from the DB and emits an event to remove it from S3.
   * Works on both active and trashed files.
   */
  async hardDeleteFile(fileId: string, ownerId: string): Promise<void> {
    const file = await this.fileRepository.findById(fileId);
    if (!file || file.ownerId !== ownerId) {
      throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);
    }

    // Only decrement quota if the file is still active (not already trashed)
    const isActive = !file.deletedAt;

    // Remove DB record first
    const deleted = await this.fileRepository.hardDelete(fileId, ownerId);
    if (!deleted) throw new AppError(404, 'File not found', ERROR_CODES.FILE_NOT_FOUND);

    if (isActive) {
      await this.fileRepository.adjustUserStorage(ownerId, -file.size);
    }

    // Remove from S3 synchronously (we have the s3Client here)
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: file.s3Bucket, Key: file.s3Key }),
      );
      this.logger.info({ fileId, s3Key: file.s3Key }, 'File permanently deleted from S3');
    } catch (err) {
      // Log but don't fail the request — S3 deletion is best-effort
      this.logger.error({ err, fileId, s3Key: file.s3Key }, 'S3 deletion failed after DB hard-delete');
    }

    // Emit event for any additional cleanup (e.g. thumbnail deletion in Phase 6)
    eventBus.emit(DOMAIN_EVENTS.FILE_DELETED, file.id, file.s3Key);

    this.logger.info({ fileId, ownerId }, 'File permanently deleted');
  }
}
