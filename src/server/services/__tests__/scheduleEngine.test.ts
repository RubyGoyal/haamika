/**
 * Unit tests for the schedule engine.
 * Covers: dose windows, event statuses, taken_late/missed, days of week, timezones.
 */
import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  getDoseWindow,
  makeEventId,
  getCurrentSlot,
  getNextSlot,
  isScheduledForDay,
  getItemsForSlot,
  resolveEventStatus,
  buildDaySchedule,
} from '../scheduleEngine.js';
import type { Anchors, Medicine, Routine, ScheduleEvent } from '../../../shared/types.js';

const ANCHORS: Anchors = {
  breakfast: '08:00',
  lunch: '13:00',
  evening: '18:00',
  dinner: '20:30',
};
const TZ = 'Asia/Kolkata';
const BEFORE = 30;
const AFTER = 120;

describe('scheduleEngine', () => {
  describe('getDoseWindow', () => {
    it('R1: morning window is anchor−30min to anchor+120min', () => {
      const w = getDoseWindow('2025-01-15', 'morning', ANCHORS, TZ, BEFORE, AFTER);
      expect(w.anchorTime.toFormat('HH:mm')).toBe('08:00');
      expect(w.windowStart.toFormat('HH:mm')).toBe('07:30');
      expect(w.windowEnd.toFormat('HH:mm')).toBe('10:00');
    });

    it('R1: night window uses dinner anchor', () => {
      const w = getDoseWindow('2025-01-15', 'night', ANCHORS, TZ, BEFORE, AFTER);
      expect(w.anchorTime.toFormat('HH:mm')).toBe('20:30');
      expect(w.windowStart.toFormat('HH:mm')).toBe('20:00');
      expect(w.windowEnd.toFormat('HH:mm')).toBe('22:30');
    });
  });

  describe('makeEventId', () => {
    it('R6: deterministic event IDs', () => {
      const id = makeEventId('2025-01-15', 'morning', 'medicine', 'med-1');
      expect(id).toBe('2025-01-15_morning_medicine_med-1');
    });
  });

  describe('getCurrentSlot', () => {
    it('R1: returns morning slot during morning window', () => {
      const now = DateTime.fromISO('2025-01-15T08:30:00', { zone: TZ });
      expect(getCurrentSlot(now, ANCHORS, TZ, BEFORE, AFTER)).toBe('morning');
    });

    it('R1: returns null between windows', () => {
      const now = DateTime.fromISO('2025-01-15T11:00:00', { zone: TZ });
      expect(getCurrentSlot(now, ANCHORS, TZ, BEFORE, AFTER)).toBeNull();
    });

    it('R1: respects timezone for IST', () => {
      // 08:30 IST = 03:00 UTC
      const now = DateTime.fromISO('2025-01-15T03:00:00', { zone: 'UTC' }).setZone(TZ);
      expect(getCurrentSlot(now, ANCHORS, TZ, BEFORE, AFTER)).toBe('morning');
    });
  });

  describe('getNextSlot', () => {
    it('R1: returns afternoon when morning window has closed', () => {
      const now = DateTime.fromISO('2025-01-15T11:00:00', { zone: TZ });
      expect(getNextSlot(now, ANCHORS, TZ, BEFORE, AFTER)).toBe('afternoon');
    });

    it('R1: returns null after all windows close', () => {
      const now = DateTime.fromISO('2025-01-15T23:00:00', { zone: TZ });
      expect(getNextSlot(now, ANCHORS, TZ, BEFORE, AFTER)).toBeNull();
    });
  });

  describe('isScheduledForDay', () => {
    it('R1: returns true for a scheduled day', () => {
      expect(isScheduledForDay(['mon', 'wed', 'fri'], '2025-01-15', TZ)).toBe(true); // Wed
    });

    it('R1: returns false for an unscheduled day', () => {
      expect(isScheduledForDay(['mon', 'wed', 'fri'], '2025-01-16', TZ)).toBe(false); // Thu
    });
  });

  describe('getItemsForSlot', () => {
    const med: Medicine = {
      id: 'med-1',
      circleId: 'c1',
      name: 'Amlodipine',
      pillColor: 'white',
      pillShape: 'round',
      foodInstruction: 'after_food',
      slots: ['morning'],
      dosePerSlot: 1,
      daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
    };

    const routine: Routine = {
      id: 'r-1',
      circleId: 'c1',
      type: 'bp_check',
      label: 'BP Check',
      slot: 'morning',
      daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      needsReading: true,
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
    };

    it('R1: includes active medicines and routines for the slot', () => {
      const items = getItemsForSlot('2025-01-15', 'morning', [med], [routine], TZ);
      expect(items).toHaveLength(2);
      expect(items[0]!.type).toBe('medicine');
      expect(items[1]!.type).toBe('routine');
    });

    it('R1: excludes proposed medicines', () => {
      const proposed = { ...med, status: 'proposed' as const };
      const items = getItemsForSlot('2025-01-15', 'morning', [proposed], [], TZ);
      expect(items).toHaveLength(0);
    });

    it('R1: excludes inactive routines or routines on other days', () => {
      const inactiveRoutine: Routine = { ...routine, status: 'stopped' as const };
      const otherDayRoutine: Routine = { ...routine, daysOfWeek: ['mon'] }; // Wed is 2025-01-15
      const medOtherDay: Medicine = { ...med, daysOfWeek: ['mon'] };
      const items = getItemsForSlot(
        '2025-01-15',
        'morning',
        [medOtherDay],
        [inactiveRoutine, otherDayRoutine],
        TZ,
      );
      expect(items).toHaveLength(0);
    });

    it('R1: excludes items not scheduled for the slot', () => {
      const items = getItemsForSlot('2025-01-15', 'evening', [med], [routine], TZ);
      expect(items).toHaveLength(0);
    });
  });

  describe('resolveEventStatus', () => {
    const window = getDoseWindow('2025-01-15', 'morning', ANCHORS, TZ, BEFORE, AFTER);

    it('R6: pending when window is still open and no event', () => {
      const now = DateTime.fromISO('2025-01-15T08:30:00', { zone: TZ });
      expect(resolveEventStatus(undefined, now, window)).toBe('pending');
    });

    it('R6: missed when window closed and no event', () => {
      const now = DateTime.fromISO('2025-01-15T11:00:00', { zone: TZ });
      expect(resolveEventStatus(undefined, now, window)).toBe('missed');
    });

    it('R6: taken when taken within window', () => {
      const event: ScheduleEvent = {
        id: 'e1',
        circleId: 'c1',
        date: '2025-01-15',
        slot: 'morning',
        itemType: 'medicine',
        itemId: 'med-1',
        status: 'taken',
        at: '2025-01-15T08:45:00+05:30',
      };
      const now = DateTime.fromISO('2025-01-15T09:00:00', { zone: TZ });
      expect(resolveEventStatus(event, now, window)).toBe('taken');
    });

    it('R6: taken_late when taken after window closed', () => {
      const event: ScheduleEvent = {
        id: 'e1',
        circleId: 'c1',
        date: '2025-01-15',
        slot: 'morning',
        itemType: 'medicine',
        itemId: 'med-1',
        status: 'taken',
        at: '2025-01-15T11:30:00+05:30',
      };
      const now = DateTime.fromISO('2025-01-15T12:00:00', { zone: TZ });
      expect(resolveEventStatus(event, now, window)).toBe('taken_late');
    });

    it('R6: skipped preserves skipped status', () => {
      const event: ScheduleEvent = {
        id: 'e1',
        circleId: 'c1',
        date: '2025-01-15',
        slot: 'morning',
        itemType: 'medicine',
        itemId: 'med-1',
        status: 'skipped',
        reason: 'Felt unwell',
        at: '2025-01-15T08:30:00+05:30',
      };
      const now = DateTime.fromISO('2025-01-15T12:00:00', { zone: TZ });
      expect(resolveEventStatus(event, now, window)).toBe('skipped');
    });
  });

  describe('buildDaySchedule', () => {
    it('R6: builds complete day schedule with statuses', () => {
      const med: Medicine = {
        id: 'med-1',
        circleId: 'c1',
        name: 'Amlodipine',
        pillColor: 'white',
        pillShape: 'round',
        foodInstruction: 'after_food',
        slots: ['morning', 'night'],
        dosePerSlot: 1,
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
      };

      const events: ScheduleEvent[] = [
        {
          id: '2025-01-15_morning_medicine_med-1',
          circleId: 'c1',
          date: '2025-01-15',
          slot: 'morning',
          itemType: 'medicine',
          itemId: 'med-1',
          status: 'taken',
          at: '2025-01-15T08:30:00+05:30',
        },
      ];

      const now = DateTime.fromISO('2025-01-15T21:00:00', { zone: TZ });
      const schedule = buildDaySchedule(
        '2025-01-15',
        [med],
        [],
        events,
        ANCHORS,
        TZ,
        BEFORE,
        AFTER,
        now,
      );

      expect(schedule).toHaveLength(4);
      const morning = schedule.find((s) => s.slot === 'morning')!;
      expect(morning.items).toHaveLength(1);
      expect(morning.items[0]!.status).toBe('taken');

      const night = schedule.find((s) => s.slot === 'night')!;
      expect(night.items).toHaveLength(1);
      expect(night.items[0]!.status).toBe('pending'); // window still open at 21:00
    });
  });
});
