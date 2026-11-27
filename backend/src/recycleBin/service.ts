import { prisma } from '../database/prisma.js';
import { logger } from '../services/logger.js';
import { deleteImageFiles } from '../attachments/storage.js';
import { getAppSettings } from '../settings/service.js';

const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours; no external cron available/needed

/** Deletes a note's attachment files from disk, then the note row (DB cascades the rest). */
export async function permanentlyDeleteNote(noteId: string): Promise<void> {
  const attachments = await prisma.attachment.findMany({
    where: { noteId },
    select: { storedFilename: true },
  });
  await Promise.all(attachments.map((a) => deleteImageFiles(a.storedFilename)));
  await prisma.note.delete({ where: { id: noteId } });
}

/** Same as above, but for every note under a board, then the board row itself. */
export async function permanentlyDeleteBoard(boardId: string): Promise<void> {
  const notes = await prisma.note.findMany({ where: { boardId }, select: { id: true } });
  for (const note of notes) {
    const attachments = await prisma.attachment.findMany({
      where: { noteId: note.id },
      select: { storedFilename: true },
    });
    await Promise.all(attachments.map((a) => deleteImageFiles(a.storedFilename)));
  }
  await prisma.board.delete({ where: { id: boardId } });
}

export async function purgeExpired(): Promise<void> {
  const settings = await getAppSettings();
  const cutoff = new Date(Date.now() - settings.recycleBinRetentionDays * 24 * 60 * 60 * 1000);

  const expiredNotes = await prisma.note.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const note of expiredNotes) {
    await permanentlyDeleteNote(note.id).catch((err) =>
      logger.error('Failed to purge note', { noteId: note.id, err }),
    );
  }

  const expiredBoards = await prisma.board.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const board of expiredBoards) {
    await permanentlyDeleteBoard(board.id).catch((err) =>
      logger.error('Failed to purge board', { boardId: board.id, err }),
    );
  }

  if (expiredNotes.length > 0 || expiredBoards.length > 0) {
    logger.info('Recycle bin purge complete', {
      notes: expiredNotes.length,
      boards: expiredBoards.length,
    });
  }
}

export function startRecycleBinPurgeJob(): void {
  purgeExpired().catch((err) => logger.error('Initial recycle bin purge failed', { err }));
  setInterval(() => {
    purgeExpired().catch((err) => logger.error('Recycle bin purge failed', { err }));
  }, PURGE_INTERVAL_MS);
}
