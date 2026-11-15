/**
 * Demo seed generator (SPEC §4.12).
 * Seeds Kamla Devi's circle (code: AMMA-4729) with 14 days of history,
 * night dose miss pattern, one pending proposal, and two appointments.
 */
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import type { Repository } from '../repositories/repository.js';
import { hashPin } from '../services/pin.js';
import { sha256, normalizeCircleCode } from '../services/tokens.js';
import { makeEventId } from '../services/scheduleEngine.js';
import type { Circle, Member, Medicine, Routine, Proposal, Appointment, ScheduleEvent } from '../../shared/types.js';

export const DEMO_CIRCLE_CODE = 'AMMA-4729';

export async function seedDemoCircle(repo: Repository): Promise<{
  circleId: string;
  circleCode: string;
  elderId: string;
  familyId: string;
  caretakerId: string;
}> {
  const normalizedCode = normalizeCircleCode(DEMO_CIRCLE_CODE);
  const codeHash = sha256(normalizedCode);

  // Check if demo circle already exists
  const existingCircleId = await repo.getCircleIdByCodeHash(codeHash);
  if (existingCircleId) {
    const existing = await repo.getCircle(existingCircleId);
    if (existing) {
      const members = await repo.getMembersByCircle(existingCircleId);
      const elder = members.find((m) => m.role === 'elder');
      const family = members.find((m) => m.role === 'family');
      const caretaker = members.find((m) => m.role === 'caretaker');
      return {
        circleId: existingCircleId,
        circleCode: DEMO_CIRCLE_CODE,
        elderId: elder?.id || '',
        familyId: family?.id || '',
        caretakerId: caretaker?.id || '',
      };
    }
  }

  const circleId = 'demo-circle-kamla-devi';
  const now = DateTime.now().setZone('Asia/Kolkata');
  const nowIso = now.toISO()!;

  // 1. Circle
  const circle: Circle = {
    id: circleId,
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
    circleCodeHash: codeHash,
    createdAt: nowIso,
  };
  await repo.createCircle(circle);
  await repo.setCircleCode(codeHash, circleId);

  // 2. Members
  const [elderPin, familyPin, caretakerPin] = await Promise.all([
    hashPin('2580'),
    hashPin('135790'),
    hashPin('246802'),
  ]);

  const elderId = 'demo-member-kamla';
  const elderMember: Member = {
    id: elderId,
    circleId,
    name: 'Kamla Devi',
    role: 'elder',
    pinHash: elderPin.hash,
    pinSalt: elderPin.salt,
    failedAttempts: 0,
    lockedUntil: null,
    isOrganizer: false,
    notify: { upcoming: true, missed: true, appointments: true, refill: true },
    createdAt: nowIso,
  };
  await repo.createMember(circleId, elderMember);

  const familyId = 'demo-member-rohan';
  const familyMember: Member = {
    id: familyId,
    circleId,
    name: 'Rohan',
    role: 'family',
    email: 'rohan@example.com',
    timezone: 'America/Toronto',
    pinHash: familyPin.hash,
    pinSalt: familyPin.salt,
    failedAttempts: 0,
    lockedUntil: null,
    isOrganizer: true,
    notify: { upcoming: false, missed: true, appointments: true, refill: true },
    createdAt: nowIso,
  };
  await repo.createMember(circleId, familyMember);

  const caretakerId = 'demo-member-sunita';
  const caretakerMember: Member = {
    id: caretakerId,
    circleId,
    name: 'Sunita',
    role: 'caretaker',
    pinHash: caretakerPin.hash,
    pinSalt: caretakerPin.salt,
    failedAttempts: 0,
    lockedUntil: null,
    isOrganizer: false,
    notify: { upcoming: true, missed: true, appointments: true, refill: true },
    createdAt: nowIso,
  };
  await repo.createMember(circleId, caretakerMember);

  // 3. Active Medicines (SPEC §4.12)
  const medAmlodipine: Medicine = {
    id: 'med-amlodipine',
    circleId,
    name: 'Amlodipine',
    strength: '5 mg',
    purpose: 'Blood pressure control',
    pillColor: 'white',
    pillShape: 'round',
    foodInstruction: 'after_food',
    slots: ['morning'],
    dosePerSlot: 1,
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    stockCount: 28,
    refillThreshold: 7,
    status: 'active',
    createdAt: nowIso,
  };

  const medMetformin: Medicine = {
    id: 'med-metformin',
    circleId,
    name: 'Metformin',
    strength: '500 mg',
    purpose: 'Blood sugar management',
    pillColor: 'white',
    pillShape: 'oval',
    foodInstruction: 'after_food',
    slots: ['morning', 'night'],
    dosePerSlot: 1,
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    stockCount: 52,
    refillThreshold: 14,
    status: 'active',
    createdAt: nowIso,
  };

  const medAtorvastatin: Medicine = {
    id: 'med-atorvastatin',
    circleId,
    name: 'Atorvastatin',
    strength: '10 mg',
    purpose: 'Cholesterol control',
    pillColor: 'brown',
    pillShape: 'oval',
    foodInstruction: 'after_food',
    slots: ['night'],
    dosePerSlot: 1,
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    stockCount: 20,
    refillThreshold: 7,
    status: 'active',
    createdAt: nowIso,
  };

  const medPantoprazole: Medicine = {
    id: 'med-pantoprazole',
    circleId,
    name: 'Pantoprazole',
    strength: '40 mg',
    purpose: 'Acidity relief',
    pillColor: 'yellow',
    pillShape: 'capsule',
    foodInstruction: 'before_food',
    slots: ['morning'],
    dosePerSlot: 1,
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    stockCount: 14,
    refillThreshold: 5,
    status: 'active',
    createdAt: nowIso,
  };

  await Promise.all([
    repo.createMedicine(circleId, medAmlodipine),
    repo.createMedicine(circleId, medMetformin),
    repo.createMedicine(circleId, medAtorvastatin),
    repo.createMedicine(circleId, medPantoprazole),
  ]);

  // 4. Routines (SPEC §4.12)
  const routineBp: Routine = {
    id: 'routine-bp',
    circleId,
    type: 'bp_check',
    label: 'Morning BP Check',
    slot: 'morning',
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    needsReading: true,
    status: 'active',
    createdAt: nowIso,
  };

  const routineWalk: Routine = {
    id: 'routine-walk',
    circleId,
    type: 'walk',
    label: 'Evening Walk in Park',
    slot: 'evening',
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    needsReading: false,
    status: 'active',
    createdAt: nowIso,
  };

  await Promise.all([
    repo.createRoutine(circleId, routineBp),
    repo.createRoutine(circleId, routineWalk),
  ]);

  // 5. One Pending Proposal (SPEC §4.12)
  const medCalciumId = 'med-calcium-pending';
  const medCalcium: Medicine = {
    id: medCalciumId,
    circleId,
    name: 'Calcium + Vitamin D3',
    strength: '500 mg',
    purpose: 'Bone health',
    pillColor: 'pink',
    pillShape: 'round',
    foodInstruction: 'after_food',
    slots: ['afternoon'],
    dosePerSlot: 1,
    daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    stockCount: 30,
    status: 'proposed',
    createdAt: nowIso,
  };
  await repo.createMedicine(circleId, medCalcium);

  const proposal: Proposal = {
    id: 'demo-proposal-calcium',
    circleId,
    type: 'add_medicine',
    payload: {
      medicineId: medCalciumId,
      medicineName: 'Calcium + Vitamin D3',
      strength: '500 mg',
      purpose: 'Bone health',
      slots: ['afternoon'],
    },
    proposedBy: familyId,
    status: 'pending',
    createdAt: nowIso,
  };
  await repo.createProposal(circleId, proposal);

  // 6. Appointments (SPEC §4.12)
  const appt1: Appointment = {
    id: 'demo-appt-1',
    circleId,
    doctorName: 'Dr. Mehta',
    specialty: 'Cardiology',
    place: 'Max Healthcare, Saket, Delhi',
    startsAt: now.plus({ days: 2 }).set({ hour: 10, minute: 30, second: 0 }).toISO()!,
    notes: 'Routine blood pressure review and ECG check.',
    questions: ['Is the current Amlodipine dose right?', 'Why do I feel light-headed in the evening?'],
    status: 'upcoming',
    createdAt: nowIso,
  };

  const appt2: Appointment = {
    id: 'demo-appt-2',
    circleId,
    doctorName: 'Dr. Iyer',
    specialty: 'Endocrinology & Diabetes',
    place: 'Apollo Clinic, Connaught Place, Delhi',
    startsAt: now.plus({ days: 12 }).set({ hour: 11, minute: 0, second: 0 }).toISO()!,
    notes: 'HbA1c quarterly review.',
    questions: ['Can I take Metformin after breakfast?'],
    status: 'upcoming',
    createdAt: nowIso,
  };

  await Promise.all([
    repo.createAppointment(circleId, appt1),
    repo.createAppointment(circleId, appt2),
  ]);

  // 7. 14 Days History at ~85% adherence where night doses are often missed (SPEC §4.12)
  for (let dayOffset = 14; dayOffset >= 1; dayOffset--) {
    const day = now.minus({ days: dayOffset });
    const dateStr = day.toISODate()!;

    // Morning: Amlodipine, Metformin, Pantoprazole, BP Check -> usually taken
    const morningItems = [
      { id: medAmlodipine.id, type: 'medicine' as const },
      { id: medMetformin.id, type: 'medicine' as const },
      { id: medPantoprazole.id, type: 'medicine' as const },
      { id: routineBp.id, type: 'routine' as const },
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
        reading: item.id === routineBp.id ? '135/85' : undefined,
        at: day.set({ hour: 8, minute: 45 }).toISO()!,
      };
      await repo.createOrUpdateEvent(circleId, event);
    }

    // Evening: Walk
    const walkEvent: ScheduleEvent = {
      id: makeEventId(dateStr, 'evening', 'routine', routineWalk.id),
      circleId,
      date: dateStr,
      slot: 'evening',
      itemType: 'routine',
      itemId: routineWalk.id,
      status: dayOffset % 4 === 0 ? 'skipped' : 'taken',
      reason: dayOffset % 4 === 0 ? 'Felt tired' : undefined,
      actorId: elderId,
      at: day.set({ hour: 18, minute: 30 }).toISO()!,
    };
    await repo.createOrUpdateEvent(circleId, walkEvent);

    // Night: Metformin and Atorvastatin
    // In the last 7 days, night doses are missed ≥ 3 times so the pattern insight triggers!
    const isNightMissed = dayOffset <= 7 && (dayOffset === 1 || dayOffset === 3 || dayOffset === 5 || dayOffset === 6);
    const nightStatus = isNightMissed ? 'missed' : 'taken';

    const nightItems = [
      { id: medMetformin.id, type: 'medicine' as const },
      { id: medAtorvastatin.id, type: 'medicine' as const },
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
        at: day.set({ hour: 21, minute: 15 }).toISO()!,
      };
      await repo.createOrUpdateEvent(circleId, event);
    }
  }

  // Activity log initial entries
  await repo.createActivity(circleId, {
    id: randomUUID(),
    circleId,
    actorId: familyId,
    actorRole: 'family',
    action: 'circle_created',
    summary: 'Created care circle for Kamla Devi (Amma)',
    at: now.minus({ days: 15 }).toISO()!,
  });

  return {
    circleId,
    circleCode: DEMO_CIRCLE_CODE,
    elderId,
    familyId,
    caretakerId,
  };
}
