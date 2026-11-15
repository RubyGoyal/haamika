import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../../app.js';
import { createMemoryRepository } from '../../repositories/memoryRepository.js';

describe('Production SPA & API Routing', () => {
  const testWebDir = join(process.cwd(), 'dist', 'web-test');
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    // Ensure temporary web directory and index.html exist
    mkdirSync(testWebDir, { recursive: true });
    writeFileSync(
      join(testWebDir, 'index.html'),
      '<!DOCTYPE html><html lang="en"><head><title>Haamika</title></head><body><div id="root">Haamika Elder Web App</div></body></html>',
      'utf-8',
    );

    const repo = createMemoryRepository();
    // Initialize app with production webDir pointing to the test index.html
    app = createApp(repo, { webDir: testWebDir });
  });

  afterAll(() => {
    if (existsSync(testWebDir)) {
      rmSync(testWebDir, { recursive: true, force: true });
    }
  });

  it('GET /elder → 200 HTML', async () => {
    const res = await request(app).get('/elder');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Haamika Elder Web App');
  });

  it('GET /api/does-not-exist → 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('GET / → 200 HTML (root landing page)', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Haamika Elder Web App');
  });

  it('GET /internal/does-not-exist → 404 JSON', async () => {
    const res = await request(app).get('/internal/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('GET /api → 404 JSON', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
