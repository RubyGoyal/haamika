/**
 * Proactive Reminder Engine (R7, SPEC §4.6).
 * Pure function: given circle, members, medicines, events, appointments, and "now",
 * calculates all emails due with dual-timezone formatting and memberId-scoped dedupe keys.
 */
import { DateTime } from 'luxon';
import type {
  Circle,
  Member,
  Medicine,
  ScheduleEvent,
  Appointment,
  Slot,
} from '../../shared/types.js';
import { buildAppointmentReminders } from './appointmentReminders.js';

export interface DueReminder {
  circleId: string;
  kind:
    | 'dose_upcoming'
    | 'dose_missed'
    | 'dose_missed_escalation'
    | 'appointment_upcoming'
    | 'refill_low'
    | 'sos';
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

const DEFAULT_WINDOW_BEFORE_MIN = 30;
const DEFAULT_WINDOW_AFTER_MIN = 120;
const DEFAULT_ESCALATION_AFTER_MIN = 60;
const UPCOMING_LEAD_MINUTES = 15;
const DEFAULT_REFILL_THRESHOLD = 5;

/**
 * Format time in dual timezones if recipient's timezone differs from the circle's.
 */
export function formatDualTime(dt: DateTime, circleTz: string, recipientTz?: string): string {
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

const ANCHOR_FOR_SLOT: Record<Slot, keyof Circle['anchors']> = {
  morning: 'breakfast',
  afternoon: 'lunch',
  evening: 'evening',
  night: 'dinner',
};

interface SlotReminderContext {
  circle: Circle;
  slot: Slot;
  todayStr: string;
  medNames: string;
  anchorDt: DateTime;
  elderTz: string;
  activeMembers: Member[];
}

function buildUpcomingReminders(ctx: SlotReminderContext): DueReminder[] {
  const { circle, slot, todayStr, medNames, anchorDt, elderTz, activeMembers } = ctx;
  const reminders: DueReminder[] = [];
  for (const m of activeMembers) {
    if (!m.email) continue;
    const wantsUpcoming = m.notify?.upcoming ?? m.role === 'caretaker';
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
  return reminders;
}

function buildMissedReminders(ctx: SlotReminderContext): DueReminder[] {
  const { circle, slot, todayStr, medNames, anchorDt, elderTz, activeMembers } = ctx;
  const reminders: DueReminder[] = [];
  for (const m of activeMembers) {
    if (!m.email) continue;
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
  return reminders;
}

function buildEscalationReminders(ctx: SlotReminderContext): DueReminder[] {
  const { circle, slot, todayStr, medNames, anchorDt, elderTz, activeMembers } = ctx;
  const reminders: DueReminder[] = [];
  for (const m of activeMembers) {
    if (!m.email || m.role !== 'family') continue;

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
  return reminders;
}

function buildRefillReminders(
  medicines: Medicine[],
  circle: Circle,
  activeMembers: Member[],
  todayStr: string,
): DueReminder[] {
  const reminders: DueReminder[] = [];
  for (const med of medicines) {
    if (med.status !== 'active') continue;
    const threshold = med.refillThreshold ?? DEFAULT_REFILL_THRESHOLD;
    const isLowStock = med.stockCount !== undefined && med.stockCount <= threshold;
    if (!isLowStock) continue;

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
  return reminders;
}

function areAllMedsResolved(slotMeds: Medicine[], slotEvents: ScheduleEvent[]): boolean {
  return slotMeds.every((m) =>
    slotEvents.some(
      (e) =>
        e.itemId === m.id &&
        (e.status === 'taken' || e.status === 'taken_late' || e.status === 'skipped'),
    ),
  );
}

interface ProcessSlotParams {
  slot: Slot;
  circle: Circle;
  nowInElderTz: DateTime;
  todayStr: string;
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  medicines: Medicine[];
  events: ScheduleEvent[];
  elderTz: string;
  activeMembers: Member[];
}

function checkSlotStageReminders(
  slotCtx: SlotReminderContext,
  nowInElderTz: DateTime,
  windowStartDt: DateTime,
  anchorDt: DateTime,
  windowEndDt: DateTime,
  escalationDt: DateTime,
): DueReminder[] {
  const results: DueReminder[] = [];
  if (
    nowInElderTz >= windowStartDt &&
    nowInElderTz < anchorDt.plus({ minutes: UPCOMING_LEAD_MINUTES })
  ) {
    results.push(...buildUpcomingReminders(slotCtx));
  }
  if (nowInElderTz >= windowEndDt && nowInElderTz < escalationDt) {
    results.push(...buildMissedReminders(slotCtx));
  }
  if (nowInElderTz >= escalationDt) {
    results.push(...buildEscalationReminders(slotCtx));
  }
  return results;
}

function processSlot(params: ProcessSlotParams): DueReminder[] {
  const {
    slot,
    circle,
    nowInElderTz,
    todayStr,
    weekday,
    medicines,
    events,
    elderTz,
    activeMembers,
  } = params;
  const anchorTimeStr = circle.anchors[ANCHOR_FOR_SLOT[slot]];
  if (!anchorTimeStr) return [];

  const [hour, min] = anchorTimeStr.split(':').map(Number);
  const anchorDt = nowInElderTz.set({ hour, minute: min, second: 0, millisecond: 0 });
  const windowStartDt = anchorDt.minus({
    minutes: circle.windowBeforeMin ?? DEFAULT_WINDOW_BEFORE_MIN,
  });
  const windowEndDt = anchorDt.plus({ minutes: circle.windowAfterMin ?? DEFAULT_WINDOW_AFTER_MIN });
  const escalationDt = windowEndDt.plus({
    minutes: circle.escalationAfterMin ?? DEFAULT_ESCALATION_AFTER_MIN,
  });

  const slotMeds = medicines.filter(
    (m) =>
      m.status === 'active' &&
      m.slots.includes(slot) &&
      (!m.daysOfWeek || m.daysOfWeek.includes(weekday)),
  );
  if (slotMeds.length === 0) return [];

  const slotEvents = events.filter(
    (e) => e.date === todayStr && e.slot === slot && e.itemType === 'medicine',
  );
  if (areAllMedsResolved(slotMeds, slotEvents)) return [];

  const medNames = slotMeds.map((m) => m.name).join(', ');
  const slotCtx: SlotReminderContext = {
    circle,
    slot,
    todayStr,
    medNames,
    anchorDt,
    elderTz,
    activeMembers,
  };

  return checkSlotStageReminders(
    slotCtx,
    nowInElderTz,
    windowStartDt,
    anchorDt,
    windowEndDt,
    escalationDt,
  );
}

export function computeDueReminders(ctx: ReminderEngineContext): DueReminder[] {
  const { circle, members, medicines, events, appointments, now } = ctx;
  const reminders: DueReminder[] = [];

  const elderTz = circle.timezone || 'Asia/Kolkata';
  const nowInElderTz = now.setZone(elderTz);
  const todayStr = nowInElderTz.toFormat('yyyy-LL-dd');
  const weekday = nowInElderTz.toFormat('ccc').toLowerCase() as
    'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

  const activeMembers = members.filter((m) => !m.removedAt);
  const slots: Slot[] = ['morning', 'afternoon', 'evening', 'night'];

  for (const slot of slots) {
    reminders.push(
      ...processSlot({
        slot,
        circle,
        nowInElderTz,
        todayStr,
        weekday,
        medicines,
        events,
        elderTz,
        activeMembers,
      }),
    );
  }

  reminders.push(
    ...buildAppointmentReminders(appointments, now, circle, activeMembers, elderTz, todayStr),
    ...buildRefillReminders(medicines, circle, activeMembers, todayStr),
  );

  return reminders;
}
