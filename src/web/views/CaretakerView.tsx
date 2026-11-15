import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import type { Routine, Slot } from '../../shared/types.js';
import { PillBoxGrid } from '../components/caretaker/PillBoxGrid.js';
import { AppointmentsReadOnly } from '../components/caretaker/AppointmentsReadOnly.js';
import { GiveNowChecklist } from '../components/caretaker/GiveNowChecklist.js';
import { CaretakerHeader } from '../components/caretaker/CaretakerHeader.js';
import { ReadingDialog } from '../components/caretaker/ReadingDialog.js';
import { useCaretakerData } from '../components/caretaker/useCaretakerData.js';

interface CaretakerViewProps {
  onSignOut: () => void;
}

const SLOTS_LIST: Slot[] = ['morning', 'afternoon', 'evening', 'night'];

export const CaretakerView: React.FC<CaretakerViewProps> = ({ onSignOut }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'checklist' | 'pillbox' | 'appointments'>('checklist');
  const [activeSlot, setActiveSlot] = useState<Slot>('morning');
  const [readingDialogItem, setReadingDialogItem] = useState<Routine | null>(null);
  const [readingValue, setReadingValue] = useState('');

  const { elderName, medicines, routines, appointments, error, handleMarkGiven, saveReading } =
    useCaretakerData(activeSlot);

  const handleSubmitReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingDialogItem) return;
    await saveReading(readingDialogItem, readingValue);
    setReadingDialogItem(null);
    setReadingValue('');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <CaretakerHeader brand={t.brand} elderName={elderName} onSignOut={onSignOut} />
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
        {activeTab === 'checklist' && (
          <GiveNowChecklist
            slotsList={SLOTS_LIST}
            activeSlot={activeSlot}
            onSelectSlot={setActiveSlot}
            slotLabel={`${t.slots[activeSlot]} Medicines & Routines`}
            markedGivenLabel={t.caretaker.markedGiven}
            foodLabels={t.food}
            medicines={medicines.filter((m) => m.slots.includes(activeSlot))}
            routines={routines.filter((r) => r.slot === activeSlot)}
            onMarkGiven={handleMarkGiven}
            onOpenReadingDialog={(rt) => {
              setReadingDialogItem(rt);
              setReadingValue('');
            }}
          />
        )}
        {activeTab === 'pillbox' && (
          <PillBoxGrid medicines={medicines} title={t.caretaker.pillBox} />
        )}
        {activeTab === 'appointments' && <AppointmentsReadOnly appointments={appointments} />}
      </div>
      <ReadingDialog
        item={readingDialogItem}
        value={readingValue}
        onChange={setReadingValue}
        onSubmit={handleSubmitReading}
        onClose={() => setReadingDialogItem(null)}
      />
    </div>
  );
};
