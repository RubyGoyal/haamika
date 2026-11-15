/**
 * Re-exports all types inferred from zod schemas.
 * Import types from here; import schemas from schemas.ts.
 */
export type {
  Slot,
  Role,
  PillColor,
  PillShape,
  FoodInstruction,
  MedicineStatus,
  EventStatus,
  ProposalType,
  ProposalStatus,
  RoutineType,
  OutboxStatus,
  ReminderKind,
  Language,
  DayOfWeek,
  Anchors,
  NotifyPrefs,
  Circle,
  Member,
  Invite,
  Medicine,
  Routine,
  Proposal,
  ScheduleEvent,
  Appointment,
  Activity,
  OutboxEntry,
  VisitLink,
} from './schemas.js';

/** Session payload stored in the JWT. Minimal — no PII. */
export interface SessionPayload {
  circleId: string;
  memberId: string;
  role: 'elder' | 'family' | 'caretaker';
}
