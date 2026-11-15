import React from 'react';
import type { Routine } from '../../../shared/types.js';

interface RoutineItemCardProps {
  rt: Routine;
  onMarkGiven: () => void;
  onOpenReadingDialog: () => void;
}

export const RoutineItemCard: React.FC<RoutineItemCardProps> = ({
  rt,
  onMarkGiven,
  onOpenReadingDialog,
}) => {
  return (
    <div
      className="card"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <div>
        <p style={{ fontSize: '1.15rem', fontWeight: 800 }}>🩺 {rt.label}</p>
        <p style={{ fontSize: '0.95rem', color: '#475569' }}>
          {rt.needsReading ? 'Measurement required' : 'Routine'}
        </p>
      </div>
      {rt.needsReading ? (
        <button type="button" onClick={onOpenReadingDialog} className="btn btn-primary">
          Log Reading
        </button>
      ) : (
        <button type="button" onClick={onMarkGiven} className="btn btn-success">
          ✓ Completed
        </button>
      )}
    </div>
  );
};
