import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { getAppSettings } from './service.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getAppSettings();
    res.json({ settings });
  }),
);

// This is a two-user household app with no admin/member distinction (PROJECT.md §4: "no
// per-board ACL needed"), so either authenticated user may change shared application settings.
const patchSettingsSchema = z.object({
  defaultNoteColour: z.string().min(1).max(30).optional(),
  defaultNoteWidth: z.number().min(120).max(2000).optional(),
  defaultNoteHeight: z.number().min(100).max(2000).optional(),
  autosaveDebounceMs: z.number().int().min(100).max(10000).optional(),
  recycleBinRetentionDays: z.number().int().min(1).max(3650).optional(),
  dateTimeFormat: z.enum(['auto', '12h', '24h']).optional(),
});

settingsRouter.patch(
  '/',
  asyncHandler(async (req, res) => {
    const data = patchSettingsSchema.parse(req.body);
    await getAppSettings(); // ensures the row exists before we update it
    const settings = await prisma.appSettings.update({ where: { id: 'global' }, data });
    res.json({ settings });
  }),
);
