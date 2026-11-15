/**
 * Phase 2 API integration tests.
 * Requirements covered:
 * - R1: daily medications, schedules, stock decrement
 * - R2: medical appointments, Google Calendar links
 * - R3: healthcare routines, readings
 * - R4: care circle member access
 * - R5: role-based authorization matrix, 403 checks
 * - R6: adherence tracking, pattern insights
 * - R9: consent cards, elder at center (only elder can approve)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createMemoryRepository } from '../../repositories/memoryRepository.js';
import { loadConfig } from '../../config.js';
import { seedDemoCircle, DEMO_CIRCLE_CODE } from '../../seed/demo.js';
import type { Repository } from '../../repositories/repository.js';

process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-bytes-long!';
process.env.CRON_SECRET = 'test-cron-secret-value';
process.env.NODE_ENV = 'test';
process.env.DEMO_MODE = 'true';

let repo: Repository;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  loadConfig(process.env as Record<string, string>);
  repo = createMemoryRepository();
  app = createApp(repo);
});

/** Helper: create circle and return session cookies for elder and family */
async function setupCircleAndSessions() {
  const circleRes = await request(app)
    .post('/api/circles')
    .send({
      elderName: 'Kamla Devi',
      preferredName: 'Amma',
      language: 'hi',
      timezone: 'Asia/Kolkata',
      anchors: { breakfast: '08:00', lunch: '13:00', evening: '18:00', dinner: '20:30' },
      organizerName: 'Rohan',
      organizerEmail: 'rohan@example.com',
      organizerPin: '135790',
      elderPin: '2580',
    });

  const { circleId, elderId, organizerId } = circleRes.body;
  const familyCookie = circleRes.headers['set-cookie'];

  // Sign in elder to get elderCookie
  const elderSignIn = await request(app)
    .post('/api/auth/signin')
    .send({ circleId, memberId: elderId, pin: '2580' });
  const elderCookie = elderSignIn.headers['set-cookie'];

  // Add and sign in a caretaker
  const inviteRes = await request(app)
    .post('/api/invites')
    .set('Cookie', familyCookie)
    .send({ role: 'caretaker' });

  const joinRes = await request(app)
    .post('/api/invites/accept')
    .send({ code: inviteRes.body.code, name: 'Sunita', pin: '246802' });
  const caretakerCookie = joinRes.headers['set-cookie'];

  return {
    circleId,
    elderId,
    organizerId,
    caretakerId: joinRes.body.memberId,
    elderCookie,
    familyCookie,
    caretakerCookie,
  };
}

