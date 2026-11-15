/**
 * Pattern insights: detects recurring problems in adherence data
 * and generates actionable suggestions.
 * Pure function — no I/O. (SPEC §4.5)
 */
import type { ScheduleEvent, Slot, Anchors } from '../../shared/types.js';
import { SLOTS_IN_ORDER } from '../../shared/slots.js';

export interface Insight {
  type: 'slot_missed' | 'medicine_missed' | 'low_adherence';
  slot?: Slot;
  medicineId?: string;
  medicineName?: string;
  missCount: number;
  message: string;
  suggestion: string;
}

const MISS_THRESHOLD_7D = 3;

function buildSlotInsights(slotMisses: Map<Slot, number>): Insight[] {
  const insights: Insight[] = [];
  for (const [slot, count] of slotMisses) {
    if (count >= MISS_THRESHOLD_7D) {
      const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
      insights.push({
        type: 'slot_missed',
        slot,
        missCount: count,
        message: `${slotLabel} doses are often missed (${count} times in the last 7 days).`,
        suggestion: `Consider moving the ${slot} dose time 30 minutes earlier.`,
      });
    }
  }
  return insights;
}

function buildMedicineInsights(
  medicineMisses: Map<string, number>,
  medicineNames: Map<string, string>,
): Insight[] {
  const insights: Insight[] = [];
  for (const [medId, count] of medicineMisses) {
    if (count >= MISS_THRESHOLD_7D) {
      const name = medicineNames.get(medId) ?? 'a medicine';
      insights.push({
        type: 'medicine_missed',
        medicineId: medId,
        medicineName: name,
        missCount: count,
        message: `${name} is often missed (${count} times in the last 7 days).`,
        suggestion: `Check if the timing or form works for the elder.`,
      });
    }
  }
  return insights;
}

/**
 * Analyse the last 7 days of events and return pattern insights.
 * A slot with ≥ 3 misses in the last 7 days triggers an insight.
 */
export function detectInsights(
  events: ScheduleEvent[],
  medicineNames: Map<string, string>,
  _anchors: Anchors,
): Insight[] {
  // Count misses per slot
  const slotMisses = new Map<Slot, number>();
  for (const slot of SLOTS_IN_ORDER) {
    slotMisses.set(slot, 0);
  }

  // Count misses per medicine
  const medicineMisses = new Map<string, number>();

  for (const ev of events) {
    if (ev.status === 'missed') {
      const current = slotMisses.get(ev.slot) ?? 0;
      slotMisses.set(ev.slot, current + 1);

      if (ev.itemType === 'medicine') {
        const medCurrent = medicineMisses.get(ev.itemId) ?? 0;
        medicineMisses.set(ev.itemId, medCurrent + 1);
      }
    }
  }

  return [
    ...buildSlotInsights(slotMisses),
    ...buildMedicineInsights(medicineMisses, medicineNames),
  ];
}
