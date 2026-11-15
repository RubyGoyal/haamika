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
import { medicineRoutes } from './routes/medicines.js';
import { routineRoutes } from './routes/routines.js';
import { proposalRoutes } from './routes/proposals.js';
import { scheduleRoutes } from './routes/schedule.js';
import { eventRoutes } from './routes/events.js';
import { adherenceRoutes } from './routes/adherence.js';
import { appointmentRoutes } from './routes/appointments.js';
import { activityRoutes } from './routes/activity.js';
import { outboxRoutes } from './routes/outbox.js';
import { settingsRoutes } from './routes/settings.js';

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
  app.use('/api/medicines', medicineRoutes(repo));
  app.use('/api/routines', routineRoutes(repo));
  app.use('/api/proposals', proposalRoutes(repo));
  app.use('/api/schedule', scheduleRoutes(repo));
  app.use('/api/events', eventRoutes(repo));
  app.use('/api/adherence', adherenceRoutes(repo));
  app.use('/api/appointments', appointmentRoutes(repo));
  app.use('/api/activity', activityRoutes(repo));
  app.use('/api/outbox', outboxRoutes(repo));
  app.use('/api/settings', settingsRoutes(repo));

  /* ── Error handler (must be last) ────────────────────── */
  app.use(errorHandler);

  return app;
}
