/**
 * Invite routes: create and accept invites.
 * Invites are single-use, expire after 48 hours, and stored as hashed codes.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { CreateInviteInput, AcceptInviteInput } from '../../shared/schemas.js';
import { requireRole } from '../middleware/requireRole.js';
import { inviteRateLimit } from '../middleware/rateLimits.js';
import { generateInviteCode, sha256, signSession } from '../services/tokens.js';
import { hashPin } from '../services/pin.js';
import { getConfig } from '../config.js';
import { COOKIE_NAME } from '../middleware/session.js';
import type { Invite, Member } from '../../shared/types.js';

export function inviteRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /api/invites — create a new invite. Family only.
   */
  router.post('/', requireRole('family'), async (req, res) => {
    const parsed = CreateInviteInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const code = generateInviteCode();
    const codeHash = sha256(code);
    const now = new Date();

    const invite: Invite = {
      id: randomUUID(),
      circleId,
      codeHash,
      role: parsed.data.role,
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      usedAt: null,
      createdBy: req.session!.memberId,
    };
    await repo.createInvite(circleId, invite);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'invite_created',
      target: parsed.data.role,
      summary: `Created an invite for a ${parsed.data.role}`,
      at: now.toISOString(),
    });

    res.status(201).json({ code, expiresAt: invite.expiresAt });
  });

  /**
   * GET /api/invites — list invites for the circle. Family only.
   */
  router.get('/', requireRole('family'), async (req, res) => {
    const circleId = req.session!.circleId;
    const inviteList = await repo.getInvitesByCircle(circleId);

    // Never return the code hash — just the metadata
    const result = inviteList.map((inv) => ({
      id: inv.id,
      role: inv.role,
      expiresAt: inv.expiresAt,
      used: !!inv.usedAt,
      createdBy: inv.createdBy,
    }));

    res.json(result);
  });

  /**
   * POST /api/invites/accept — accept an invite and join the circle.
   * No session required (the joiner doesn't have one yet).
   * Rate limited per SPEC §7.
   */
  router.post('/accept', inviteRateLimit, async (req, res) => {
    const parsed = AcceptInviteInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const codeHash = sha256(parsed.data.code.toUpperCase());
    const invite = await repo.getInviteByCodeHash(codeHash);

    if (!invite) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    // Check single-use
    if (invite.usedAt) {
      res.status(410).json({ error: 'This invite has already been used' });
      return;
    }

    // Check expiry
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      res.status(410).json({ error: 'This invite has expired' });
      return;
    }

    // Create member
    const pinResult = await hashPin(parsed.data.pin);
    const memberId = randomUUID();
    const now = new Date().toISOString();

    const member: Member = {
      id: memberId,
      circleId: invite.circleId,
      name: parsed.data.name,
      role: invite.role,
      email: parsed.data.email,
      pinHash: pinResult.hash,
      pinSalt: pinResult.salt,
      failedAttempts: 0,
      lockedUntil: null,
      isOrganizer: false,
      notify: { upcoming: true, missed: true, appointments: true, refill: true },
      createdAt: now,
    };
    await repo.createMember(invite.circleId, member);

    // Mark invite as used
    await repo.updateInvite(invite.circleId, invite.id, { usedAt: now });

    // Log activity
    await repo.createActivity(invite.circleId, {
      id: randomUUID(),
      circleId: invite.circleId,
      actorId: memberId,
      actorRole: invite.role,
      action: 'member_joined',
      summary: `Joined as ${invite.role}`,
      at: now,
    });

    // Sign in the new member
    const config = getConfig();
    const token = await signSession(
      { circleId: invite.circleId, memberId, role: invite.role },
      config.SESSION_SECRET,
      '7d',
    );
    const secure = config.NODE_ENV === 'production';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}${secure ? '; Secure' : ''}`,
    );

    res.status(201).json({
      memberId,
      circleId: invite.circleId,
      role: invite.role,
    });
  });

  return router;
}
