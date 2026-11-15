/**
 * Express application factory. Used by both the server entry point and tests.
 * Assembles middleware, routes, and error handling.
 */
import express from 'express';
import compression from 'compression';
import type { Repository } from './repositories/repository.js';
import { securityHeaders } from './middleware/security.js';
import { sessionMiddleware } from './middleware/session.js';
import { originCheck } from './middleware/originCheck.js';
import { generalRateLimit, authRateLimit } from './middleware/rateLimits.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { circleRoutes } from './routes/circles.js';
import { inviteRoutes } from './routes/invites.js';
import { memberRoutes } from './routes/members.js';
import { meRoutes } from './routes/me.js';

export function createApp(repo: Repository): express.Express {
  const app = express();

  /* ── Security ────────────────────────────────────────── */
  app.use(securityHeaders);
  app.use(compression());
  app.use(express.json({ limit: '50kb' }));
  app.use(originCheck);
  app.use(generalRateLimit);

  /* ── Session (parse on every request, don't reject) ── */
  app.use(sessionMiddleware);

  /* ── Public routes ───────────────────────────────────── */
  app.use(healthRoutes());

  /* ── Auth routes (rate-limited) ──────────────────────── */
  app.use('/api/auth', authRateLimit, authRoutes(repo));

  /* ── Protected routes ────────────────────────────────── */
  app.use('/api/circles', circleRoutes(repo));
  app.use('/api/invites', inviteRoutes(repo));
  app.use('/api/members', memberRoutes(repo));
  app.use('/api/me', meRoutes(repo));

  /* ── Error handler (must be last) ────────────────────── */
  app.use(errorHandler);

  return app;
}
