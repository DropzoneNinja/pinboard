import type { IncomingMessage } from 'node:http';
import { prisma } from '../database/prisma.js';
import { verifyAccessToken } from '../auth/tokens.js';

const ACCESS_COOKIE = 'access_token';

/**
 * Cookie-parser only works against an Express `Request`; a raw WebSocket upgrade request is a
 * bare `IncomingMessage`, so this parses just the one cookie we need by hand rather than pulling
 * in a cookie-parsing dependency for a single call site.
 */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

export interface AuthenticatedUpgrade {
  userId: string;
  displayName: string;
  authorColour: string;
}

/** Mirrors auth/middleware.ts's requireAuth checks, adapted for a raw upgrade request. */
export async function authenticateUpgrade(
  req: IncomingMessage,
): Promise<AuthenticatedUpgrade | null> {
  const token = readCookie(req.headers.cookie, ACCESS_COOKIE);
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) return null;

  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.userId !== payload.sub
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;

  return { userId: user.id, displayName: user.displayName, authorColour: user.authorColour };
}
