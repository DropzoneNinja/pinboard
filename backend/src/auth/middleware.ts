import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { getAccessTokenCookie } from './cookies.js';
import { verifyAccessToken } from './tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

/**
 * Checks the access token JWT *and* that its session hasn't been revoked.
 * JWTs are otherwise stateless, so without this a revoked/logged-out session
 * would silently keep working until the short-lived access token expired.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getAccessTokenCookie(req);
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: { message: 'Not authenticated' } });
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== payload.sub) {
    res.status(401).json({ error: { message: 'Not authenticated' } });
    return;
  }

  req.userId = payload.sub;
  req.sessionId = payload.sid;
  next();
}
