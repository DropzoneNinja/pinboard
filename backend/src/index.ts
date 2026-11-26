import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './services/env.js';
import { logger } from './services/logger.js';
import { apiRouter } from './api/router.js';
import { notFoundHandler, errorHandler } from './services/errorHandler.js';

const app = express();

// Nginx sits in front of us and sets X-Forwarded-*; trust it so req.secure and
// req.ip reflect the real client, not the proxy hop.
app.set('trust proxy', 1);

if (env.frontendOrigin) {
  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
}

app.use(express.json({ limit: `${env.maxUploadMb}mb` }));
app.use(cookieParser());

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  logger.info(`Backend listening on port ${env.port}`, { nodeEnv: env.nodeEnv });
});
