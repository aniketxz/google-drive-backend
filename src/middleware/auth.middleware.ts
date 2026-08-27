import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { sessionStore } from '../cache/redis';
import { AppError } from '../utils/AppError';

/**
 * Extracts the JWT from the `gdrive_token` HTTP-only cookie,
 * verifies it, looks up the session in Redis, and attaches
 * `req.userId` and `req.sessionId` for downstream handlers.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies?.gdrive_token as string | undefined;
    if (!token) throw new AppError(401, 'Not authenticated', 'UNAUTHENTICATED');

    const { sessionId } = verifyToken(token);

    const session = await sessionStore.get(sessionId);
    if (!session) throw new AppError(401, 'Session expired or revoked', 'SESSION_INVALID');

    req.userId    = session.id;
    req.sessionId = sessionId;
    next();
  } catch (err) {
    next(err);
  }
};
