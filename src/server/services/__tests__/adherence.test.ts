/**
 * Unit tests for adherence calculation.
 */
import { describe, it, expect } from 'vitest';
import {
  computeAdherence,
  adherenceByMedicine,
  adherenceBySlot,
  filterEventsByDateRange,
  filterEventsByStatus,
} from '../adherence.js';
import type { ScheduleEvent } from '../../../shared/types.js';

function makeEvent(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'e1',
    circleId: 'c1',
    date: '2025-01-15',
    slot: 'morning',
    itemType: 'medicine',
    itemId: 'med-1',
    status: 'taken',
    at: '2025-01-15T08:30:00Z',
    ...overrides,
  };
}

describe('adherence', () => {
  describe('computeAdherence', () => {
    it('R6: 100% when all taken', () => {
      const events = [makeEvent({ status: 'taken' }), makeEvent({ id: 'e2', status: 'taken' })];
      const result = computeAdherence(events);
      expect(result.percentage).toBe(100);
      expect(result.taken).toBe(2);
    });

    it('R6: 0% when all missed', () => {
      const events = [makeEvent({ status: 'missed' }), makeEvent({ id: 'e2', status: 'missed' })];
      const result = computeAdherence(events);
      expect(result.percentage).toBe(0);
      expect(result.missed).toBe(2);
    });

    it('R6: skipped doses excluded from denominator', () => {
      const events = [
        makeEvent({ status: 'taken' }),
        makeEvent({ id: 'e2', status: 'skipped' }),
        makeEvent({ id: 'e3', status: 'missed' }),
      ];
      const result = computeAdherence(events);
      // taken=1, denominator=total(3)-skipped(1)=2 → 50%
      expect(result.percentage).toBe(50);
      expect(result.skipped).toBe(1);
    });

    it('R6: taken_late counts as taken for adherence', () => {
      const events = [
        makeEvent({ status: 'taken' }),
        makeEvent({ id: 'e2', status: 'taken_late' }),
      ];
      const result = computeAdherence(events);
      expect(result.percentage).toBe(100);
      expect(result.takenLate).toBe(1);
    });

    it('R6: empty events gives 100%', () => {
      const result = computeAdherence([]);
      expect(result.percentage).toBe(100);
    });

    it('R6: pending events are not counted', () => {
      const events = [makeEvent({ status: 'taken' }), makeEvent({ id: 'e2', status: 'pending' })];
      const result = computeAdherence(events);
      expect(result.percentage).toBe(100);
      expect(result.total).toBe(1);
    });
  });

  describe('adherenceByMedicine', () => {
    it('R6: groups by medicine itemId', () => {
      const events = [
        makeEvent({ itemId: 'med-1', status: 'taken' }),
        makeEvent({ id: 'e2', itemId: 'med-1', status: 'missed' }),
        makeEvent({ id: 'e3', itemId: 'med-2', status: 'taken' }),
      ];
      const result = adherenceByMedicine(events);
      expect(result.get('med-1')!.percentage).toBe(50);
      expect(result.get('med-2')!.percentage).toBe(100);
    });
  });

  describe('adherenceBySlot', () => {
    it('R6: groups by slot', () => {
      const events = [
        makeEvent({ slot: 'morning', status: 'taken' }),
        makeEvent({ id: 'e2', slot: 'night', status: 'missed' }),
        makeEvent({ id: 'e3', slot: 'night', status: 'missed' }),
      ];
      const result = adherenceBySlot(events);
      expect(result.get('morning')!.percentage).toBe(100);
      expect(result.get('night')!.percentage).toBe(0);
    });
  });

  describe('filterEventsByDateRange', () => {
    it('R6: filters to date range inclusive', () => {
      const events = [
        makeEvent({ date: '2025-01-13' }),
        makeEvent({ id: 'e2', date: '2025-01-14' }),
        makeEvent({ id: 'e3', date: '2025-01-15' }),
        makeEvent({ id: 'e4', date: '2025-01-16' }),
      ];
      const filtered = filterEventsByDateRange(events, '2025-01-14', '2025-01-15');
      expect(filtered).toHaveLength(2);
    });

    it('R6: filters events by status', () => {
      const events = [makeEvent({ status: 'taken' }), makeEvent({ id: 'e2', status: 'missed' })];
      const filtered = filterEventsByStatus(events, ['missed']);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.status).toBe('missed');
    });
  });
});
