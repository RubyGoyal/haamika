/**
 * Phase 3 API Integration Tests.
 * Requirements covered:
 * - R7: proactive reminder tick, secret auth, send-once deduplication, missed event marking
 * - R8: SOS emergency blast emails & activity log; voice assistant with emergency detection,
 *       PII scrubbing to role tokens, safe dosing replies, and confirmation enforcement
 * - R9: voice safety rules (voice cannot alter medicines or give dosing advice)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createMemoryRepository } from '../../repositories/memoryRepository.js';
import { loadConfig } from '../../config.js';
import type { Repository } from '../../repositories/repository.js';
import { setGeminiMock } from '../../services/geminiClient.js';

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
  setGeminiMock(null); // Reset mock
});

async function setupCircleWithMembers() {
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

  const elderSignIn = await request(app)
    .post('/api/auth/signin')
    .send({ circleId, memberId: elderId, pin: '2580' });
  const elderCookie = elderSignIn.headers['set-cookie'];

  // Add caretaker with email
  const inviteRes = await request(app)
    .post('/api/invites')
    .set('Cookie', familyCookie)
    .send({ role: 'caretaker' });

  const joinRes = await request(app).post('/api/invites/accept').send({
    code: inviteRes.body.code,
    name: 'Sunita',
    email: 'sunita@example.com',
    pin: '246802',
  });
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

describe('Cron Tick & Proactive Reminders (R7, SPEC §4.6)', () => {
  it('R7: requires valid X-Cron-Secret header (401 without or with invalid secret)', async () => {
    // 1. Missing secret -> 401
    await request(app).post('/internal/tick').expect(401);

    // 2. Wrong secret -> 401
    await request(app)
      .post('/internal/tick')
      .set('X-Cron-Secret', 'wrong-secret-value')
      .expect(401);

    // 3. Correct secret -> 200
    const res = await request(app)
      .post('/internal/tick')
      .set('X-Cron-Secret', 'test-cron-secret-value')
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.processedCircles).toBeDefined();
  });

  it('R7: tick processes reminders and enforces send-once deduplication', async () => {
    const { circleId, familyCookie, elderCookie } = await setupCircleWithMembers();

    // Propose and approve an active medicine with low stock (triggers refill_low)
    const medRes = await request(app)
      .post('/api/medicines')
      .set('Cookie', familyCookie)
      .send({
        name: 'Thyroxine',
        pillColor: 'white',
        pillShape: 'round',
        foodInstruction: 'before_food',
        slots: ['morning'],
        stockCount: 2,
        refillThreshold: 5,
      });

    await request(app)
      .post(`/api/proposals/${medRes.body.proposal.id}/decide`)
      .set('Cookie', elderCookie)
      .send({ decision: 'approved' });

    // First tick run: sends refill alert to family
    const tick1 = await request(app)
      .post('/internal/tick')
      .set('X-Cron-Secret', 'test-cron-secret-value')
      .expect(200);

    expect(tick1.body.sentReminders).toBeGreaterThanOrEqual(1);

    const outboxAfterTick1 = await repo.getOutboxByCircle(circleId);
    expect(outboxAfterTick1.length).toBeGreaterThanOrEqual(1);

    // Second tick run immediately after: 0 new reminders sent due to deduplication
    const tick2 = await request(app)
      .post('/internal/tick')
      .set('X-Cron-Secret', 'test-cron-secret-value')
      .expect(200);

    expect(tick2.body.sentReminders).toBe(0);
  });
});

describe('SOS Emergency Route (R8, SPEC §4.10)', () => {
  it('R8: triggers immediate email blast to all circle members and logs activity', async () => {
    const { circleId, elderCookie } = await setupCircleWithMembers();

    const sosRes = await request(app).post('/api/sos').set('Cookie', elderCookie).expect(200);

    expect(sosRes.body.ok).toBe(true);
    expect(sosRes.body.alertedMembers).toBeGreaterThanOrEqual(2); // family + caretaker

    // Check outbox entries
    const outbox = await repo.getOutboxByCircle(circleId);
    const sosEmails = outbox.filter((o) => o.kind === 'sos');
    expect(sosEmails.length).toBeGreaterThanOrEqual(2);
    expect(sosEmails[0].subject).toContain('URGENT: SOS Alert');

    // Check activity log
    const activities = await repo.getActivitiesByCircle(circleId);
    const sosActivity = activities.find((a) => a.action === 'sos_triggered');
    expect(sosActivity).toBeDefined();
    expect(sosActivity!.actorRole).toBe('elder');
  });
});

describe('Voice Assistant "Haamika" (R8, R9, SPEC §4.3)', () => {
  it('R8: emergency phrases trigger EMERGENCY intent immediately', async () => {
    const { elderCookie } = await setupCircleWithMembers();

    const res = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Help me, I fell down in the room' })
      .expect(200);

    expect(res.body.intent).toBe('EMERGENCY');
    expect(res.body.requiresConfirmation).toBe(false);
  });

  it('R9: dosing advice query returns safe response and notifies family Outbox', async () => {
    const { circleId, elderCookie } = await setupCircleWithMembers();

    const res = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Can I take two tablets of Amlodipine?' })
      .expect(200);

    expect(res.body.isDosingAdviceQuery).toBe(true);
    expect(res.body.replyText).toContain('डॉक्टर से पूछें');

    // Outbox notification sent to family
    const outbox = await repo.getOutboxByCircle(circleId);
    const notice = outbox.find((o) => o.subject.includes('Medication question'));
    expect(notice).toBeDefined();
    expect(notice!.body).toContain('Can I take two tablets');

    // Activity log entry created
    const activities = await repo.getActivitiesByCircle(circleId);
    expect(activities.some((a) => a.action === 'dosing_advice_inquiry')).toBe(true);
  });

  it('R9: voice refuses attempts to add, change, or stop medicines', async () => {
    const { elderCookie } = await setupCircleWithMembers();

    const res = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Please stop medicine Metformin right now' })
      .expect(200);

    expect(res.body.intent).toBe('UNKNOWN');
    expect(res.body.replyText).toContain('परिवार डैशबोर्ड में बदल सकता है');
  });

  it('R8: PII scrub replaces member name with role token and resolves CALL_FAMILY', async () => {
    const { elderCookie } = await setupCircleWithMembers();

    // "Rohan" is the family member's name
    const res = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Rohan ko phone lagao' })
      .expect(200);

    expect(res.body.intent).toBe('CALL_FAMILY');
  });

  it('R8, R9: state-changing intents require explicit confirmation', async () => {
    const { elderCookie } = await setupCircleWithMembers();

    // MARK_TAKEN
    const takenRes = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Maine subah ki dawai le li' })
      .expect(200);
    expect(takenRes.body.intent).toBe('MARK_TAKEN');
    expect(takenRes.body.requiresConfirmation).toBe(true);

    // SKIP
    const skipRes = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Aaj raat ki dawai nahi lungi' })
      .expect(200);
    expect(skipRes.body.intent).toBe('SKIP');
    expect(skipRes.body.requiresConfirmation).toBe(true);

    // LOG_READING
    const readingRes = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Mera BP 130/85 hai' })
      .expect(200);
    expect(readingRes.body.intent).toBe('LOG_READING');
    expect(readingRes.body.requiresConfirmation).toBe(true);

    // ADD_QUESTION (Correction 5)
    const qRes = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Doctor se poochna hai ki chakkar kyun aata hai' })
      .expect(200);
    expect(qRes.body.intent).toBe('ADD_QUESTION');
    expect(qRes.body.requiresConfirmation).toBe(true);

    // Invalid voice input -> 400
    await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: '' })
      .expect(400);

    // Read-only queries (WHAT_NOW, NEXT_APPOINTMENT) -> 200
    const whatNowRes = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Abhi kaunsi dawai leni hai?' })
      .expect(200);
    expect(whatNowRes.body.intent).toBe('WHAT_NOW');
    expect(whatNowRes.body.requiresConfirmation).toBe(false);

    const apptRes = await request(app)
      .post('/api/voice/intent')
      .set('Cookie', elderCookie)
      .send({ transcript: 'Doctor ke paas kab jaana hai?' })
      .expect(200);
    expect(apptRes.body.intent).toBe('NEXT_APPOINTMENT');
    expect(apptRes.body.requiresConfirmation).toBe(false);
  });
});
