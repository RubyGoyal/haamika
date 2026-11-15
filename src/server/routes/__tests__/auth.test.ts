/**
 * API integration tests for authentication flow.
 * Covers: create circle, lookup, sign-in, sign-out, lockout, invalid input.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createMemoryRepository } from '../../repositories/memoryRepository.js';
import { loadConfig } from '../../config.js';
import type { Repository } from '../../repositories/repository.js';

// Set test environment
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

describe('POST /api/circles', () => {
  it('R4: creates a circle and returns code + member IDs', async () => {
    const res = await request(app)
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
      })
      .expect(201);

    expect(res.body.circleId).toBeTruthy();
    expect(res.body.circleCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(res.body.elderId).toBeTruthy();
    expect(res.body.organizerId).toBeTruthy();

    // Should set session cookie
    const cookie = res.headers['set-cookie'];
    expect(cookie).toBeDefined();
  });

  it('R5: rejects invalid elder PIN (must be 4 digits)', async () => {
    await request(app)
      .post('/api/circles')
      .send({
        elderName: 'Kamla Devi',
        preferredName: 'Amma',
        organizerName: 'Rohan',
        organizerPin: '135790',
        elderPin: '12', // too short
      })
      .expect(400);
  });

  it('R5: rejects unknown fields', async () => {
    await request(app)
      .post('/api/circles')
      .send({
        elderName: 'Kamla Devi',
        preferredName: 'Amma',
        organizerName: 'Rohan',
        organizerPin: '135790',
        elderPin: '2580',
        hackField: 'injected',
      })
      .expect(400);
  });
});

describe('POST /api/auth/lookup', () => {
  it('R4: returns member tiles for valid circle code', async () => {
    const createRes = await request(app).post('/api/circles').send({
      elderName: 'Kamla Devi',
      preferredName: 'Amma',
      organizerName: 'Rohan',
      organizerPin: '135790',
      elderPin: '2580',
    });

    const circleCode = createRes.body.circleCode.replace('-', '');

    const lookupRes = await request(app).post('/api/auth/lookup').send({ circleCode }).expect(200);

    expect(lookupRes.body.circleId).toBeTruthy();
    expect(lookupRes.body.members).toHaveLength(2);
    expect(lookupRes.body.members[0]).toHaveProperty('name');
    expect(lookupRes.body.members[0]).toHaveProperty('role');
  });

  it('R5: case-insensitive lookup with hyphen', async () => {
    const createRes = await request(app).post('/api/circles').send({
      elderName: 'Kamla Devi',
      preferredName: 'Amma',
      organizerName: 'Rohan',
      organizerPin: '135790',
      elderPin: '2580',
    });

    const code = createRes.body.circleCode.toLowerCase();

    const lookupRes = await request(app)
      .post('/api/auth/lookup')
      .send({ circleCode: code })
      .expect(200);

    expect(lookupRes.body.circleId).toBeTruthy();
  });

  it('R5: returns 404 for unknown code', async () => {
    await request(app).post('/api/auth/lookup').send({ circleCode: 'ZZZZ-ZZZZ' }).expect(404);
  });

  it('R5: rejects invalid lookup input with 400', async () => {
    await request(app).post('/api/auth/lookup').send({}).expect(400);
  });
});

describe('POST /api/auth/signin', () => {
  async function createTestCircle() {
    const res = await request(app).post('/api/circles').send({
      elderName: 'Kamla Devi',
      preferredName: 'Amma',
      organizerName: 'Rohan',
      organizerPin: '135790',
      elderPin: '2580',
    });
    return res.body;
  }

  it('R5: signs in with correct PIN', async () => {
    const { circleId, elderId } = await createTestCircle();

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ circleId, memberId: elderId, pin: '2580' })
      .expect(200);

    expect(res.body.role).toBe('elder');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('R5: rejects incorrect PIN', async () => {
    const { circleId, elderId } = await createTestCircle();

    await request(app)
      .post('/api/auth/signin')
      .send({ circleId, memberId: elderId, pin: '9999' })
      .expect(401);
  });

  it('R5: locks account after 5 failed attempts', async () => {
    const { circleId, elderId } = await createTestCircle();

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/signin')
        .send({ circleId, memberId: elderId, pin: '9999' });
    }

    // 6th attempt should get lockout
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ circleId, memberId: elderId, pin: '2580' }) // correct PIN
      .expect(423);

    expect(res.body.error).toContain('locked');
  });

  it('R5: rejects 400 for missing fields', async () => {
    await request(app).post('/api/auth/signin').send({ circleId: 'x' }).expect(400);
  });

  it('R5: rejects non-existent or removed member with 401', async () => {
    const { circleId, elderId } = await createTestCircle();

    await request(app)
      .post('/api/auth/signin')
      .send({ circleId, memberId: 'non-existent', pin: '2580' })
      .expect(401);

    // Remove member and try to sign in
    await repo.deleteMember(circleId, elderId);
    await request(app)
      .post('/api/auth/signin')
      .send({ circleId, memberId: elderId, pin: '2580' })
      .expect(401);
  });
});

describe('POST /api/auth/signout', () => {
  it('R5: clears session cookie', async () => {
    const res = await request(app).post('/api/auth/signout').expect(200);

    expect(res.body.ok).toBe(true);
    const cookie = res.headers['set-cookie'];
    expect(cookie).toBeDefined();
    expect(String(cookie)).toContain('Max-Age=0');
  });
});

describe('GET /healthz', () => {
  it('returns ok without touching external services', async () => {
    const res = await request(app).get('/healthz').expect(200);
    expect(res.body.ok).toBe(true);
  });
});
