/**
 * Adherence routes (R6).
 * Computes 7-day and 30-day adherence percentages, breakdown by medicine and slot,
 * and rule-based pattern insights (e.g. night dose miss patterns).
 */
import { Router } from 'express';
import { DateTime } from 'luxon';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  computeAdherence,
  adherenceByMedicine,
  adherenceBySlot,
  filterEventsByDateRange,
} from '../services/adherence.js';
import { detectInsights } from '../services/insights.js';

export function adherenceRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * GET /api/adherence — comprehensive adherence reports and pattern insights.
   */
  router.get('/', requireRole('elder', 'family', 'caretaker'), async (req, res) => {
    const circleId = req.session!.circleId;
    const circle = await repo.getCircle(circleId);
    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const timezone = circle.timezone;
    const today = DateTime.now().setZone(timezone);
    const startDate30d = today.minus({ days: 30 }).toISODate()!;
    const startDate7d = today.minus({ days: 7 }).toISODate()!;
    const todayStr = today.toISODate()!;

    const [allEvents, medicines] = await Promise.all([
      repo.getEventsByCircle(circleId, startDate30d, todayStr),
      repo.getMedicinesByCircle(circleId),
    ]);

    const events30d = filterEventsByDateRange(allEvents, startDate30d, todayStr);
    const events7d = filterEventsByDateRange(allEvents, startDate7d, todayStr);

    const overall7d = computeAdherence(events7d);
    const overall30d = computeAdherence(events30d);

    const byMedicineMap = adherenceByMedicine(events30d);
    const bySlotMap = adherenceBySlot(events30d);

    const medicineNames = new Map<string, string>();
    for (const m of medicines) {
      medicineNames.set(m.id, m.name);
    }

    const byMedicine = Array.from(byMedicineMap.entries()).map(([medicineId, result]) => ({
      medicineId,
      medicineName: medicineNames.get(medicineId) || 'Unknown',
      ...result,
    }));

    const bySlot = Array.from(bySlotMap.entries()).map(([slot, result]) => ({
      slot,
      ...result,
    }));

    // Detect pattern insights on the last 7 days of events
    const insights = detectInsights(events7d, medicineNames, circle.anchors);

    // Compute day-by-day 7-day adherence for the BarChart
    const dailyStats: Array<{ date: string; dayName: string; percentage: number; taken: number; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dt = today.minus({ days: i });
      const dStr = dt.toISODate()!;
      const dayEvts = allEvents.filter((e) => e.date === dStr);
      const adherence = computeAdherence(dayEvts);
      dailyStats.push({
        date: dStr,
        dayName: dt.toFormat('ccc'), // Mon, Tue...
        percentage: adherence.percentage,
        taken: adherence.taken + adherence.takenLate,
        total: adherence.total - adherence.skipped,
      });
    }

    res.json({
      overall7d,
      overall30d,
      byMedicine,
      bySlot,
      dailyStats,
      insights,
    });
  });

  return router;
}
