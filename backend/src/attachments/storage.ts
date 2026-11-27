import { copyFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../services/env.js';

export const IMAGES_DIR = path.join(env.uploadsDir, 'images');
export const THUMBNAILS_DIR = path.join(env.uploadsDir, 'thumbnails');
const THUMBNAIL_MAX_EDGE = 320;

const EXTENSION_BY_FORMAT: Record<string, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
};

export interface ProcessedImage {
  storedFilename: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Validates the buffer is really a decodable image (not just a spoofed Content-Type) and writes
 * it plus a thumbnail to the persistent uploads volume under a generated filename. Non-GIF images
 * are re-encoded through sharp (incidentally stripping embedded metadata); GIFs are stored as-is
 * since re-encoding animated GIFs through libvips is unreliable — the thumbnail for a GIF is a
 * static first frame instead.
 */
export async function saveImageWithThumbnail(buffer: Buffer): Promise<ProcessedImage> {
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(THUMBNAILS_DIR, { recursive: true });

  const metadata = await sharp(buffer).metadata();
  const format = metadata.format;
  if (!format || !(format in EXTENSION_BY_FORMAT)) {
    throw new Error('Unsupported or unrecognised image format');
  }
  const extension = EXTENSION_BY_FORMAT[format]!;
  const filename = `${crypto.randomUUID()}.${extension}`;

  if (format === 'gif') {
    await writeFile(path.join(IMAGES_DIR, filename), buffer);
    await sharp(buffer)
      .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .toFile(path.join(THUMBNAILS_DIR, filename));
  } else {
    await sharp(buffer).toFile(path.join(IMAGES_DIR, filename));
    await sharp(buffer)
      .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .toFile(path.join(THUMBNAILS_DIR, filename));
  }

  return {
    storedFilename: filename,
    mimeType: `image/${format}`,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

export function imagePath(storedFilename: string): string {
  return path.join(IMAGES_DIR, path.basename(storedFilename));
}

export function thumbnailPath(storedFilename: string): string {
  return path.join(THUMBNAILS_DIR, path.basename(storedFilename));
}

/** Copies an existing image + its thumbnail to new generated filenames (used by note duplication). */
export async function copyImageFiles(storedFilename: string): Promise<string> {
  const extension = storedFilename.slice(storedFilename.lastIndexOf('.'));
  const newFilename = `${crypto.randomUUID()}${extension}`;
  await copyFile(imagePath(storedFilename), imagePath(newFilename));
  await copyFile(thumbnailPath(storedFilename), thumbnailPath(newFilename));
  return newFilename;
}

export async function deleteImageFiles(storedFilename: string): Promise<void> {
  await Promise.all([
    unlink(imagePath(storedFilename)).catch(() => {}),
    unlink(thumbnailPath(storedFilename)).catch(() => {}),
  ]);
}
