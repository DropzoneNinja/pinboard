import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { noteInclude } from '../notes/noteInclude.js';
import { logActivity } from '../activity/log.js';
import { getWsHub } from '../websocket/server.js';
import { getAppSettings } from '../settings/service.js';
import { permanentlyDeleteBoard, permanentlyDeleteNote } from './service.js';

export const recycleBinRouter = Router();

recycleBinRouter.use(requireAuth);

recycleBinRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await getAppSettings();
    const retentionMs = settings.recycleBinRetentionDays * 24 * 60 * 60 * 1000;

    const [boards, notes] = await Promise.all([
      prisma.board.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.note.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        include: { ...noteInclude, board: { select: { id: true, name: true } } },
      }),
    ]);

    res.json({
      retentionDays: settings.recycleBinRetentionDays,
      boards: boards.map((b) => ({
        ...b,
        expiresAt: new Date(b.deletedAt!.getTime() + retentionMs),
      })),
      notes: notes.map((n) => ({
        ...n,
        expiresAt: new Date(n.deletedAt!.getTime() + retentionMs),
      })),
    });
  }),
);

const typeQuerySchema = z.object({ type: z.enum(['note', 'board']) });

recycleBinRouter.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const { type } = typeQuerySchema.parse(req.query);
    const id = req.params.id!;

    if (type === 'board') {
      const board = await prisma.board.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!board) throw new HttpError(404, 'Board not found in recycle bin');
      const restored = await prisma.board.update({ where: { id }, data: { deletedAt: null } });
      await logActivity({ userId: req.userId!, boardId: id, action: 'board.restored_from_bin' });
      getWsHub().broadcastGlobal({ type: 'board:restored', board: restored });
      res.json({ board: restored });
      return;
    }

    const note = await prisma.note.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!note) throw new HttpError(404, 'Note not found in recycle bin');
    const restored = await prisma.note.update({
      where: { id },
      data: { deletedAt: null },
      include: noteInclude,
    });
    await logActivity({
      userId: req.userId!,
      boardId: note.boardId,
      noteId: id,
      action: 'note.restored_from_bin',
    });
    getWsHub().broadcastToBoard(note.boardId, { type: 'note:restored', note: restored });
    res.json({ note: restored });
  }),
);

recycleBinRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { type } = typeQuerySchema.parse(req.query);
    const id = req.params.id!;

    if (type === 'board') {
      const board = await prisma.board.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!board) throw new HttpError(404, 'Board not found in recycle bin');
      await logActivity({
        userId: req.userId!,
        action: 'board.permanently_deleted',
        metadata: { name: board.name },
      });
      await permanentlyDeleteBoard(id);
      res.status(204).end();
      return;
    }

    const note = await prisma.note.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!note) throw new HttpError(404, 'Note not found in recycle bin');
    await logActivity({
      userId: req.userId!,
      boardId: note.boardId,
      action: 'note.permanently_deleted',
      metadata: { title: note.title },
    });
    await permanentlyDeleteNote(id);
    res.status(204).end();
  }),
);
