import React, { useEffect, useCallback } from 'react';

interface PinPadProps {
  pin: string;
  maxDigits: 4 | 6;
  onChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  disabled?: boolean;
}

function usePinKeyboard(
  pin: string,
  maxDigits: 4 | 6,
  disabled: boolean,
  onDigit: (d: string) => void,
  onBack: () => void,
  onClear: () => void,
  onSubmit: (p: string) => void,
): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) {
        onDigit(e.key);
      } else if (e.key === 'Backspace') {
        onBack();
      } else if (e.key === 'Escape') {
        onClear();
      } else if (e.key === 'Enter' && pin.length === maxDigits) {
        onSubmit(pin);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [disabled, onBack, onClear, onDigit, maxDigits, onSubmit, pin]);
}

const PinDots: React.FC<{ pinLength: number; maxDigits: number }> = ({ pinLength, maxDigits }) => (
  <div
    role="status"
    aria-label={`${pinLength} of ${maxDigits} digits entered`}
    style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1.25rem 0 1.5rem' }}
  >
    {Array.from({ length: maxDigits }).map((_, idx) => (
      <div
        key={idx}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '3px solid #000000',
          background: idx < pinLength ? '#0284c7' : '#ffffff',
        }}
      />
    ))}
  </div>
);

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const KeypadGrid: React.FC<{
  disabled: boolean;
  pinLength: number;
  onDigit: (d: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}> = ({ disabled, pinLength, onDigit, onClear, onBackspace }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
    {DIGITS.map((d) => (
      <button
        key={d}
        type="button"
        disabled={disabled}
        onClick={() => onDigit(d)}
        className="btn btn-secondary"
        style={{
          fontSize: '1.8rem',
          fontWeight: 700,
          minHeight: '64px',
          border: '2px solid #000000',
          borderRadius: '14px',
        }}
        aria-label={`Digit ${d}`}
      >
        {d}
      </button>
    ))}
    <button
      type="button"
      disabled={disabled || pinLength === 0}
      onClick={onClear}
      className="btn btn-danger"
      style={{ fontSize: '1.2rem', fontWeight: 700, minHeight: '64px', borderRadius: '14px' }}
      aria-label="Clear all digits"
    >
      C
    </button>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onDigit('0')}
      className="btn btn-secondary"
      style={{
        fontSize: '1.8rem',
        fontWeight: 700,
        minHeight: '64px',
        border: '2px solid #000000',
        borderRadius: '14px',
      }}
      aria-label="Digit 0"
    >
      0
    </button>
    <button
      type="button"
      disabled={disabled || pinLength === 0}
      onClick={onBackspace}
      className="btn btn-secondary"
      style={{ fontSize: '1.4rem', fontWeight: 700, minHeight: '64px', borderRadius: '14px' }}
      aria-label="Delete last digit"
    >
      ⌫
    </button>
  </div>
);

export const PinPad: React.FC<PinPadProps> = ({
  pin,
  maxDigits,
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled) return;
      if (pin.length < maxDigits) {
        const next = pin + digit;
        onChange(next);
        if (next.length === maxDigits) onSubmit(next);
      }
    },
    [disabled, maxDigits, onChange, onSubmit, pin],
  );

  const handleClear = useCallback(() => {
    if (!disabled) onChange('');
  }, [disabled, onChange]);

  const handleBackspace = useCallback(() => {
    if (!disabled) onChange(pin.slice(0, -1));
  }, [disabled, onChange, pin]);

  usePinKeyboard(pin, maxDigits, disabled, handleDigit, handleBackspace, handleClear, onSubmit);

  return (
    <div
      style={{ maxWidth: '340px', margin: '0 auto', textAlign: 'center' }}
      aria-label="Numeric PIN Pad"
    >
      <PinDots pinLength={pin.length} maxDigits={maxDigits} />
      <KeypadGrid
        disabled={disabled}
        pinLength={pin.length}
        onDigit={handleDigit}
        onClear={handleClear}
        onBackspace={handleBackspace}
      />
    </div>
  );
};
