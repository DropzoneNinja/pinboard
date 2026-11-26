import { Router } from 'express';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { deleteImageFiles, imagePath, thumbnailPath } from './storage.js';

export const attachmentsRouter = Router();

attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id! } });
    if (!attachment) throw new HttpError(404, 'Attachment not found');
    res.sendFile(imagePath(attachment.storedFilename), {
      headers: { 'Content-Type': attachment.mimeType },
    });
  }),
);

attachmentsRouter.get(
  '/:id/thumbnail',
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id! } });
    if (!attachment) throw new HttpError(404, 'Attachment not found');
    res.sendFile(thumbnailPath(attachment.storedFilename), {
      headers: { 'Content-Type': attachment.mimeType },
    });
  }),
);

attachmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id! } });
    if (!attachment) throw new HttpError(404, 'Attachment not found');
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await deleteImageFiles(attachment.storedFilename);
    res.status(204).end();
  }),
);
