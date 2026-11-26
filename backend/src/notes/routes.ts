import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';

export const notesRouter = Router();

notesRouter.use(requireAuth);

// Layout/appearance fields only for now — rich text `content` editing and its
// sanitisation land with the note editor (Phase 3).
const patchNoteSchema = z.object({
  version: z.number().int(),
  title: z.string().trim().min(1).max(150).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  width: z.number().min(120).max(2000).optional(),
  height: z.number().min(100).max(2000).optional(),
  zIndex: z.number().int().optional(),
  backgroundColour: z.string().optional(),
});

notesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { version, ...fields } = patchNoteSchema.parse(req.body);

    const note = await prisma.note.findFirst({ where: { id: req.params.id!, deletedAt: null } });
    if (!note) throw new HttpError(404, 'Note not found');

    if (note.version !== version) {
      res.status(409).json({ error: { message: 'Note has changed since you last loaded it' }, note });
      return;
    }

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { ...fields, updatedBy: req.userId!, version: { increment: 1 } },
    });
    res.json({ note: updated });
  }),
);
