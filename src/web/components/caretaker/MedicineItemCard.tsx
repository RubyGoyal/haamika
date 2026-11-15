import React from 'react';
import type { Medicine } from '../../../shared/types.js';
import { PillIcon } from '../PillIcon.js';

interface MedicineItemCardProps {
  med: Medicine;
  foodLabel: string;
  markedGivenLabel: string;
  onMarkGiven: () => void;
}

export const MedicineItemCard: React.FC<MedicineItemCardProps> = ({
  med,
  foodLabel,
  markedGivenLabel,
  onMarkGiven,
}) => {
  return (
    <div
      className="card"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <PillIcon color={med.pillColor} shape={med.pillShape} size={44} />
        <div>
          <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {med.name} {med.strength && `(${med.strength})`}
          </p>
          <p style={{ fontSize: '0.95rem', color: '#475569' }}>
            Dose: {med.dosePerSlot} · {foodLabel}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onMarkGiven}
        className="btn btn-success"
        style={{ fontWeight: 700 }}
      >
        ✓ {markedGivenLabel}
      </button>
    </div>
  );
};