describe('Medicines & Proposals (R1, R9)', () => {
  it('R9: medicine proposed by family stays inactive until elder approves', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    // 1. Family proposes a medicine
    const proposeRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Calcium + Vitamin D3',
        strength: '500 mg',
        purpose: 'Bone strength',
        pillColor: 'pink',
        pillShape: 'round',
        foodInstruction: 'after_food',
        slots: ['afternoon'],
        dosePerSlot: 1,
        stockCount: 30,
      })
      .expect(201);

    const medId = proposeRes.body.medicine.id;
    const proposalId = proposeRes.body.proposal.id;
    expect(proposeRes.body.medicine.status).toBe('proposed');

    // 2. Elder views pending proposals
    const getPropsRes = await request(app)
      .get('/api/proposals?status=pending')
      .set('Cookie', elderCookie)
      .expect(200);

    expect(getPropsRes.body).toHaveLength(1);
    expect(getPropsRes.body[0].id).toBe(proposalId);

    // 3. Elder approves proposal
    await request(app)
      .post(`/api/proposals/${proposalId}/decide`)
      .set('Cookie', elderCookie)
      .send({ decision: 'approved' })
      .expect(200);

    // 4. Medicine is now active!
    const medsRes = await request(app)
      .get('/api/medicines')
      .set('Cookie', elderCookie)
      .expect(200);

    const approvedMed = medsRes.body.find((m: { id: string }) => m.id === medId);
    expect(approvedMed.status).toBe('active');
  });

  it('R9: family cannot approve proposal (403)', async () => {
    const { familyCookie } = await setupCircleAndSessions();

    const proposeRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Metformin',
        strength: '500 mg',
        pillColor: 'white',
        pillShape: 'oval',
        foodInstruction: 'after_food',
        slots: ['morning'],
      });

    const proposalId = proposeRes.body.proposal.id;

    // Family attempts approval -> 403
    await request(app)
      .post(`/api/proposals/${proposalId}/decide`)
      .set('Cookie', familyCookie)
      .send({ decision: 'approved' })
      .expect(403);
  });

  it('R9: caretaker cannot approve proposal (403)', async () => {
    const { familyCookie, caretakerCookie } = await setupCircleAndSessions();

    const proposeRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Amlodipine',
        strength: '5 mg',
        pillColor: 'white',
        pillShape: 'round',
        foodInstruction: 'after_food',
        slots: ['morning'],
      });

    const proposalId = proposeRes.body.proposal.id;

    // Caretaker attempts approval -> 403
    await request(app)
      .post(`/api/proposals/${proposalId}/decide`)
      .set('Cookie', caretakerCookie)
      .send({ decision: 'approved' })
      .expect(403);
  });

  it('R5: caretaker cannot propose or edit medicines (403)', async () => {
    const { caretakerCookie } = await setupCircleAndSessions();

    await request(app)
      .post('/api/medicines')
      .set('Cookie', caretakerCookie)
      .send({
        name: 'Atorvastatin',
        pillColor: 'brown',
        pillShape: 'oval',
        foodInstruction: 'after_food',
        slots: ['night'],
      })
      .expect(403);

    await request(app)
      .patch('/api/medicines/some-id')
      .set('Cookie', caretakerCookie)
      .send({ name: 'Changed' })
      .expect(403);
  });

  it('R9: elder first-time batch approval (Okay to all)', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    // Family proposes two medicines
    await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Med 1',
        pillColor: 'white',
        pillShape: 'round',
        foodInstruction: 'any',
        slots: ['morning'],
      });

    await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Med 2',
        pillColor: 'yellow',
        pillShape: 'capsule',
        foodInstruction: 'any',
        slots: ['night'],
      });

    // Elder batch approves
    const batchRes = await request(app)
      .post('/api/proposals/batch-decide')
      .set('Cookie', elderCookie)
      .send({ decision: 'approved' })
      .expect(200);

    expect(batchRes.body.count).toBe(2);

    const meds = await request(app).get('/api/medicines').set('Cookie', elderCookie);
    expect(meds.body.every((m: { status: string }) => m.status === 'active')).toBe(true);
  });

  it('R9: elder can decline a proposal and invalid inputs return 400/404/409', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    // 1. Invalid medicine input -> 400
    await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({ name: '' })
      .expect(400);

    // 2. Propose a medicine
    const propRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Iron Supplement',
        pillColor: 'red',
        pillShape: 'round',
        foodInstruction: 'after_food',
        slots: ['evening'],
      });

    const proposalId = propRes.body.proposal.id;
    const medicineId = propRes.body.medicine.id;

    // 3. Invalid decide input -> 400
    await request(app)
      .post(`/api/proposals/${proposalId}/decide`)
      .set('Cookie', elderCookie)
      .send({ decision: 'invalid_decision' })
      .expect(400);

    // 4. Non-existent proposal -> 404
    await request(app)
      .post('/api/proposals/non-existent-id/decide')
      .set('Cookie', elderCookie)
      .send({ decision: 'approved' })
      .expect(404);

    // 5. Decline the proposal
    const declineRes = await request(app)
      .post(`/api/proposals/${proposalId}/decide`)
      .set('Cookie', elderCookie)
      .send({ decision: 'declined' })
      .expect(200);

    expect(declineRes.body.status).toBe('declined');

    // Medicine remains 'proposed' (not activated)
    const meds = await request(app).get('/api/medicines').set('Cookie', elderCookie);
    const med = meds.body.find((m: { id: string }) => m.id === medicineId);
    expect(med.status).toBe('proposed');

    // 6. Deciding again returns 409 Conflict
    await request(app)
      .post(`/api/proposals/${proposalId}/decide`)
      .set('Cookie', elderCookie)
      .send({ decision: 'approved' })
      .expect(409);

    // 7. Batch decide invalid input -> 400
    await request(app)
      .post('/api/proposals/batch-decide')
      .set('Cookie', elderCookie)
      .send({ decision: 'wrong' })
      .expect(400);
  });
});

