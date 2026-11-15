/**
 * Unit tests for emergency keyword detection (R8).
 */
import { describe, it, expect } from 'vitest';
import { isEmergencyKeyword } from '../emergency.js';

describe('isEmergencyKeyword', () => {
  it('detects English emergency phrases', () => {
    expect(isEmergencyKeyword('I fell down in the kitchen')).toBe(true);
    expect(isEmergencyKeyword('I have severe chest pain')).toBe(true);
    expect(isEmergencyKeyword("I can't breathe right now")).toBe(true);
    expect(isEmergencyKeyword('Call an ambulance immediately')).toBe(true);
  });

  it('detects Hindi Devanagari feminine and masculine forms', () => {
    expect(isEmergencyKeyword('मैं फर्श पर गिर गई')).toBe(true);
    expect(isEmergencyKeyword('मुझे सीने में दर्द हो रहा है')).toBe(true);
    expect(isEmergencyKeyword('बेहोश हो रही हूं')).toBe(true);
    expect(isEmergencyKeyword('सांस नहीं आ रही')).toBe(true);
    expect(isEmergencyKeyword('मदद करो जल्दी')).toBe(true);
  });

  it('detects Hinglish feminine and masculine forms', () => {
    expect(isEmergencyKeyword('Amma gir gayi hai')).toBe(true);
    expect(isEmergencyKeyword('Mujhe behosh ho rahi hoon lag raha hai')).toBe(true);
    expect(isEmergencyKeyword('Bohot tez seene mein dard hai')).toBe(true);
    expect(isEmergencyKeyword('Chakkar aa raha hai bohot')).toBe(true);
  });

  it('returns false for normal everyday medication queries', () => {
    expect(isEmergencyKeyword('Abhi kaunsi dawai leni hai?')).toBe(false);
    expect(isEmergencyKeyword('Maine subah ki dawai le li')).toBe(false);
    expect(isEmergencyKeyword('Doctor ke paas kab jaana hai?')).toBe(false);
    expect(isEmergencyKeyword('What medicines are scheduled for today?')).toBe(false);
  });
});
