import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';

import type { Config } from '../../config';
import { s3Client } from '../../utils/s3';
import type { UploadRepository } from './uploads.repository';
import type { FolderRepository } from '../folders/folders.repository';
import type { Upload } from '../../db/schema/uploads';
import type { File } from '../../db/schema/files';
import { AppError } from '../../utils/AppError';
import { eventBus } from '../../events';
import {
  ERROR_CODES,
  DOMAIN_EVENTS,
  S3_UPLOAD_PREFIX,
  S3_PART_PRESIGNED_URL_EXPIRES_SECONDS,
} from '../../constants';

interface UploadServiceDeps {
  uploadRepository: UploadRepository;
  folderRepository: FolderRepository;
  config:           Config;
  logger:           Logger;
}

export class UploadService {
  private readonly uploadRepository: UploadRepository;
  private readonly folderRepository: FolderRepository;
  private readonly config:           Config;
  private readonly logger:           Logger;

  constructor({ uploadRepository, folderRepository, config, logger }: UploadServiceDeps) {
    this.uploadRepository = uploadRepository;
    this.folderRepository = folderRepository;
    this.config           = config;
    this.logger           = logger;
  }

  /**
   * Initiates a multipart S3 upload session:
   * 1. Checks user's storage quota against the target file size.
   * 2. Validates folder ownership if nested under a folder.
   * 3. Creates multipart session in S3.
   * 4. Stores pending session in PostgreSQL.
   */
  async initiateUpload(
    userId:   string,
    filename: string,
    mimeType: string,
    size:     number,
    folderId: string | null = null,
  ): Promise<{ uploadId: string; key: string }> {
    // 1. Check user storage quota
    const userStorage = await this.uploadRepository.findUserStorage(userId);
    if (!userStorage) {
      throw new AppError(404, 'User storage record not found', ERROR_CODES.USER_NOT_FOUND);
    }

    const projectedUsage = userStorage.usedStorage + size;
    if (projectedUsage > userStorage.quota) {
      throw new AppError(400, 'Insufficient storage quota to complete this upload', ERROR_CODES.QUOTA_EXCEEDED);
    }

    // 2. Validate folder ownership
    if (folderId) {
      const folderExists = await this.folderRepository.existsAndOwned(folderId, userId);
      if (!folderExists) {
        throw new AppError(404, 'Destination folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
      }
    }

    // 3. Initiate S3 multipart upload
    const fileId = uuidv4();
    const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `${S3_UPLOAD_PREFIX}/${userId}/${fileId}-${sanitizedName}`;

    this.logger.debug({ userId, s3Key }, 'Initiating S3 Multipart Upload');

    const command = new CreateMultipartUploadCommand({
      Bucket:      this.config.AWS_S3_BUCKET,
      Key:         s3Key,
      ContentType: mimeType,
    });

    const s3Response = await s3Client.send(command);
    if (!s3Response.UploadId) {
      throw new AppError(500, 'Failed to initiate upload in S3', ERROR_CODES.S3_ERROR);
    }

    // 4. Save session in DB
    const dbRecord = await this.uploadRepository.create({
      userId,
      s3Key,
      s3Bucket:     this.config.AWS_S3_BUCKET,
      originalName: filename,
      mimeType,
      totalSize:    size,
      totalParts:   0, // will be indexed on completion, or computed dynamically
      s3UploadId:   s3Response.UploadId,
      folderId:     folderId ?? undefined,
      status:       'pending',
    });

    this.logger.info({ uploadId: dbRecord.id, userId }, 'Multipart upload session initiated');

    return {
      uploadId: dbRecord.id,
      key:      s3Key,
    };
  }

  /**
   * Generates a signed URL for a specific upload part.
   */
  async getPresignedPartUrl(
    userId:     string,
    uploadId:   string,
    partNumber: number,
  ): Promise<string> {
    const upload = await this.uploadRepository.findById(uploadId);
    if (!upload || upload.userId !== userId) {
      throw new AppError(404, 'Upload session not found', ERROR_CODES.UPLOAD_NOT_FOUND);
    }

    if (upload.status !== 'pending' && upload.status !== 'uploading') {
      throw new AppError(400, `Cannot upload parts to a session with status: ${upload.status}`, ERROR_CODES.UPLOAD_INVALID_STATUS);
    }

    if (upload.status === 'pending') {
      await this.uploadRepository.updateStatus(uploadId, 'uploading');
    }

    const command = new UploadPartCommand({
      Bucket:     upload.s3Bucket,
      Key:        upload.s3Key,
      UploadId:   upload.s3UploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: S3_PART_PRESIGNED_URL_EXPIRES_SECONDS,
    });
  }

  /**
   * Completes a multipart upload:
   * 1. Informs S3 to assemble all parts.
   * 2. Saves metadata tags in database.
   * 3. Atomically registers the file, updates user storage quota, and flags session completed.
   * 4. Emits internal 'file.uploaded' event for thumbnails.
   */
  async completeUpload(
    userId:   string,
    uploadId: string,
    parts:    { partNumber: number; etag: string }[],
  ): Promise<File> {
    const upload = await this.uploadRepository.findById(uploadId);
    if (!upload || upload.userId !== userId) {
      throw new AppError(404, 'Upload session not found', ERROR_CODES.UPLOAD_NOT_FOUND);
    }

    if (upload.status !== 'uploading' && upload.status !== 'pending') {
      throw new AppError(400, `Session status must be uploading/pending to complete, current: ${upload.status}`, ERROR_CODES.UPLOAD_INVALID_STATUS);
    }

    // Sort parts to satisfy S3 SDK constraints
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

    this.logger.debug({ uploadId, partsCount: sortedParts.length }, 'Completing S3 Multipart Upload');

    // 1. Tell S3 to assemble the file
    const command = new CompleteMultipartUploadCommand({
      Bucket:          upload.s3Bucket,
      Key:             upload.s3Key,
      UploadId:        upload.s3UploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
          PartNumber: p.partNumber,
          ETag:       p.etag,
        })),
      },
    });

    try {
      await s3Client.send(command);
    } catch (err) {
      this.logger.error({ err, uploadId }, 'S3 CompleteMultipartUpload failed');
      await this.uploadRepository.updateStatus(uploadId, 'failed');
      throw new AppError(500, 'S3 completed multipart request failed', ERROR_CODES.S3_ERROR);
    }

    // 3. Complete session and register the file atomically in transaction
    const file = await this.uploadRepository.completeUploadTx(
      uploadId,
      {
        originalName:    upload.originalName,
        s3Key:           upload.s3Key,
        s3Bucket:        upload.s3Bucket,
        mimeType:        upload.mimeType,
        size:            upload.totalSize,
        ownerId:         userId,
        folderId:        upload.folderId ?? undefined,
        thumbnailStatus: 'pending',
      },
      upload.totalSize,
    );

    this.logger.info({ fileId: file.id, uploadId }, 'Multipart upload successfully completed');

    // 4. Trigger async post-processing pipeline
    eventBus.emit(DOMAIN_EVENTS.FILE_UPLOADED, file);

    return file;
  }

  /**
   * Aborts an active multipart upload.
   */
  async abortUpload(userId: string, uploadId: string): Promise<void> {
    const upload = await this.uploadRepository.findById(uploadId);
    if (!upload || upload.userId !== userId) {
      throw new AppError(404, 'Upload session not found', ERROR_CODES.UPLOAD_NOT_FOUND);
    }

    if (upload.status !== 'pending' && upload.status !== 'uploading') {
      throw new AppError(400, `Cannot abort upload session with status: ${upload.status}`, ERROR_CODES.UPLOAD_INVALID_STATUS);
    }

    this.logger.info({ uploadId, userId }, 'Aborting multipart upload session');

    const command = new AbortMultipartUploadCommand({
      Bucket:   upload.s3Bucket,
      Key:      upload.s3Key,
      UploadId: upload.s3UploadId,
    });

    try {
      await s3Client.send(command);
    } catch (err) {
      this.logger.error({ err, uploadId }, 'S3 AbortMultipartUpload failed');
    }

    await this.uploadRepository.updateStatus(uploadId, 'aborted');
  }
}
