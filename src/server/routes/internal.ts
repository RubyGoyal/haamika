/**
 * Internal cron endpoints (R7, SPEC §4.6).
 * Triggered by Google Cloud Scheduler every 5 minutes.
 * Protected by X-Cron-Secret with constant-time comparison.
 */
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { DateTime } from 'luxon';
import type { Repository } from '../repositories/repository.js';
import { getConfig } from '../config.js';
import { computeDueReminders } from '../services/reminderEngine.js';
import { sendDueReminders } from '../services/emailService.js';
import { logger } from '../services/logger.js';

export function internalRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /internal/tick
   * Runs the proactive reminder engine across all circles.
   */
  router.post('/tick', async (req, res) => {
    const config = getConfig();
    const providedSecret = req.headers['x-cron-secret'];

    if (typeof providedSecret !== 'string') {
      res.status(401).json({ error: 'Unauthorized: missing X-Cron-Secret header' });
      return;
    }

    const expectedBuffer = Buffer.from(config.CRON_SECRET);
    const providedBuffer = Buffer.from(providedSecret);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      res.status(401).json({ error: 'Unauthorized: invalid cron secret' });
      return;
    }

    const now = DateTime.now();
    const circles = await repo.getAllCircles();
    let totalSent = 0;

    for (const circle of circles) {
      try {
        const elderTz = circle.timezone || 'Asia/Kolkata';
        const nowInElderTz = now.setZone(elderTz);
        const todayStr = nowInElderTz.toFormat('yyyy-LL-dd');
        const weekday = nowInElderTz.toFormat('ccc').toLowerCase() as
          'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

        const [members, medicines, appointments, events] = await Promise.all([
          repo.getMembersByCircle(circle.id),
          repo.getMedicinesByCircle(circle.id),
          repo.getAppointmentsByCircle(circle.id),
          repo.getEventsByDate(circle.id, todayStr),
        ]);

        // 1. Mark missed events for closed dose windows
        const windowAfterMin = circle.windowAfterMin ?? 120;
        const slots = ['morning', 'afternoon', 'evening', 'night'] as const;
        const ANCHOR_MAP: Record<
          'morning' | 'afternoon' | 'evening' | 'night',
          keyof typeof circle.anchors
        > = {
          morning: 'breakfast',
          afternoon: 'lunch',
          evening: 'evening',
          night: 'dinner',
        };

        for (const slot of slots) {
          const anchorKey = ANCHOR_MAP[slot];
          const anchorTimeStr = circle.anchors[anchorKey];
          if (!anchorTimeStr) continue;

          const [h, m] = anchorTimeStr.split(':').map(Number);
          const anchorDt = nowInElderTz.set({ hour: h, minute: m, second: 0, millisecond: 0 });
          const windowEndDt = anchorDt.plus({ minutes: windowAfterMin });

          if (nowInElderTz >= windowEndDt) {
            const slotMeds = medicines.filter(
              (med) =>
                med.status === 'active' &&
                med.slots.includes(slot) &&
                (!med.daysOfWeek || med.daysOfWeek.includes(weekday)),
            );

            for (const med of slotMeds) {
              const eventId = `${todayStr}_${slot}_medicine_${med.id}`;
              const existingEvent = events.find((e) => e.id === eventId);
              if (!existingEvent) {
                const missedEvent = {
                  id: eventId,
                  circleId: circle.id,
                  date: todayStr,
                  slot,
                  itemType: 'medicine' as const,
                  itemId: med.id,
                  status: 'missed' as const,
                  at: now.toISO(),
                };
                await repo.createOrUpdateEvent(circle.id, missedEvent);
                events.push(missedEvent);
              }
            }
          }
        }

        // 2. Compute due reminders
        const dueReminders = computeDueReminders({
          circle,
          members,
          medicines,
          events,
          appointments,
          now,
        });

        // 3. Send/log emails with deduplication
        const sent = await sendDueReminders(repo, dueReminders);
        totalSent += sent.length;
      } catch (err: unknown) {
        logger.error('Error processing tick for circle', {
          circleId: circle.id,
          error: (err as Error).message,
        });
      }
    }

    res.json({
      ok: true,
      processedCircles: circles.length,
      sentReminders: totalSent,
    });
  });

  return router;
}
