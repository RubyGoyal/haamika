/**
 * Member management routes: list, remove, reset PIN.
 * Scoped to the session's circleId.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { ResetPinInput } from '../../shared/schemas.js';
import { requireRole } from '../middleware/requireRole.js';
import { hashPin } from '../services/pin.js';

export function memberRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/members — list all active members. Any authenticated member.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const members = await repo.getMembersByCircle(circleId);

    // Never return PII beyond name — no pinHash, pinSalt, email, phone
    const result = members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      isOrganizer: m.isOrganizer,
    }));

    res.json(result);
  });

  /**
   * DELETE /api/members/:id — remove a member.
   * Elder can remove anyone. Family can remove anyone except the elder.
   */
  router.delete('/:id', requireRole('elder', 'family'), async (req, res) => {
    const circleId = req.session!.circleId;
    const targetId = req.params.id as string;

    if (!targetId) {
      res.status(400).json({ error: 'Member ID required' });
      return;
    }

    // Prevent self-removal
    if (targetId === req.session!.memberId) {
      res.status(400).json({ error: 'Cannot remove yourself' });
      return;
    }

    const target = await repo.getMember(circleId, targetId);
    if (!target || target.removedAt) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Family cannot remove the elder
    if (req.session!.role === 'family' && target.role === 'elder') {
      res.status(403).json({ error: 'Cannot remove the elder' });
      return;
    }

    await repo.deleteMember(circleId, targetId);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: req.session!.role,
      action: 'member_removed',
      target: targetId,
      summary: `Removed member from the circle`,
      at: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  /**
   * POST /api/members/:id/reset-pin — reset a member's PIN.
   * Family only; can reset elder or caretaker PINs.
   */
  router.post('/:id/reset-pin', requireRole('family'), async (req, res) => {
    const circleId = req.session!.circleId;
    const targetId = req.params.id as string;

    if (!targetId) {
      res.status(400).json({ error: 'Member ID required' });
      return;
    }

    const parsed = ResetPinInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const target = await repo.getMember(circleId, targetId);
    if (!target || target.removedAt) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Family cannot reset another family member's PIN
    if (target.role === 'family' && targetId !== req.session!.memberId) {
      res.status(403).json({ error: "Cannot reset another family member's PIN" });
      return;
    }

    const pinResult = await hashPin(parsed.data.newPin);
    await repo.updateMember(circleId, targetId, {
      pinHash: pinResult.hash,
      pinSalt: pinResult.salt,
      failedAttempts: 0,
      lockedUntil: null,
    });

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'family',
      action: 'pin_reset',
      target: targetId,
      summary: `Reset PIN for a member`,
      at: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  return router;
}
