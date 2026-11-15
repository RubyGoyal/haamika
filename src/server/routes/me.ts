/**
 * GET /api/me — return the current session's user info.
 */
import { Router } from 'express';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';

export function meRoutes(repo: Repository): Router {
  const router = Router();

  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const { circleId, memberId, role } = req.session!;
    const circle = await repo.getCircle(circleId);
    const member = await repo.getMember(circleId, memberId);

    if (!circle || !member || member.removedAt) {
      res.status(401).json({ error: 'Session invalid' });
      return;
    }

    res.json({
      circleId,
      memberId,
      name: member.name,
      role,
      isOrganizer: member.isOrganizer,
      circle: {
        elderName: circle.elderName,
        preferredName: circle.preferredName,
        language: circle.language,
        timezone: circle.timezone,
      },
    });
  });

  return router;
}
