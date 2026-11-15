import React from 'react';
import type { Appointment } from '../../../shared/types.js';

interface AppointmentsReadOnlyProps {
  appointments: Appointment[];
}

export const AppointmentsReadOnly: React.FC<AppointmentsReadOnlyProps> = ({ appointments }) => {
  return (
    <div>
      <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>
        Upcoming Appointments (Read-Only)
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {appointments.map((appt) => (
          <div key={appt.id} className="card">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{appt.doctorName}</h3>
            <p style={{ color: '#475569', fontSize: '0.95rem' }}>
              {appt.specialty} · 📅 {new Date(appt.startsAt).toLocaleString()}
            </p>
            {appt.place && <p style={{ color: '#475569', fontSize: '0.95rem' }}>📍 {appt.place}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
