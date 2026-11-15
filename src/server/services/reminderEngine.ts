/**
 * Proactive Reminder Engine (R7, SPEC §4.6).
 * Pure function: given circle, members, medicines, events, appointments, and "now",
 * calculates all emails due with dual-timezone formatting and memberId-scoped dedupe keys.
 */
import { DateTime } from 'luxon';
import type { Circle, Member, Medicine, ScheduleEvent, Appointment } from '../../shared/types.js';

export interface DueReminder {
  circleId: string;
  kind: 'dose_upcoming' | 'dose_missed' | 'dose_missed_escalation' | 'appointment_upcoming' | 'refill_low' | 'sos';
  target: string;
  stage: string;
  date: string;
  to: string;
  recipientId: string;
  recipientRole: 'elder' | 'family' | 'caretaker';
  subject: string;
  body: string;
  dedupeKey: string;
}

export interface ReminderEngineContext {
  circle: Circle;
  members: Member[];
  medicines: Medicine[];
  events: ScheduleEvent[];
  appointments: Appointment[];
  now: DateTime;
}

/**
 * Format time in dual timezones if recipient's timezone differs from the circle's.
 */
export function formatDualTime(
  dt: DateTime,
  circleTz: string,
  recipientTz?: string,
): string {
  const circleTime = dt.setZone(circleTz).toFormat('hh:mm a ZZZZ');
  if (!recipientTz || recipientTz === circleTz) {
    return circleTime;
  }
  const recipientDt = dt.setZone(recipientTz);
  const recipientTime = recipientDt.toFormat('hh:mm a ZZZZ');
  
  // Check if date is different in recipient's timezone
  const circleDate = dt.setZone(circleTz).toFormat('yyyy-LL-dd');
  const recipientDate = recipientDt.toFormat('yyyy-LL-dd');
  const dayDiffNote = circleDate !== recipientDate ? ` on ${recipientDt.toFormat('LLL dd')}` : '';

  return `${circleTime} (${recipientTime}${dayDiffNote} in your local time)`;
}

const ANCHOR_FOR_SLOT: Record<'morning' | 'afternoon' | 'evening' | 'night', keyof Circle['anchors']> = {
  morning: 'breakfast',
  afternoon: 'lunch',
  evening: 'evening',
  night: 'dinner',
};

