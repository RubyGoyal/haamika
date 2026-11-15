/**
 * API integration tests for access control: invites, members, roles, cross-circle denial.
 * Covers: invite create/accept, single-use, 48h expiry, 403 for wrong roles, cross-circle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createMemoryRepository } from '../../repositories/memoryRepository.js';
import { loadConfig } from '../../config.js';
import type { Repository } from '../../repositories/repository.js';

process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-bytes-long!';
process.env.CRON_SECRET = 'test-cron-secret-value';
process.env.NODE_ENV = 'test';

let repo: Repository;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  loadConfig(process.env as Record<string, string>);
  repo = createMemoryRepository();
  app = createApp(repo);
});

/** Helper: creates a circle and returns { circleId, circleCode, elderId, organizerId, cookie } */
async function createCircle() {
  const res = await request(app).post('/api/circles').send({
    elderName: 'Kamla Devi',
    preferredName: 'Amma',
    organizerName: 'Rohan',
    organizerEmail: 'rohan@example.com',
    organizerPin: '135790',
    elderPin: '2580',
  });
  const cookie = res.headers['set-cookie'];
  return { ...res.body, cookie };
}

/** Helper: sign in as a specific member */
async function signIn(circleId: string, memberId: string, pin: string) {
  const res = await request(app).post('/api/auth/signin').send({ circleId, memberId, pin });
  return res.headers['set-cookie'] as string;
}

describe('Invite system', () => {
  it('R5: family can create an invite', async () => {
    const { cookie } = await createCircle();

    const res = await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'caretaker' })
      .expect(201);

    expect(res.body.code).toBeTruthy();
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('R5: invite code can be used to join', async () => {
    const { cookie, circleId } = await createCircle();

    const inviteRes = await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'caretaker' });

    const acceptRes = await request(app)
      .post('/api/invites/accept')
      .send({
        code: inviteRes.body.code,
        name: 'Sunita',
        pin: '246802',
      })
      .expect(201);

    expect(acceptRes.body.circleId).toBe(circleId);
    expect(acceptRes.body.role).toBe('caretaker');
  });

  it('R5: invite is single-use', async () => {
    const { cookie } = await createCircle();

    const inviteRes = await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'caretaker' });

    // First use
    await request(app)
      .post('/api/invites/accept')
      .send({ code: inviteRes.body.code, name: 'Sunita', pin: '246802' })
      .expect(201);

    // Second use should fail
    await request(app)
      .post('/api/invites/accept')
      .send({ code: inviteRes.body.code, name: 'Another', pin: '135790' })
      .expect(410);
  });

  it('R5: expired invite is rejected', async () => {
    const { cookie, circleId } = await createCircle();

    const inviteRes = await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'caretaker' });

    // Manually expire the invite
    const invites = await repo.getInvitesByCircle(circleId);
    const invite = invites[0]!;
    await repo.updateInvite(circleId, invite.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    await request(app)
      .post('/api/invites/accept')
      .send({ code: inviteRes.body.code, name: 'Sunita', pin: '246802' })
      .expect(410);
  });

  it('R5: elder cannot create invites (403)', async () => {
    const { circleId, elderId } = await createCircle();
    const elderCookie = await signIn(circleId, elderId, '2580');

    await request(app)
      .post('/api/invites')
      .set('Cookie', elderCookie)
      .send({ role: 'caretaker' })
      .expect(403);
  });

  it('R5: cannot create invite for elder role', async () => {
    const { cookie } = await createCircle();

    await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'elder' })
      .expect(400);
  });

  it('R5: lists invites for the circle', async () => {
    const { cookie } = await createCircle();

    await request(app).post('/api/invites').set('Cookie', cookie).send({ role: 'family' });

    const res = await request(app).get('/api/invites').set('Cookie', cookie).expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].role).toBe('family');
    expect(res.body[0].used).toBe(false);
  });

  it('R5: reject invite accept with invalid input or non-existent code', async () => {
    await request(app).post('/api/invites/accept').send({ code: '' }).expect(400);

    await request(app)
      .post('/api/invites/accept')
      .send({ code: 'NONEXISTENT', name: 'Someone', pin: '123456' })
      .expect(404);
  });
});

