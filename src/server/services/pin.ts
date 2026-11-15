/**
 * PIN hashing and verification using Node crypto.scrypt.
 * Constant-time comparison via timingSafeEqual. No PINs are ever logged.
 */
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;
const SALT_LEN = 32;

/** Hash a PIN with a fresh random salt. Returns { hash, salt } as hex strings. */
export function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(SALT_LEN).toString('hex');
    scrypt(pin, salt, KEYLEN, (err, derived) => {
      if (err) return reject(err);
      resolve({ hash: derived.toString('hex'), salt });
    });
  });
}

/** Verify a PIN against a stored hash and salt. Constant-time comparison. */
export function verifyPin(pin: string, storedHash: string, salt: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEYLEN, (err, derived) => {
      if (err) return reject(err);
      const expected = Buffer.from(storedHash, 'hex');
      resolve(timingSafeEqual(derived, expected));
    });
  });
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Check whether a member is currently locked out. */
export function isLockedOut(
  failedAttempts: number,
  lockedUntil: string | null | undefined,
): boolean {
  if (failedAttempts < LOCKOUT_THRESHOLD) return false;
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > Date.now();
}

/** Compute lockout state after a failed attempt. */
export function afterFailedAttempt(failedAttempts: number): {
  failedAttempts: number;
  lockedUntil: string | null;
} {
  const next = failedAttempts + 1;
  if (next >= LOCKOUT_THRESHOLD) {
    return {
      failedAttempts: next,
      lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString(),
    };
  }
  return { failedAttempts: next, lockedUntil: null };
}

/** Reset failed attempts after a successful sign-in. */
export function afterSuccessfulAttempt(): { failedAttempts: number; lockedUntil: null } {
  return { failedAttempts: 0, lockedUntil: null };
}
