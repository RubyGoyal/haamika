/**
 * Demo seed generator (SPEC §4.12).
 * Seeds Kamla Devi's circle (code: AMMA-4729) with 14 days of history,
 * night dose miss pattern, one pending proposal, and two appointments.
 */
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import type { Repository } from '../repositories/repository.js';
import { sha256, normalizeCircleCode } from '../services/tokens.js';
import {
  DEMO_CIRCLE_CODE,
  DEMO_CIRCLE_ID,
  DEMO_ELDER_ID,
  DEMO_FAMILY_ID,
  DEMO_CARETAKER_ID,
  createDemoCircle,
  createDemoMembers,
  createDemoMedicines,
  createDemoRoutines,
  createDemoProposal,
  createDemoAppointments,
} from './demoData.js';
import { seedDemoHistory } from './demoHistory.js';

export { DEMO_CIRCLE_CODE };

export interface DemoSeedResult {
  circleId: string;
  circleCode: string;
  elderId: string;
  familyId: string;
  caretakerId: string;
}

async function findExistingCircle(
  repo: Repository,
  codeHash: string,
): Promise<DemoSeedResult | null> {
  const existingId =
    (await repo.getCircleIdByCodeHash(codeHash)) || (await repo.getCircle(DEMO_CIRCLE_ID))?.id;
  if (!existingId) return null;

  const members = await repo.getMembersByCircle(existingId);
  return {
    circleId: existingId,
    circleCode: DEMO_CIRCLE_CODE,
    elderId: members.find((m) => m.role === 'elder')?.id || '',
    familyId: members.find((m) => m.role === 'family')?.id || '',
    caretakerId: members.find((m) => m.role === 'caretaker')?.id || '',
  };
}

const APPT_1_OFFSET_DAYS = 2;
const APPT_1_HOUR = 10;
const APPT_1_MINUTE = 30;
const APPT_2_OFFSET_DAYS = 12;
const APPT_2_HOUR = 11;
const APPT_2_MINUTE = 0;
const ACTIVITY_OFFSET_DAYS = 15;

export async function seedDemoCircle(repo: Repository): Promise<DemoSeedResult> {
  const normalizedCode = normalizeCircleCode(DEMO_CIRCLE_CODE);
  const codeHash = sha256(normalizedCode);

  const existing = await findExistingCircle(repo, codeHash);
  if (existing) return existing;

  const now = DateTime.now().setZone('Asia/Kolkata');
  const nowIso = now.toISO()!;

  // 1. Circle & code lookup
  await repo.createCircle(createDemoCircle(codeHash, nowIso));
  await repo.setCircleCode(codeHash, DEMO_CIRCLE_ID);

  // 2. Members
  const members = await createDemoMembers(DEMO_CIRCLE_ID, nowIso);
  await Promise.all(members.map((m) => repo.createMember(DEMO_CIRCLE_ID, m)));

  // 3. Medicines & Routines
  const meds = createDemoMedicines(DEMO_CIRCLE_ID, nowIso);
  await Promise.all(meds.map((m) => repo.createMedicine(DEMO_CIRCLE_ID, m)));
  const routines = createDemoRoutines(DEMO_CIRCLE_ID, nowIso);
  await Promise.all(routines.map((r) => repo.createRoutine(DEMO_CIRCLE_ID, r)));

  // 4. Proposal
  const { med, proposal } = createDemoProposal(DEMO_CIRCLE_ID, nowIso);
  await repo.createMedicine(DEMO_CIRCLE_ID, med);
  await repo.createProposal(DEMO_CIRCLE_ID, proposal);

  // 5. Appointments
  const starts1 = now
    .plus({ days: APPT_1_OFFSET_DAYS })
    .set({ hour: APPT_1_HOUR, minute: APPT_1_MINUTE, second: 0 })
    .toISO()!;
  const starts2 = now
    .plus({ days: APPT_2_OFFSET_DAYS })
    .set({ hour: APPT_2_HOUR, minute: APPT_2_MINUTE, second: 0 })
    .toISO()!;
  const appts = createDemoAppointments(DEMO_CIRCLE_ID, starts1, starts2, nowIso);
  await Promise.all(appts.map((a) => repo.createAppointment(DEMO_CIRCLE_ID, a)));

  // 6. 14 Days History
  await seedDemoHistory(repo, DEMO_CIRCLE_ID, DEMO_ELDER_ID, now);

  // 7. Initial Activity Log
  await repo.createActivity(DEMO_CIRCLE_ID, {
    id: randomUUID(),
    circleId: DEMO_CIRCLE_ID,
    actorId: DEMO_FAMILY_ID,
    actorRole: 'family',
    action: 'circle_created',
    summary: 'Created care circle for Kamla Devi (Amma)',
    at: now.minus({ days: ACTIVITY_OFFSET_DAYS }).toISO()!,
  });

  return {
    circleId: DEMO_CIRCLE_ID,
    circleCode: DEMO_CIRCLE_CODE,
    elderId: DEMO_ELDER_ID,
    familyId: DEMO_FAMILY_ID,
    caretakerId: DEMO_CARETAKER_ID,
  };
}
