import type { Slot, Anchors } from './types.js';

/** Maps each slot to the anchor field it uses. */
export const SLOT_ANCHOR_MAP: Record<Slot, keyof Anchors> = {
  morning: 'breakfast',
  afternoon: 'lunch',
  evening: 'evening',
  night: 'dinner',
};

/** Ordered list of slots through the day. */
export const SLOTS_IN_ORDER: readonly Slot[] = [
  'morning',
  'afternoon',
  'evening',
  'night',
] as const;

/** Default day anchors (HH:mm). */
export const DEFAULT_ANCHORS: Anchors = {
  breakfast: '08:00',
  lunch: '13:00',
  evening: '18:00',
  dinner: '20:30',
};
