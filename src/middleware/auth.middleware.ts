import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { sessionStore } from '../cache/redis';
import { AppError } from '../utils/AppError';
import { AUTH_COOKIE_NAME, ERROR_CODES } from '../constants';

/**
 * Extracts the JWT from the HTTP-only cookie,
 * verifies it, looks up the session in Redis, and attaches
 * `req.userId` and `req.sessionId` for downstream handlers.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
    if (!token) throw new AppError(401, 'Not authenticated', ERROR_CODES.UNAUTHENTICATED);

    const { sessionId } = verifyToken(token);

    const session = await sessionStore.get(sessionId);
    if (!session) throw new AppError(401, 'Session expired or revoked', ERROR_CODES.SESSION_INVALID);

    req.userId    = session.id;
    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
};
