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
  currentSlotMedicines?: Array<{ name: string; dose: string; color: string; shape: string; purpose?: string }>;
  nextAppointment?: { doctorName: string; startsAt: string; specialty?: string; place?: string };
}

/**
 * Check if the utterance asks for dosing advice or medication changes.
 */
export function checkDosingOrMedicineChangeSafety(transcript: string, lang: 'en' | 'hi'): {
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
  const medChangeRegex = /\b(add medicine|change medicine|stop medicine|remove medicine|delete medicine|dawai jod do|dawai badal do|dawai band kar do|dawai hata do|naya medicine)\b/i;
  if (medChangeRegex.test(lower)) {
    const safeReply =
      lang === 'hi'
        ? 'दवाइयां केवल आपका परिवार डैशबोर्ड में बदल सकता है, और इसके लिए हमेशा आपकी सहमति चाहिए।'
        : 'Medicines can only be added or changed by your family in the dashboard, and will always require your approval.';
    return { isUnsafeDosing: false, isMedicineChangeAttempt: true, safeReply };
  }

  return { isUnsafeDosing: false, isMedicineChangeAttempt: false };
}

/**
 * Deterministic keyword fallback mapping for EVERY intent in SPEC §4.3.
 */
export function fallbackKeywordClassify(transcript: string): VoiceIntent {
  // 1. Emergency first
  if (isEmergencyKeyword(transcript)) {
    return 'EMERGENCY';
  }

  const lower = transcript.toLowerCase();

  // 2. Calling family / role token
  if (
    lower.includes('[family') ||
    lower.includes('call') ||
    lower.includes('phone karo') ||
    lower.includes('phone lagao') ||
    lower.includes('baat karni hai')
  ) {
    return 'CALL_FAMILY';
  }

  // 3. Mark taken
  if (
    lower.includes('took') ||
    lower.includes('taken') ||
    lower.includes('le li') ||
    lower.includes('kha li') ||
    lower.includes('le liya') ||
    lower.includes('kha liya')
  ) {
    return 'MARK_TAKEN';
  }

  // 4. Skip with reason
  if (
    lower.includes('skip') ||
    lower.includes('nahi lungi') ||
    lower.includes('nahi lunga') ||
    lower.includes('nahi leni') ||
    lower.includes('tabiyat theek nahi')
  ) {
    return 'SKIP';
  }

  // 5. Readings (BP, sugar)
  if (
    lower.includes('bp') ||
    lower.includes('sugar') ||
    lower.includes('reading') ||
    /\b\d{2,3}\s*[/\\]\s*\d{2,3}\b/.test(lower) ||
    lower.includes('140 by 90')
  ) {
    return 'LOG_READING';
  }

  // 6. Add question for doctor (check before NEXT_APPOINTMENT to avoid false match on "doctor")
  if (
    lower.includes('poochna hai') ||
    lower.includes('ask doctor') ||
    lower.includes('sawal') ||
    lower.includes('question')
  ) {
    return 'ADD_QUESTION';
  }

  // 7. Next appointment
  if (
    lower.includes('doctor') ||
    lower.includes('appointment') ||
    lower.includes('kab jaana hai') ||
    lower.includes('visit')
  ) {
    return 'NEXT_APPOINTMENT';
  }

  // 8. Medicine information / purpose
  if (
    lower.includes('kis liye') ||
    lower.includes('why') ||
    lower.includes('purpose') ||
    lower.includes('kya kaam') ||
    lower.includes('what is')
  ) {
    return 'MED_INFO';
  }

  // 9. What now / current schedule
  if (
    lower.includes('what now') ||
    lower.includes('what medicine') ||
    lower.includes('scheduled') ||
    lower.includes('abhi') ||
    lower.includes('kaunsi dawai') ||
    lower.includes('which medicine') ||
    lower.includes('kya lena hai')
  ) {
    return 'WHAT_NOW';
  }

  return 'UNKNOWN';
}

/**
 * Builds the code-templated voice response in the elder's language.
 */
