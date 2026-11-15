/**
 * Unit tests for voice intent classifier and safety rules (R8, R9, SPEC §4.3).
 */
import { describe, it, expect } from 'vitest';
import {
  fallbackKeywordClassify,
  checkDosingOrMedicineChangeSafety,
  buildVoiceReply,
} from '../voiceIntent.js';

describe('Voice Safety Guards (R9, SPEC §4.3)', () => {
  it('strictly blocks dosing advice questions with fixed safe reply (en & hi)', () => {
    const enSafety = checkDosingOrMedicineChangeSafety('Can I take two tablets today?', 'en');
    expect(enSafety.isUnsafeDosing).toBe(true);
    expect(enSafety.safeReply).toBe("Please ask your doctor. I've let your family know.");

    const hiSafety = checkDosingOrMedicineChangeSafety('क्या मैं दो गोली ले लूं?', 'hi');
    expect(hiSafety.isUnsafeDosing).toBe(true);
    expect(hiSafety.safeReply).toBe('कृपया अपने डॉक्टर से पूछें। मैंने परिवार को बता दिया है।');
  });

  it('strictly blocks attempts to add, change, or stop medicines via voice', () => {
    const changeAttempt = checkDosingOrMedicineChangeSafety('Please stop medicine Metformin', 'en');
    expect(changeAttempt.isMedicineChangeAttempt).toBe(true);
    expect(changeAttempt.safeReply).toContain(
      'Medicines can only be added or changed by your family',
    );

    const addAttempt = checkDosingOrMedicineChangeSafety('Naya medicine add kar do', 'hi');
    expect(addAttempt.isMedicineChangeAttempt).toBe(true);
    expect(addAttempt.safeReply).toContain('दवाइयां केवल आपका परिवार डैशबोर्ड में बदल सकता है');
  });
});

describe('Fallback Keyword Classifier for Every Intent (SPEC §4.3)', () => {
  it('maps EMERGENCY keywords', () => {
    expect(fallbackKeywordClassify('I fell down and cannot get up')).toBe('EMERGENCY');
    expect(fallbackKeywordClassify('Chakkar aa raha hai bohot')).toBe('EMERGENCY');
    expect(fallbackKeywordClassify('सीने में दर्द हो रहा है')).toBe('EMERGENCY');
  });

  it('maps CALL_FAMILY with member role tokens and standard phrases', () => {
    expect(fallbackKeywordClassify('[FAMILY_1] ko phone lagao')).toBe('CALL_FAMILY');
    expect(fallbackKeywordClassify('Call my family')).toBe('CALL_FAMILY');
    expect(fallbackKeywordClassify('Beta se baat karni hai phone karo')).toBe('CALL_FAMILY');
  });

  it('maps WHAT_NOW', () => {
    expect(fallbackKeywordClassify('Abhi kaunsi dawai leni hai?')).toBe('WHAT_NOW');
    expect(fallbackKeywordClassify('What medicines are scheduled now?')).toBe('WHAT_NOW');
  });

  it('maps MARK_TAKEN', () => {
    expect(fallbackKeywordClassify('Maine subah ki dawai le li')).toBe('MARK_TAKEN');
    expect(fallbackKeywordClassify('I took all my pills')).toBe('MARK_TAKEN');
  });

  it('maps SKIP', () => {
    expect(fallbackKeywordClassify('Aaj raat ki dawai nahi lungi')).toBe('SKIP');
    expect(fallbackKeywordClassify('Please skip this dose')).toBe('SKIP');
  });

  it('maps LOG_READING', () => {
    expect(fallbackKeywordClassify('Mera BP 140 by 90 hai')).toBe('LOG_READING');
    expect(fallbackKeywordClassify('Record sugar reading')).toBe('LOG_READING');
  });

  it('maps NEXT_APPOINTMENT', () => {
    expect(fallbackKeywordClassify('Doctor ke paas kab jaana hai?')).toBe('NEXT_APPOINTMENT');
    expect(fallbackKeywordClassify('When is my next appointment?')).toBe('NEXT_APPOINTMENT');
  });

  it('maps ADD_QUESTION', () => {
    expect(fallbackKeywordClassify('Doctor se poochna hai ki chakkar kyun aata hai')).toBe(
      'ADD_QUESTION',
    );
    expect(fallbackKeywordClassify('Ask doctor why my knee hurts')).toBe('ADD_QUESTION');
  });

  it('maps MED_INFO', () => {
    expect(fallbackKeywordClassify('Yeh Metformin kis liye hai?')).toBe('MED_INFO');
    expect(fallbackKeywordClassify('What is the purpose of Amlodipine?')).toBe('MED_INFO');
  });

  it('maps UNKNOWN for unmatched phrases', () => {
    expect(fallbackKeywordClassify('Aaj mausam kaisa hai')).toBe('UNKNOWN');
  });
});

describe('Confirmation Enforcement (R9, Correction 5)', () => {
  const dummyCtx = {
    language: 'hi' as const,
    elderName: 'Kamla Devi',
    currentSlotName: 'morning',
  };

  it('enforces requiresConfirmation on state-changing intents including ADD_QUESTION', () => {
    expect(buildVoiceReply('MARK_TAKEN', '', dummyCtx).requiresConfirmation).toBe(true);
    expect(buildVoiceReply('SKIP', '', dummyCtx).requiresConfirmation).toBe(true);
    expect(buildVoiceReply('LOG_READING', '130/80', dummyCtx).requiresConfirmation).toBe(true);
    expect(
      buildVoiceReply('ADD_QUESTION', 'Will I need blood test?', dummyCtx).requiresConfirmation,
    ).toBe(true);
  });

  it('does not require confirmation for read-only queries', () => {
    expect(buildVoiceReply('WHAT_NOW', '', dummyCtx).requiresConfirmation).toBe(false);
    expect(buildVoiceReply('NEXT_APPOINTMENT', '', dummyCtx).requiresConfirmation).toBe(false);
    expect(buildVoiceReply('MED_INFO', '', dummyCtx).requiresConfirmation).toBe(false);
    expect(buildVoiceReply('CALL_FAMILY', '', dummyCtx).requiresConfirmation).toBe(false);
    expect(buildVoiceReply('UNKNOWN', '', dummyCtx).requiresConfirmation).toBe(false);
  });

  it('builds localized replies for WHAT_NOW, NEXT_APPOINTMENT, and MED_INFO branches', () => {
    const fullCtx = {
      language: 'en' as const,
      elderName: 'Kamla Devi',
      currentSlotName: 'morning',
      currentSlotMedicines: [
        {
          name: 'Metformin',
          dose: '500 mg',
          color: 'white',
          shape: 'oval',
          purpose: 'Control blood sugar',
        },
      ],
      nextAppointment: {
        doctorName: 'Dr. Mehta',
        startsAt: '2026-11-20T10:00:00Z',
      },
    };

    // WHAT_NOW with medicine
    const whatNowEn = buildVoiceReply('WHAT_NOW', '', fullCtx);
    expect(whatNowEn.replyText).toContain('white oval Metformin');

    // NEXT_APPOINTMENT with appointment
    const nextApptEn = buildVoiceReply('NEXT_APPOINTMENT', '', fullCtx);
    expect(nextApptEn.replyText).toContain('Dr. Mehta');

    // MED_INFO with match
    const medInfoEn = buildVoiceReply('MED_INFO', 'Tell me about Metformin', fullCtx);
    expect(medInfoEn.replyText).toContain('Control blood sugar');

    // EMERGENCY
    const emerg = buildVoiceReply('EMERGENCY', '', fullCtx);
    expect(emerg.replyText).toContain('emergency screen');
  });
});
