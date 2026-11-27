import { prisma } from '../database/prisma.js';
import { logger } from '../services/logger.js';
import { pruneAutoBackups, runSystemBackup } from './service.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly; frequency itself is weekly/monthly at minimum
const GLOBAL_ID = 'global';

async function getBackupSettings() {
  const existing = await prisma.backupSettings.findUnique({ where: { id: GLOBAL_ID } });
  if (existing) return existing;
  return prisma.backupSettings.create({ data: { id: GLOBAL_ID } });
}

function isDue(frequency: string, lastRunAt: Date | null): boolean {
  if (!lastRunAt) return true;
  const elapsedMs = Date.now() - lastRunAt.getTime();
  const intervalMs = frequency === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return elapsedMs >= intervalMs;
}

async function tick(): Promise<void> {
  const settings = await getBackupSettings();
  if (!settings.enabled) return;
  if (!isDue(settings.frequency, settings.lastRunAt)) return;

  try {
    await runSystemBackup('auto');
    await pruneAutoBackups(settings.retainCount);
    await prisma.backupSettings.update({
      where: { id: GLOBAL_ID },
      data: { lastRunAt: new Date() },
    });
  } catch (err) {
    logger.error('Scheduled backup failed', { err });
  }
}

export function startBackupScheduler(): void {
  tick().catch((err) => logger.error('Initial backup check failed', { err }));
  setInterval(() => {
    tick().catch((err) => logger.error('Scheduled backup check failed', { err }));
  }, CHECK_INTERVAL_MS);
}
