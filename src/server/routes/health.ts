/**
 * Health check endpoint. Returns { ok: true } without touching external services.
 */
import { Router } from 'express';

export function healthRoutes(): Router {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
