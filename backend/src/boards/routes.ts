import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { noteInclude } from '../notes/noteInclude.js';
import { logActivity } from '../activity/log.js';
import { getWsHub } from '../websocket/server.js';
import { syncBoardSearchVector } from '../services/searchVector.js';
import { getAppSettings } from '../settings/service.js';
import { buildBoardExportZip, importBoardExportZip } from './exportImport.js';

export const boardsRouter = Router();

boardsRouter.use(requireAuth);

async function loadBoard(id: string) {
  const board = await prisma.board.findFirst({ where: { id, deletedAt: null } });
  if (!board) throw new HttpError(404, 'Board not found');
  return board;
}

boardsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const boards = await prisma.board.findMany({
      where: { deletedAt: null, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ boards });
  }),
);

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  backgroundStyle: z.enum(['plain', 'grey', 'grid', 'dotted']).optional(),
  backgroundColour: z.string().optional(),
});

boardsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createBoardSchema.parse(req.body);
    const board = await prisma.board.create({
      data: { ...data, createdBy: req.userId! },
    });
    await syncBoardSearchVector(board.id, board.name, board.description);
    await logActivity({ userId: req.userId!, boardId: board.id, action: 'board.created' });
    getWsHub().broadcastGlobal({ type: 'board:created', board });
    res.status(201).json({ board });
  }),
);

boardsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    res.json({ board });
  }),
);

const patchBoardSchema = z.object({
  version: z.number().int(),
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  backgroundStyle: z.enum(['plain', 'grey', 'grid', 'dotted']).optional(),
  backgroundColour: z.string().nullable().optional(),
});

boardsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { version, ...fields } = patchBoardSchema.parse(req.body);
    const board = await loadBoard(req.params.id!);

    if (board.version !== version) {
      const latest = await prisma.board.findUnique({ where: { id: board.id } });
      res
        .status(409)
        .json({ error: { message: 'Board has changed since you last loaded it' }, board: latest });
      return;
    }

    const updated = await prisma.board.update({
      where: { id: board.id },
      data: { ...fields, version: { increment: 1 } },
    });

    if ('name' in fields || 'description' in fields) {
      await syncBoardSearchVector(updated.id, updated.name, updated.description);
    }
    await logActivity({
      userId: req.userId!,
      boardId: updated.id,
      action: 'board.updated',
      metadata: fields,
    });
    getWsHub().broadcastGlobal({ type: 'board:updated', board: updated });

    res.json({ board: updated });
  }),
);

boardsRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    const updated = await prisma.board.update({
      where: { id: board.id },
      data: { isArchived: true },
    });
    await logActivity({ userId: req.userId!, boardId: board.id, action: 'board.archived' });
    getWsHub().broadcastGlobal({ type: 'board:archived', board: updated });
    res.json({ board: updated });
  }),
);

boardsRouter.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    const updated = await prisma.board.update({
      where: { id: board.id },
      data: { isArchived: false },
    });
    await logActivity({ userId: req.userId!, boardId: board.id, action: 'board.restored' });
    getWsHub().broadcastGlobal({ type: 'board:restored', board: updated });
    res.json({ board: updated });
  }),
);

boardsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    await prisma.board.update({ where: { id: board.id }, data: { deletedAt: new Date() } });
    await logActivity({ userId: req.userId!, boardId: board.id, action: 'board.deleted' });
    getWsHub().broadcastGlobal({ type: 'board:deleted', boardId: board.id });
    res.status(204).end();
  }),
);

boardsRouter.get(
  '/:id/activity',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const entries = await prisma.activityLog.findMany({
      where: { boardId: req.params.id! },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, displayName: true, authorColour: true } } },
    });
    res.json({ activity: entries });
  }),
);

const viewSchema = z.object({
  viewportX: z.number(),
  viewportY: z.number(),
  zoomLevel: z.number().min(0.05).max(5),
});

boardsRouter.get(
  '/:id/view',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const view = await prisma.boardView.findUnique({
      where: { boardId_userId: { boardId: req.params.id!, userId: req.userId! } },
    });
    res.json({
      view: view ?? { viewportX: 0, viewportY: 0, zoomLevel: 1 },
    });
  }),
);

boardsRouter.put(
  '/:id/view',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const data = viewSchema.parse(req.body);
    const view = await prisma.boardView.upsert({
      where: { boardId_userId: { boardId: req.params.id!, userId: req.userId! } },
      create: { boardId: req.params.id!, userId: req.userId!, ...data },
      update: data,
    });
    res.json({ view });
  }),
);

const listNotesQuerySchema = z.object({ archived: z.enum(['true', 'false']).optional() });