describe('Events, Stock Decrement & Adherence (R1, R6)', () => {
  it('R1, R6: marking medicine taken decrements stock and updates adherence', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    // Propose & approve medicine with stock 10
    const propRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Amlodipine',
        pillColor: 'white',
        pillShape: 'round',
        foodInstruction: 'after_food',
        slots: ['morning'],
        dosePerSlot: 2,
        stockCount: 10,
      });

    await request(app)
      .post(`/api/proposals/${propRes.body.proposal.id}/decide`)
      .set('Cookie', elderCookie)
      .send({ decision: 'approved' });

    const medId = propRes.body.medicine.id;

    // Record event taken
    const today = new Date().toISOString().slice(0, 10);
    await request(app)
      .post('/api/events')
      .set('Cookie', elderCookie)
      .send({
        date: today,
        slot: 'morning',
        itemType: 'medicine',
        itemId: medId,
        status: 'taken',
      })
      .expect(201);

    // Stock should have decreased by 2 -> 8
    const meds = await request(app).get('/api/medicines').set('Cookie', elderCookie);
    const med = meds.body.find((m: { id: string }) => m.id === medId);
    expect(med.stockCount).toBe(8);

    // Check adherence endpoint
    const adhRes = await request(app).get('/api/adherence').set('Cookie', elderCookie).expect(200);
    expect(adhRes.body.overall7d.percentage).toBe(100);
  });

  it('R6: skip with reason is recorded as elder decision', async () => {
    const { elderCookie } = await setupCircleAndSessions();
    const today = new Date().toISOString().slice(0, 10);

    const eventRes = await request(app)
      .post('/api/events')
      .set('Cookie', elderCookie)
      .send({
        date: today,
        slot: 'morning',
        itemType: 'medicine',
        itemId: 'dummy-med',
        status: 'skipped',
        reason: 'Felt unwell',
      })
      .expect(201);

    expect(eventRes.body.status).toBe('skipped');
    expect(eventRes.body.reason).toBe('Felt unwell');

    // Invalid event input -> 400
    await request(app)
      .post('/api/events')
      .set('Cookie', elderCookie)
      .send({ date: '2026-11-15' }) // missing required slot, itemType, itemId, status
      .expect(400);
  });
});

describe('Appointments & Google Calendar Links (R2)', () => {
  it('R2: family creates appointment with generated Google Calendar link', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Cookie', familyCookie)
      .send({
        doctorName: 'Dr. Mehta',
        specialty: 'Cardiology',
        place: 'Max Hospital',
        startsAt: '2025-05-10T10:00:00+05:30',
        notes: 'Annual heart checkup',
        questions: ['Should I continue Amlodipine?'],
      })
      .expect(201);

    expect(apptRes.body.googleCalendarUrl).toContain('calendar.google.com');
    expect(apptRes.body.googleCalendarUrl).toContain('Dr.+Mehta');

    // Elder can view appointments with calendar link
    const viewRes = await request(app)
      .get('/api/appointments')
      .set('Cookie', elderCookie)
      .expect(200);

    expect(viewRes.body).toHaveLength(1);
    expect(viewRes.body[0].googleCalendarUrl).toBeTruthy();

    // Family updates appointment
    await request(app)
      .patch(`/api/appointments/${apptRes.body.id}`)
      .set('Cookie', familyCookie)
      .send({ place: 'Apollo Clinic' })
      .expect(200);

    // Invalid update input -> 400
    await request(app)
      .patch(`/api/appointments/${apptRes.body.id}`)
      .set('Cookie', familyCookie)
      .send({ status: 'invalid_status' })
      .expect(400);

    // Family deletes appointment
    await request(app)
      .delete(`/api/appointments/${apptRes.body.id}`)
      .set('Cookie', familyCookie)
      .expect(200);

    // Error cases:
    await request(app)
      .post('/api/appointments')
      .set('Cookie', familyCookie)
      .send({ doctorName: '' })
      .expect(400);

    await request(app)
      .patch('/api/appointments/non-existent-id')
      .set('Cookie', familyCookie)
      .send({ place: 'Nowhere' })
      .expect(404);

    await request(app)
      .delete('/api/appointments/non-existent-id')
      .set('Cookie', familyCookie)
      .expect(404);
  });
});

