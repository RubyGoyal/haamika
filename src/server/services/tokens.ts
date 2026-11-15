/**
 * Token utilities: JWT session tokens, circle code generation, invite code generation,
 * and SHA-256 hashing for codes and tokens.
 */
import { randomBytes, createHash } from 'node:crypto';
import * as jose from 'jose';
import type { SessionPayload } from '../../shared/types.js';

/**
 * Generate a circle code: 8 characters from A-HJ-NP-Z2-9 (no I, O, 0, 1),
 * displayed as XXXX-XXXX.
 */
export function generateCircleCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i]! % alphabet.length];
  }
  return code;
}

/** Format a circle code for display: XXXX-XXXX. */
export function formatCircleCode(code: string): string {
  const clean = code.replace(/-/g, '').toUpperCase();
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

/** Normalize user input for circle code: strip hyphens, uppercase. */
export function normalizeCircleCode(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase();
}

/** Generate a single-use invite code: 12 random hex characters. */
export function generateInviteCode(): string {
  return randomBytes(6).toString('hex').toUpperCase();
}

/** SHA-256 hash (hex) for storing codes and tokens without exposing the originals. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Generate a random token for doctor visit links. */
export function generateVisitToken(): string {
  return randomBytes(32).toString('hex');
}

/** Sign a JWT session token. */
export async function signSession(
  payload: SessionPayload,
  secret: string,
  expiresIn: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

/** Verify and decode a JWT session token. Returns the payload or null if invalid. */
export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key);
    if (
      typeof payload.circleId !== 'string' ||
      typeof payload.memberId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }
    return {
      circleId: payload.circleId,
      memberId: payload.memberId,
      role: payload.role as SessionPayload['role'],
    };
  } catch {
    return null;
  }
}
