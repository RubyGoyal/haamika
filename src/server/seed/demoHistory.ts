import type { DateTime } from 'luxon';
import type { Repository } from '../repositories/repository.js';
import { makeEventId } from '../services/scheduleEngine.js';
import type { ScheduleEvent } from '../../shared/types.js';

const TOTAL_HISTORY_DAYS = 14;
const MORNING_HOUR = 8;
const MORNING_MINUTE = 45;
const EVENING_HOUR = 18;
const EVENING_MINUTE = 30;
const NIGHT_HOUR = 21;
const NIGHT_MINUTE = 15;
const WALK_SKIP_MODULO = 4;
const INSIGHT_LOOKBACK_DAYS = 7;

async function seedMorning(
  repo: Repository,
  circleId: string,
  elderId: string,
  day: DateTime,
  dateStr: string,
): Promise<void> {
  const morningItems = [
    { id: 'med-amlodipine', type: 'medicine' as const },
    { id: 'med-metformin', type: 'medicine' as const },
    { id: 'med-pantoprazole', type: 'medicine' as const },
    { id: 'routine-bp', type: 'routine' as const },
  ];
  for (const item of morningItems) {
    const event: ScheduleEvent = {
      id: makeEventId(dateStr, 'morning', item.type, item.id),
      circleId,
      date: dateStr,
      slot: 'morning',
      itemType: item.type,
      itemId: item.id,
      status: 'taken',
      actorId: elderId,
      reading: item.id === 'routine-bp' ? '135/85' : undefined,
      at: day.set({ hour: MORNING_HOUR, minute: MORNING_MINUTE }).toISO()!,
    };
    await repo.createOrUpdateEvent(circleId, event);
  }
}

async function seedEvening(
  repo: Repository,
  circleId: string,
  elderId: string,
  day: DateTime,
  dateStr: string,
  dayOffset: number,
): Promise<void> {
  const walkSkipped = dayOffset % WALK_SKIP_MODULO === 0;
  const walkEvent: ScheduleEvent = {
    id: makeEventId(dateStr, 'evening', 'routine', 'routine-walk'),
    circleId,
    date: dateStr,
    slot: 'evening',
    itemType: 'routine',
    itemId: 'routine-walk',
    status: walkSkipped ? 'skipped' : 'taken',
    reason: walkSkipped ? 'Felt tired' : undefined,
    actorId: elderId,
    at: day.set({ hour: EVENING_HOUR, minute: EVENING_MINUTE }).toISO()!,
  };
  await repo.createOrUpdateEvent(circleId, walkEvent);
}

async function seedNight(
  repo: Repository,
  circleId: string,
  elderId: string,
  day: DateTime,
  dateStr: string,
  dayOffset: number,
): Promise<void> {
  const isNightMissed =
    dayOffset <= INSIGHT_LOOKBACK_DAYS &&
    (dayOffset === 1 || dayOffset === 3 || dayOffset === 5 || dayOffset === 6);
  const nightStatus = isNightMissed ? 'missed' : 'taken';
  const nightItems = [
    { id: 'med-metformin', type: 'medicine' as const },
    { id: 'med-atorvastatin', type: 'medicine' as const },
  ];
  for (const item of nightItems) {
    const event: ScheduleEvent = {
      id: makeEventId(dateStr, 'night', item.type, item.id),
      circleId,
      date: dateStr,
      slot: 'night',
      itemType: item.type,
      itemId: item.id,
      status: nightStatus,
      actorId: isNightMissed ? undefined : elderId,
      at: day.set({ hour: NIGHT_HOUR, minute: NIGHT_MINUTE }).toISO()!,
    };
    await repo.createOrUpdateEvent(circleId, event);
  }
}

export async function seedDemoHistory(
  repo: Repository,
  circleId: string,
  elderId: string,
  now: DateTime,
): Promise<void> {
  for (let dayOffset = TOTAL_HISTORY_DAYS; dayOffset >= 1; dayOffset--) {
    const day = now.minus({ days: dayOffset });
    const dateStr = day.toISODate()!;
    await seedMorning(repo, circleId, elderId, day, dateStr);
    await seedEvening(repo, circleId, elderId, day, dateStr, dayOffset);
    await seedNight(repo, circleId, elderId, day, dateStr, dayOffset);
  }
}
