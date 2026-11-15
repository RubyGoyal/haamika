/**
 * Events routes (R1, R6).
 * Records taken, taken_late, skipped with reason, or healthcare reading.
 * Decrements stock on medicine taken.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { CreateEventInput } from '../../shared/schemas.js';
import { makeEventId } from '../services/scheduleEngine.js';
import type { ScheduleEvent } from '../../shared/types.js';

export function eventRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /api/events — record medication/routine status or reading.
   * Can be performed by Elder, Family, or Caretaker.
   */
  router.post('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const parsed = CreateEventInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const memberId = req.session!.memberId;
    const role = req.session!.role;
    const data = parsed.data;

    const eventId = makeEventId(data.date, data.slot, data.itemType, data.itemId);
    const now = new Date().toISOString();

    const event: ScheduleEvent = {
      id: eventId,
      circleId,
      date: data.date,
      slot: data.slot,
      itemType: data.itemType,
      itemId: data.itemId,
      status: data.status,
      actorId: memberId,
      reason: data.reason,
      reading: data.reading,
      at: now,
    };

    await repo.createOrUpdateEvent(circleId, event);

    // Stock decrement if medicine is taken
    let itemName = data.itemId;
    if (data.itemType === 'medicine') {
      const med = await repo.getMedicine(circleId, data.itemId);
      if (med) {
        itemName = med.name;
        if ((data.status === 'taken' || data.status === 'taken_late') && typeof med.stockCount === 'number') {
          const newStock = Math.max(0, med.stockCount - med.dosePerSlot);
          await repo.updateMedicine(circleId, med.id, { stockCount: newStock });
        }
      }
    } else {
      const routine = await repo.getRoutine(circleId, data.itemId);
      if (routine) {
        itemName = routine.label;
      }
    }

    // Log activity
    const actionDesc = data.status === 'skipped'
      ? `Skipped ${itemName}${data.reason ? ` (${data.reason})` : ''}`
      : `Marked ${itemName} as ${data.status}${data.reading ? ` [Reading: ${data.reading}]` : ''}`;

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: memberId,
      actorRole: role,
      action: `event_${data.status}`,
      target: itemName,
      summary: actionDesc,
      at: now,
    });

    res.status(201).json(event);
  });

  return router;
}
