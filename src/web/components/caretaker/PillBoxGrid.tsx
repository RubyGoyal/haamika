import React from 'react';
import type { Medicine, Slot } from '../../../shared/types.js';
import { PillIcon } from '../PillIcon.js';

interface PillBoxGridProps {
  medicines: Medicine[];
  title: string;
}

const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const SLOTS_LIST: Slot[] = ['morning', 'afternoon', 'evening', 'night'];

export const PillBoxGrid: React.FC<PillBoxGridProps> = ({ medicines, title }) => {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>{title}</h2>
      <p style={{ color: '#475569', marginBottom: '1.25rem' }}>
        Guide for physical weekly organizer pill boxes (7 Days × 4 Slots).
      </p>

      <table
        style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}
      >
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: '0.75rem', fontWeight: 700 }}>Day</th>
            {SLOTS_LIST.map((slot) => (
              <th
                key={slot}
                style={{ padding: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}
              >
                {slot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS_OF_WEEK.map((day) => (
            <tr key={day} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {day}
              </td>
              {SLOTS_LIST.map((slot) => {
                const medsForCell = medicines.filter(
                  (m) => m.slots.includes(slot) && m.daysOfWeek.includes(day),
                );
                return (
                  <td key={slot} style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                    {medsForCell.map((m) => (
                      <div key={m.id} style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <PillIcon color={m.pillColor} shape={m.pillShape} size={18} />{' '}
                        <strong>{m.name}</strong> ({m.dosePerSlot})
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
