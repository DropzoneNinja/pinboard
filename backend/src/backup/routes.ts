import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler, HttpError } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';
import { verifyPassword } from '../auth/password.js';
import { logActivity } from '../activity/log.js';
import {
  listBackups,
  pruneAutoBackups,
  resolveBackupPath,
  restoreSystemBackup,
  runSystemBackup,
  saveUploadedBackup,
} from './service.js';

export const backupRouter = Router();

backupRouter.use(requireAuth);

const GLOBAL_ID = 'global';

async function getBackupSettings() {
  const existing = await prisma.backupSettings.findUnique({ where: { id: GLOBAL_ID } });
  if (existing) return existing;
  return prisma.backupSettings.create({ data: { id: GLOBAL_ID } });
}

backupRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = await getBackupSettings();
    res.json({ settings });
  }),
);

const patchSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  retainCount: z.number().int().min(1).max(100).optional(),
});

backupRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const data = patchSettingsSchema.parse(req.body);
    await getBackupSettings();
    const settings = await prisma.backupSettings.update({ where: { id: GLOBAL_ID }, data });
    res.json({ settings });
  }),
);

backupRouter.get(
  '/list',
  asyncHandler(async (_req, res) => {
    const backups = await listBackups();
    res.json({ backups });
  }),
);

backupRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const filename = await runSystemBackup('manual');
    const settings = await getBackupSettings();
    await pruneAutoBackups(settings.retainCount);
    await logActivity({ userId: req.userId!, action: 'backup.created', metadata: { filename } });
    res.status(201).json({ filename });
  }),
);

backupRouter.get(
  '/:filename/download',
  asyncHandler(async (req, res) => {
    const filePath = resolveBackupPath(req.params.filename!);
    res.download(filePath, req.params.filename!, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: { message: 'Backup not found' } });
      }
    });
  }),
);

const MAX_BACKUP_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB — a full system backup can be sizeable
const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BACKUP_UPLOAD_BYTES },
});

backupRouter.post(
  '/upload',
  uploadBackup.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'No file uploaded');
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new HttpError(400, 'Backup files must be a .zip archive');
    }
    const filename = await saveUploadedBackup(file.buffer, file.originalname);
    await logActivity({ userId: req.userId!, action: 'backup.uploaded', metadata: { filename } });
    res.status(201).json({ filename });
  }),
);

const restoreSchema = z.object({ password: z.string().min(1) });

backupRouter.post(
  '/:filename/restore',
  asyncHandler(async (req, res) => {
    const { password } = restoreSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new HttpError(401, 'Incorrect password');
    }

    await restoreSystemBackup(req.params.filename!);
    res.status(204).end();
  }),
);
