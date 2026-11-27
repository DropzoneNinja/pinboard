import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { hashPassword, verifyPassword } from './password.js';
import { requireAuth } from './middleware.js';
import { loginRateLimiter } from './rateLimiter.js';
import { clearAuthCookies, getRefreshTokenCookie, setAuthCookies } from './cookies.js';
import {
  generateRefreshToken,
  parseRefreshToken,
  refreshSecretMatches,
  refreshTokenExpiry,
  signAccessToken,
} from './tokens.js';
import { toUserProfile } from '../users/profile.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, password))) {
      throw new HttpError(401, 'Invalid username or password');
    }

    const sessionId = crypto.randomUUID();
    const { token, hash } = generateRefreshToken(sessionId);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hash,
        expiresAt: refreshTokenExpiry(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    setAuthCookies(req, res, signAccessToken(user.id, sessionId), token);
    res.json({ user: toUserProfile(user) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshCookie = getRefreshTokenCookie(req);
    const parsed = refreshCookie ? parseRefreshToken(refreshCookie) : null;
    if (parsed) {
      await prisma.session
        .update({
          where: { id: parsed.sessionId },
          data: { revokedAt: new Date() },
        })
        .catch(() => {
          // Session may already be gone; logout should succeed regardless.
        });
    }
    clearAuthCookies(req, res);
    res.status(204).end();
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshCookie = getRefreshTokenCookie(req);
    const parsed = refreshCookie ? parseRefreshToken(refreshCookie) : null;
    if (!parsed) {
      clearAuthCookies(req, res);
      throw new HttpError(401, 'Not authenticated');
    }

    const session = await prisma.session.findUnique({ where: { id: parsed.sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      clearAuthCookies(req, res);
      throw new HttpError(401, 'Session expired or revoked');
    }

    if (!refreshSecretMatches(parsed.rawSecret, session.refreshTokenHash)) {
      // Token reuse after rotation, or a forged token: treat as compromised and kill the session.
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      clearAuthCookies(req, res);
      throw new HttpError(401, 'Session expired or revoked');
    }

    const { token, hash } = generateRefreshToken(session.id);
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hash,
        expiresAt: refreshTokenExpiry(),
        lastUsedAt: new Date(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) {
      clearAuthCookies(req, res);
      throw new HttpError(401, 'Not authenticated');
    }

    setAuthCookies(req, res, signAccessToken(user.id, session.id), token);
    res.json({ user: toUserProfile(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new HttpError(401, 'Not authenticated');
    res.json({ user: toUserProfile(user) });
  }),
);

authRouter.post(
  '/revoke-sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.session.updateMany({
      where: { userId: req.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearAuthCookies(req, res);
    res.status(204).end();
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, createdAt: true, lastUsedAt: true, userAgent: true, ipAddress: true },
    });
    res.json({
      sessions: sessions.map((s) => ({ ...s, isCurrent: s.id === req.sessionId })),
    });
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id!, userId: req.userId, revokedAt: null },
    });
    if (!session) throw new HttpError(404, 'Session not found');
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    if (session.id === req.sessionId) clearAuthCookies(req, res);
    res.status(204).end();
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new HttpError(401, 'Current password is incorrect');
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.status(204).end();
  }),
);
