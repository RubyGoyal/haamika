/**
 * Unit tests for pattern insights detection.
 */
import { describe, it, expect } from 'vitest';
import { detectInsights } from '../insights.js';
import type { ScheduleEvent, Anchors } from '../../../shared/types.js';

const ANCHORS: Anchors = {
  breakfast: '08:00',
  lunch: '13:00',
  evening: '18:00',
  dinner: '20:30',
};

function missedEvent(slot: string, itemId: string, date: string): ScheduleEvent {
  return {
    id: `${date}_${slot}_medicine_${itemId}`,
    circleId: 'c1',
    date,
    slot: slot as ScheduleEvent['slot'],
    itemType: 'medicine',
    itemId,
    status: 'missed',
    at: `${date}T23:59:00Z`,
  };
}

describe('insights', () => {
  it('R6: detects slot with ≥3 misses in 7 days', () => {
    const events = [
      missedEvent('night', 'med-1', '2025-01-10'),
      missedEvent('night', 'med-1', '2025-01-11'),
      missedEvent('night', 'med-1', '2025-01-12'),
    ];
    const names = new Map([['med-1', 'Metformin']]);
    const insights = detectInsights(events, names, ANCHORS);

    const slotInsight = insights.find((i) => i.type === 'slot_missed');
    expect(slotInsight).toBeDefined();
    expect(slotInsight!.slot).toBe('night');
    expect(slotInsight!.missCount).toBe(3);
    expect(slotInsight!.message).toContain('Night');
  });

  it('R6: detects medicine with ≥3 misses', () => {
    const events = [
      missedEvent('morning', 'med-1', '2025-01-10'),
      missedEvent('night', 'med-1', '2025-01-11'),
      missedEvent('morning', 'med-1', '2025-01-12'),
    ];
    const names = new Map([['med-1', 'Metformin']]);
    const insights = detectInsights(events, names, ANCHORS);

    const medInsight = insights.find((i) => i.type === 'medicine_missed');
    expect(medInsight).toBeDefined();
    expect(medInsight!.medicineName).toBe('Metformin');
  });

  it('R6: no insight when misses < 3', () => {
    const events = [
      missedEvent('night', 'med-1', '2025-01-10'),
      missedEvent('night', 'med-1', '2025-01-11'),
    ];
    const names = new Map([['med-1', 'Metformin']]);
    const insights = detectInsights(events, names, ANCHORS);
    expect(insights).toHaveLength(0);
  });

  it('R6: suggestion mentions moving dose time earlier', () => {
    const events = [
      missedEvent('night', 'med-1', '2025-01-10'),
      missedEvent('night', 'med-1', '2025-01-11'),
      missedEvent('night', 'med-1', '2025-01-12'),
    ];
    const names = new Map([['med-1', 'Metformin']]);
    const insights = detectInsights(events, names, ANCHORS);
    const slotInsight = insights.find((i) => i.type === 'slot_missed');
    expect(slotInsight!.suggestion).toContain('earlier');
  });
});