export function buildVoiceReply(
  intent: VoiceIntent,
  transcript: string,
  ctx: VoiceContext,
): VoiceProcessResult {
  const { language, currentSlotName, currentSlotMedicines, nextAppointment } = ctx;
  const isHi = language === 'hi';

  switch (intent) {
    case 'EMERGENCY':
      return {
        intent: 'EMERGENCY',
        replyText: isHi
          ? 'इमरजेंसी स्क्रीन खोली जा रही है और परिवार को तुरंत सूचना भेज दी गई है।'
          : 'Opening emergency screen and alerting your family right now.',
        requiresConfirmation: false,
      };

    case 'WHAT_NOW': {
      if (!currentSlotMedicines || currentSlotMedicines.length === 0) {
        return {
          intent: 'WHAT_NOW',
          replyText: isHi
            ? 'अभी के लिए कोई दवाई बाकी नहीं है।'
            : 'You have no medicines scheduled right now.',
          requiresConfirmation: false,
        };
      }
      const medList = currentSlotMedicines
        .map((m) => `${m.color} ${m.shape} ${m.name}`)
        .join(', ');
      return {
        intent: 'WHAT_NOW',
        replyText: isHi
          ? `अभी ${currentSlotName || 'वर्तमान'} समय की दवाइयां हैं: ${medList}।`
          : `For ${currentSlotName || 'now'}, your medicines are: ${medList}.`,
        requiresConfirmation: false,
      };
    }

    case 'MARK_TAKEN':
      return {
        intent: 'MARK_TAKEN',
        replyText: isHi
          ? `क्या आपने ${currentSlotName || 'वर्तमान'} समय की सभी दवाइयां ले ली हैं? पुष्टि के लिए "हाँ" कहें या टैप करें।`
          : `Mark all ${currentSlotName || 'current'} medicines as taken? Say "yes" or tap to confirm.`,
        requiresConfirmation: true,
        actionPayload: { slot: currentSlotName },
      };

    case 'SKIP':
      return {
        intent: 'SKIP',
        replyText: isHi
          ? 'क्या आप इस समय की दवाई छोड़ना चाहते हैं? पुष्टि के लिए "हाँ" कहें या टैप करें।'
          : 'Do you want to skip this dose? Say "yes" or tap to confirm.',
        requiresConfirmation: true,
        actionPayload: { reason: 'Elder decided via voice' },
      };

    case 'NEXT_APPOINTMENT': {
      if (!nextAppointment) {
        return {
          intent: 'NEXT_APPOINTMENT',
          replyText: isHi
            ? 'आपके लिए कोई आगामी डॉक्टर अपॉइंटमेंट दर्ज नहीं है।'
            : 'You have no upcoming doctor appointments.',
          requiresConfirmation: false,
        };
      }
      return {
        intent: 'NEXT_APPOINTMENT',
        replyText: isHi
          ? `आपका अगला अपॉइंटमेंट ${nextAppointment.doctorName} के साथ है।`
          : `Your next appointment is with ${nextAppointment.doctorName}.`,
        requiresConfirmation: false,
      };
    }

    case 'MED_INFO': {
      const match = currentSlotMedicines?.find((m) =>
        transcript.toLowerCase().includes(m.name.toLowerCase()),
      );
      if (match && match.purpose) {
        return {
          intent: 'MED_INFO',
          replyText: isHi
            ? `${match.name} का उद्देश्य: ${match.purpose}।`
            : `${match.name} is for: ${match.purpose}.`,
          requiresConfirmation: false,
        };
      }
      return {
        intent: 'MED_INFO',
        replyText: isHi
          ? 'यह दवाई डॉक्टर द्वारा निर्धारित स्वास्थ्य लाभ के लिए है।'
          : 'This medicine is prescribed by your doctor for your ongoing health.',
        requiresConfirmation: false,
      };
    }

    case 'LOG_READING': {
      const readingMatch = transcript.match(/\b\d{2,3}\s*[/\\]\s*\d{2,3}\b/);
      const val = readingMatch ? readingMatch[0].replace(/\s+/g, '') : '120/80';
      return {
        intent: 'LOG_READING',
        replyText: isHi
          ? `क्या आप ब्लड प्रेशर रीडिंग ${val} दर्ज करना चाहते हैं? "हाँ" कहें या टैप करें।`
          : `Record blood pressure reading as ${val}? Say "yes" or tap to confirm.`,
        requiresConfirmation: true,
        actionPayload: { reading: val },
      };
    }

    case 'ADD_QUESTION':
      return {
        intent: 'ADD_QUESTION',
        replyText: isHi
          ? 'क्या यह सवाल डॉक्टर के अगले अपॉइंटमेंट में जोड़ें? पुष्टि के लिए "हाँ" कहें या टैप करें।'
          : 'Add this question to your next doctor visit? Say "yes" or tap to confirm.',
        requiresConfirmation: true,
        actionPayload: { question: transcript },
      };

    case 'CALL_FAMILY':
      return {
        intent: 'CALL_FAMILY',
        replyText: isHi
          ? 'परिवार को कॉल करने का लिंक खोला जा रहा है।'
          : 'Opening call link for family.',
        requiresConfirmation: false,
      };

    case 'UNKNOWN':
    default:
      return {
        intent: 'UNKNOWN',
        replyText: isHi
          ? 'माफ़ कीजिए, मैं समझ नहीं पाई। आप स्क्रीन पर बड़े बटन दबा सकते हैं।'
          : "I'm sorry, I didn't quite catch that. You can tap the big buttons on screen.",
        requiresConfirmation: false,
      };
  }
}
