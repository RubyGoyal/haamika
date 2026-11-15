import React from 'react';
import type { Medicine, Routine, Slot } from '../../../shared/types.js';
import { MedicineItemCard } from './MedicineItemCard.js';
import { RoutineItemCard } from './RoutineItemCard.js';

interface GiveNowChecklistProps {
  slotsList: Slot[];
  activeSlot: Slot;
  onSelectSlot: (slot: Slot) => void;
  slotLabel: string;
  markedGivenLabel: string;
  foodLabels: Record<string, string>;
  medicines: Medicine[];
  routines: Routine[];
  onMarkGiven: (itemType: 'medicine' | 'routine', itemId: string) => void;
  onOpenReadingDialog: (rt: Routine) => void;
}

export const GiveNowChecklist: React.FC<GiveNowChecklistProps> = ({
  slotsList,
  activeSlot,
  onSelectSlot,
  slotLabel,
  markedGivenLabel,
  foodLabels,
  medicines,
  routines,
  onMarkGiven,
  onOpenReadingDialog,
}) => {
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {slotsList.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onSelectSlot(slot)}
            className={`btn ${activeSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '24px', padding: '0.5rem 1.25rem', fontWeight: 700 }}
          >
            {slot}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>{slotLabel}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {medicines.map((med) => (
          <MedicineItemCard
            key={med.id}
            med={med}
            foodLabel={foodLabels[med.foodInstruction] || med.foodInstruction}
            markedGivenLabel={markedGivenLabel}
            onMarkGiven={() => onMarkGiven('medicine', med.id)}
          />
        ))}

        {routines.map((rt) => (
          <RoutineItemCard
            key={rt.id}
            rt={rt}
            onMarkGiven={() => onMarkGiven('routine', rt.id)}
            onOpenReadingDialog={() => onOpenReadingDialog(rt)}
          />
        ))}
      </div>
    </div>
  );
};
