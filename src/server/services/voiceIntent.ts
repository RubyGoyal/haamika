/**
 * Voice intent classification and response generator (R8, R9, SPEC §4.3).
 * Pure functions implementing:
 * 1. Strict safety rules (no medicine changes, no dosing advice)
 * 2. Deterministic keyword fallback for every intent
 * 3. Localized reply templates (en/hi)
 * 4. Confirmation requirement for state-changing intents (MARK_TAKEN, SKIP, LOG_READING, ADD_QUESTION)
 */
import type { VoiceIntent } from '../../shared/schemas.js';
import { isEmergencyKeyword } from './emergency.js';

export interface VoiceProcessResult {
  intent: VoiceIntent;
  replyText: string;
  requiresConfirmation: boolean;
  actionPayload?: Record<string, unknown>;
  isDosingAdviceQuery?: boolean;
}

export interface VoiceContext {
  language: 'en' | 'hi';
  preferredName?: string;
  elderName: string;
  currentSlotName?: string;
  currentSlotMedicines?: Array<{
    name: string;
    dose: string;
    color: string;
    shape: string;
    purpose?: string;
  }>;
  nextAppointment?: { doctorName: string; startsAt: string; specialty?: string; place?: string };
}

/**
 * Check if the utterance asks for dosing advice or medication changes.
 */
export function checkDosingOrMedicineChangeSafety(
  transcript: string,
  lang: 'en' | 'hi',
): {
  isUnsafeDosing: boolean;
  isMedicineChangeAttempt: boolean;
  safeReply?: string;
} {
  const lower = transcript.toLowerCase();

  // 1. Dosing advice questions: "Can I take two?", "double dose le lun?", "extra goli kha lun?", "दो गोली"
  const dosingKeywords = [
    'can i take two',
    'can i take 2',
    'can i take double',
    'take two',
    'take 2',
    'take double',
    'take extra',
    'take more',
    'double dose',
    'extra dose',
    'do goli',
    'दो गोली',
    'दो दवाई',
    'डबल',
    'double goli',
    'zyada goli',
    'dawai do le lun',
    'do dawai le lun',
  ];

  const isDosing =
    dosingKeywords.some((k) => lower.includes(k)) ||
    /\b(can i take (two|2|three|3|double|extra|more)|take two|take double)\b/i.test(lower);

  if (isDosing) {
    const safeReply =
      lang === 'hi'
        ? 'कृपया अपने डॉक्टर से पूछें। मैंने परिवार को बता दिया है।'
        : "Please ask your doctor. I've let your family know.";
    return { isUnsafeDosing: true, isMedicineChangeAttempt: false, safeReply };
  }

  // 2. Medicine change/add/stop attempts: Voice can NEVER modify medicines
  const medChangeRegex =
    /\b(add medicine|change medicine|stop medicine|remove medicine|delete medicine|dawai jod do|dawai badal do|dawai band kar do|dawai hata do|naya medicine)\b/i;
  if (medChangeRegex.test(lower)) {
    const safeReply =
      lang === 'hi'
        ? 'दवाइयां केवल आपका परिवार डैशबोर्ड में बदल सकता है, और इसके लिए हमेशा आपकी सहमति चाहिए।'
        : 'Medicines can only be added or changed by your family in the dashboard, and will always require your approval.';
    return { isUnsafeDosing: false, isMedicineChangeAttempt: true, safeReply };
  }

  return { isUnsafeDosing: false, isMedicineChangeAttempt: false };
}

interface KeywordRule {
  intent: VoiceIntent;
  matches: (lower: string) => boolean;
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    intent: 'CALL_FAMILY',
    matches: (l) =>
      l.includes('[family') ||
      l.includes('call') ||
      l.includes('phone karo') ||
      l.includes('phone lagao') ||
      l.includes('baat karni hai'),
  },
  {
    intent: 'MARK_TAKEN',
    matches: (l) =>
      l.includes('took') ||
      l.includes('taken') ||
      l.includes('le li') ||
      l.includes('kha li') ||
      l.includes('le liya') ||
      l.includes('kha liya'),
  },
  {
    intent: 'SKIP',
    matches: (l) =>
      l.includes('skip') ||
      l.includes('nahi lungi') ||
      l.includes('nahi lunga') ||
      l.includes('nahi leni') ||
      l.includes('tabiyat theek nahi'),
  },
  {
    intent: 'LOG_READING',
    matches: (l) =>
      l.includes('bp') ||
      l.includes('sugar') ||
      l.includes('reading') ||
      /\b\d{2,3}\s*[/\\]\s*\d{2,3}\b/.test(l) ||
      l.includes('140 by 90'),
  },
  {
    intent: 'ADD_QUESTION',
    matches: (l) =>
      l.includes('poochna hai') ||
      l.includes('ask doctor') ||
      l.includes('sawal') ||
      l.includes('question'),
  },
  {
    intent: 'NEXT_APPOINTMENT',
    matches: (l) =>
      l.includes('doctor') ||
      l.includes('appointment') ||
      l.includes('kab jaana hai') ||
      l.includes('visit'),
  },
  {
    intent: 'MED_INFO',
    matches: (l) =>
      l.includes('kis liye') ||
      l.includes('why') ||
      l.includes('purpose') ||
      l.includes('kya kaam') ||
      l.includes('what is'),
  },
  {
    intent: 'WHAT_NOW',
    matches: (l) =>
      l.includes('what now') ||
      l.includes('what medicine') ||
      l.includes('scheduled') ||
      l.includes('abhi') ||
      l.includes('kaunsi dawai') ||
      l.includes('which medicine') ||
      l.includes('kya lena hai'),
  },
];

/**
 * Deterministic keyword fallback mapping for EVERY intent in SPEC §4.3.
 */
export function fallbackKeywordClassify(transcript: string): VoiceIntent {
  if (isEmergencyKeyword(transcript)) {
    return 'EMERGENCY';
  }

  const lower = transcript.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.matches(lower)) {
      return rule.intent;
    }
  }

  return 'UNKNOWN';
}

export { buildVoiceReply } from './voiceReply.js';
