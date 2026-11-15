/**
 * Unit tests for whatsappLink service (R8).
 */
import { describe, it, expect } from 'vitest';
import { buildWhatsAppShareUrl } from '../whatsappLink.js';

describe('buildWhatsAppShareUrl', () => {
  it('generates share URL without phone number (general web intent)', () => {
    const url = buildWhatsAppShareUrl({
      elderName: 'Kamla Devi',
      adherencePercentage: 92,
      todaySummary: '3 of 3 doses taken',
    });

    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).toContain('Kamla%20Devi');
    expect(url).toContain('92%25');
    expect(url).toContain('3%20of%203%20doses%20taken');
  });

  it('generates direct message URL when clean phone is provided', () => {
    const url = buildWhatsAppShareUrl({
      phone: '+91 98765-43210',
      elderName: 'Amma',
      adherencePercentage: 100,
      todaySummary: 'All doses completed',
    });

    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(url).toContain('Amma');
  });
});