describe('Routines, Schedule & Settings (R1, R3)', () => {
  it('R3: family manages healthcare routines', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    // Create routine
    const createRes = await request(app)
      .post('/api/routines')
      .set('Cookie', familyCookie)
      .send({
        type: 'bp_check',
        label: 'Morning BP Check',
        slot: 'morning',
        needsReading: true,
      })
      .expect(201);

    expect(createRes.body.id).toBeTruthy();

    // View routines
    const viewRes = await request(app)
      .get('/api/routines')
      .set('Cookie', elderCookie)
      .expect(200);

    expect(viewRes.body).toHaveLength(1);

    // Update routine
    await request(app)
      .patch(`/api/routines/${createRes.body.id}`)
      .set('Cookie', familyCookie)
      .send({ label: 'Updated BP Check' })
      .expect(200);

    // Routine error cases
    await request(app)
      .post('/api/routines')
      .set('Cookie', familyCookie)
      .send({ label: '' })
      .expect(400);

    await request(app)
      .patch(`/api/routines/${createRes.body.id}`)
      .set('Cookie', familyCookie)
      .send({ slot: 'invalid_slot' })
      .expect(400);

    await request(app)
      .patch('/api/routines/non-existent-id')
      .set('Cookie', familyCookie)
      .send({ label: 'Ghost' })
      .expect(404);
  });

  it('R1: today schedule returns time slots and items', async () => {
    const { elderCookie } = await setupCircleAndSessions();

    const schedRes = await request(app)
      .get('/api/schedule/today')
      .set('Cookie', elderCookie)
      .expect(200);

    expect(schedRes.body.slots).toBeDefined();
    expect(schedRes.body.slots.length).toBe(4); // morning, afternoon, evening, night
  });

  it('R4: settings view and update by family', async () => {
    const { familyCookie, elderCookie } = await setupCircleAndSessions();

    // View settings
    const getRes = await request(app)
      .get('/api/settings')
      .set('Cookie', elderCookie)
      .expect(200);

    expect(getRes.body.elderName).toBe('Kamla Devi');

    // Update settings
    await request(app)
      .patch('/api/settings')
      .set('Cookie', familyCookie)
      .send({ preferredName: 'Dadi' })
      .expect(200);

    // Settings invalid input -> 400
    await request(app)
      .patch('/api/settings')
      .set('Cookie', familyCookie)
      .send({ language: 'fr' }) // invalid language
      .expect(400);
  });

  it('R1: family proposes modifying and stopping a medicine', async () => {
    const { familyCookie } = await setupCircleAndSessions();

    // Propose initial medicine
    const medRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Metformin',
        pillColor: 'white',
        pillShape: 'oval',
        foodInstruction: 'after_food',
        slots: ['morning'],
      });

    const medId = medRes.body.medicine.id;

    // Propose change
    await request(app)
      .patch(`/api/medicines/${medId}`)
      .set('Cookie', familyCookie)
      .send({ dosePerSlot: 2 })
      .expect(201);

    // Propose stop
    await request(app)
      .patch(`/api/medicines/${medId}`)
      .set('Cookie', familyCookie)
      .send({ status: 'stopped' })
      .expect(201);

    // Medicine patch error cases
    await request(app)
      .patch('/api/medicines/non-existent-id')
      .set('Cookie', familyCookie)
      .send({ dosePerSlot: 3 })
      .expect(404);

    await request(app)
      .patch(`/api/medicines/${medId}`)
      .set('Cookie', familyCookie)
      .send({ dosePerSlot: -1 })
      .expect(400);
  });
});

describe('Permissions matrix (SPEC §6.6)', () => {
  it('R5: caretaker cannot view activity log or outbox (403)', async () => {
    const { caretakerCookie, elderCookie, familyCookie } = await setupCircleAndSessions();

    // Caretaker gets 403
    await request(app).get('/api/activity').set('Cookie', caretakerCookie).expect(403);
    await request(app).get('/api/outbox').set('Cookie', caretakerCookie).expect(403);

    // Elder and Family can view
    await request(app).get('/api/activity').set('Cookie', elderCookie).expect(200);
    await request(app).get('/api/activity').set('Cookie', familyCookie).expect(200);
    await request(app).get('/api/outbox').set('Cookie', elderCookie).expect(200);
    await request(app).get('/api/outbox').set('Cookie', familyCookie).expect(200);
  });
});

describe('Demo Mode Seeding (SPEC §4.12)', () => {
  it('seeds Kamla Devi circle with 14 days of history and night dose miss insight', async () => {
    const demo = await seedDemoCircle(repo);
    expect(demo.circleCode).toBe(DEMO_CIRCLE_CODE);

    // Sign in as family to verify
    const signInRes = await request(app)
      .post('/api/auth/signin')
      .send({
        circleId: demo.circleId,
        memberId: demo.familyId,
        pin: '135790',
      })
      .expect(200);

    const cookie = signInRes.headers['set-cookie'];

    // Check adherence insights
    const adh = await request(app).get('/api/adherence').set('Cookie', cookie).expect(200);
    const nightInsight = adh.body.insights.find((i: { slot?: string }) => i.slot === 'night');
    expect(nightInsight).toBeDefined();
    expect(nightInsight.missCount).toBeGreaterThanOrEqual(3);

    // Check pending proposal
    const props = await request(app).get('/api/proposals?status=pending').set('Cookie', cookie).expect(200);
    expect(props.body).toHaveLength(1);
    expect(props.body[0].payload.medicineName).toContain('Calcium');

    // Check appointments
    const appts = await request(app).get('/api/appointments').set('Cookie', cookie).expect(200);
    expect(appts.body.length).toBeGreaterThanOrEqual(2);
  });
});
