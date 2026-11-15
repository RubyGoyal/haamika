/**
 * Central error handler. Never exposes stack traces or internal details.
 * Logs errors with the structured logger.
 */
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', {
    name: err.name,
    message: err.message,
    // Never log stack traces to avoid leaking internals
  });

  res.status(500).json({ error: 'Internal server error' });
}
