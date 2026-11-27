import { Router } from 'express';
import { authRouter } from '../auth/routes.js';
import { usersRouter } from '../users/routes.js';
import { boardsRouter } from '../boards/routes.js';
import { notesRouter } from '../notes/routes.js';
import { noteConnectionsRouter } from '../noteConnections/routes.js';
import { attachmentsRouter } from '../attachments/routes.js';
import { searchRouter } from '../search/routes.js';
import { recycleBinRouter } from '../recycleBin/routes.js';
import { settingsRouter } from '../settings/routes.js';
import { backupRouter } from '../backup/routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: process.uptime() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/boards', boardsRouter);
apiRouter.use('/notes', notesRouter);
apiRouter.use('/note-connections', noteConnectionsRouter);
apiRouter.use('/attachments', attachmentsRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/recycle-bin', recycleBinRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/backup', backupRouter);
