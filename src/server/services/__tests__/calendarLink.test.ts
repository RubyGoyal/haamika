/**
 * Unit tests for calendarLink service (R2).
 */
import { describe, it, expect } from 'vitest';
import { buildGoogleCalendarUrl } from '../calendarLink.js';
import type { Appointment } from '../../../shared/types.js';

describe('buildGoogleCalendarUrl', () => {
  const baseAppointment: Appointment = {
    id: 'appt-1',
    circleId: 'circle-1',
    doctorName: 'Dr. Anita Roy',
    startsAt: '2026-11-20T10:30:00+05:30',
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  };

  it('builds URL with minimal required fields', () => {
    const url = buildGoogleCalendarUrl(baseAppointment);
    expect(url).toContain('https://calendar.google.com/calendar/render?');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Doctor+Appointment%3A+Dr.+Anita+Roy');
    expect(url).not.toContain('%28'); // no specialty parentheses
  });

  it('includes specialty, notes, questions, and place when provided', () => {
    const fullAppt: Appointment = {
      ...baseAppointment,
      specialty: 'Cardiologist',
      place: 'Room 204, City Hospital',
      notes: 'Bring previous ECG reports',
      questions: ['Should I adjust dosage?', 'Can I resume light exercise?'],
    };

    const url = buildGoogleCalendarUrl(fullAppt, 'Asia/Kolkata');
    expect(url).toContain('Dr.+Anita+Roy+%28Cardiologist%29');
    expect(url).toContain('Room+204%2C+City+Hospital');
    expect(url).toContain('Bring+previous+ECG+reports');
    expect(url).toContain('1.+Should+I+adjust+dosage%3F');
    expect(url).toContain('2.+Can+I+resume+light+exercise%3F');
  });

  it('handles questions without notes', () => {
    const appt: Appointment = {
      ...baseAppointment,
      questions: ['Is fasting required?'],
    };
    const url = buildGoogleCalendarUrl(appt);
    expect(url).toContain('Questions+for+Doctor');
    expect(url).toContain('1.+Is+fasting+required%3F');
  });
});
