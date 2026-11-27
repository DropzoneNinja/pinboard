import { createWriteStream } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import extractZip from 'extract-zip';

interface ZipEntry {
  /** Path inside the archive. */
  name: string;
  /** Either literal file content, or a source path on disk to stream in. */
  content?: string | Buffer;
  sourcePath?: string;
}

/** Builds a zip file at `outputPath` from in-memory entries plus whole directories copied in under a prefix. */
export async function createZip(
  outputPath: string,
  entries: ZipEntry[],
  directories: { sourceDir: string; destPrefix: string }[] = [],
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    output.on('error', reject);

    archive.pipe(output);

    for (const entry of entries) {
      if (entry.sourcePath) archive.file(entry.sourcePath, { name: entry.name });
      else archive.append(entry.content ?? '', { name: entry.name });
    }
    for (const dir of directories) {
      archive.directory(dir.sourceDir, dir.destPrefix);
    }

    archive.finalize();
  });
}

export async function extractZipTo(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await extractZip(zipPath, { dir: destDir });
}

/** Lists files directly inside a directory (not recursive), ignoring the directory if it doesn't exist yet. */
export async function listFilesSafe(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
