import { DateTime } from 'luxon';
import type { Appointment, Circle, Member } from '../../shared/types.js';
import type { DueReminder } from './reminderEngine.js';
import { formatDualTime } from './reminderEngine.js';

const APPT_24H_MIN_HOURS = 23;
const APPT_24H_MAX_HOURS = 24.5;
const APPT_2H_MIN_HOURS = 1.5;
const APPT_2H_MAX_HOURS = 2.5;

function create24hReminder(
  appt: Appointment,
  m: Member,
  circle: Circle,
  timeDesc: string,
  todayStr: string,
): DueReminder {
  return {
    circleId: circle.id,
    kind: 'appointment_upcoming',
    target: appt.id,
    stage: '24h',
    date: todayStr,
    to: m.email!,
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
  };
}

function create2hReminder(
  appt: Appointment,
  m: Member,
  circle: Circle,
  timeDesc: string,
  todayStr: string,
): DueReminder {
  return {
    circleId: circle.id,
    kind: 'appointment_upcoming',
    target: appt.id,
    stage: '2h',
    date: todayStr,
    to: m.email!,
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
  };
}

function dispatchApptReminders(
  appt: Appointment,
  activeMembers: Member[],
  circle: Circle,
  apptDt: DateTime,
  elderTz: string,
  todayStr: string,
  is24h: boolean,
): DueReminder[] {
  const reminders: DueReminder[] = [];
  for (const m of activeMembers) {
    if (!m.email) continue;
    const memTime = formatDualTime(apptDt, elderTz, m.timezone);
    if (is24h) {
      reminders.push(create24hReminder(appt, m, circle, memTime, todayStr));
    } else {
      reminders.push(create2hReminder(appt, m, circle, memTime, todayStr));
    }
  }
  return reminders;
}

export function buildAppointmentReminders(
  appointments: Appointment[],
  now: DateTime,
  circle: Circle,
  activeMembers: Member[],
  elderTz: string,
  todayStr: string,
): DueReminder[] {
  const reminders: DueReminder[] = [];
  for (const appt of appointments) {
    if (appt.status !== 'upcoming') continue;
    const apptDt = DateTime.fromISO(appt.startsAt);
    if (!apptDt.isValid) continue;

    const diffHours = apptDt.diff(now, 'hours').hours;
    const is24h = diffHours >= APPT_24H_MIN_HOURS && diffHours <= APPT_24H_MAX_HOURS;
    const is2h = diffHours >= APPT_2H_MIN_HOURS && diffHours <= APPT_2H_MAX_HOURS;
    if (!is24h && !is2h) continue;

    reminders.push(
      ...dispatchApptReminders(appt, activeMembers, circle, apptDt, elderTz, todayStr, is24h),
    );
  }
  return reminders;
}
