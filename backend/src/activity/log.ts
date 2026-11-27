import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { logger } from '../services/logger.js';

export type ActivityAction =
  | 'board.created'
  | 'board.updated'
  | 'board.archived'
  | 'board.restored'
  | 'board.deleted'
  | 'board.restored_from_bin'
  | 'board.permanently_deleted'
  | 'note.created'
  | 'note.moved'
  | 'note.resized'
  | 'note.recoloured'
  | 'note.content_updated'
  | 'note.archived'
  | 'note.restored'
  | 'note.deleted'
  | 'note.restored_from_bin'
  | 'note.permanently_deleted'
  | 'note.duplicated'
  | 'note.connected'
  | 'note.disconnected'
  | 'backup.created'
  | 'backup.uploaded'
  | 'board.restored_content';

interface LogActivityInput {
  userId: string;
  boardId?: string | null;
  noteId?: string | null;
  action: ActivityAction;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget-ish history entry. Never throws into the caller's request path. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        boardId: input.boardId ?? null,
        noteId: input.noteId ?? null,
        action: input.action,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Activity history is a nice-to-have; a logging failure must never break the actual operation.
    logger.error('Failed to record activity', { action: input.action, err });
  }
}
