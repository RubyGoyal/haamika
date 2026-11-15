/**
 * Settings routes.
 * Family can update circle day anchors, timezone, language, and names.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { UpdateSettingsInput } from '../../shared/schemas.js';

export function settingsRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/settings — view current circle settings.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const circle = await repo.getCircle(circleId);
    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    res.json({
      elderName: circle.elderName,
      preferredName: circle.preferredName,
      language: circle.language,
      timezone: circle.timezone,
      anchors: circle.anchors,
      windowBeforeMin: circle.windowBeforeMin,
      windowAfterMin: circle.windowAfterMin,
    });
  });

  /**
   * PATCH /api/settings — update circle configuration (Family only).
   */
  router.patch('/', requireRole('family'), async (req, res) => {
    const parsed = UpdateSettingsInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    await repo.updateCircle(circleId, parsed.data);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'settings_updated',
      summary: 'Updated circle care settings',
      at: new Date().toISOString(),
    });

    const updated = await repo.getCircle(circleId);
    res.json(updated);
  });

  return router;
}
