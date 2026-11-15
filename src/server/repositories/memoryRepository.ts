/**
 * In-memory repository implementation for local development and tests.
 * Data lives in Maps — no persistence across restarts.
 */
import type { Repository } from './repository.js';
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

export function createMemoryRepository(): Repository {
  const circles = new Map<string, Circle>();
  const circleCodes = new Map<string, string>(); // codeHash → circleId
  const members = new Map<string, Map<string, Member>>(); // circleId → memberId → Member
  const invites = new Map<string, Map<string, Invite>>();
  const invitesByCode = new Map<string, Invite>(); // codeHash → Invite
  const medicines = new Map<string, Map<string, Medicine>>();
  const routines = new Map<string, Map<string, Routine>>();
  const proposals = new Map<string, Map<string, Proposal>>();
  const events = new Map<string, Map<string, ScheduleEvent>>();
  const appointments = new Map<string, Map<string, Appointment>>();
  const activities = new Map<string, Activity[]>();
  const outbox = new Map<string, OutboxEntry[]>();
  const outboxByDedupe = new Map<string, OutboxEntry>(); // dedupeKey → OutboxEntry
  const visitLinks = new Map<string, Map<string, VisitLink>>();
  const visitLinksByToken = new Map<string, VisitLink>(); // tokenHash → VisitLink

  function getSubMap<T>(map: Map<string, Map<string, T>>, circleId: string): Map<string, T> {
    let sub = map.get(circleId);
    if (!sub) {
      sub = new Map();
      map.set(circleId, sub);
    }
    return sub;
  }

  const repo: Repository = {
    /* ── Circles ────────────────────────────────────── */
    async createCircle(circle) {
      circles.set(circle.id, circle);
      return circle;
    },
    async getCircle(circleId) {
      return circles.get(circleId) ?? null;
    },
    async updateCircle(circleId, data) {
      const existing = circles.get(circleId);
      if (existing) circles.set(circleId, { ...existing, ...data });
    },

    /* ── Circle codes ──────────────────────────────── */
    async setCircleCode(codeHash, circleId) {
      circleCodes.set(codeHash, circleId);
    },
    async getCircleIdByCodeHash(codeHash) {
      return circleCodes.get(codeHash) ?? null;
    },

    /* ── Members ───────────────────────────────────── */
    async createMember(circleId, member) {
      getSubMap(members, circleId).set(member.id, member);
      return member;
    },
    async getMember(circleId, memberId) {
      return getSubMap(members, circleId).get(memberId) ?? null;
    },
    async getMembersByCircle(circleId) {
      return [...getSubMap(members, circleId).values()].filter((m) => !m.removedAt);
    },
    async updateMember(circleId, memberId, data) {
      const sub = getSubMap(members, circleId);
      const existing = sub.get(memberId);
      if (existing) sub.set(memberId, { ...existing, ...data });
    },
    async deleteMember(circleId, memberId) {
      const sub = getSubMap(members, circleId);
      const existing = sub.get(memberId);
      if (existing) sub.set(memberId, { ...existing, removedAt: new Date().toISOString() });
    },

    /* ── Invites ───────────────────────────────────── */
    async createInvite(circleId, invite) {
      getSubMap(invites, circleId).set(invite.id, invite);
      invitesByCode.set(invite.codeHash, invite);
      return invite;
    },
    async getInviteByCodeHash(codeHash) {
      return invitesByCode.get(codeHash) ?? null;
    },
    async updateInvite(circleId, inviteId, data) {
      const sub = getSubMap(invites, circleId);
      const existing = sub.get(inviteId);
      if (existing) {
        const updated = { ...existing, ...data };
        sub.set(inviteId, updated);
        invitesByCode.set(updated.codeHash, updated);
      }
    },
    async getInvitesByCircle(circleId) {
      return [...getSubMap(invites, circleId).values()];
    },

    /* ── Medicines ─────────────────────────────────── */
    async createMedicine(circleId, medicine) {
      getSubMap(medicines, circleId).set(medicine.id, medicine);
      return medicine;
    },
    async getMedicine(circleId, medicineId) {
      return getSubMap(medicines, circleId).get(medicineId) ?? null;
    },
    async getMedicinesByCircle(circleId) {
      return [...getSubMap(medicines, circleId).values()];
    },
    async updateMedicine(circleId, medicineId, data) {
      const sub = getSubMap(medicines, circleId);
      const existing = sub.get(medicineId);
      if (existing) sub.set(medicineId, { ...existing, ...data });
    },

    /* ── Routines ──────────────────────────────────── */
    async createRoutine(circleId, routine) {
      getSubMap(routines, circleId).set(routine.id, routine);
      return routine;
    },
    async getRoutine(circleId, routineId) {
      return getSubMap(routines, circleId).get(routineId) ?? null;
    },
    async getRoutinesByCircle(circleId) {
      return [...getSubMap(routines, circleId).values()];
    },
    async updateRoutine(circleId, routineId, data) {
      const sub = getSubMap(routines, circleId);
      const existing = sub.get(routineId);
      if (existing) sub.set(routineId, { ...existing, ...data });
    },

    /* ── Proposals ─────────────────────────────────── */
    async createProposal(circleId, proposal) {
      getSubMap(proposals, circleId).set(proposal.id, proposal);
      return proposal;
    },
    async getProposal(circleId, proposalId) {
      return getSubMap(proposals, circleId).get(proposalId) ?? null;
    },
    async getProposalsByCircle(circleId, status) {
      const all = [...getSubMap(proposals, circleId).values()];
      if (status) return all.filter((p) => p.status === status);
      return all;
    },
    async updateProposal(circleId, proposalId, data) {
      const sub = getSubMap(proposals, circleId);
      const existing = sub.get(proposalId);
      if (existing) sub.set(proposalId, { ...existing, ...data });
    },

    /* ── Events ────────────────────────────────────── */
    async createOrUpdateEvent(circleId, event) {
      getSubMap(events, circleId).set(event.id, event);
      return event;
    },
    async getEvent(circleId, eventId) {
      return getSubMap(events, circleId).get(eventId) ?? null;
    },
    async getEventsByCircle(circleId, dateStart, dateEnd) {
      return [...getSubMap(events, circleId).values()].filter(
        (ev) => ev.date >= dateStart && ev.date <= dateEnd,
      );
    },
    async getEventsByDate(circleId, date) {
      return [...getSubMap(events, circleId).values()].filter((ev) => ev.date === date);
    },

    /* ── Appointments ──────────────────────────────── */
    async createAppointment(circleId, appointment) {
      getSubMap(appointments, circleId).set(appointment.id, appointment);
      return appointment;
    },
    async getAppointment(circleId, appointmentId) {
      return getSubMap(appointments, circleId).get(appointmentId) ?? null;
    },
    async getAppointmentsByCircle(circleId) {
      return [...getSubMap(appointments, circleId).values()].filter(
        (a) => a.status !== 'cancelled',
      );
    },
    async updateAppointment(circleId, appointmentId, data) {
      const sub = getSubMap(appointments, circleId);
      const existing = sub.get(appointmentId);
      if (existing) sub.set(appointmentId, { ...existing, ...data });
    },
    async deleteAppointment(circleId, appointmentId) {
      getSubMap(appointments, circleId).delete(appointmentId);
    },

    /* ── Activity ──────────────────────────────────── */
    async createActivity(circleId, activity) {
      const list = activities.get(circleId) ?? [];
      list.push(activity);
      activities.set(circleId, list);
      return activity;
    },
    async getActivitiesByCircle(circleId, limit = 100) {
      const list = activities.get(circleId) ?? [];
      return list.slice(-limit).reverse();
    },

    /* ── Outbox ────────────────────────────────────── */
    async createOutboxEntry(circleId, entry) {
      const list = outbox.get(circleId) ?? [];
      list.push(entry);
      outbox.set(circleId, list);
      outboxByDedupe.set(`${circleId}:${entry.dedupeKey}`, entry);
      return entry;
    },
    async getOutboxByCircle(circleId, limit = 100) {
      const list = outbox.get(circleId) ?? [];
      return list.slice(-limit).reverse();
    },
    async getOutboxByDedupeKey(circleId, dedupeKey) {
      return outboxByDedupe.get(`${circleId}:${dedupeKey}`) ?? null;
    },

    /* ── Visit Links ───────────────────────────────── */
    async createVisitLink(circleId, link) {
      getSubMap(visitLinks, circleId).set(link.id, link);
      visitLinksByToken.set(link.tokenHash, link);
      return link;
    },
    async getVisitLinkByTokenHash(tokenHash) {
      return visitLinksByToken.get(tokenHash) ?? null;
    },
    async updateVisitLink(circleId, linkId, data) {
      const sub = getSubMap(visitLinks, circleId);
      const existing = sub.get(linkId);
      if (existing) {
        const updated = { ...existing, ...data };
        sub.set(linkId, updated);
        visitLinksByToken.set(updated.tokenHash, updated);
      }
    },

    /* ── Bulk / utility ────────────────────────────── */
    async getAllCircles() {
      return [...circles.values()];
    },
  };

  return repo;
}
