import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Attachment, Board, Note, NoteConnection, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { HttpError } from '../services/http.js';
import { createZip, extractZipTo } from '../backup/archive.js';
import { IMAGES_DIR, THUMBNAILS_DIR, imagePath, thumbnailPath } from '../attachments/storage.js';
import { remapAttachmentIds } from '../notes/remapAttachments.js';
import { syncBoardSearchVector, syncNoteSearchVector } from '../services/searchVector.js';

const MANIFEST_VERSION = 1;

interface BoardExportData {
  board: Board;
  notes: Note[];
  attachments: Attachment[];
  connections: NoteConnection[];
}

/** Builds a complete, standalone export of one board (metadata, notes, connections and the actual image files) as a zip. */
export async function buildBoardExportZip(boardId: string, outputPath: string): Promise<void> {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new HttpError(404, 'Board not found');

  const notes = await prisma.note.findMany({ where: { boardId } });
  const noteIds = notes.map((n) => n.id);
  const [attachments, connections] = await Promise.all([
    noteIds.length > 0
      ? prisma.attachment.findMany({ where: { noteId: { in: noteIds } } })
      : Promise.resolve([]),
    prisma.noteConnection.findMany({ where: { boardId } }),
  ]);

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'pinboard-board-export-'));
  try {
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const dataPath = path.join(tmpDir, 'board.json');
    await writeFile(
      manifestPath,
      JSON.stringify({
        version: MANIFEST_VERSION,
        type: 'board',
        createdAt: new Date().toISOString(),
        boardId: board.id,
        boardName: board.name,
      }),
    );
    const data: BoardExportData = { board, notes, attachments, connections };
    await writeFile(dataPath, JSON.stringify(data));

    const entries = [
      { name: 'manifest.json', sourcePath: manifestPath },
      { name: 'board.json', sourcePath: dataPath },
    ];
    for (const attachment of attachments) {
      entries.push({
        name: `files/images/${attachment.storedFilename}`,
        sourcePath: imagePath(attachment.storedFilename),
      });
      entries.push({
        name: `files/thumbnails/${attachment.storedFilename}`,
        sourcePath: thumbnailPath(attachment.storedFilename),
      });
    }
    await createZip(outputPath, entries);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx);
}

/**
 * Overwrites a board's current notes/connections/attachments with the contents of a previously
 * exported zip (the user already confirmed this is destructive). Notes, attachments and
 * connections all get freshly generated ids/filenames — reusing the originals would risk
 * colliding with unrelated data if the same export were ever imported more than once, or into
 * a different board — while the board row itself (name/description/background) is updated in
 * place to match the backup.
 */
export async function importBoardExportZip(
  boardId: string,
  zipPath: string,
  importingUserId: string,
): Promise<void> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'pinboard-board-import-'));
  try {
    await extractZipTo(zipPath, tmpDir);

    const [manifestRaw, dataRaw] = await Promise.all([
      readFile(path.join(tmpDir, 'manifest.json'), 'utf-8').catch(() => null),
      readFile(path.join(tmpDir, 'board.json'), 'utf-8').catch(() => null),
    ]);
    if (!manifestRaw || !dataRaw) throw new HttpError(400, 'Not a valid whiteboard export file');

    const manifest = JSON.parse(manifestRaw) as { type?: string };
    if (manifest.type !== 'board') throw new HttpError(400, 'Not a valid whiteboard export file');
    const data = JSON.parse(dataRaw) as BoardExportData;

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw new HttpError(404, 'Board not found');

    const validUserIds = new Set(
      (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id),
    );
    const resolveUserId = (id: string) => (validUserIds.has(id) ? id : importingUserId);

    const noteIdMap = new Map<string, string>();
    for (const note of data.notes) noteIdMap.set(note.id, crypto.randomUUID());

    const attachmentIdMap = new Map<string, string>();
    const filenameMap = new Map<string, string>(); // old storedFilename -> new storedFilename
    for (const attachment of data.attachments) {
      attachmentIdMap.set(attachment.id, crypto.randomUUID());
      filenameMap.set(
        attachment.storedFilename,
        `${crypto.randomUUID()}${fileExtension(attachment.storedFilename)}`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.note.deleteMany({ where: { boardId } });
      await tx.noteConnection.deleteMany({ where: { boardId } });

      await tx.board.update({
        where: { id: boardId },
        data: {
          name: data.board.name,
          description: data.board.description,
          backgroundStyle: data.board.backgroundStyle,
          backgroundColour: data.board.backgroundColour,
          version: { increment: 1 },
        },
      });

      if (data.notes.length > 0) {
        await tx.note.createMany({
          data: data.notes.map((note) => ({
            ...note,
            id: noteIdMap.get(note.id)!,
            boardId,
            content: remapAttachmentIds(note.content, attachmentIdMap) as Prisma.InputJsonValue,
            createdBy: resolveUserId(note.createdBy),
            updatedBy: resolveUserId(note.updatedBy),
          })),
        });
      }

      if (data.attachments.length > 0) {
        await tx.attachment.createMany({
          data: data.attachments.map((attachment) => ({
            ...attachment,
            id: attachmentIdMap.get(attachment.id)!,
            noteId: noteIdMap.get(attachment.noteId)!,
            storedFilename: filenameMap.get(attachment.storedFilename)!,
            uploadedBy: resolveUserId(attachment.uploadedBy),
          })),
        });
      }

      const validConnections = data.connections.filter(
        (c) => noteIdMap.has(c.noteAId) && noteIdMap.has(c.noteBId),
      );
      if (validConnections.length > 0) {
        await tx.noteConnection.createMany({
          data: validConnections.map((connection) => ({
            ...connection,
            id: crypto.randomUUID(),
            boardId,
            noteAId: noteIdMap.get(connection.noteAId)!,
            noteBId: noteIdMap.get(connection.noteBId)!,
            createdBy: resolveUserId(connection.createdBy),
          })),
        });
      }

      await syncBoardSearchVector(boardId, data.board.name, data.board.description, tx);
      for (const note of data.notes) {
        await syncNoteSearchVector(noteIdMap.get(note.id)!, note.title, note.searchText, tx);
      }
    });

    // Copy the attachment files in under their new names — outside the transaction since it's
    // plain filesystem I/O, and after the transaction commits so a failed copy can't leave the
    // DB pointing at files that were never written.
    await mkdir(IMAGES_DIR, { recursive: true });
    await mkdir(THUMBNAILS_DIR, { recursive: true });
    for (const attachment of data.attachments) {
      const newFilename = filenameMap.get(attachment.storedFilename)!;
      await copyFile(
        path.join(tmpDir, 'files', 'images', attachment.storedFilename),
        imagePath(newFilename),
      );
      await copyFile(
        path.join(tmpDir, 'files', 'thumbnails', attachment.storedFilename),
        thumbnailPath(newFilename),
      );
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
