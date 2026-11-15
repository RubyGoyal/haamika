/**
 * Activity log routes.
 * Scoped to circleId. Elder and Family only (Caretaker gets 403 per SPEC §6.6).
 */
import { Router } from 'express';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';

export function activityRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/activity — chronological activity history.
   */
  router.get('/', requireRole('elder', 'family'), async (req, res) => {
    const circleId = req.session!.circleId;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const activities = await repo.getActivitiesByCircle(circleId, limit);
    res.json(activities);
  });

  return router;
}
