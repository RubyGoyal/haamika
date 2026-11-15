/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { VoiceModal } from '../VoiceModal.js';

expect.extend(matchers);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        intent: 'MARK_TAKEN',
        replyText: 'Mark all morning medicines as taken?',
        requiresConfirmation: true,
        actionPayload: { slot: 'morning' },
      }),
    }),
  );
});

describe('VoiceModal component (R8, R9, SPEC §4.3)', () => {
  it('renders voice assistant dialog with zero axe violations', async () => {
    const onClose = vi.fn();
    const onEmergency = vi.fn();
    const onCallFamily = vi.fn();
    const onConfirmAction = vi.fn();

    const { container } = render(
      <VoiceModal
        isOpen={true}
        onClose={onClose}
        language="hi"
        onEmergency={onEmergency}
        onCallFamily={onCallFamily}
        onConfirmAction={onConfirmAction}
      />,
    );

    // vitest-axe check
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('allows text fallback input and processes confirmation prompt', async () => {
    const onClose = vi.fn();
    const onEmergency = vi.fn();
    const onCallFamily = vi.fn();
    const onConfirmAction = vi.fn();

    render(
      <VoiceModal
        isOpen={true}
        onClose={onClose}
        language="en"
        onEmergency={onEmergency}
        onCallFamily={onCallFamily}
        onConfirmAction={onConfirmAction}
      />,
    );

    const input = screen.getByLabelText(/type message for haamika/i);
    fireEvent.change(input, { target: { value: 'I took my morning pills' } });

    const sendBtn = screen.getByRole('button', { name: /^send$/i });
    fireEvent.click(sendBtn);

    // Wait for reply and confirmation button
    const confirmBtn = await screen.findByRole('button', { name: /yes, confirm/i });
    expect(confirmBtn).toBeDefined();

    fireEvent.click(confirmBtn);
    expect(onConfirmAction).toHaveBeenCalledWith('MARK_TAKEN', { slot: 'morning' });
  });
});
