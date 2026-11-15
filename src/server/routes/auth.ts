/**
 * Authentication routes: circle lookup, sign-in, sign-out.
 * Protected by rate limiting. PINs verified with constant-time comparison.
 */
import { Router } from 'express';
import type { Repository } from '../repositories/repository.js';
import { LookupInput, SignInInput } from '../../shared/schemas.js';
import {
  verifyPin,
  isLockedOut,
  afterFailedAttempt,
  afterSuccessfulAttempt,
} from '../services/pin.js';
import { signSession, sha256, normalizeCircleCode } from '../services/tokens.js';
import { getConfig } from '../config.js';
import { COOKIE_NAME } from '../middleware/session.js';
import { logger } from '../services/logger.js';

export function authRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /api/auth/lookup — look up a circle by code.
   * Returns member tiles (id, name, role) for the sign-in screen.
   */
  router.post('/lookup', async (req, res) => {
    const parsed = LookupInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const normalized = normalizeCircleCode(parsed.data.circleCode);
    const codeHash = sha256(normalized);
    const circleId = await repo.getCircleIdByCodeHash(codeHash);
    if (!circleId) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const circle = await repo.getCircle(circleId);
    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const members = await repo.getMembersByCircle(circleId);
    const tiles = members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
    }));

    res.json({
      circleId: circle.id,
      elderName: circle.elderName,
      preferredName: circle.preferredName,
      members: tiles,
    });
  });

  /**
   * POST /api/auth/signin — authenticate with circle ID, member ID, and PIN.
   * Sets a session cookie on success.
   */
  router.post('/signin', async (req, res) => {
    const parsed = SignInInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const { circleId, memberId, pin } = parsed.data;
    const member = await repo.getMember(circleId, memberId);
    if (!member || member.removedAt) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check lockout
    if (isLockedOut(member.failedAttempts, member.lockedUntil)) {
      res.status(423).json({ error: 'Account locked. Try again in 15 minutes.' });
      return;
    }

    // Verify PIN
    const valid = await verifyPin(pin, member.pinHash, member.pinSalt);
    if (!valid) {
      const lockoutData = afterFailedAttempt(member.failedAttempts);
      await repo.updateMember(circleId, memberId, lockoutData);
      logger.warn('Failed sign-in attempt', { circleId, memberId });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Reset lockout
    await repo.updateMember(circleId, memberId, afterSuccessfulAttempt());

    // Create session
    const config = getConfig();
    const expiresIn = member.role === 'elder' ? '30d' : '7d';
    const token = await signSession(
      { circleId, memberId: member.id, role: member.role },
      config.SESSION_SECRET,
      expiresIn,
    );

    const maxAge = member.role === 'elder' ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    const secure = config.NODE_ENV === 'production';

    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`,
    );

    res.json({
      memberId: member.id,
      name: member.name,
      role: member.role,
    });
  });

  /**
   * POST /api/auth/signout — clear the session cookie.
   */
  router.post('/signout', (_req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.json({ ok: true });
  });

  return router;
}
