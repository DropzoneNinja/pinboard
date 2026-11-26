import { Router } from 'express';
import { authRouter } from '../auth/routes.js';
import { usersRouter } from '../users/routes.js';
import { boardsRouter } from '../boards/routes.js';
import { notesRouter } from '../notes/routes.js';
import { attachmentsRouter } from '../attachments/routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: process.uptime() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/boards', boardsRouter);
apiRouter.use('/notes', notesRouter);
apiRouter.use('/attachments', attachmentsRouter);
