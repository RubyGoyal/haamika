/**
 * Session middleware: extracts and verifies the JWT session cookie.
 * Attaches session payload to req for downstream use.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifySession } from '../services/tokens.js';
import { getConfig } from '../config.js';
import type { SessionPayload } from '../../shared/types.js';

declare global {
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

/** Parse cookies from the Cookie header (no external dependency). */
function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

const COOKIE_NAME = 'haamika_session';

export { COOKIE_NAME };

/**
 * Middleware that verifies the session cookie and attaches the payload to req.session.
 * Does NOT reject unauthenticated requests — use requireRole for that.
 */
export async function sessionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (token) {
    const config = getConfig();
    const payload = await verifySession(token, config.SESSION_SECRET);
    if (payload) {
      req.session = payload;
    }
  }
  next();
}
