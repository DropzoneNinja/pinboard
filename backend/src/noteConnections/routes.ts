import { Router } from 'express';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { logActivity } from '../activity/log.js';
import { getWsHub } from '../websocket/server.js';

export const noteConnectionsRouter = Router();

noteConnectionsRouter.use(requireAuth);

noteConnectionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const connection = await prisma.noteConnection.findUnique({ where: { id: req.params.id! } });
    if (!connection) throw new HttpError(404, 'Connection not found');

    await prisma.noteConnection.delete({ where: { id: connection.id } });
    await logActivity({
      userId: req.userId!,
      boardId: connection.boardId,
      noteId: connection.noteAId,
      action: 'note.disconnected',
      metadata: { otherNoteId: connection.noteBId },
    });
    getWsHub().broadcastToBoard(connection.boardId, {
      type: 'note-connection:deleted',
      connectionId: connection.id,
      boardId: connection.boardId,
    });
    res.status(204).end();
  }),
);
