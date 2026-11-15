/**
 * Unit tests for geminiClient service (R8, SPEC §4.3).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { classifyWithGemini, setGeminiMock, setAiClientForTest } from '../geminiClient.js';
import { loadConfig } from '../../config.js';
import type { GoogleGenAI } from '@google/genai';

beforeEach(() => {
  loadConfig({
    SESSION_SECRET: 'test-secret-that-is-at-least-32-bytes-long!',
    CRON_SECRET: 'test-cron-secret',
    NODE_ENV: 'test',
  });
  setGeminiMock(null);
  setAiClientForTest(null);
});

describe('geminiClient', () => {
  it('returns mocked intent when mock classifier is provided', async () => {
    setGeminiMock(async () => 'WHAT_NOW');
    const result = await classifyWithGemini('what medicines now');
    expect(result).toBe('WHAT_NOW');
  });

  it('returns null when neither Vertex nor API key is configured', async () => {
    const result = await classifyWithGemini('some text');
    expect(result).toBeNull();
  });

  it('calls ai client and parses structured JSON response successfully', async () => {
    const mockAi = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ intent: 'MARK_TAKEN' }),
        }),
      },
    } as unknown as GoogleGenAI;

    setAiClientForTest(mockAi);

    const result = await classifyWithGemini('i took my pills');
    expect(result).toBe('MARK_TAKEN');
  });

  it('gracefully handles empty response or invalid JSON by returning null', async () => {
    const mockAi = {
      models: {
        generateContent: async () => ({
          text: '',
        }),
      },
    } as unknown as GoogleGenAI;

    setAiClientForTest(mockAi);

    const result = await classifyWithGemini('hello');
    expect(result).toBeNull();
  });

  it('handles client errors by logging warning and returning null', async () => {
    const mockAi = {
      models: {
        generateContent: async () => {
          throw new Error('API Rate Limited');
        },
      },
    } as unknown as GoogleGenAI;

    setAiClientForTest(mockAi);

    const result = await classifyWithGemini('error triggering text');
    expect(result).toBeNull();
  });
});
