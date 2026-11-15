/**
 * Origin header check for state-changing requests (POST, PUT, PATCH, DELETE).
 * Combined with SameSite=Strict cookies, this provides CSRF protection.
 */
import type { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (!STATE_CHANGING.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (!origin) {
    // Allow requests without Origin header (same-origin, server-to-server)
    next();
    return;
  }

  const config = getConfig();

  try {
    const originUrl = new URL(origin);
    const hostHeader = req.headers.host || '';
    const hostWithoutPort = hostHeader.split(':')[0];
    const originHostWithoutPort = originUrl.hostname;

    if (originUrl.host === hostHeader || originHostWithoutPort === hostWithoutPort) {
      next();
      return;
    }

    if (config.APP_BASE_URL && origin === new URL(config.APP_BASE_URL).origin) {
      next();
      return;
    }
  } catch {
    res.status(403).json({ error: 'Invalid origin header' });
    return;
  }

  res.status(403).json({ error: 'Origin not allowed' });
  return;

  next();
}
