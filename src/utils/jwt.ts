import jwt from 'jsonwebtoken';
import { config } from '../config';

interface JwtPayload {
  sessionId: string;
}

export const signToken = (sessionId: string): string =>
  jwt.sign({ sessionId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY as jwt.SignOptions['expiresIn'] });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, config.JWT_SECRET) as JwtPayload;
