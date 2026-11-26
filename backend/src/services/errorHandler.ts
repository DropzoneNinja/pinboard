import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { HttpError } from './http.js';
import { logger } from './logger.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Validation failed', issues: err.issues } });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Could not process the uploaded file';
    res.status(400).json({ error: { message } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: { message: 'Not found' } });
    return;
  }

  // Malformed id in a path param (e.g. not a valid UUID) — a client input error, not a server fault.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2023') {
    res.status(400).json({ error: { message: 'Invalid id' } });
    return;
  }

  logger.error('Unhandled error', { err });
  res.status(500).json({ error: { message: 'Internal server error' } });
}
