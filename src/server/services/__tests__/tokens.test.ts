/**
 * Unit tests for token utilities: JWT, circle codes, invite codes, SHA-256.
 */
import { describe, it, expect } from 'vitest';
import {
  generateCircleCode,
  formatCircleCode,
  normalizeCircleCode,
  generateInviteCode,
  generateVisitToken,
  sha256,
  signSession,
  verifySession,
} from '../tokens.js';
import * as jose from 'jose';

describe('tokens service', () => {
  describe('generateCircleCode', () => {
    it('R5: generates 8-character code from valid alphabet', () => {
      const code = generateCircleCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    });

    it('R5: excludes I, O, 0, 1', () => {
      // Generate many codes and check none contain excluded chars
      for (let i = 0; i < 50; i++) {
        const code = generateCircleCode();
        expect(code).not.toMatch(/[IO01]/);
      }
    });
  });

  describe('formatCircleCode', () => {
    it('R5: formats as XXXX-XXXX', () => {
      expect(formatCircleCode('KM7Q4FXR')).toBe('KM7Q-4FXR');
    });
  });

  describe('normalizeCircleCode', () => {
    it('R5: strips hyphens and uppercases', () => {
      expect(normalizeCircleCode('km7q-4fxr')).toBe('KM7Q4FXR');
    });

    it('R5: strips spaces', () => {
      expect(normalizeCircleCode('km7q 4fxr')).toBe('KM7Q4FXR');
    });
  });

  describe('generateInviteCode', () => {
    it('R5: generates 12-character hex code', () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(12);
      expect(code).toMatch(/^[0-9A-F]{12}$/);
    });
  });

  describe('generateVisitToken', () => {
    it('R5: generates 64-character hex string', () => {
      const token = generateVisitToken();
      expect(token).toHaveLength(64);
    });
  });

  describe('sha256', () => {
    it('R5: produces consistent hex hash', () => {
      const hash = sha256('test');
      expect(hash).toHaveLength(64);
      expect(sha256('test')).toBe(hash);
    });

    it('R5: different inputs produce different hashes', () => {
      expect(sha256('a')).not.toBe(sha256('b'));
    });
  });

  describe('signSession / verifySession', () => {
    const secret = 'test-secret-that-is-at-least-32-bytes-long!';

    it('R5: signs and verifies a session token', async () => {
      const payload = { circleId: 'c1', memberId: 'm1', role: 'elder' as const };
      const token = await signSession(payload, secret, '1h');
      const result = await verifySession(token, secret);
      expect(result).toEqual(payload);
    });

    it('R5: returns null for invalid token', async () => {
      const result = await verifySession('invalid.token.here', secret);
      expect(result).toBeNull();
    });

    it('R5: returns null for wrong secret', async () => {
      const payload = { circleId: 'c1', memberId: 'm1', role: 'family' as const };
      const token = await signSession(payload, secret, '1h');
      const result = await verifySession(token, 'wrong-secret-that-is-also-32-bytes!!');
      expect(result).toBeNull();
    });

    it('R5: returns null when payload has missing fields', async () => {
      const key = new TextEncoder().encode(secret);
      const invalidToken = await new jose.SignJWT({ circleId: 123 })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(key);
      const result = await verifySession(invalidToken, secret);
      expect(result).toBeNull();
    });
  });
});
