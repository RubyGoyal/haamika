/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { SosModal } from '../SosModal.js';

expect.extend(matchers);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, alertedMembers: 2 }),
  }));
});

describe('SosModal component (R8, SPEC §4.10)', () => {
  it('renders emergency screen with zero axe violations', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <SosModal
        isOpen={true}
        onClose={onClose}
        elderName="Kamla Devi"
        familyPhone="+919876543210"
      />,
    );

    // Call 112 button
    const call112Btn = screen.getByRole('link', { name: /call national emergency number 112/i });
    expect(call112Btn).toBeDefined();
    expect(call112Btn.getAttribute('href')).toBe('tel:112');

    // Call family button
    const callFamilyBtn = screen.getByRole('link', { name: /call family at \+919876543210/i });
    expect(callFamilyBtn).toBeDefined();

    // vitest-axe check
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
