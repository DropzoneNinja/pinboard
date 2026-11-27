import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { env } from '../services/env.js';
import { copyImageFiles, saveImageWithThumbnail } from '../attachments/storage.js';
import { noteInclude } from './noteInclude.js';
import { classifyContent, extractPlainText, sanitizeContent } from './sanitizeContent.js';
import { remapAttachmentIds } from './remapAttachments.js';
import { syncNoteSearchVector } from '../services/searchVector.js';
import { logActivity } from '../activity/log.js';
import { getWsHub } from '../websocket/server.js';
import type { ActivityAction } from '../activity/log.js';

export const notesRouter = Router();

notesRouter.use(requireAuth);

const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      callback(new HttpError(400, 'Unsupported file type. Use JPG, PNG, WebP or GIF.'));
      return;
    }
    callback(null, true);
  },
});

const patchNoteSchema = z.object({
  version: z.number().int(),
  title: z.string().trim().min(1).max(150).optional(),
  content: z.unknown().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  width: z.number().min(120).max(2000).optional(),
  height: z.number().min(100).max(2000).optional(),
  zIndex: z.number().int().optional(),
  backgroundColour: z.string().optional(),
});

const LAYOUT_KEYS = [
  'positionX',
  'positionY',
  'width',
  'height',
  'zIndex',
  'backgroundColour',
] as const;

async function loadActiveNote(id: string) {
  const note = await prisma.note.findFirst({ where: { id, deletedAt: null } });
  if (!note) throw new HttpError(404, 'Note not found');
  return note;
}

/**
 * Archiving/deleting a note doesn't remove its row (soft-delete, recycle bin), so its string
 * connections would otherwise dangle, pointing at a note that's no longer visible on the board.
 * Drop them here and tell other clients so the strings disappear immediately rather than only
 * once the note is eventually purged (which does cascade-delete these rows at the DB level).
 */
async function removeNoteConnections(noteId: string, boardId: string): Promise<void> {
  const connections = await prisma.noteConnection.findMany({
    where: { OR: [{ noteAId: noteId }, { noteBId: noteId }] },
  });
  if (connections.length === 0) return;
  await prisma.noteConnection.deleteMany({
    where: { id: { in: connections.map((c) => c.id) } },
  });
  for (const connection of connections) {
    getWsHub().broadcastToBoard(boardId, {
      type: 'note-connection:deleted',
      connectionId: connection.id,
      boardId,
    });
  }
}

notesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const note = await prisma.note.findFirst({
      where: { id: req.params.id!, deletedAt: null },
      include: noteInclude,
    });
    if (!note) throw new HttpError(404, 'Note not found');
    res.json({ note });
  }),
);

notesRouter.get(
  '/:id/activity',
  asyncHandler(async (req, res) => {
    await loadActiveNote(req.params.id!);
    const entries = await prisma.activityLog.findMany({
      where: { noteId: req.params.id! },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, displayName: true, authorColour: true } } },
    });
    res.json({ activity: entries });
  }),
);

notesRouter.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const note = await loadActiveNote(req.params.id!);

    const file = req.file;
    if (!file) throw new HttpError(400, 'No file uploaded');

    let processed;
    try {
      processed = await saveImageWithThumbnail(file.buffer);
    } catch {
      throw new HttpError(400, 'Could not read that file as an image');
    }

    const attachment = await prisma.attachment.create({
      data: {
        noteId: note.id,
        originalFilename: file.originalname.slice(0, 255),
        storedFilename: processed.storedFilename,
        mimeType: processed.mimeType,
        fileSize: file.size,
        width: processed.width,
        height: processed.height,
        uploadedBy: req.userId!,
      },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        createdAt: true,
        uploadedBy: true,
      },
    });
    res.status(201).json({ attachment });
  }),
);

notesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { version, content, ...fields } = patchNoteSchema.parse(req.body);

    const note = await loadActiveNote(req.params.id!);

    if (note.version !== version) {
      const latest = await prisma.note.findUnique({ where: { id: note.id }, include: noteInclude });
      res
        .status(409)
        .json({ error: { message: 'Note has changed since you last loaded it' }, note: latest });
      return;
    }

    const data: Record<string, unknown> = {
      ...fields,
      updatedBy: req.userId!,
      version: { increment: 1 },
    };
    let searchText: string | undefined;
    if (content !== undefined) {
      const sanitized = sanitizeContent(content);
      data.content = sanitized;
      data.contentType = classifyContent(sanitized);
      searchText = extractPlainText(sanitized);
      data.searchText = searchText;
    }

    const updated = await prisma.note.update({
      where: { id: note.id },
      data,
      include: noteInclude,
    });

    if (content !== undefined || 'title' in fields) {
      await syncNoteSearchVector(updated.id, updated.title, searchText ?? updated.searchText);
    }

    const layoutTouched = LAYOUT_KEYS.some((key) => key in fields);
    const contentTouched = content !== undefined || 'title' in fields;

    if (layoutTouched)
      getWsHub().broadcastToBoard(updated.boardId, { type: 'note:layout', note: updated });
    if (contentTouched)
      getWsHub().broadcastToBoard(updated.boardId, { type: 'note:content', note: updated });

    let action: ActivityAction | null = null;
    if (content !== undefined || 'title' in fields) action = 'note.content_updated';
    else if ('backgroundColour' in fields) action = 'note.recoloured';
    else if ('positionX' in fields || 'positionY' in fields) action = 'note.moved';
    else if ('width' in fields || 'height' in fields) action = 'note.resized';
    if (action) {
      await logActivity({
        userId: req.userId!,
        boardId: updated.boardId,
        noteId: updated.id,
        action,
      });
    }

    res.json({ note: updated });
  }),
);

