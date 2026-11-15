/**
 * Circle creation route.
 * Creates a circle with the elder and family organizer members.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { CreateCircleInput } from '../../shared/schemas.js';
import { hashPin } from '../services/pin.js';
import { generateCircleCode, formatCircleCode, sha256, signSession } from '../services/tokens.js';
import { getConfig } from '../config.js';
import { COOKIE_NAME } from '../middleware/session.js';
import type { Circle, Member } from '../../shared/types.js';

export function circleRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /api/circles — create a new care circle.
   * Creates the circle, elder member, and family organizer member.
   * Returns the circle code and signs in the organizer.
   */
  router.post('/', async (req, res) => {
    const parsed = CreateCircleInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const circleId = randomUUID();
    const circleCode = generateCircleCode();
    const codeHash = sha256(circleCode);

    // Hash PINs
    const [elderPinResult, organizerPinResult] = await Promise.all([
      hashPin(data.elderPin),
      hashPin(data.organizerPin),
    ]);

    const now = new Date().toISOString();

    // Create circle
    const circle: Circle = {
      id: circleId,
      elderName: data.elderName,
      preferredName: data.preferredName,
      language: data.language,
      timezone: data.timezone,
      anchors: data.anchors,
      windowBeforeMin: 30,
      windowAfterMin: 120,
      escalationAfterMin: 60,
      circleCodeHash: codeHash,
      createdAt: now,
    };
    await repo.createCircle(circle);
    await repo.setCircleCode(codeHash, circleId);

    // Create elder member
    const elderId = randomUUID();
    const elderMember: Member = {
      id: elderId,
      circleId,
      name: data.elderName,
      role: 'elder',
      pinHash: elderPinResult.hash,
      pinSalt: elderPinResult.salt,
      failedAttempts: 0,
      lockedUntil: null,
      isOrganizer: false,
      notify: { upcoming: true, missed: true, appointments: true, refill: true },
      createdAt: now,
    };
    await repo.createMember(circleId, elderMember);

    // Create family organizer
    const organizerId = randomUUID();
    const organizerMember: Member = {
      id: organizerId,
      circleId,
      name: data.organizerName,
      role: 'family',
      email: data.organizerEmail,
      pinHash: organizerPinResult.hash,
      pinSalt: organizerPinResult.salt,
      failedAttempts: 0,
      lockedUntil: null,
      isOrganizer: true,
      notify: { upcoming: false, missed: true, appointments: true, refill: true },
      createdAt: now,
    };
    await repo.createMember(circleId, organizerMember);

    // Log activity
    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: organizerId,
      actorRole: 'family',
      action: 'circle_created',
      summary: 'Created a new care circle',
      at: now,
    });

    // Sign in the organizer
    const config = getConfig();
    const token = await signSession(
      { circleId, memberId: organizerId, role: 'family' },
      config.SESSION_SECRET,
      '7d',
    );
    const secure = config.NODE_ENV === 'production';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}${secure ? '; Secure' : ''}`,
    );

    res.status(201).json({
      circleId,
      circleCode: formatCircleCode(circleCode),
      elderId,
      organizerId,
    });
  });

  return router;
}
