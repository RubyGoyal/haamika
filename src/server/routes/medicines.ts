/**
 * Medicines routes.
 * Scoped to circleId. Family proposes changes; elder must approve (R1, R9).
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { ProposeMedicineInput, UpdateMedicineInput } from '../../shared/schemas.js';
import type { Medicine, Proposal } from '../../shared/types.js';

export function medicineRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/medicines — list all medicines in the circle.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const medicines = await repo.getMedicinesByCircle(circleId);
    res.json(medicines);
  });

  /**
   * POST /api/medicines — propose a new medicine (Family only).
   * Stays in 'proposed' status until the elder approves (R9).
   */
  router.post('/', requireRole('family'), async (req, res) => {
    const parsed = ProposeMedicineInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const memberId = req.session!.memberId;
    const now = new Date().toISOString();
    const medicineId = randomUUID();

    const medicine: Medicine = {
      id: medicineId,
      circleId,
      ...parsed.data,
      status: 'proposed', // always proposed until elder approves
      createdAt: now,
    };
    await repo.createMedicine(circleId, medicine);

    const proposalId = randomUUID();
    const proposal: Proposal = {
      id: proposalId,
      circleId,
      type: 'add_medicine',
      payload: {
        medicineId,
        medicineName: medicine.name,
        strength: medicine.strength,
        purpose: medicine.purpose,
        slots: medicine.slots,
      },
      proposedBy: memberId,
      status: 'pending',
      createdAt: now,
    };
    await repo.createProposal(circleId, proposal);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: memberId,
      actorRole: 'family',
      action: 'medicine_proposed',
      target: medicine.name,
      summary: `Proposed adding ${medicine.name}`,
      at: now,
    });

    res.status(201).json({ medicine, proposal });
  });

  /**
   * PATCH /api/medicines/:id — propose changes or stopping a medicine (Family only).
   */
  router.patch('/:id', requireRole('family'), async (req, res) => {
    const parsed = UpdateMedicineInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const circleId = req.session!.circleId;
    const memberId = req.session!.memberId;
    const medicineId = req.params.id as string;

    const existing = await repo.getMedicine(circleId, medicineId);
    if (!existing) {
      res.status(404).json({ error: 'Medicine not found' });
      return;
    }

    const now = new Date().toISOString();
    const proposalType = parsed.data.status === 'stopped' ? 'stop_medicine' : 'change_medicine';

    const proposal: Proposal = {
      id: randomUUID(),
      circleId,
      type: proposalType,
      payload: {
        medicineId,
        medicineName: existing.name,
        changes: parsed.data,
      },
      proposedBy: memberId,
      status: 'pending',
      createdAt: now,
    };
    await repo.createProposal(circleId, proposal);

    await repo.createActivity(circleId, {
      id: randomUUID(),
      circleId,
      actorId: memberId,
      actorRole: 'family',
      action: proposalType,
      target: existing.name,
      summary: `Proposed to ${proposalType === 'stop_medicine' ? 'stop' : 'modify'} ${existing.name}`,
      at: now,
    });

    res.status(201).json({ proposal });
  });

  return router;
}
