/**
 * Schedule engine: determines dose windows, generates event IDs, computes event statuses.
 * Pure functions — no I/O. Fully unit-tested.
 */
import { DateTime } from 'luxon';
import type {
  Anchors,
  Slot,
  Medicine,
  Routine,
  ScheduleEvent,
  DayOfWeek,
} from '../../shared/types.js';
import { SLOT_ANCHOR_MAP, SLOTS_IN_ORDER } from '../../shared/slots.js';

/** A scheduled item (medicine or routine) for a particular slot. */
export interface ScheduleItem {
  id: string;
  type: 'medicine' | 'routine';
  name: string;
  slot: Slot;
  medicine?: Medicine;
  routine?: Routine;
}

/** A dose window with start and end DateTimes. */
export interface DoseWindow {
  slot: Slot;
  anchorTime: DateTime;
  windowStart: DateTime;
  windowEnd: DateTime;
}

/** Convert a luxon weekday (1=Mon) to our DayOfWeek enum. */
const WEEKDAY_MAP: Record<number, DayOfWeek> = {
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
  7: 'sun',
};

/** Build the dose window for a slot on a given date. */
export function getDoseWindow(
  date: string,
  slot: Slot,
  anchors: Anchors,
  timezone: string,
  windowBeforeMin: number,
  windowAfterMin: number,
): DoseWindow {
  const anchorKey = SLOT_ANCHOR_MAP[slot];
  const [hours, minutes] = anchors[anchorKey].split(':').map(Number);
  const anchorTime = DateTime.fromISO(date, { zone: timezone }).set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });

  return {
    slot,
    anchorTime,
    windowStart: anchorTime.minus({ minutes: windowBeforeMin }),
    windowEnd: anchorTime.plus({ minutes: windowAfterMin }),
  };
}

/** Generate a deterministic event ID: {date}_{slot}_{itemType}_{itemId}. */
export function makeEventId(
  date: string,
  slot: Slot,
  itemType: 'medicine' | 'routine',
  itemId: string,
): string {
  return `${date}_${slot}_${itemType}_${itemId}`;
}

/**
 * Determine the current slot for a given time and circle anchors.
 * Returns the slot whose window is currently open, or null if between windows.
 */
export function getCurrentSlot(
  now: DateTime,
  anchors: Anchors,
  timezone: string,
  windowBeforeMin: number,
  windowAfterMin: number,
): Slot | null {
  const dateStr = now.setZone(timezone).toISODate();
  if (!dateStr) return null;

  for (const slot of SLOTS_IN_ORDER) {
    const window = getDoseWindow(dateStr, slot, anchors, timezone, windowBeforeMin, windowAfterMin);
    if (now >= window.windowStart && now <= window.windowEnd) {
      return slot;
    }
  }
  return null;
}

/**
 * Find the next upcoming slot for a given time.
 * Returns the next slot whose window hasn't closed yet.
 */
export function getNextSlot(
  now: DateTime,
  anchors: Anchors,
  timezone: string,
  windowBeforeMin: number,
  windowAfterMin: number,
): Slot | null {
  const dateStr = now.setZone(timezone).toISODate();
  if (!dateStr) return null;

  for (const slot of SLOTS_IN_ORDER) {
    const window = getDoseWindow(dateStr, slot, anchors, timezone, windowBeforeMin, windowAfterMin);
    if (now < window.windowEnd) {
      return slot;
    }
  }
  return null;
}

/** Check whether an item is scheduled for a particular day of the week. */
export function isScheduledForDay(
  daysOfWeek: DayOfWeek[],
  date: string,
  timezone: string,
): boolean {
  const dt = DateTime.fromISO(date, { zone: timezone });
  const dayOfWeek = WEEKDAY_MAP[dt.weekday];
  if (!dayOfWeek) return false;
  return daysOfWeek.includes(dayOfWeek);
}

/**
 * Build the list of schedule items for a given date and slot.
 * Filters by active status and day of week.
 */
export function getItemsForSlot(
  date: string,
  slot: Slot,
  medicines: Medicine[],
  routines: Routine[],
  timezone: string,
): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  for (const med of medicines) {
    if (med.status !== 'active') continue;
    if (!med.slots.includes(slot)) continue;
    if (!isScheduledForDay(med.daysOfWeek, date, timezone)) continue;
    items.push({
      id: med.id,
      type: 'medicine',
      name: med.name,
      slot,
      medicine: med,
    });
  }

  for (const routine of routines) {
    if (routine.status !== 'active') continue;
    if (routine.slot !== slot) continue;
    if (!isScheduledForDay(routine.daysOfWeek, date, timezone)) continue;
    items.push({
      id: routine.id,
      type: 'routine',
      name: routine.label,
      slot,
      routine,
    });
  }

  return items;
}

/**
 * Determine the final status of an event based on the current time and the dose window.
 * - If an event was recorded as taken after the window closed → taken_late.
 * - If the window has closed and no event was recorded → missed.
 */
export function resolveEventStatus(
  event: ScheduleEvent | undefined,
  now: DateTime,
  window: DoseWindow,
): ScheduleEvent['status'] {
  if (!event) {
    return now > window.windowEnd ? 'missed' : 'pending';
  }

  if (event.status === 'taken') {
    const takenAt = DateTime.fromISO(event.at);
    if (takenAt > window.windowEnd) return 'taken_late';
    return 'taken';
  }

  return event.status;
}

/**
 * Build today's full schedule: all slots with their items and current statuses.
 */
export function buildDaySchedule(
  date: string,
  medicines: Medicine[],
  routines: Routine[],
  events: ScheduleEvent[],
  anchors: Anchors,
  timezone: string,
  windowBeforeMin: number,
  windowAfterMin: number,
  now: DateTime,
): Array<{
  slot: Slot;
  window: DoseWindow;
  items: Array<ScheduleItem & { status: ScheduleEvent['status']; event?: ScheduleEvent }>;
}> {
  const eventMap = new Map<string, ScheduleEvent>();
  for (const ev of events) {
    eventMap.set(ev.id, ev);
  }

  return SLOTS_IN_ORDER.map((slot) => {
    const window = getDoseWindow(date, slot, anchors, timezone, windowBeforeMin, windowAfterMin);
    const items = getItemsForSlot(date, slot, medicines, routines, timezone);

    const itemsWithStatus = items.map((item) => {
      const eventId = makeEventId(date, slot, item.type, item.id);
      const event = eventMap.get(eventId);
      const status = resolveEventStatus(event, now, window);
      return { ...item, status, event };
    });

    return { slot, window, items: itemsWithStatus };
  });
}
