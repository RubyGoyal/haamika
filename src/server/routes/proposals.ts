/**
 * Proposals routes (R9).
 * Elder at the centre of their own healthcare decisions.
 * ONLY the elder can approve or decline proposals.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { DecideProposalInput, BatchDecideProposalsInput } from '../../shared/schemas.js';

export function proposalRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/proposals — view proposals in the circle.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const status = req.query.status as string | undefined;
    const proposals = await repo.getProposalsByCircle(circleId, status);
    res.json(proposals);
  });

  /**
   * POST /api/proposals/:id/decide — elder approves or declines a proposal.
   * Elder ONLY (SPEC §6.6: Family and Caretaker get 403).
   */
  router.post('/:id/decide', requireRole('elder'), async (req, res) => {
    const parsed = DecideProposalInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const proposalId = req.params.id as string;
    const proposal = await repo.getProposal(circleId, proposalId);

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    if (proposal.status !== 'pending') {
      res.status(409).json({ error: 'Proposal has already been decided' });
      return;
    }

    const decision = parsed.data.decision;
    const now = new Date().toISOString();

    await repo.updateProposal(circleId, proposalId, {
      status: decision,
      decidedAt: now,
    });

    const medicineId = proposal.payload['medicineId'] as string | undefined;

    if (decision === 'approved' && medicineId) {
      if (proposal.type === 'add_medicine') {
        await repo.updateMedicine(circleId, medicineId, { status: 'active' });
      } else if (proposal.type === 'stop_medicine') {
        await repo.updateMedicine(circleId, medicineId, { status: 'stopped' });
      } else if (proposal.type === 'change_medicine') {
        const changes = proposal.payload['changes'] as Record<string, unknown> | undefined;
        if (changes) {
          await repo.updateMedicine(circleId, medicineId, changes);
        }
      }
    }

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'elder',
      action: `proposal_${decision}`,
      target: (proposal.payload['medicineName'] as string) || proposal.id,
      summary: `Elder ${decision} proposal: ${proposal.type}`,
      at: now,
    });

    res.json({ ok: true, status: decision });
  });

  /**
   * POST /api/proposals/batch-decide — first-time "Okay to all" review (Elder only).
   */
  router.post('/batch-decide', requireRole('elder'), async (req, res) => {
    const parsed = BatchDecideProposalsInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const pending = await repo.getProposalsByCircle(circleId, 'pending');
    const decision = parsed.data.decision;
    const now = new Date().toISOString();

    for (const proposal of pending) {
      await repo.updateProposal(circleId, proposal.id, {
        status: decision,
        decidedAt: now,
      });

      const medicineId = proposal.payload['medicineId'] as string | undefined;
      if (decision === 'approved' && medicineId) {
        if (proposal.type === 'add_medicine') {
          await repo.updateMedicine(circleId, medicineId, { status: 'active' });
        } else if (proposal.type === 'stop_medicine') {
          await repo.updateMedicine(circleId, medicineId, { status: 'stopped' });
        }
      }
    }

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: req.session!.memberId,
      actorRole: 'elder',
      action: `proposals_batch_${decision}`,
      summary: `Elder gave ${decision} to all ${pending.length} pending proposals`,
      at: now,
    });

    res.json({ ok: true, count: pending.length, status: decision });
  });

  return router;
}
