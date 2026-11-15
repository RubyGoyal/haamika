/**
 * Gemini client wrapper using @google/genai (SPEC §4.3, §5, §6.1).
 * Classifies scrubbed voice transcripts into structured intent enums.
 * Features:
 * - 4-second timeout
 * - Vertex AI when GOOGLE_GENAI_USE_VERTEXAI=true, or API key in local dev
 * - Returns null on any failure, error, or missing credentials so deterministic keyword fallback handles the request.
 */
import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../config.js';
import { logger } from './logger.js';
import type { VoiceIntent } from '../../shared/schemas.js';

let mockClassifier: ((transcript: string) => Promise<VoiceIntent | null>) | null = null;

export function setGeminiMock(
  mock: ((transcript: string) => Promise<VoiceIntent | null>) | null,
): void {
  mockClassifier = mock;
}

let aiInstance: GoogleGenAI | null = null;

export function setAiClientForTest(client: GoogleGenAI | null): void {
  aiInstance = client;
}

function getAiClient(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;

  const config = getConfig();

  if (config.GOOGLE_GENAI_USE_VERTEXAI && config.GOOGLE_CLOUD_PROJECT) {
    aiInstance = new GoogleGenAI({
      vertexai: true,
      project: config.GOOGLE_CLOUD_PROJECT,
      location: config.GOOGLE_CLOUD_LOCATION || 'us-central1',
    });
    return aiInstance;
  }

  if (config.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({
      apiKey: config.GEMINI_API_KEY,
    });
    return aiInstance;
  }

  return null;
}

const INTENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: [
        'WHAT_NOW',
        'MARK_TAKEN',
        'SKIP',
        'MED_INFO',
        'NEXT_APPOINTMENT',
        'LOG_READING',
        'ADD_QUESTION',
        'CALL_FAMILY',
        'EMERGENCY',
        'UNKNOWN',
      ],
    },
  },
  required: ['intent'],
};

const GEMINI_TIMEOUT_MS = 4000;

/**
 * Classify a scrubbed voice transcript using Gemini structured output.
 */
export async function classifyWithGemini(scrubbedTranscript: string): Promise<VoiceIntent | null> {
  if (mockClassifier) {
    return mockClassifier(scrubbedTranscript);
  }

  const ai = getAiClient();
  if (!ai) {
    return null; // Fall back to keyword matcher
  }

  const config = getConfig();
  const modelName = config.GEMINI_MODEL || 'gemini-2.5-flash';

  const systemInstruction =
    'You are a voice intent classifier for Haamika, an elderly care platform. ' +
    'Classify the user utterance into exactly one intent from the allowed enum. ' +
    'If the user asks whether they can take more/double doses or asks for dosing advice, classify as UNKNOWN. ' +
    'If the user mentions calling their family member or role token like [FAMILY_1], classify as CALL_FAMILY.';

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: modelName,
        contents: scrubbedTranscript,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: INTENT_SCHEMA,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Gemini classification timeout (4s)')),
          GEMINI_TIMEOUT_MS,
        ),
      ),
    ]);

    const text = response.text?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text) as { intent?: VoiceIntent };
    if (parsed.intent) {
      return parsed.intent;
    }
    return null;
  } catch (err: unknown) {
    logger.warn('Gemini classification unavailable, utilizing deterministic fallback', {
      error: (err as Error).message,
    });
    return null;
  }
}
