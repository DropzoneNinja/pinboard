import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { toUserProfile } from './profile.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    res.json({ users: users.map(toUserProfile) });
  }),
);

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user: toUserProfile(user) });
  }),
);

const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  authorColour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'authorColour must be a hex colour like #3B82F6')
    .optional(),
});

usersRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const data = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.userId }, data });
    res.json({ user: toUserProfile(user) });
  }),
);
