/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { PinPad } from '../PinPad.js';

expect.extend(matchers);

function PinPadWrapper({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  return <PinPad pin={pin} maxDigits={4} onChange={setPin} onSubmit={onSubmit} />;
}

describe('PinPad component', () => {
  it('R5: renders accessible keypad with zero axe violations', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<PinPadWrapper onSubmit={onSubmit} />);

    // Screen reader and labels
    expect(screen.getByRole('button', { name: /digit 1/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /digit 0/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /clear all digits/i })).toBeDefined();

    // vitest-axe check
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('R5: keyboard-only PIN entry and submission', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PinPadWrapper onSubmit={onSubmit} />);

    // Type 2, 5, 8, 0 from keyboard
    await user.keyboard('2580');

    expect(onSubmit).toHaveBeenCalledWith('2580');
  });

  it('R5: backspace and clear via keyboard', async () => {
    const onSubmit = vi.fn();
    render(<PinPadWrapper onSubmit={onSubmit} />);

    // Fire keydown for 1, 2
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    // Backspace
    fireEvent.keyDown(window, { key: 'Backspace' });
    // Type 3, 4, 5
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: '4' });
    fireEvent.keyDown(window, { key: '5' });

    expect(onSubmit).toHaveBeenCalledWith('1345');
  });
});
