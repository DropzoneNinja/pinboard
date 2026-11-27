import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { env } from './services/env.js';
import { logger } from './services/logger.js';
import { apiRouter } from './api/router.js';
import { notFoundHandler, errorHandler } from './services/errorHandler.js';
import { initWebSocket, setWsHub } from './websocket/server.js';
import { startRecycleBinPurgeJob } from './recycleBin/service.js';
import { startBackupScheduler } from './backup/scheduler.js';

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

const server = app.listen(env.port, () => {
  logger.info(`Backend listening on port ${env.port}`, { nodeEnv: env.nodeEnv });
});

const wsHub = initWebSocket(server);
setWsHub(wsHub);
startRecycleBinPurgeJob();
startBackupScheduler();

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down`);
  // Drain WebSocket connections first so clients get a clean close (and reconnect promptly)
  // instead of waiting for the TCP connection to time out.
  wsHub.shutdown();
  server.close(() => process.exit(0));
  // Safety net: force-exit if something (e.g. a lingering keep-alive connection) stops
  // server.close()'s callback from ever firing.
  setTimeout(() => process.exit(0), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
