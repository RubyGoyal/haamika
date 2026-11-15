/**
 * Unit tests for PIN hashing, verification, and lockout logic.
 */
import { describe, it, expect } from 'vitest';
import {
  hashPin,
  verifyPin,
  isLockedOut,
  afterFailedAttempt,
  afterSuccessfulAttempt,
} from '../pin.js';

describe('pin service', () => {
  describe('hashPin / verifyPin', () => {
    it('R5: hashes and verifies a correct PIN', async () => {
      const { hash, salt } = await hashPin('1234');
      expect(hash).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(await verifyPin('1234', hash, salt)).toBe(true);
    });

    it('R5: rejects an incorrect PIN', async () => {
      const { hash, salt } = await hashPin('1234');
      expect(await verifyPin('5678', hash, salt)).toBe(false);
    });

    it('R5: different salts produce different hashes', async () => {
      const r1 = await hashPin('1234');
      const r2 = await hashPin('1234');
      expect(r1.hash).not.toBe(r2.hash);
      expect(r1.salt).not.toBe(r2.salt);
    });
  });

  describe('lockout', () => {
    it('R5: not locked with fewer than 5 failures', () => {
      expect(isLockedOut(4, null)).toBe(false);
      expect(isLockedOut(5, null)).toBe(false);
      expect(isLockedOut(5, undefined)).toBe(false);
    });

    it('R5: locked after 5 failures with future lockout time', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(isLockedOut(5, future)).toBe(true);
    });

    it('R5: not locked after lockout expires', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(isLockedOut(5, past)).toBe(false);
    });

    it('R5: afterFailedAttempt sets lockout at threshold', () => {
      const result = afterFailedAttempt(4);
      expect(result.failedAttempts).toBe(5);
      expect(result.lockedUntil).toBeTruthy();
    });

    it('R5: afterFailedAttempt does not set lockout below threshold', () => {
      const result = afterFailedAttempt(2);
      expect(result.failedAttempts).toBe(3);
      expect(result.lockedUntil).toBeNull();
    });

    it('R5: afterSuccessfulAttempt resets state', () => {
      const result = afterSuccessfulAttempt();
      expect(result.failedAttempts).toBe(0);
      expect(result.lockedUntil).toBeNull();
    });
  });
});
