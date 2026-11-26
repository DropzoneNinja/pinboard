import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { env } from '../services/env.js';
import { saveImageWithThumbnail } from '../attachments/storage.js';
import { noteInclude } from './noteInclude.js';
import { classifyContent, sanitizeContent } from './sanitizeContent.js';

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

notesRouter.post(
  '/:id/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const note = await prisma.note.findFirst({ where: { id: req.params.id!, deletedAt: null } });
    if (!note) throw new HttpError(404, 'Note not found');

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

    const note = await prisma.note.findFirst({ where: { id: req.params.id!, deletedAt: null } });
    if (!note) throw new HttpError(404, 'Note not found');

    if (note.version !== version) {
      const latest = await prisma.note.findUnique({ where: { id: note.id }, include: noteInclude });
      res.status(409).json({ error: { message: 'Note has changed since you last loaded it' }, note: latest });
      return;
    }

    const data: Record<string, unknown> = { ...fields, updatedBy: req.userId!, version: { increment: 1 } };
    if (content !== undefined) {
      const sanitized = sanitizeContent(content);
      data.content = sanitized;
      data.contentType = classifyContent(sanitized);
    }

    const updated = await prisma.note.update({
      where: { id: note.id },
      data,
      include: noteInclude,
    });
    res.json({ note: updated });
  }),
);
