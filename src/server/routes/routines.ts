/**
 * Routines routes (R3).
 * Family manages routines directly (no elder approval needed per SPEC §4.4).
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { CreateRoutineInput, UpdateRoutineInput } from '../../shared/schemas.js';
import type { Routine } from '../../shared/types.js';

export function routineRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/routines — list all routines.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const routines = await repo.getRoutinesByCircle(circleId);
    res.json(routines);
  });

  /**
   * POST /api/routines — create a routine (Family only).
   */
  router.post('/', requireRole('family'), async (req, res) => {
    const parsed = CreateRoutineInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const memberId = req.session!.memberId;
    const now = new Date().toISOString();

    const routine: Routine = {
      id: randomUUID(),
      circleId,
      ...parsed.data,
      status: 'active',
      createdAt: now,
    };
    await repo.createRoutine(circleId, routine);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: memberId,
      actorRole: 'family',
      action: 'routine_created',
      target: routine.label,
      summary: `Created healthcare routine: ${routine.label}`,
      at: now,
    });

    res.status(201).json(routine);
  });

  /**
   * PATCH /api/routines/:id — update a routine (Family only).
   */
  router.patch('/:id', requireRole('family'), async (req, res) => {
    const parsed = UpdateRoutineInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const routineId = req.params.id as string;

    const existing = await repo.getRoutine(circleId, routineId);
    if (!existing) {
      res.status(404).json({ error: 'Routine not found' });
      return;
    }

    await repo.updateRoutine(circleId, routineId, parsed.data);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'routine_updated',
      target: existing.label,
      summary: `Updated healthcare routine: ${existing.label}`,
      at: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  return router;
}
