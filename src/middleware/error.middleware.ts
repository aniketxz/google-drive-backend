import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { ERROR_CODES } from '../constants';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode },
      err.message,
    );
    res.status(err.statusCode).json({
      success: false,
      code:    err.code ?? 'ERROR',
      message: err.message,
    });
    return;
  }

  // Unhandled / unexpected errors
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    code:    ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
  });
}
