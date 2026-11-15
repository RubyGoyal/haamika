import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/index.js';
import { PillIcon } from '../components/PillIcon.js';
import { Dialog } from '../components/Dialog.js';
import { LanguageToggle } from '../components/LanguageToggle.js';
import { api, ApiError } from '../api/client.js';
import type { Medicine, Routine, Appointment, Slot } from '../../shared/types.js';

interface CaretakerViewProps {
  onSignOut: () => void;
}

export const CaretakerView: React.FC<CaretakerViewProps> = ({ onSignOut }) => {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'checklist' | 'pillbox' | 'appointments'>('checklist');
  const [elderName, setElderName] = useState('Amma');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeSlot, setActiveSlot] = useState<Slot>('morning');
  const [readingDialogItem, setReadingDialogItem] = useState<Routine | null>(null);
  const [readingValue, setReadingValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [meRes, meds, rts, appts] = await Promise.all([
        api.get<{ circle: { preferredName?: string; elderName?: string } }>('/api/me'),
        api.get<Medicine[]>('/api/medicines'),
        api.get<Routine[]>('/api/routines'),
        api.get<Appointment[]>('/api/appointments'),
      ]);
      setElderName(meRes.circle.preferredName || meRes.circle.elderName || 'Amma');
      setMedicines(meds.filter((m) => m.status === 'active'));
      setRoutines(rts.filter((r) => r.status === 'active'));
      setAppointments(appts);
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to load caretaker view');
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Record given
  const handleMarkGiven = async (itemType: 'medicine' | 'routine', itemId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.post('/api/events', {
        date: today,
        slot: activeSlot,
        itemType,
        itemId,
        status: 'taken',
      });
      alert('Dose recorded as given.');
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to record event');
    }
  };

  // Submit reading
  const handleSubmitReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingDialogItem) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.post('/api/events', {
        date: today,
        slot: readingDialogItem.slot,
        itemType: 'routine',
        itemId: readingDialogItem.id,
        status: 'taken',
        reading: readingValue,
      });
      setReadingDialogItem(null);
      setReadingValue('');
      alert('Reading successfully saved.');
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to save reading');
    }
  };

  const currentSlotMeds = medicines.filter((m) => m.slots.includes(activeSlot));
  const currentSlotRoutines = routines.filter((r) => r.slot === activeSlot);

  const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const slotsList: Slot[] = ['morning', 'afternoon', 'evening', 'night'];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <header className="header">
        <div>
          <span className="brand">{t.brand}</span>
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

      <div className="container">
        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* Tab switcher */}
        <nav className="tabs" aria-label="Caretaker navigation">
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          >
            📋 {t.caretaker.checklist}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pillbox')}
            className={`tab-btn ${activeTab === 'pillbox' ? 'active' : ''}`}
          >
            💊 {t.caretaker.pillBox}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          >
            🩺 {t.family.appointments}
          </button>
        </nav>

        {/* ── Tab 1: Give-Now Checklist ── */}
        {activeTab === 'checklist' && (
          <div>
            {/* Slot selector pill buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              {slotsList.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActiveSlot(slot)}
                  className={`btn ${activeSlot === slot ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '24px', padding: '0.5rem 1.25rem', fontWeight: 700 }}
                >
                  {t.slots[slot]}
                </button>
              ))}
            </div>

            <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>
              {t.slots[activeSlot]} Medicines & Routines
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {currentSlotMeds.map((med) => (
                <div key={med.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <PillIcon color={med.pillColor} shape={med.pillShape} size={44} />
                    <div>
                      <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{med.name} {med.strength && `(${med.strength})`}</p>
                      <p style={{ fontSize: '0.95rem', color: '#475569' }}>
                        Dose: {med.dosePerSlot} · {t.food[med.foodInstruction]}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkGiven('medicine', med.id)}
                    className="btn btn-success"
                    style={{ fontWeight: 700 }}
                  >
                    ✓ {t.caretaker.markedGiven}
                  </button>
                </div>
              ))}

              {currentSlotRoutines.map((rt) => (
                <div key={rt.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800 }}>🩺 {rt.label}</p>
                    <p style={{ fontSize: '0.95rem', color: '#475569' }}>
                      {rt.needsReading ? 'Measurement required' : 'Routine'}
                    </p>
                  </div>
                  {rt.needsReading ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReadingDialogItem(rt);
                        setReadingValue('');
                      }}
                      className="btn btn-primary"
                    >
                      Log Reading
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarkGiven('routine', rt.id)}
                      className="btn btn-success"
                    >
                      ✓ Completed
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 2: Weekly 7x4 Pill-Box Organizer Grid (SPEC §4.9) ── */}
        {activeTab === 'pillbox' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>{t.caretaker.pillBox}</h2>
            <p style={{ color: '#475569', marginBottom: '1.25rem' }}>
              Guide for physical weekly organizer pill boxes (7 Days × 4 Slots).
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Day</th>
                  {slotsList.map((slot) => (
                    <th key={slot} style={{ padding: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {daysOfWeek.map((day) => (
                  <tr key={day} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {day}
                    </td>
                    {slotsList.map((slot) => {
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
        )}

        {/* ── Tab 3: Appointments (Read-Only) ── */}
        {activeTab === 'appointments' && (
          <div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>Upcoming Appointments (Read-Only)</h2>
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
        )}
      </div>

      {/* Log Reading Dialog */}
      <Dialog
        isOpen={Boolean(readingDialogItem)}
        onClose={() => setReadingDialogItem(null)}
        title={`Record Reading: ${readingDialogItem?.label}`}
      >
        <form onSubmit={handleSubmitReading}>
          <div className="form-group">
            <label htmlFor="reading-val" className="form-label">
              Value (e.g. 135/85 for BP or 110 for Sugar)
            </label>
            <input
              id="reading-val"
              type="text"
              required
              className="form-input"
              value={readingValue}
              onChange={(e) => setReadingValue(e.target.value)}
              placeholder="e.g. 130/80"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Save Reading
          </button>
        </form>
      </Dialog>
    </div>
  );
};