notesRouter.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const note = await loadActiveNote(req.params.id!);
    await prisma.note.update({ where: { id: note.id }, data: { isArchived: true } });
    await logActivity({
      userId: req.userId!,
      boardId: note.boardId,
      noteId: note.id,
      action: 'note.archived',
    });
    getWsHub().broadcastToBoard(note.boardId, {
      type: 'note:archived',
      noteId: note.id,
      boardId: note.boardId,
    });
    await removeNoteConnections(note.id, note.boardId);
    res.status(204).end();
  }),
);

notesRouter.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const note = await loadActiveNote(req.params.id!);
    const restored = await prisma.note.update({
      where: { id: note.id },
      data: { isArchived: false },
      include: noteInclude,
    });
    await logActivity({
      userId: req.userId!,
      boardId: note.boardId,
      noteId: note.id,
      action: 'note.restored',
    });
    getWsHub().broadcastToBoard(note.boardId, { type: 'note:restored', note: restored });
    res.json({ note: restored });
  }),
);

notesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const note = await loadActiveNote(req.params.id!);
    await prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } });
    await logActivity({
      userId: req.userId!,
      boardId: note.boardId,
      noteId: note.id,
      action: 'note.deleted',
    });
    getWsHub().broadcastToBoard(note.boardId, {
      type: 'note:deleted',
      noteId: note.id,
      boardId: note.boardId,
    });
    await removeNoteConnections(note.id, note.boardId);
    res.status(204).end();
  }),
);

notesRouter.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const note = await prisma.note.findFirst({
      where: { id: req.params.id!, deletedAt: null },
      include: { attachments: true },
    });
    if (!note) throw new HttpError(404, 'Note not found');

    const topNote = await prisma.note.findFirst({
      where: { boardId: note.boardId },
      orderBy: { zIndex: 'desc' },
    });

    const idMap = new Map<string, string>();
    const attachmentsToCreate: {
      newId: string;
      storedFilename: string;
      originalFilename: string;
      mimeType: string;
      fileSize: number;
      width: number | null;
      height: number | null;
    }[] = [];
    for (const attachment of note.attachments) {
      const newStoredFilename = await copyImageFiles(attachment.storedFilename);
      const newId = crypto.randomUUID();
      idMap.set(attachment.id, newId);
      attachmentsToCreate.push({
        newId,
        storedFilename: newStoredFilename,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        width: attachment.width,
        height: attachment.height,
      });
    }

    const newTitle = `${note.title} (copy)`.slice(0, 150);
    const newContent = idMap.size > 0 ? remapAttachmentIds(note.content, idMap) : note.content;

    const duplicate = await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          boardId: note.boardId,
          title: newTitle,
          content: newContent as Prisma.InputJsonValue,
          contentType: note.contentType,
          backgroundColour: note.backgroundColour,
          positionX: note.positionX + 24,
          positionY: note.positionY + 24,
          width: note.width,
          height: note.height,
          zIndex: (topNote?.zIndex ?? 0) + 1,
          createdBy: req.userId!,
          updatedBy: req.userId!,
          searchText: note.searchText,
        },
        include: noteInclude,
      });
      for (const a of attachmentsToCreate) {
        await tx.attachment.create({
          data: {
            id: a.newId,
            noteId: created.id,
            originalFilename: a.originalFilename,
            storedFilename: a.storedFilename,
            mimeType: a.mimeType,
            fileSize: a.fileSize,
            width: a.width,
            height: a.height,
            uploadedBy: req.userId!,
          },
        });
      }
      return created;
    });

    await syncNoteSearchVector(duplicate.id, duplicate.title, duplicate.searchText);
    await logActivity({
      userId: req.userId!,
      boardId: duplicate.boardId,
      noteId: duplicate.id,
      action: 'note.duplicated',
      metadata: { sourceNoteId: note.id },
    });
    getWsHub().broadcastToBoard(duplicate.boardId, { type: 'note:created', note: duplicate });

    res.status(201).json({ note: duplicate });
  }),
);
