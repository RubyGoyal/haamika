import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../../api/client.js';
import type { Medicine, Routine, Appointment, Slot } from '../../../shared/types.js';

export function useCaretakerData(activeSlot: Slot) {
  const [elderName, setElderName] = useState('Amma');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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

  const saveReading = async (item: Routine, readingValue: string) => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      await api.post('/api/events', {
        date: today,
        slot: item.slot,
        itemType: 'routine',
        itemId: item.id,
        status: 'taken',
        reading: readingValue,
      });
      alert('Reading successfully saved.');
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to save reading');
    }
  };

  return { elderName, medicines, routines, appointments, error, handleMarkGiven, saveReading };
}
