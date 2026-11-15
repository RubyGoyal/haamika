import React from 'react';
import { LanguageToggle } from '../LanguageToggle.js';

interface CaretakerHeaderProps {
  brand: string;
  elderName: string;
  onSignOut: () => void;
}

export const CaretakerHeader: React.FC<CaretakerHeaderProps> = ({
  brand,
  elderName,
  onSignOut,
}) => {
  return (
    <header className="header">
      <div>
        <span className="brand">{brand}</span>
        <span style={{ marginLeft: '0.75rem', fontSize: '1rem', color: '#64748b' }}>
          Care for <strong>{elderName}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <LanguageToggle />
        <button
          type="button"
          onClick={onSignOut}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
};
