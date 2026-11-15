/**
 * Appointments routes (R2).
 * Family manages appointments; elder and caretaker view.
 * Builds Google Calendar TEMPLATE links.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { CreateAppointmentInput, UpdateAppointmentInput } from '../../shared/schemas.js';
import { buildGoogleCalendarUrl } from '../services/calendarLink.js';
import type { Appointment } from '../../shared/types.js';

export function appointmentRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/appointments — view appointments with Google Calendar links.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const circle = await repo.getCircle(circleId);
    const timezone = circle?.timezone || 'Asia/Kolkata';

    const appointments = await repo.getAppointmentsByCircle(circleId);
    const withLinks = appointments.map((a) => ({
      ...a,
      googleCalendarUrl: buildGoogleCalendarUrl(a, timezone),
    }));

    res.json(withLinks);
  });

  /**
   * POST /api/appointments — create an appointment (Family only).
   */
  router.post('/', requireRole('family'), async (req, res) => {
    const parsed = CreateAppointmentInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const circle = await repo.getCircle(circleId);
    const timezone = circle?.timezone || 'Asia/Kolkata';
    const now = new Date().toISOString();

    const appointment: Appointment = {
      id: randomUUID(),
      circleId,
      ...parsed.data,
      status: 'upcoming',
      createdAt: now,
    };

    await repo.createAppointment(circleId, appointment);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'appointment_created',
      target: appointment.doctorName,
      summary: `Scheduled appointment with ${appointment.doctorName}`,
      at: now,
    });

    res.status(201).json({
      ...appointment,
      googleCalendarUrl: buildGoogleCalendarUrl(appointment, timezone),
    });
  });

  /**
   * PATCH /api/appointments/:id — update an appointment (Family only).
   */
  router.patch('/:id', requireRole('family'), async (req, res) => {
    const parsed = UpdateAppointmentInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const appointmentId = req.params.id as string;

    const existing = await repo.getAppointment(circleId, appointmentId);
    if (!existing) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    await repo.updateAppointment(circleId, appointmentId, parsed.data);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'appointment_updated',
      target: existing.doctorName,
      summary: `Updated appointment with ${existing.doctorName}`,
      at: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  /**
   * DELETE /api/appointments/:id — delete/cancel an appointment (Family only).
   */
  router.delete('/:id', requireRole('family'), async (req, res) => {
    const circleId = req.session!.circleId;
    const appointmentId = req.params.id as string;

    const existing = await repo.getAppointment(circleId, appointmentId);
    if (!existing) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    await repo.deleteAppointment(circleId, appointmentId);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'appointment_cancelled',
      target: existing.doctorName,
      summary: `Cancelled appointment with ${existing.doctorName}`,
      at: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  return router;
}
