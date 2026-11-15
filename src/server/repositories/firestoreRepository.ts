/**
 * Firestore repository implementation using @google-cloud/firestore.
 * Data model per SPEC §6.4: all data under circles/{circleId} subcollections,
 * with a top-level circleCodes collection for lookup.
 */
import { Firestore } from '@google-cloud/firestore';
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

export function createFirestoreRepository(projectId: string): Repository {
  const db = new Firestore({ projectId });

  function circleRef(circleId: string) {
    return db.collection('circles').doc(circleId);
  }

  function subCol(circleId: string, collection: string) {
    return circleRef(circleId).collection(collection);
  }

  /** Convert Firestore doc to plain object with id. */
  function docToObj<T>(doc: FirebaseFirestore.DocumentSnapshot): T | null {
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
  }

  const repo: Repository = {
    /* ── Circles ────────────────────────────────────── */
    async createCircle(circle) {
      const { id, ...data } = circle;
      await circleRef(id).set(data);
      return circle;
    },
    async getCircle(circleId) {
      const doc = await circleRef(circleId).get();
      return docToObj<Circle>(doc);
    },
    async updateCircle(circleId, data) {
      await circleRef(circleId).update(data);
    },

    /* ── Circle codes ──────────────────────────────── */
    async setCircleCode(codeHash, circleId) {
      await db.collection('circleCodes').doc(codeHash).set({ circleId });
    },
    async getCircleIdByCodeHash(codeHash) {
      const doc = await db.collection('circleCodes').doc(codeHash).get();
      if (!doc.exists) return null;
      return (doc.data() as { circleId: string }).circleId;
    },

    /* ── Members ───────────────────────────────────── */
    async createMember(circleId, member) {
      const { id, ...data } = member;
      await subCol(circleId, 'members').doc(id).set(data);
      return member;
    },
    async getMember(circleId, memberId) {
      const doc = await subCol(circleId, 'members').doc(memberId).get();
      return docToObj<Member>(doc);
    },
    async getMembersByCircle(circleId) {
      const snap = await subCol(circleId, 'members').where('removedAt', '==', null).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member);
    },
    async updateMember(circleId, memberId, data) {
      await subCol(circleId, 'members').doc(memberId).update(data);
    },
    async deleteMember(circleId, memberId) {
      await subCol(circleId, 'members').doc(memberId).update({
        removedAt: new Date().toISOString(),
      });
    },

    /* ── Invites ───────────────────────────────────── */
    async createInvite(circleId, invite) {
      const { id, ...data } = invite;
      await subCol(circleId, 'invites').doc(id).set(data);
      return invite;
    },
    async getInviteByCodeHash(codeHash) {
      const snap = await db
        .collectionGroup('invites')
        .where('codeHash', '==', codeHash)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0]!;
      return { id: doc.id, circleId: doc.ref.parent.parent!.id, ...doc.data() } as Invite;
    },
    async updateInvite(circleId, inviteId, data) {
      await subCol(circleId, 'invites').doc(inviteId).update(data);
    },
    async getInvitesByCircle(circleId) {
      const snap = await subCol(circleId, 'invites').get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as Invite);
    },

    /* ── Medicines ─────────────────────────────────── */
    async createMedicine(circleId, medicine) {
      const { id, ...data } = medicine;
      await subCol(circleId, 'medicines').doc(id).set(data);
      return medicine;
    },
    async getMedicine(circleId, medicineId) {
      const doc = await subCol(circleId, 'medicines').doc(medicineId).get();
      return docToObj<Medicine>(doc);
    },
    async getMedicinesByCircle(circleId) {
      const snap = await subCol(circleId, 'medicines').get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as Medicine);
    },
    async updateMedicine(circleId, medicineId, data) {
      await subCol(circleId, 'medicines').doc(medicineId).update(data);
    },

    /* ── Routines ──────────────────────────────────── */
    async createRoutine(circleId, routine) {
      const { id, ...data } = routine;
      await subCol(circleId, 'routines').doc(id).set(data);
      return routine;
    },
    async getRoutine(circleId, routineId) {
      const doc = await subCol(circleId, 'routines').doc(routineId).get();
      return docToObj<Routine>(doc);
    },
    async getRoutinesByCircle(circleId) {
      const snap = await subCol(circleId, 'routines').get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as Routine);
    },
    async updateRoutine(circleId, routineId, data) {
      await subCol(circleId, 'routines').doc(routineId).update(data);
    },

    /* ── Proposals ─────────────────────────────────── */
    async createProposal(circleId, proposal) {
      const { id, ...data } = proposal;
      await subCol(circleId, 'proposals').doc(id).set(data);
      return proposal;
    },
    async getProposal(circleId, proposalId) {
      const doc = await subCol(circleId, 'proposals').doc(proposalId).get();
      return docToObj<Proposal>(doc);
    },
    async getProposalsByCircle(circleId, status) {
      let query: FirebaseFirestore.Query = subCol(circleId, 'proposals');
      if (status) query = query.where('status', '==', status);
      const snap = await query.get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as Proposal);
    },
    async updateProposal(circleId, proposalId, data) {
      await subCol(circleId, 'proposals').doc(proposalId).update(data);
    },

    /* ── Events ────────────────────────────────────── */
    async createOrUpdateEvent(circleId, event) {
      const { id, ...data } = event;
      await subCol(circleId, 'events').doc(id).set(data, { merge: true });
      return event;
    },
    async getEvent(circleId, eventId) {
      const doc = await subCol(circleId, 'events').doc(eventId).get();
      return docToObj<ScheduleEvent>(doc);
    },
    async getEventsByCircle(circleId, dateStart, dateEnd) {
      const snap = await subCol(circleId, 'events')
        .where('date', '>=', dateStart)
        .where('date', '<=', dateEnd)
        .get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as ScheduleEvent);
    },
    async getEventsByDate(circleId, date) {
      const snap = await subCol(circleId, 'events').where('date', '==', date).get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as ScheduleEvent);
    },

    /* ── Appointments ──────────────────────────────── */
    async createAppointment(circleId, appointment) {
      const { id, ...data } = appointment;
      await subCol(circleId, 'appointments').doc(id).set(data);
      return appointment;
    },
    async getAppointment(circleId, appointmentId) {
      const doc = await subCol(circleId, 'appointments').doc(appointmentId).get();
      return docToObj<Appointment>(doc);
    },
    async getAppointmentsByCircle(circleId) {
      const snap = await subCol(circleId, 'appointments').where('status', '!=', 'cancelled').get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as Appointment);
    },
    async updateAppointment(circleId, appointmentId, data) {
      await subCol(circleId, 'appointments').doc(appointmentId).update(data);
    },
    async deleteAppointment(circleId, appointmentId) {
      await subCol(circleId, 'appointments').doc(appointmentId).delete();
    },

    /* ── Activity ──────────────────────────────────── */
    async createActivity(circleId, activity) {
      const { id, ...data } = activity;
      await subCol(circleId, 'activity').doc(id).set(data);
      return activity;
    },
    async getActivitiesByCircle(circleId, limit = 100) {
      const snap = await subCol(circleId, 'activity').orderBy('at', 'desc').limit(limit).get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as Activity);
    },

    /* ── Outbox ────────────────────────────────────── */
    async createOutboxEntry(circleId, entry) {
      const { id, ...data } = entry;
      await subCol(circleId, 'outbox').doc(id).set(data);
      return entry;
    },
    async getOutboxByCircle(circleId, limit = 100) {
      const snap = await subCol(circleId, 'outbox').orderBy('at', 'desc').limit(limit).get();
      return snap.docs.map((d) => ({ id: d.id, circleId, ...d.data() }) as OutboxEntry);
    },
    async getOutboxByDedupeKey(circleId, dedupeKey) {
      const snap = await subCol(circleId, 'outbox')
        .where('dedupeKey', '==', dedupeKey)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0]!;
      return { id: doc.id, circleId, ...doc.data() } as OutboxEntry;
    },

    /* ── Visit Links ───────────────────────────────── */
    async createVisitLink(circleId, link) {
      const { id, ...data } = link;
      await subCol(circleId, 'visitLinks').doc(id).set(data);
      return link;
    },
    async getVisitLinkByTokenHash(tokenHash) {
      const snap = await db
        .collectionGroup('visitLinks')
        .where('tokenHash', '==', tokenHash)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0]!;
      return { id: doc.id, circleId: doc.ref.parent.parent!.id, ...doc.data() } as VisitLink;
    },
    async updateVisitLink(circleId, linkId, data) {
      await subCol(circleId, 'visitLinks').doc(linkId).update(data);
    },

    /* ── Bulk / utility ────────────────────────────── */
    async getAllCircles() {
      const snap = await db.collection('circles').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Circle);
    },
  };

  return repo;
}