boardsRouter.get(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const { archived } = listNotesQuerySchema.parse(req.query);
    const notes = await prisma.note.findMany({
      where: { boardId: req.params.id!, deletedAt: null, isArchived: archived === 'true' },
      orderBy: archived === 'true' ? { updatedAt: 'desc' } : { zIndex: 'asc' },
      include: noteInclude,
    });
    res.json({ notes });
  }),
);

const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(150).default('Untitled note'),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number().min(120).max(2000).optional(),
  height: z.number().min(100).max(2000).optional(),
  backgroundColour: z.string().optional(),
});

boardsRouter.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const data = createNoteSchema.parse(req.body);
    const [topNote, settings] = await Promise.all([
      prisma.note.findFirst({ where: { boardId: req.params.id! }, orderBy: { zIndex: 'desc' } }),
      getAppSettings(),
    ]);
    const note = await prisma.note.create({
      data: {
        ...data,
        width: data.width ?? settings.defaultNoteWidth,
        height: data.height ?? settings.defaultNoteHeight,
        backgroundColour: data.backgroundColour ?? settings.defaultNoteColour,
        boardId: req.params.id!,
        zIndex: (topNote?.zIndex ?? 0) + 1,
        createdBy: req.userId!,
        updatedBy: req.userId!,
      },
      include: noteInclude,
    });
    await logActivity({
      userId: req.userId!,
      boardId: note.boardId,
      noteId: note.id,
      action: 'note.created',
    });
    getWsHub().broadcastToBoard(note.boardId, { type: 'note:created', note });
    res.status(201).json({ note });
  }),
);

boardsRouter.get(
  '/:id/note-connections',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const connections = await prisma.noteConnection.findMany({
      where: { boardId: req.params.id! },
    });
    res.json({ connections });
  }),
);

const createConnectionSchema = z
  .object({
    noteAId: z.string().uuid(),
    noteBId: z.string().uuid(),
  })
  .refine((data) => data.noteAId !== data.noteBId, {
    message: 'A note cannot be connected to itself',
  });

boardsRouter.post(
  '/:id/note-connections',
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    const { noteAId, noteBId } = createConnectionSchema.parse(req.body);

    const [noteA, noteB] = await Promise.all([
      prisma.note.findFirst({
        where: { id: noteAId, boardId: board.id, deletedAt: null, isArchived: false },
      }),
      prisma.note.findFirst({
        where: { id: noteBId, boardId: board.id, deletedAt: null, isArchived: false },
      }),
    ]);
    if (!noteA || !noteB) throw new HttpError(404, 'Note not found on this board');

    const existing = await prisma.noteConnection.findFirst({
      where: {
        OR: [
          { noteAId, noteBId },
          { noteAId: noteBId, noteBId: noteAId },
        ],
      },
    });
    if (existing) {
      res.status(200).json({ connection: existing });
      return;
    }

    const connection = await prisma.noteConnection.create({
      data: { boardId: board.id, noteAId, noteBId, createdBy: req.userId! },
    });
    await logActivity({
      userId: req.userId!,
      boardId: board.id,
      noteId: noteAId,
      action: 'note.connected',
      metadata: { otherNoteId: noteBId },
    });
    getWsHub().broadcastToBoard(board.id, { type: 'note-connection:created', connection });
    res.status(201).json({ connection });
  }),
);

boardsRouter.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    const tmpPath = path.join(tmpdir(), `board-export-${crypto.randomUUID()}.zip`);
    try {
      await buildBoardExportZip(board.id, tmpPath);
    } catch (err) {
      await rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
    const safeName = board.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'board';
    res.download(tmpPath, `${safeName}-export.zip`, () => {
      rm(tmpPath, { force: true }).catch(() => {});
    });
  }),
);

const MAX_BOARD_IMPORT_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const importBoardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BOARD_IMPORT_BYTES },
});

boardsRouter.post(
  '/:id/import',
  importBoardUpload.single('file'),
  asyncHandler(async (req, res) => {
    const board = await loadBoard(req.params.id!);
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file uploaded');
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new HttpError(400, 'Whiteboard export files must be a .zip archive');
    }

    const tmpPath = path.join(tmpdir(), `board-import-${crypto.randomUUID()}.zip`);
    await writeFile(tmpPath, file.buffer);
    try {
      await importBoardExportZip(board.id, tmpPath, req.userId!);
    } finally {
      await rm(tmpPath, { force: true }).catch(() => {});
    }

    const updated = await prisma.board.findUniqueOrThrow({ where: { id: board.id } });
    await logActivity({
      userId: req.userId!,
      boardId: board.id,
      action: 'board.restored_content',
    });
    getWsHub().broadcastToBoard(board.id, { type: 'board:content_restored', boardId: board.id });
    getWsHub().broadcastGlobal({ type: 'board:updated', board: updated });
    res.json({ board: updated });
  }),
);
