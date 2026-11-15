import type { VoiceIntent } from '../../shared/schemas.js';
import type { VoiceContext, VoiceProcessResult } from './voiceIntent.js';

type ReplyHandler = (transcript: string, ctx: VoiceContext) => VoiceProcessResult;

function handleEmergency(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  return {
    intent: 'EMERGENCY',
    replyText:
      ctx.language === 'hi'
        ? 'इमरजेंसी स्क्रीन खोली जा रही है और परिवार को तुरंत सूचना भेज दी गई है।'
        : 'Opening emergency screen and alerting your family right now.',
    requiresConfirmation: false,
  };
}

function handleWhatNow(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  const { language, currentSlotName, currentSlotMedicines } = ctx;
  const isHi = language === 'hi';
  if (!currentSlotMedicines || currentSlotMedicines.length === 0) {
    return {
      intent: 'WHAT_NOW',
      replyText: isHi
        ? 'अभी के लिए कोई दवाई बाकी नहीं है।'
        : 'You have no medicines scheduled right now.',
      requiresConfirmation: false,
    };
  }
  const medList = currentSlotMedicines.map((m) => `${m.color} ${m.shape} ${m.name}`).join(', ');
  return {
    intent: 'WHAT_NOW',
    replyText: isHi
      ? `अभी ${currentSlotName || 'वर्तमान'} समय की दवाइयां हैं: ${medList}।`
      : `For ${currentSlotName || 'now'}, your medicines are: ${medList}.`,
    requiresConfirmation: false,
  };
}

function handleMarkTaken(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  const { language, currentSlotName } = ctx;
  return {
    intent: 'MARK_TAKEN',
    replyText:
      language === 'hi'
        ? `क्या आपने ${currentSlotName || 'वर्तमान'} समय की सभी दवाइयां ले ली हैं? पुष्टि के लिए "हाँ" कहें या टैप करें।`
        : `Mark all ${currentSlotName || 'current'} medicines as taken? Say "yes" or tap to confirm.`,
    requiresConfirmation: true,
    actionPayload: { slot: currentSlotName },
  };
}

function handleSkip(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  return {
    intent: 'SKIP',
    replyText:
      ctx.language === 'hi'
        ? 'क्या आप इस समय की दवाई छोड़ना चाहते हैं? पुष्टि के लिए "हाँ" कहें या टैप करें।'
        : 'Do you want to skip this dose? Say "yes" or tap to confirm.',
    requiresConfirmation: true,
    actionPayload: { reason: 'Elder decided via voice' },
  };
}

function handleNextAppointment(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  const { language, nextAppointment } = ctx;
  if (!nextAppointment) {
    return {
      intent: 'NEXT_APPOINTMENT',
      replyText:
        language === 'hi'
          ? 'आपके लिए कोई आगामी डॉक्टर अपॉइंटमेंट दर्ज नहीं है।'
          : 'You have no upcoming doctor appointments.',
      requiresConfirmation: false,
    };
  }
  return {
    intent: 'NEXT_APPOINTMENT',
    replyText:
      language === 'hi'
        ? `आपका अगला अपॉइंटमेंट ${nextAppointment.doctorName} के साथ है।`
        : `Your next appointment is with ${nextAppointment.doctorName}.`,
    requiresConfirmation: false,
  };
}

function handleMedInfo(transcript: string, ctx: VoiceContext): VoiceProcessResult {
  const { language, currentSlotMedicines } = ctx;
  const isHi = language === 'hi';
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

function handleLogReading(transcript: string, ctx: VoiceContext): VoiceProcessResult {
  const readingMatch = transcript.match(/\b\d{2,3}\s*[/\\]\s*\d{2,3}\b/);
  const val = readingMatch ? readingMatch[0].replace(/\s+/g, '') : '120/80';
  return {
    intent: 'LOG_READING',
    replyText:
      ctx.language === 'hi'
        ? `क्या आप ब्लड प्रेशर रीडिंग ${val} दर्ज करना चाहते हैं? "हाँ" कहें या टैप करें।`
        : `Record blood pressure reading as ${val}? Say "yes" or tap to confirm.`,
    requiresConfirmation: true,
    actionPayload: { reading: val },
  };
}

function handleAddQuestion(transcript: string, ctx: VoiceContext): VoiceProcessResult {
  return {
    intent: 'ADD_QUESTION',
    replyText:
      ctx.language === 'hi'
        ? 'क्या यह सवाल डॉक्टर के अगले अपॉइंटमेंट में जोड़ें? पुष्टि के लिए "हाँ" कहें या टैप करें।'
        : 'Add this question to your next doctor visit? Say "yes" or tap to confirm.',
    requiresConfirmation: true,
    actionPayload: { question: transcript },
  };
}

function handleCallFamily(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  return {
    intent: 'CALL_FAMILY',
    replyText:
      ctx.language === 'hi'
        ? 'परिवार को कॉल करने का लिंक खोला जा रहा है।'
        : 'Opening call link for family.',
    requiresConfirmation: false,
  };
}

function handleUnknown(_transcript: string, ctx: VoiceContext): VoiceProcessResult {
  return {
    intent: 'UNKNOWN',
    replyText:
      ctx.language === 'hi'
        ? 'माफ़ कीजिए, मैं समझ नहीं पाई। आप स्क्रीन पर बड़े बटन दबा सकते हैं।'
        : "I'm sorry, I didn't quite catch that. You can tap the big buttons on screen.",
    requiresConfirmation: false,
  };
}

const HANDLERS: Record<VoiceIntent, ReplyHandler> = {
  EMERGENCY: handleEmergency,
  WHAT_NOW: handleWhatNow,
  MARK_TAKEN: handleMarkTaken,
  SKIP: handleSkip,
  NEXT_APPOINTMENT: handleNextAppointment,
  MED_INFO: handleMedInfo,
  LOG_READING: handleLogReading,
  ADD_QUESTION: handleAddQuestion,
  CALL_FAMILY: handleCallFamily,
  UNKNOWN: handleUnknown,
};

export function buildVoiceReply(
  intent: VoiceIntent,
  transcript: string,
  ctx: VoiceContext,
): VoiceProcessResult {
  const handler = HANDLERS[intent] || handleUnknown;
  return handler(transcript, ctx);
}
