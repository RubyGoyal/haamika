/**
 * Repository interface — the only way routes and services access data.
 * Two implementations: memoryRepository (dev/tests) and firestoreRepository (production).
 */
import type {
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
} from '../../shared/types.js';

export interface Repository {
  /* ── Circles ─────────────────────────────────────────────── */
  createCircle(circle: Circle): Promise<Circle>;
  getCircle(circleId: string): Promise<Circle | null>;
  updateCircle(circleId: string, data: Partial<Circle>): Promise<void>;

  /* ── Circle codes ────────────────────────────────────────── */
  setCircleCode(codeHash: string, circleId: string): Promise<void>;
  getCircleIdByCodeHash(codeHash: string): Promise<string | null>;

  /* ── Members ─────────────────────────────────────────────── */
  createMember(circleId: string, member: Member): Promise<Member>;
  getMember(circleId: string, memberId: string): Promise<Member | null>;
  getMembersByCircle(circleId: string): Promise<Member[]>;
  updateMember(circleId: string, memberId: string, data: Partial<Member>): Promise<void>;
  deleteMember(circleId: string, memberId: string): Promise<void>;

  /* ── Invites ─────────────────────────────────────────────── */
  createInvite(circleId: string, invite: Invite): Promise<Invite>;
  getInviteByCodeHash(codeHash: string): Promise<Invite | null>;
  updateInvite(circleId: string, inviteId: string, data: Partial<Invite>): Promise<void>;
  getInvitesByCircle(circleId: string): Promise<Invite[]>;

  /* ── Medicines ───────────────────────────────────────────── */
  createMedicine(circleId: string, medicine: Medicine): Promise<Medicine>;
  getMedicine(circleId: string, medicineId: string): Promise<Medicine | null>;
  getMedicinesByCircle(circleId: string): Promise<Medicine[]>;
  updateMedicine(circleId: string, medicineId: string, data: Partial<Medicine>): Promise<void>;

  /* ── Routines ────────────────────────────────────────────── */
  createRoutine(circleId: string, routine: Routine): Promise<Routine>;
  getRoutine(circleId: string, routineId: string): Promise<Routine | null>;
  getRoutinesByCircle(circleId: string): Promise<Routine[]>;
  updateRoutine(circleId: string, routineId: string, data: Partial<Routine>): Promise<void>;

  /* ── Proposals ───────────────────────────────────────────── */
  createProposal(circleId: string, proposal: Proposal): Promise<Proposal>;
  getProposal(circleId: string, proposalId: string): Promise<Proposal | null>;
  getProposalsByCircle(circleId: string, status?: string): Promise<Proposal[]>;
  updateProposal(circleId: string, proposalId: string, data: Partial<Proposal>): Promise<void>;

  /* ── Events ──────────────────────────────────────────────── */
  createOrUpdateEvent(circleId: string, event: ScheduleEvent): Promise<ScheduleEvent>;
  getEvent(circleId: string, eventId: string): Promise<ScheduleEvent | null>;
  getEventsByCircle(circleId: string, dateStart: string, dateEnd: string): Promise<ScheduleEvent[]>;
  getEventsByDate(circleId: string, date: string): Promise<ScheduleEvent[]>;

  /* ── Appointments ────────────────────────────────────────── */
  createAppointment(circleId: string, appointment: Appointment): Promise<Appointment>;
  getAppointment(circleId: string, appointmentId: string): Promise<Appointment | null>;
  getAppointmentsByCircle(circleId: string): Promise<Appointment[]>;
  updateAppointment(
    circleId: string,
    appointmentId: string,
    data: Partial<Appointment>,
  ): Promise<void>;
  deleteAppointment(circleId: string, appointmentId: string): Promise<void>;

  /* ── Activity ────────────────────────────────────────────── */
  createActivity(circleId: string, activity: Activity): Promise<Activity>;
  getActivitiesByCircle(circleId: string, limit?: number): Promise<Activity[]>;

  /* ── Outbox ──────────────────────────────────────────────── */
  createOutboxEntry(circleId: string, entry: OutboxEntry): Promise<OutboxEntry>;
  getOutboxByCircle(circleId: string, limit?: number): Promise<OutboxEntry[]>;
  getOutboxByDedupeKey(circleId: string, dedupeKey: string): Promise<OutboxEntry | null>;

  /* ── Visit Links ─────────────────────────────────────────── */
  createVisitLink(circleId: string, link: VisitLink): Promise<VisitLink>;
  getVisitLinkByTokenHash(tokenHash: string): Promise<VisitLink | null>;
  updateVisitLink(circleId: string, linkId: string, data: Partial<VisitLink>): Promise<void>;

  /* ── Bulk / utility ──────────────────────────────────────── */
  getAllCircles(): Promise<Circle[]>;
}
