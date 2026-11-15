/**
 * Adherence calculation: percentage of doses taken (including taken_late)
 * out of all due items, excluding skipped items.
 * Pure function — no I/O.
 */
import type { ScheduleEvent, Slot, EventStatus } from '../../shared/types.js';

export interface AdherenceResult {
  /** (taken + taken_late) ÷ (total − skipped), as 0–100. */
  percentage: number;
  taken: number;
  takenLate: number;
  skipped: number;
  missed: number;
  total: number;
}

const PERCENT_MULTIPLIER = 100;
const PERFECT_PERCENTAGE = 100;

/** Compute adherence across a set of events. */
export function computeAdherence(events: ScheduleEvent[]): AdherenceResult {
  let taken = 0;
  let takenLate = 0;
  let skipped = 0;
  let missed = 0;

  for (const ev of events) {
    switch (ev.status) {
      case 'taken':
        taken++;
        break;
      case 'taken_late':
        takenLate++;
        break;
      case 'skipped':
        skipped++;
        break;
      case 'missed':
        missed++;
        break;
      // 'pending' events are not counted — they haven't resolved yet
    }
  }

  const total = taken + takenLate + skipped + missed;
  const denominator = total - skipped;
  const percentage =
    denominator > 0
      ? Math.round(((taken + takenLate) / denominator) * PERCENT_MULTIPLIER)
      : PERFECT_PERCENTAGE;

  return { percentage, taken, takenLate, skipped, missed, total };
}

/** Compute adherence per medicine (by itemId). */
export function adherenceByMedicine(events: ScheduleEvent[]): Map<string, AdherenceResult> {
  const groups = new Map<string, ScheduleEvent[]>();
  for (const ev of events) {
    if (ev.itemType !== 'medicine') continue;
    const list = groups.get(ev.itemId) ?? [];
    list.push(ev);
    groups.set(ev.itemId, list);
  }

  const result = new Map<string, AdherenceResult>();
  for (const [itemId, evts] of groups) {
    result.set(itemId, computeAdherence(evts));
  }
  return result;
}

/** Compute adherence per slot. */
export function adherenceBySlot(events: ScheduleEvent[]): Map<Slot, AdherenceResult> {
  const groups = new Map<Slot, ScheduleEvent[]>();
  for (const ev of events) {
    const list = groups.get(ev.slot) ?? [];
    list.push(ev);
    groups.set(ev.slot, list);
  }

  const result = new Map<Slot, AdherenceResult>();
  for (const [slot, evts] of groups) {
    result.set(slot, computeAdherence(evts));
  }
  return result;
}

/**
 * Filter events to a date range (inclusive, ISO date strings).
 * Events must have a `date` field in YYYY-MM-DD format.
 */
export function filterEventsByDateRange(
  events: ScheduleEvent[],
  startDate: string,
  endDate: string,
): ScheduleEvent[] {
  return events.filter((ev) => ev.date >= startDate && ev.date <= endDate);
}

/** Filter events by status. */
export function filterEventsByStatus(
  events: ScheduleEvent[],
  statuses: EventStatus[],
): ScheduleEvent[] {
  return events.filter((ev) => statuses.includes(ev.status));
}
