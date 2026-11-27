import type {
  ActivityLog,
  AppSettings,
  Attachment,
  BackupSettings,
  Board,
  BoardView,
  Note,
  NoteConnection,
  Prisma,
  User,
} from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { syncBoardSearchVector, syncNoteSearchVector } from '../services/searchVector.js';

/**
 * A full snapshot of every table except `sessions` (restoring stale refresh-token hashes is
 * pointless — nobody's browser still holds that cookie — and a restore already forces every
 * session to re-authenticate by wiping the live `sessions` table, cascaded from `users`).
 * `search_vector` columns aren't included (Prisma can't read/write `Unsupported` columns at all)
 * and are instead regenerated from the restored rows via the same helpers notes/boards already
 * use to keep them in sync day-to-day.
 */
export interface DatabaseDump {
  users: User[];
  appSettings: AppSettings[];
  backupSettings: BackupSettings[];
  boards: Board[];
  boardViews: BoardView[];
  notes: Note[];
  attachments: Attachment[];
  noteConnections: NoteConnection[];
  activityLog: ActivityLog[];
}

export async function dumpDatabase(): Promise<DatabaseDump> {
  const [
    users,
    appSettings,
    backupSettings,
    boards,
    boardViews,
    notes,
    attachments,
    noteConnections,
    activityLog,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.appSettings.findMany(),
    prisma.backupSettings.findMany(),
    prisma.board.findMany(),
    prisma.boardView.findMany(),
    prisma.note.findMany(),
    prisma.attachment.findMany(),
    prisma.noteConnection.findMany(),
    prisma.activityLog.findMany(),
  ]);

  return {
    users,
    appSettings,
    backupSettings,
    boards,
    boardViews,
    notes,
    attachments,
    noteConnections,
    activityLog,
  };
}

/** Deletes every row in dependency order; cascades in the schema handle everything below boards/users. */
export async function wipeDatabase(tx: Prisma.TransactionClient): Promise<void> {
  await tx.board.deleteMany();
  await tx.user.deleteMany();
  await tx.appSettings.deleteMany();
  await tx.backupSettings.deleteMany();
}

// A JSON round-trip turns every Date into a string; Prisma's createMany needs real Date
// instances for DateTime columns, so convert the named fields back before inserting.
function reviveDates<T extends Record<string, unknown>>(rows: T[], fields: (keyof T)[]): T[] {
  return rows.map((row) => {
    const copy = { ...row };
    for (const field of fields) {
      if (typeof copy[field] === 'string')
        copy[field] = new Date(copy[field] as string) as T[keyof T];
    }
    return copy;
  });
}

/** Re-inserts a dump's rows in dependency order, then rebuilds the search_vector columns. */
export async function restoreDatabase(
  tx: Prisma.TransactionClient,
  dump: DatabaseDump,
): Promise<void> {
  const users = reviveDates(dump.users, ['createdAt', 'updatedAt', 'lastLoginAt']);
  const appSettings = reviveDates(dump.appSettings, ['updatedAt']);
  const backupSettings = reviveDates(dump.backupSettings, ['lastRunAt', 'updatedAt']);
  const boards = reviveDates(dump.boards, ['createdAt', 'updatedAt', 'deletedAt']);
  const boardViews = reviveDates(dump.boardViews, ['updatedAt']);
  const notes = reviveDates(dump.notes, ['createdAt', 'updatedAt', 'deletedAt']);
  const attachments = reviveDates(dump.attachments, ['createdAt']);
  const noteConnections = reviveDates(dump.noteConnections, ['createdAt']);
  const activityLog = reviveDates(dump.activityLog, ['createdAt']);

  if (users.length > 0) await tx.user.createMany({ data: users });
  if (appSettings.length > 0) await tx.appSettings.createMany({ data: appSettings });
  if (backupSettings.length > 0) await tx.backupSettings.createMany({ data: backupSettings });
  if (boards.length > 0) await tx.board.createMany({ data: boards });
  if (boardViews.length > 0) await tx.boardView.createMany({ data: boardViews });
  if (notes.length > 0) {
    await tx.note.createMany({
      data: notes.map((note) => ({ ...note, content: note.content as Prisma.InputJsonValue })),
    });
  }
  if (attachments.length > 0) await tx.attachment.createMany({ data: attachments });
  if (noteConnections.length > 0) await tx.noteConnection.createMany({ data: noteConnections });
  if (activityLog.length > 0) {
    await tx.activityLog.createMany({
      data: activityLog.map((entry) => ({
        ...entry,
        metadata: entry.metadata as Prisma.InputJsonValue,
      })),
    });
  }

  for (const board of boards) {
    await syncBoardSearchVector(
      board.id as string,
      board.name as string,
      board.description as string | null,
      tx,
    );
  }
  for (const note of notes) {
    await syncNoteSearchVector(
      note.id as string,
      note.title as string,
      note.searchText as string,
      tx,
    );
  }
}
