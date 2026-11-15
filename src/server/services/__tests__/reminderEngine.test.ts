/**
 * Unit tests for reminderEngine (R7).
 * Tests timing, escalation, dedupe key formatting with memberId,
 * appointment reminders (24h, 2h), low refill alerts, and dual timezone formatting.
 */
import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { computeDueReminders, formatDualTime } from '../reminderEngine.js';
import type { Circle, Member, Medicine, ScheduleEvent, Appointment } from '../../../shared/types.js';

const mockCircle: Circle = {
  id: 'circle-101',
  elderName: 'Kamla Devi',
  preferredName: 'Amma',
  language: 'hi',
  timezone: 'Asia/Kolkata',
  anchors: {
    breakfast: '08:00',
    lunch: '13:00',
    evening: '18:00',
    dinner: '20:30',
  },
  windowBeforeMin: 30,
  windowAfterMin: 120,
  escalationAfterMin: 60,
  circleCodeHash: 'dummy',
  createdAt: '2026-01-01T00:00:00Z',
};

const elderMember: Member = {
  id: 'mem-elder',
  circleId: 'circle-101',
  name: 'Kamla Devi',
  role: 'elder',
  email: 'kamla@example.com',
  timezone: 'Asia/Kolkata',
  pinHash: 'x',
  pinSalt: 'y',
  failedAttempts: 0,
  isOrganizer: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const caretakerMember: Member = {
  id: 'mem-caretaker',
  circleId: 'circle-101',
  name: 'Sunita',
  role: 'caretaker',
  email: 'sunita@example.com',
  timezone: 'Asia/Kolkata',
  pinHash: 'x',
  pinSalt: 'y',
  failedAttempts: 0,
  isOrganizer: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const familyMember: Member = {
  id: 'mem-family',
  circleId: 'circle-101',
  name: 'Rohan',
  role: 'family',
  email: 'rohan@example.com',
  timezone: 'America/Toronto',
  pinHash: 'x',
  pinSalt: 'y',
  failedAttempts: 0,
  isOrganizer: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const testMedicine: Medicine = {
  id: 'med-bp',
  circleId: 'circle-101',
  name: 'Amlodipine',
  pillColor: 'white',
  pillShape: 'round',
  foodInstruction: 'after_food',
  slots: ['morning'],
  daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  status: 'active',
  stockCount: 20,
  refillThreshold: 5,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Reminder Engine (R7)', () => {
  it('R7: triggers dose_upcoming at window start (anchor - 30 min)', () => {
    // 07:45 Asia/Kolkata is 15 min before 08:00 anchor
    const now = DateTime.fromISO('2026-11-15T07:45:00', { zone: 'Asia/Kolkata' });
    const reminders = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [testMedicine],
      events: [],
      appointments: [],
      now,
    });

    const upcoming = reminders.filter((r) => r.kind === 'dose_upcoming');
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming[0].to).toBe('sunita@example.com');
    expect(upcoming[0].dedupeKey).toBe('circle-101:dose_upcoming:morning:2026-11-15:start:mem-caretaker');
  });

  it('R7: caretaker and elder both receive dose_missed when dose window closes (Correction 1)', () => {
    // 08:00 + 120 min = 10:00. At 10:15, window has closed without doses taken
    const now = DateTime.fromISO('2026-11-15T10:15:00', { zone: 'Asia/Kolkata' });
    const reminders = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [testMedicine],
      events: [],
      appointments: [],
      now,
    });

    const missed = reminders.filter((r) => r.kind === 'dose_missed');
    // Both caretaker and elder should receive an email
    expect(missed.length).toBe(2);

    const caretakerReminder = missed.find((r) => r.recipientId === 'mem-caretaker');
    const elderReminder = missed.find((r) => r.recipientId === 'mem-elder');

    expect(caretakerReminder).toBeDefined();
    expect(caretakerReminder!.to).toBe('sunita@example.com');
    expect(caretakerReminder!.dedupeKey).toBe('circle-101:dose_missed:morning:2026-11-15:close:mem-caretaker');

    expect(elderReminder).toBeDefined();
    expect(elderReminder!.to).toBe('kamla@example.com');
    expect(elderReminder!.dedupeKey).toBe('circle-101:dose_missed:morning:2026-11-15:close:mem-elder');
  });

  it('R7: family receives dose_missed_escalation 60 min after window closes', () => {
    // 08:00 + 120 min window + 60 min escalation = 11:00. At 11:05, escalation is due
    const now = DateTime.fromISO('2026-11-15T11:05:00', { zone: 'Asia/Kolkata' });
    const reminders = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [testMedicine],
      events: [],
      appointments: [],
      now,
    });

    const escalations = reminders.filter((r) => r.kind === 'dose_missed_escalation');
    expect(escalations.length).toBe(1);
    expect(escalations[0].to).toBe('rohan@example.com');
    expect(escalations[0].recipientRole).toBe('family');
    expect(escalations[0].dedupeKey).toBe('circle-101:dose_missed_escalation:morning:2026-11-15:escalation:mem-family');
  });

  it('R7: does not send reminder if doses are marked as taken', () => {
    const now = DateTime.fromISO('2026-11-15T10:15:00', { zone: 'Asia/Kolkata' });
    const takenEvent: ScheduleEvent = {
      id: '2026-11-15_morning_medicine_med-bp',
      circleId: 'circle-101',
      date: '2026-11-15',
      slot: 'morning',
      itemType: 'medicine',
      itemId: 'med-bp',
      status: 'taken',
      at: '2026-11-15T08:10:00Z',
    };

    const reminders = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [testMedicine],
      events: [takenEvent],
      appointments: [],
      now,
    });

    const doseReminders = reminders.filter((r) => r.kind.startsWith('dose_'));
    expect(doseReminders.length).toBe(0);
  });

  it('R2, R7: sends appointment_upcoming 24h and 2h before', () => {
    const appt: Appointment = {
      id: 'appt-cardio',
      circleId: 'circle-101',
      doctorName: 'Dr. Mehta',
      startsAt: '2026-11-16T10:00:00+05:30',
      questions: [],
      status: 'upcoming',
      createdAt: '2026-11-15T00:00:00Z',
    };

    // Exactly 24h before: 2026-11-15T10:00:00+05:30
    const now24h = DateTime.fromISO('2026-11-15T10:00:00', { zone: 'Asia/Kolkata' });
    const rem24h = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [],
      events: [],
      appointments: [appt],
      now: now24h,
    });

    const apptRem24h = rem24h.filter((r) => r.kind === 'appointment_upcoming');
    expect(apptRem24h.length).toBe(3); // elder, caretaker, family
    expect(apptRem24h[0].stage).toBe('24h');

    // 2h before: 2026-11-16T08:00:00+05:30
    const now2h = DateTime.fromISO('2026-11-16T08:00:00', { zone: 'Asia/Kolkata' });
    const rem2h = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [],
      events: [],
      appointments: [appt],
      now: now2h,
    });

    const apptRem2h = rem2h.filter((r) => r.kind === 'appointment_upcoming');
    expect(apptRem2h.length).toBe(3);
    expect(apptRem2h[0].stage).toBe('2h');
  });

  it('R1, R7: alerts family when medicine stock is low (refill_low)', () => {
    const lowStockMed: Medicine = {
      ...testMedicine,
      id: 'med-low',
      stockCount: 3,
      refillThreshold: 5,
    };

    const now = DateTime.fromISO('2026-11-15T12:00:00', { zone: 'Asia/Kolkata' });
    const reminders = computeDueReminders({
      circle: mockCircle,
      members: [elderMember, caretakerMember, familyMember],
      medicines: [lowStockMed],
      events: [],
      appointments: [],
      now,
    });

    const refills = reminders.filter((r) => r.kind === 'refill_low');
    expect(refills.length).toBe(1);
    expect(refills[0].to).toBe('rohan@example.com');
    expect(refills[0].body).toContain('Remaining stock: 3 doses');
    expect(refills[0].dedupeKey).toBe('circle-101:refill_low:med-low:2026-11-15:refill:mem-family');
  });

  it('R7: formats dual timezones when recipient timezone is different', () => {
    const dt = DateTime.fromISO('2026-11-15T08:00:00', { zone: 'Asia/Kolkata' });
    const formatted = formatDualTime(dt, 'Asia/Kolkata', 'America/Toronto');
    expect(formatted).toContain('08:00 AM');
    expect(formatted).toContain('EST');
    expect(formatted).toContain('in your local time');
  });
});