export function computeDueReminders(ctx: ReminderEngineContext): DueReminder[] {
  const { circle, members, medicines, events, appointments, now } = ctx;
  const reminders: DueReminder[] = [];

  const elderTz = circle.timezone || 'Asia/Kolkata';
  const nowInElderTz = now.setZone(elderTz);
  const todayStr = nowInElderTz.toFormat('yyyy-LL-dd');
  const weekday = nowInElderTz.toFormat('ccc').toLowerCase() as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

  const windowBeforeMin = circle.windowBeforeMin ?? 30;
  const windowAfterMin = circle.windowAfterMin ?? 120;
  const escalationAfterMin = circle.escalationAfterMin ?? 60;

  // Active members who have not been removed
  const activeMembers = members.filter((m) => !m.removedAt);

  /* ── 1. Dose-related reminders (upcoming, missed, escalation) ─────── */
  const slots = ['morning', 'afternoon', 'evening', 'night'] as const;

  for (const slot of slots) {
    const anchorKey = ANCHOR_FOR_SLOT[slot];
    const anchorTimeStr = circle.anchors[anchorKey];
    if (!anchorTimeStr) continue;

    const [anchorHour, anchorMin] = anchorTimeStr.split(':').map(Number);
    const anchorDt = nowInElderTz.set({
      hour: anchorHour,
      minute: anchorMin,
      second: 0,
      millisecond: 0,
    });

    const windowStartDt = anchorDt.minus({ minutes: windowBeforeMin });
    const windowEndDt = anchorDt.plus({ minutes: windowAfterMin });
    const escalationDt = windowEndDt.plus({ minutes: escalationAfterMin });

    // Active medicines due in this slot today
    const slotMeds = medicines.filter(
      (m) => m.status === 'active' && m.slots.includes(slot) && (!m.daysOfWeek || m.daysOfWeek.includes(weekday)),
    );

    if (slotMeds.length === 0) continue;

    // Check events for these medicines in this slot today
    const slotEvents = events.filter(
      (e) => e.date === todayStr && e.slot === slot && e.itemType === 'medicine',
    );

    // Has all medications been recorded as taken or skipped?
    const allResolved = slotMeds.every((m) =>
      slotEvents.some(
        (e) => e.itemId === m.id && (e.status === 'taken' || e.status === 'taken_late' || e.status === 'skipped'),
      ),
    );

    if (allResolved) continue;

    const medNames = slotMeds.map((m) => m.name).join(', ');

    // 1a. Dose Upcoming: within window start up to window end, if not resolved
    // Specifically trigger at window start: now is between windowStartDt and anchorDt + 15 min
    if (nowInElderTz >= windowStartDt && nowInElderTz < anchorDt.plus({ minutes: 15 })) {
      for (const m of activeMembers) {
        if (!m.email) continue;
        // Default to caretaker, or anyone with notify.upcoming = true
        const wantsUpcoming = m.notify?.upcoming ?? (m.role === 'caretaker');
        if (!wantsUpcoming) continue;

        const timeDesc = formatDualTime(anchorDt, elderTz, m.timezone);
        reminders.push({
          circleId: circle.id,
          kind: 'dose_upcoming',
          target: slot,
          stage: 'start',
          date: todayStr,
          to: m.email,
          recipientId: m.id,
          recipientRole: m.role,
          subject: `Haamika: Upcoming ${slot} medicines for ${circle.elderName}`,
          body:
            `Hello ${m.name},\n\n` +
            `This is a friendly reminder that ${circle.preferredName || circle.elderName}'s ` +
            `${slot} dose (${medNames}) is scheduled for ${timeDesc}.\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circle.id}:dose_upcoming:${slot}:${todayStr}:start:${m.id}`,
        });
      }
    }

    // 1b. Dose Missed: window closed, not yet escalation time
    if (nowInElderTz >= windowEndDt && nowInElderTz < escalationDt) {
      for (const m of activeMembers) {
        if (!m.email) continue;
        // Caretaker and Elder (if email) receive dose_missed
        const isTarget = m.role === 'caretaker' || m.role === 'elder' || m.notify?.missed;
        if (!isTarget) continue;

        const timeDesc = formatDualTime(anchorDt, elderTz, m.timezone);
        reminders.push({
          circleId: circle.id,
          kind: 'dose_missed',
          target: slot,
          stage: 'close',
          date: todayStr,
          to: m.email,
          recipientId: m.id,
          recipientRole: m.role,
          subject: `Haamika: Missed ${slot} medicines for ${circle.elderName}`,
          body:
            `Hello ${m.name},\n\n` +
            `${circle.preferredName || circle.elderName}'s ${slot} dose (${medNames}) ` +
            `was scheduled for ${timeDesc} and has not yet been marked as taken.\n\n` +
            `Please check in with ${circle.preferredName || circle.elderName}.\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circle.id}:dose_missed:${slot}:${todayStr}:close:${m.id}`,
        });
      }
    }

    // 1c. Dose Missed Escalation: escalationDt passed, still not resolved
    if (nowInElderTz >= escalationDt) {
      for (const m of activeMembers) {
        if (!m.email) continue;
        // Family members receive escalation
        if (m.role !== 'family') continue;

        const timeDesc = formatDualTime(anchorDt, elderTz, m.timezone);
        reminders.push({
          circleId: circle.id,
          kind: 'dose_missed_escalation',
          target: slot,
          stage: 'escalation',
          date: todayStr,
          to: m.email,
          recipientId: m.id,
          recipientRole: m.role,
          subject: `Haamika Urgent: ${slot} medicines still not taken for ${circle.elderName}`,
          body:
            `Hello ${m.name},\n\n` +
            `Escalation Notice: ${circle.preferredName || circle.elderName}'s ${slot} dose (${medNames}) ` +
            `was due at ${timeDesc} and remains unconfirmed 60 minutes after the window closed.\n\n` +
            `Please reach out to ensure everything is okay.\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circle.id}:dose_missed_escalation:${slot}:${todayStr}:escalation:${m.id}`,
        });
      }
    }
  }

  /* ── 2. Appointments: 24h and 2h before ────────────────────────────── */
  for (const appt of appointments) {
    if (appt.status !== 'upcoming') continue;
    const apptDt = DateTime.fromISO(appt.startsAt);
    if (!apptDt.isValid) continue;

    const diffHours = apptDt.diff(now, 'hours').hours;

    // 24h reminder (within 23h to 24.5h)
    if (diffHours >= 23 && diffHours <= 24.5) {
      for (const m of activeMembers) {
        if (!m.email) continue;
        const timeDesc = formatDualTime(apptDt, elderTz, m.timezone);
        reminders.push({
          circleId: circle.id,
          kind: 'appointment_upcoming',
          target: appt.id,
          stage: '24h',
          date: todayStr,
          to: m.email,
          recipientId: m.id,
          recipientRole: m.role,
          subject: `Haamika: Doctor appointment tomorrow for ${circle.elderName}`,
          body:
            `Hello ${m.name},\n\n` +
            `Reminder: ${circle.preferredName || circle.elderName} has an appointment tomorrow with ` +
            `${appt.doctorName}${appt.specialty ? ` (${appt.specialty})` : ''} at ${timeDesc}.\n` +
            `Location: ${appt.place || 'Clinic'}\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circle.id}:appointment_upcoming:${appt.id}:${todayStr}:24h:${m.id}`,
        });
      }
    }

    // 2h reminder (within 1.5h to 2.5h)
    if (diffHours >= 1.5 && diffHours <= 2.5) {
      for (const m of activeMembers) {
        if (!m.email) continue;
        const timeDesc = formatDualTime(apptDt, elderTz, m.timezone);
        reminders.push({
          circleId: circle.id,
          kind: 'appointment_upcoming',
          target: appt.id,
          stage: '2h',
          date: todayStr,
          to: m.email,
          recipientId: m.id,
          recipientRole: m.role,
          subject: `Haamika: Doctor appointment in 2 hours for ${circle.elderName}`,
          body:
            `Hello ${m.name},\n\n` +
            `Reminder: ${circle.preferredName || circle.elderName}'s appointment with ` +
            `${appt.doctorName} is starting in about 2 hours at ${timeDesc}.\n` +
            `Location: ${appt.place || 'Clinic'}\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circle.id}:appointment_upcoming:${appt.id}:${todayStr}:2h:${m.id}`,
        });
      }
    }
  }

  /* ── 3. Low Refill Alert: stockCount <= refillThreshold ───────────── */
  for (const med of medicines) {
    if (med.status !== 'active') continue;
    const threshold = med.refillThreshold ?? 5;
    if (med.stockCount !== undefined && med.stockCount <= threshold) {
      for (const m of activeMembers) {
        if (!m.email || m.role !== 'family') continue;
        reminders.push({
          circleId: circle.id,
          kind: 'refill_low',
          target: med.id,
          stage: 'refill',
          date: todayStr,
          to: m.email,
          recipientId: m.id,
          recipientRole: m.role,
          subject: `Haamika Alert: Low stock for ${med.name} (${circle.elderName})`,
          body:
            `Hello ${m.name},\n\n` +
            `${circle.preferredName || circle.elderName}'s medication "${med.name}" is running low. ` +
            `Remaining stock: ${med.stockCount} doses (refill threshold: ${threshold}).\n\n` +
            `Please arrange for a refill soon.\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circle.id}:refill_low:${med.id}:${todayStr}:refill:${m.id}`,
        });
      }
    }
  }

  return reminders;
}
