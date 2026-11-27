import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prisma } from '../database/prisma.js';
import { env } from '../services/env.js';
import { logger } from '../services/logger.js';
import { HttpError } from '../services/http.js';
import { IMAGES_DIR, THUMBNAILS_DIR } from '../attachments/storage.js';
import { createZip, extractZipTo, listFilesSafe } from './archive.js';
import { dumpDatabase, restoreDatabase, wipeDatabase } from './dbDump.js';
import type { DatabaseDump } from './dbDump.js';

const MANIFEST_VERSION = 1;

export type BackupKind = 'auto' | 'manual' | 'uploaded';

export interface BackupFileInfo {
  filename: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: string;
}

function kindOf(filename: string): BackupKind {
  if (filename.startsWith('auto-')) return 'auto';
  if (filename.startsWith('manual-')) return 'manual';
  return 'uploaded';
}

function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('Z', '');
}

/** Only ever used to build filenames *we* generate server-side (timestamp-based, no user input). */
function backupPath(filename: string): string {
  return path.join(env.backupDir, filename);
}

const SAFE_FILENAME = /^[A-Za-z0-9._-]+\.zip$/;

/** Validates a filename coming from a request (download/restore/by-name) isn't a path-traversal attempt. */
export function assertSafeBackupFilename(filename: string): void {
  if (!SAFE_FILENAME.test(filename) || filename.includes('..')) {
    throw new HttpError(400, 'Invalid backup filename');
  }
}

async function buildSystemBackupZip(outputPath: string): Promise<void> {
  const dump = await dumpDatabase();
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'pinboard-backup-'));
  try {
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const dbPath = path.join(tmpDir, 'db.json');
    await writeFile(
      manifestPath,
      JSON.stringify({
        version: MANIFEST_VERSION,
        type: 'system',
        createdAt: new Date().toISOString(),
      }),
    );
    await writeFile(dbPath, JSON.stringify(dump));

    await mkdir(IMAGES_DIR, { recursive: true });
    await mkdir(THUMBNAILS_DIR, { recursive: true });

    await createZip(
      outputPath,
      [
        { name: 'manifest.json', sourcePath: manifestPath },
        { name: 'db.json', sourcePath: dbPath },
      ],
      [
        { sourceDir: IMAGES_DIR, destPrefix: 'files/images' },
        { sourceDir: THUMBNAILS_DIR, destPrefix: 'files/thumbnails' },
      ],
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/** Creates a new system backup file in BACKUP_DIR and returns its filename. */
export async function runSystemBackup(kind: 'auto' | 'manual'): Promise<string> {
  await mkdir(env.backupDir, { recursive: true });
  const filename = `${kind}-${timestampForFilename()}.zip`;
  const fullPath = backupPath(filename);
  await buildSystemBackupZip(fullPath);
  logger.info('System backup created', { filename, kind });
  return filename;
}

export async function listBackups(): Promise<BackupFileInfo[]> {
  await mkdir(env.backupDir, { recursive: true });
  const filenames = await listFilesSafe(env.backupDir);
  const infos = await Promise.all(
    filenames
      .filter((f) => f.endsWith('.zip'))
      .map(async (filename) => {
        const stats = await stat(backupPath(filename));
        return {
          filename,
          kind: kindOf(filename),
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      }),
  );
  return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolveBackupPath(filename: string): string {
  assertSafeBackupFilename(filename);
  return backupPath(filename);
}

/** Saves an uploaded backup file into BACKUP_DIR under a safe, collision-free name. */
export async function saveUploadedBackup(buffer: Buffer, originalName: string): Promise<string> {
  await mkdir(env.backupDir, { recursive: true });
  const safeBase = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 80);
  const filename = `uploaded-${timestampForFilename()}-${safeBase || 'backup'}.zip`;
  await writeFile(backupPath(filename), buffer);
  return filename;
}

/** Deletes the oldest `auto-*` backups beyond `retainCount`; manual/uploaded backups are never auto-pruned. */
export async function pruneAutoBackups(retainCount: number): Promise<void> {
  const all = await listBackups();
  const autos = all
    .filter((b) => b.kind === 'auto')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const toDelete = autos.slice(Math.max(retainCount, 0));
  for (const backup of toDelete) {
    await rm(backupPath(backup.filename), { force: true });
    logger.info('Pruned old automated backup', { filename: backup.filename });
  }
}

async function replaceUploadsDirFrom(filesDir: string): Promise<void> {
  await rm(IMAGES_DIR, { recursive: true, force: true });
  await rm(THUMBNAILS_DIR, { recursive: true, force: true });
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(THUMBNAILS_DIR, { recursive: true });

  const sourceImages = path.join(filesDir, 'images');
  const sourceThumbs = path.join(filesDir, 'thumbnails');
  for (const [from, to] of [
    [sourceImages, IMAGES_DIR],
    [sourceThumbs, THUMBNAILS_DIR],
  ] as const) {
    const names = await listFilesSafe(from);
    // Copy rather than rename: the extracted archive lives under the OS temp dir, which may be
    // a different filesystem/volume than the uploads mount, and rename() can't cross that boundary.
    for (const name of names) {
      await copyFile(path.join(from, name), path.join(to, name));
    }
  }
}

/** Full-replace restore: wipes the live database and uploads, replacing both with the backup's contents. */
export async function restoreSystemBackup(filename: string): Promise<void> {
  const zipPath = resolveBackupPath(filename);
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'pinboard-restore-'));
  try {
    await extractZipTo(zipPath, tmpDir);

    const manifestRaw = await readdir(tmpDir).catch(() => [] as string[]);
    if (!manifestRaw.includes('manifest.json') || !manifestRaw.includes('db.json')) {
      throw new HttpError(400, 'Not a valid system backup archive');
    }

    const dbRaw = await readFile(path.join(tmpDir, 'db.json'), 'utf-8');
    const dump = JSON.parse(dbRaw) as DatabaseDump;

    await prisma.$transaction(
      async (tx) => {
        await wipeDatabase(tx);
        await restoreDatabase(tx, dump);
      },
      { timeout: 120_000 },
    );

    await replaceUploadsDirFrom(path.join(tmpDir, 'files'));
    logger.info('System backup restored', { filename });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
