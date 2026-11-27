import type { AppSettings } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { env } from '../services/env.js';

const GLOBAL_ID = 'global';

/** Gets the single shared settings row, creating it (seeded from env defaults) on first access. */
export async function getAppSettings(): Promise<AppSettings> {
  const existing = await prisma.appSettings.findUnique({ where: { id: GLOBAL_ID } });
  if (existing) return existing;
  return prisma.appSettings.create({
    data: { id: GLOBAL_ID, recycleBinRetentionDays: env.recycleBinRetentionDays },
  });
}
