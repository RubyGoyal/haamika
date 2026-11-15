import React, { useEffect, useCallback } from 'react';

interface PinPadProps {
  pin: string;
  maxDigits: 4 | 6;
  onChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  disabled?: boolean;
}

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
        if (next.length === maxDigits) {
          onSubmit(next);
        }
      }
    },
    [disabled, maxDigits, onChange, onSubmit, pin],
  );

  const handleClear = useCallback(() => {
    if (disabled) return;
    onChange('');
  }, [disabled, onChange]);

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    onChange(pin.slice(0, -1));
  }, [disabled, onChange, pin]);

  // Keyboard navigation support (0-9, Backspace, Enter, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      } else if (e.key === 'Enter' && pin.length === maxDigits) {
        onSubmit(pin);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, handleBackspace, handleClear, handleDigit, maxDigits, onSubmit, pin]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div style={{ maxWidth: '340px', margin: '0 auto', textAlign: 'center' }} aria-label="Numeric PIN Pad">
      {/* Visual Dot Indicators */}
      <div
        role="status"
        aria-label={`${pin.length} of ${maxDigits} digits entered`}
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          margin: '1.25rem 0 1.5rem',
        }}
      >
        {Array.from({ length: maxDigits }).map((_, idx) => (
          <div
            key={idx}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '3px solid #000000',
              background: idx < pin.length ? '#0284c7' : '#ffffff',
            }}
          />
        ))}
      </div>

      {/* 3x4 Grid Keypad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
        }}
      >
        {digits.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(d)}
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
          disabled={disabled || pin.length === 0}
          onClick={handleClear}
          className="btn btn-danger"
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            minHeight: '64px',
            borderRadius: '14px',
          }}
          aria-label="Clear all digits"
        >
          C
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
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
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="btn btn-secondary"
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            minHeight: '64px',
            borderRadius: '14px',
          }}
          aria-label="Delete last digit"
        >
          ⌫
        </button>
      </div>
    </div>
  );
};
