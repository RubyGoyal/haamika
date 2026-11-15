/**
 * Unit tests for PII scrubbing.
 */
import { describe, it, expect } from 'vitest';
import { piiScrub } from '../piiScrub.js';

describe('piiScrub', () => {
  it('R8: replaces known names', () => {
    const result = piiScrub('Kamla Devi needs medicine', ['Kamla Devi']);
    expect(result).toBe('[NAME] needs medicine');
    expect(result).not.toContain('Kamla');
  });

  it('R8: replaces email addresses', () => {
    const result = piiScrub('Contact rohan@example.com for details');
    expect(result).toContain('[EMAIL]');
    expect(result).not.toContain('rohan@example.com');
  });

  it('R8: replaces phone numbers', () => {
    const result = piiScrub('Call +91 98765 43210 now');
    expect(result).toContain('[PHONE]');
    expect(result).not.toContain('98765');
  });

  it('R8: replaces blood pressure readings', () => {
    const result = piiScrub('BP is 140/90 today');
    expect(result).toContain('[READING]');
    expect(result).not.toContain('140/90');
  });

  it('R8: handles multiple replacements', () => {
    const result = piiScrub('Kamla Devi (kamla@mail.com) BP 130/80', ['Kamla Devi']);
    expect(result).not.toContain('Kamla');
    expect(result).not.toContain('kamla@mail.com');
    expect(result).not.toContain('130/80');
  });

  it('R8: returns original text when no PII found', () => {
    const result = piiScrub('Take medicine after breakfast');
    expect(result).toBe('Take medicine after breakfast');
  });

  it('R8: case-insensitive name matching', () => {
    const result = piiScrub('kamla devi needs help', ['Kamla Devi']);
    expect(result).toBe('[NAME] needs help');
  });

  it('R8: handles empty name or empty names list gracefully', () => {
    const result = piiScrub('No names here', ['', '   ']);
    expect(result).toBe('No names here');
  });
});
