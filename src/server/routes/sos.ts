/**
 * SOS Emergency routes (R8, SPEC §4.10).
 * Elder or caretaker triggers immediate emergency alerts to all circle members.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { sosRateLimit } from '../middleware/rateLimits.js';
import { sendDueReminders } from '../services/emailService.js';
import type { DueReminder } from '../services/reminderEngine.js';
import { formatDualTime } from '../services/reminderEngine.js';
import { DateTime } from 'luxon';

export function sosRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /api/sos — trigger immediate emergency alert to all circle members.
   */
  router.post('/', sosRateLimit, requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const actorId = req.session!.memberId;
    const actorRole = req.session!.role;

    const [circle, members] = await Promise.all([
      repo.getCircle(circleId),
      repo.getMembersByCircle(circleId),
    ]);

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const now = DateTime.now();
    const elderTz = circle.timezone || 'Asia/Kolkata';
    const nowIso = now.toISO()!;
    const todayStr = now.setZone(elderTz).toFormat('yyyy-LL-dd');

    const activeMembers = members.filter((m) => !m.removedAt && m.email);
    const reminders: DueReminder[] = activeMembers.map((m) => {
      const timeDesc = formatDualTime(now, elderTz, m.timezone);
      return {
        circleId: circle.id,
        kind: 'sos',
        target: 'sos_button',
        stage: 'immediate',
        date: todayStr,
        to: m.email!,
        recipientId: m.id,
        recipientRole: m.role,
        subject: `URGENT: SOS Alert for ${circle.elderName}`,
        body:
          `EMERGENCY ALERT!\n\n` +
          `An SOS alert was triggered for ${circle.elderName} at ${timeDesc} by ${actorRole}.\n\n` +
          `Please check on them immediately or call local emergency services.\n\n` +
          `Haamika Emergency System`,
        dedupeKey: `${circle.id}:sos:${nowIso}:${m.id}`,
      };
    });

    const sent = await sendDueReminders(repo, reminders);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId,
      actorRole,
      action: 'sos_triggered',
      summary: `SOS Emergency Alert triggered by ${actorRole}`,
      at: nowIso,
    });

    res.json({
      ok: true,
      alertedMembers: sent.length,
      at: nowIso,
    });
  });

  return router;
}
