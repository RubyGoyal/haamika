/**
 * Calendar link builder for appointments.
 * Generates Google Calendar web intent URLs per SPEC §4.7 (R2).
 */
import { DateTime } from 'luxon';
import type { Appointment } from '../../shared/types.js';

export function buildGoogleCalendarUrl(
  appointment: Appointment,
  timezone: string = 'Asia/Kolkata',
): string {
  const dt = DateTime.fromISO(appointment.startsAt, { zone: timezone });
  // Default duration: 1 hour
  const endDt = dt.plus({ hours: 1 });

  const formatGCal = (d: DateTime) => d.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const dates = `${formatGCal(dt)}/${formatGCal(endDt)}`;

  const title = `Doctor Appointment: ${appointment.doctorName}${appointment.specialty ? ` (${appointment.specialty})` : ''}`;

  let details = appointment.notes || '';
  if (appointment.questions && appointment.questions.length > 0) {
    details +=
      `\n\nQuestions for Doctor:\n` +
      appointment.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details: details.trim(),
    location: appointment.place || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
