import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../services/env.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sub: userId, sid: sessionId } satisfies AccessTokenPayload, env.accessTokenSecret, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.accessTokenSecret);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'string' &&
      typeof decoded.sid === 'string'
    ) {
      return { sub: decoded.sub, sid: decoded.sid };
    }
    return null;
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN_MAX_AGE_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

/** Opaque refresh token: `<sessionId>.<rawSecret>`. Only a hash of the secret is stored. */
export function generateRefreshToken(sessionId: string): { token: string; hash: string } {
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const hash = hashRefreshSecret(rawSecret);
  return { token: `${sessionId}.${rawSecret}`, hash };
}

export function hashRefreshSecret(rawSecret: string): string {
  return crypto.createHmac('sha256', env.refreshTokenSecret).update(rawSecret).digest('hex');
}

export function parseRefreshToken(token: string): { sessionId: string; rawSecret: string } | null {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex === -1) return null;
  const sessionId = token.slice(0, separatorIndex);
  const rawSecret = token.slice(separatorIndex + 1);
  if (!sessionId || !rawSecret) return null;
  return { sessionId, rawSecret };
}

export function refreshSecretMatches(rawSecret: string, storedHash: string): boolean {
  const candidateHash = hashRefreshSecret(rawSecret);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (candidateBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, storedBuf);
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

export const REFRESH_TOKEN_MAX_AGE_MS = () => env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
