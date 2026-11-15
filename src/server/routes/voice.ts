/**
 * Voice assistant route (R8, R9, SPEC §4.3).
 * Pipeline:
 * 1. Code-based emergency check first (en/hi/Hinglish)
 * 2. Strict safety rules (no dosing advice, no medicine changes via voice)
 * 3. Member PII scrubbed to role tokens (e.g. [FAMILY_1])
 * 4. Gemini structured output classification (@google/genai) with 4s timeout
 * 5. Deterministic keyword fallback
 * 6. Code template reply generation with confirmation requirements
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../repositories/repository.js';
import { requireRole } from '../middleware/requireRole.js';
import { voiceRateLimit } from '../middleware/rateLimits.js';
import { VoiceIntentInput } from '../../shared/schemas.js';
import { isEmergencyKeyword } from '../services/emergency.js';
import { scrubWithMemberTokens } from '../services/piiScrub.js';
import { classifyWithGemini } from '../services/geminiClient.js';
import {
  checkDosingOrMedicineChangeSafety,
  fallbackKeywordClassify,
  buildVoiceReply,
  type VoiceContext,
} from '../services/voiceIntent.js';
import { getCurrentSlot } from '../services/scheduleEngine.js';
import { sendDueReminders } from '../services/emailService.js';
import type { DueReminder } from '../services/reminderEngine.js';
import { DateTime } from 'luxon';

export function voiceRoutes(repo: Repository): Router {
  const router = Router();

  /**
   * POST /api/voice/intent
   * Process voice transcript and return structured action & spoken reply.
   */
  router.post(
    '/intent',
    voiceRateLimit,
    requireRole('elder', 'family', 'caretaker'),
    async (req, res) => {
      const parsed = VoiceIntentInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
        return;
      }

      const { transcript } = parsed.data;
      const circleId = req.session!.circleId;

      const [circle, members, medicines, appointments] = await Promise.all([
        repo.getCircle(circleId),
        repo.getMembersByCircle(circleId),
        repo.getMedicinesByCircle(circleId),
        repo.getAppointmentsByCircle(circleId),
      ]);

      if (!circle) {
        res.status(404).json({ error: 'Circle not found' });
        return;
      }

      const elderTz = circle.timezone || 'Asia/Kolkata';
      const now = DateTime.now().setZone(elderTz);
      const lang = circle.language || 'hi';

      // 1. Emergency keyword check in code first
      if (isEmergencyKeyword(transcript)) {
        const emergencyReply = buildVoiceReply('EMERGENCY', transcript, {
          language: lang,
          elderName: circle.elderName,
        });
        res.json(emergencyReply);
        return;
      }

      // 2. Strict safety check: dosing advice and medicine change attempts
      const safetyCheck = checkDosingOrMedicineChangeSafety(transcript, lang);
      if (safetyCheck.isUnsafeDosing) {
        // Log activity and alert family about dosing question
        const nowIso = now.toISO()!;
        await repo.createActivity(circleId, {
          id: randomUUID(),
          circleId,
          actorId: req.session!.memberId,
          actorRole: req.session!.role,
          action: 'dosing_advice_inquiry',
          summary: `Elder asked dosing advice via voice: "${transcript}"`,
          at: nowIso,
        });

        const familyMembers = members.filter((m) => m.role === 'family' && m.email && !m.removedAt);
        const reminders: DueReminder[] = familyMembers.map((m) => ({
          circleId,
          kind: 'dose_missed_escalation',
          target: 'voice_dosing_inquiry',
          stage: 'inquiry',
          date: now.toFormat('yyyy-LL-dd'),
          to: m.email!,
          recipientId: m.id,
          recipientRole: 'family',
          subject: `Haamika Notice: Medication question from ${circle.elderName}`,
          body:
            `Hello ${m.name},\n\n` +
            `${circle.preferredName || circle.elderName} asked for dosing advice via voice:\n` +
            `"${transcript}"\n\n` +
            `Haamika informed them to consult their doctor and sent this notice so you can check in.\n\n` +
            `Best regards,\nHaamika Care Team`,
          dedupeKey: `${circleId}:dosing_inquiry:${nowIso}:${m.id}`,
        }));
        await sendDueReminders(repo, reminders);

        res.json({
          intent: 'UNKNOWN',
          replyText: safetyCheck.safeReply!,
          requiresConfirmation: false,
          isDosingAdviceQuery: true,
        });
        return;
      }

      if (safetyCheck.isMedicineChangeAttempt) {
        res.json({
          intent: 'UNKNOWN',
          replyText: safetyCheck.safeReply!,
          requiresConfirmation: false,
        });
        return;
      }

      // 3. PII Scrub with role tokens (e.g. Rohan -> [FAMILY_1])
      const { scrubbedText } = scrubWithMemberTokens(
        transcript,
        members.map((m) => ({ name: m.name, role: m.role })),
      );

      // 4. Gemini structured output classification
      let intent = await classifyWithGemini(scrubbedText);

      // 5. Fallback keyword classifier if Gemini is unavailable or failed
      if (!intent || intent === 'UNKNOWN') {
        intent = fallbackKeywordClassify(scrubbedText);
      }

      // Prepare context for template reply
      const currentSlotName =
        getCurrentSlot(
          now,
          circle.anchors,
          elderTz,
          circle.windowBeforeMin ?? 30,
          circle.windowAfterMin ?? 120,
        ) || 'morning';

      const activeMeds = medicines.filter(
        (m) => m.status === 'active' && m.slots.includes(currentSlotName),
      );
      const nextAppt = appointments
        .filter((a) => a.status === 'upcoming')
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

      const voiceCtx: VoiceContext = {
        language: lang,
        elderName: circle.elderName,
        preferredName: circle.preferredName,
        currentSlotName,
        currentSlotMedicines: activeMeds.map((m) => ({
          name: m.name,
          dose: m.strength || '1 dose',
          color: m.pillColor,
          shape: m.pillShape,
          purpose: m.purpose,
        })),
        nextAppointment: nextAppt
          ? {
              doctorName: nextAppt.doctorName,
              startsAt: nextAppt.startsAt,
              specialty: nextAppt.specialty,
              place: nextAppt.place,
            }
          : undefined,
      };

      const result = buildVoiceReply(intent, transcript, voiceCtx);
      res.json(result);
    },
  );

  return router;
}
