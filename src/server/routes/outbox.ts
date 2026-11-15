/**
 * Outbox routes (R7).
 * Displays all proactive email reminders sent or logged.
 * Elder and Family only (Caretaker gets 403 per SPEC §6.6).
 */
import { Router } from 'express';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';

export function outboxRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/outbox — view outgoing reminder logs.
   */
  router.get('/', requireRole('elder', 'family'), async (req, res) => {
    const circleId = req.session!.circleId;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const entries = await repo.getOutboxByCircle(circleId, limit);
    res.json(entries);
  });

  return router;
}
