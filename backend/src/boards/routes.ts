import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { noteInclude } from '../notes/noteInclude.js';

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

boardsRouter.get(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    await loadBoard(req.params.id!);
    const notes = await prisma.note.findMany({
      where: { boardId: req.params.id!, deletedAt: null, isArchived: false },
      orderBy: { zIndex: 'asc' },
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
    const topNote = await prisma.note.findFirst({
      where: { boardId: req.params.id! },
      orderBy: { zIndex: 'desc' },
    });
    const note = await prisma.note.create({
      data: {
        ...data,
        boardId: req.params.id!,
        zIndex: (topNote?.zIndex ?? 0) + 1,
        createdBy: req.userId!,
        updatedBy: req.userId!,
      },
      include: noteInclude,
    });
    res.status(201).json({ note });
  }),
);
