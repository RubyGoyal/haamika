/**
 * Schedule routes (R1, R6).
 * Computes today's time-of-day slots, dose windows, and item statuses.
 */
import { Router } from 'express';
import { DateTime } from 'luxon';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { buildDaySchedule, getCurrentSlot, getNextSlot } from '../services/scheduleEngine.js';

export function scheduleRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/schedule/today — today's complete schedule with live statuses.
   */
  router.get('/today', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const circle = await repo.getCircle(circleId);
    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const timezone = circle.timezone;
    const now = DateTime.now().setZone(timezone);
    const dateStr = (req.query.date as string) || now.toISODate()!;

    const [medicines, routines, events, proposals, appointments] = await Promise.all([
      repo.getMedicinesByCircle(circleId),
      repo.getRoutinesByCircle(circleId),
      repo.getEventsByDate(circleId, dateStr),
      repo.getProposalsByCircle(circleId, 'pending'),
      repo.getAppointmentsByCircle(circleId),
    ]);

    const slots = buildDaySchedule(
      dateStr,
      medicines,
      routines,
      events,
      circle.anchors,
      timezone,
      circle.windowBeforeMin,
      circle.windowAfterMin,
      now,
    );

    const currentSlot = getCurrentSlot(
      now,
      circle.anchors,
      timezone,
      circle.windowBeforeMin,
      circle.windowAfterMin,
    );

    const nextSlot = getNextSlot(
      now,
      circle.anchors,
      timezone,
      circle.windowBeforeMin,
      circle.windowAfterMin,
    );

    // Filter next appointment (future ones only, sorted by startsAt)
    const upcomingAppointments = appointments
      .filter((a) => a.status === 'upcoming' && a.startsAt >= now.toISO()!)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    res.json({
      date: dateStr,
      timezone,
      currentSlot,
      nextSlot,
      slots,
      pendingProposalsCount: proposals.length,
      nextAppointment: upcomingAppointments[0] || null,
    });
  });

  return router;
}