describe('Member management', () => {
  it('R4: lists active members', async () => {
    const { cookie } = await createCircle();

    const res = await request(app).get('/api/members').set('Cookie', cookie).expect(200);

    expect(res.body).toHaveLength(2);
    // No PII leaked
    expect(res.body[0]).not.toHaveProperty('pinHash');
    expect(res.body[0]).not.toHaveProperty('email');
  });

  it('R4: elder can remove a family member', async () => {
    const { circleId, elderId, organizerId } = await createCircle();
    const elderCookie = await signIn(circleId, elderId, '2580');

    await request(app).delete(`/api/members/${organizerId}`).set('Cookie', elderCookie).expect(200);
  });

  it('R4: family cannot remove the elder (403)', async () => {
    const { cookie, elderId } = await createCircle();

    await request(app).delete(`/api/members/${elderId}`).set('Cookie', cookie).expect(403);
  });

  it('R5: caretaker cannot remove members (403)', async () => {
    const { cookie, elderId } = await createCircle();

    // Add a caretaker
    const inviteRes = await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'caretaker' });

    const acceptRes = await request(app)
      .post('/api/invites/accept')
      .send({ code: inviteRes.body.code, name: 'Sunita', pin: '246802' });

    const caretakerCookie = acceptRes.headers['set-cookie'] as string;

    await request(app).delete(`/api/members/${elderId}`).set('Cookie', caretakerCookie).expect(403);
  });

  it('R5: family can reset elder PIN', async () => {
    const { cookie, elderId } = await createCircle();

    await request(app)
      .post(`/api/members/${elderId}/reset-pin`)
      .set('Cookie', cookie)
      .send({ newPin: '5678' })
      .expect(200);
  });

  it('R5: rejects member deletion for non-existent member or self', async () => {
    const { cookie, organizerId } = await createCircle();

    // Self-removal
    await request(app).delete(`/api/members/${organizerId}`).set('Cookie', cookie).expect(400);

    // Non-existent member
    await request(app).delete('/api/members/non-existent-id').set('Cookie', cookie).expect(404);
  });

  it('R5: reset-pin validation and unauthorized checks', async () => {
    const { cookie, elderId } = await createCircle();

    // Invalid PIN format
    await request(app)
      .post(`/api/members/${elderId}/reset-pin`)
      .set('Cookie', cookie)
      .send({ newPin: '12' })
      .expect(400);

    // Non-existent member
    await request(app)
      .post('/api/members/non-existent-id/reset-pin')
      .set('Cookie', cookie)
      .send({ newPin: '1234' })
      .expect(404);

    // Cannot reset another family member's PIN
    // Add another family member first
    const inviteRes = await request(app)
      .post('/api/invites')
      .set('Cookie', cookie)
      .send({ role: 'family' });
    const joinRes = await request(app)
      .post('/api/invites/accept')
      .send({ code: inviteRes.body.code, name: 'Pooja', pin: '654321' });

    await request(app)
      .post(`/api/members/${joinRes.body.memberId}/reset-pin`)
      .set('Cookie', cookie)
      .send({ newPin: '999999' })
      .expect(403);
  });
});

describe('Cross-circle access', () => {
  it('R5: cannot access members from another circle', async () => {
    // Create two circles
    const circle1 = await createCircle();

    const circle2Res = await request(app).post('/api/circles').send({
      elderName: 'Other Elder',
      preferredName: 'Dadi',
      organizerName: 'Vikram',
      organizerPin: '654321',
      elderPin: '4321',
    });

    // Sign in to circle 1
    const cookie1 = circle1.cookie;

    // Try to access circle 2 member from circle 1 session
    const res = await request(app).get('/api/members').set('Cookie', cookie1).expect(200);

    // Should only see circle 1 members (2), not circle 2 members
    expect(res.body).toHaveLength(2);
    const memberIds = res.body.map((m: { id: string }) => m.id);
    expect(memberIds).not.toContain(circle2Res.body.elderId);
  });
});

describe('GET /api/me', () => {
  it('R4: returns current session info', async () => {
    const { cookie } = await createCircle();

    const res = await request(app).get('/api/me').set('Cookie', cookie).expect(200);

    expect(res.body.role).toBe('family');
    expect(res.body.name).toBe('Rohan');
    expect(res.body.circle.elderName).toBe('Kamla Devi');
  });

  it('R5: returns 401 without session', async () => {
    await request(app).get('/api/me').expect(401);
  });

  it('R5: returns 401 when member was removed', async () => {
    const { cookie, circleId, organizerId } = await createCircle();
    await repo.deleteMember(circleId, organizerId);

    await request(app).get('/api/me').set('Cookie', cookie).expect(401);
  });
});
