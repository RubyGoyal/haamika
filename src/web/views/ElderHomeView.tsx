import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/index.js';
import { PillIcon } from '../components/PillIcon.js';
import { LanguageToggle } from '../components/LanguageToggle.js';
import { Dialog } from '../components/Dialog.js';
import { SosModal } from '../components/SosModal.js';
import { VoiceModal } from '../components/VoiceModal.js';
import { buildWhatsAppShareUrl } from '../../shared/whatsappLink.js';
import { api, ApiError } from '../api/client.js';
import type { Slot, Proposal, PillColor, PillShape, FoodInstruction } from '../../shared/types.js';
import type { VoiceIntent } from '../../shared/schemas.js';

interface ScheduleItemState {
  id: string;
  type: 'medicine' | 'routine';
  name: string;
  slot: Slot;
  status: 'pending' | 'taken' | 'taken_late' | 'skipped' | 'missed';
  medicine?: {
    strength?: string;
    purpose?: string;
    pillColor: PillColor;
    pillShape: PillShape;
    foodInstruction: FoodInstruction;
  };
  routine?: {
    type: string;
    label: string;
    needsReading: boolean;
  };
}

interface ScheduleSlotData {
  slot: Slot;
  items: ScheduleItemState[];
}

interface TodayScheduleResponse {
  date: string;
  currentSlot: Slot | null;
  slots: ScheduleSlotData[];
  nextAppointment: {
    doctorName: string;
    specialty?: string;
    place?: string;
    startsAt: string;
  } | null;
}

interface CircleMember {
  id: string;
  name: string;
  role: 'elder' | 'family' | 'caretaker';
  phone?: string;
}

interface ElderHomeViewProps {
  onSignOut: () => void;
}

export const ElderHomeView: React.FC<ElderHomeViewProps> = ({ onSignOut }) => {
  const { t, lang } = useI18n();

  const [scheduleData, setScheduleData] = useState<TodayScheduleResponse | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [preferredName, setPreferredName] = useState('Amma');
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Skip dialog state
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [itemToSkip, setItemToSkip] = useState<ScheduleItemState | null>(null);

  // Members / settings dialog state
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  // Phase 3: Voice assistant and SOS dialogs
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sched, props, meRes, mems] = await Promise.all([
        api.get<TodayScheduleResponse>('/api/schedule/today'),
        api.get<Proposal[]>('/api/proposals?status=pending'),
        api.get<{ circle: { preferredName?: string; elderName?: string } }>('/api/me'),
        api.get<CircleMember[]>('/api/members'),
      ]);
      setScheduleData(sched);
      setProposals(Array.isArray(props) ? props : []);
      setPreferredName(meRes?.circle?.preferredName || meRes?.circle?.elderName || 'Amma');
      setMembers(Array.isArray(mems) ? mems : []);
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle marking an item taken
  const handleMarkTaken = async (slot: Slot, item: ScheduleItemState) => {
    if (!scheduleData) return;
    try {
      await api.post('/api/events', {
        date: scheduleData.date,
        slot,
        itemType: item.type,
        itemId: item.id,
        status: 'taken',
      });
      await loadData();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Could not mark as taken');
    }
  };

  // Handle "I took them" (mark all pending in the slot)
  const handleMarkAllSlotTaken = async (slot: Slot, items: ScheduleItemState[]) => {
    if (!scheduleData) return;
    const pendingItems = items.filter((i) => i.status === 'pending');
    for (const item of pendingItems) {
      await api.post('/api/events', {
        date: scheduleData.date,
        slot,
        itemType: item.type,
        itemId: item.id,
        status: 'taken',
      });
    }
    await loadData();
  };

  // Handle skip with reason
  const handleSkipReason = async (reason: string) => {
    if (!scheduleData || !itemToSkip) return;
    try {
      await api.post('/api/events', {
        date: scheduleData.date,
        slot: itemToSkip.slot,
        itemType: itemToSkip.type,
        itemId: itemToSkip.id,
        status: 'skipped',
        reason,
      });
      setSkipDialogOpen(false);
      setItemToSkip(null);
      await loadData();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Could not skip item');
    }
  };

  // Consent decisions (R9)
  const handleProposalDecision = async (proposalId: string, decision: 'approved' | 'declined') => {
    try {
      await api.post(`/api/proposals/${proposalId}/decide`, { decision });
      await loadData();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to record decision');
    }
  };

  // Batch consent: "Okay to all"
  const handleBatchApprove = async () => {
    try {
      await api.post('/api/proposals/batch-decide', { decision: 'approved' });
      await loadData();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to approve all');
    }
  };

  // Elder removing a member (SPEC §4.1)
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from your care circle?')) return;
    try {
      await api.delete(`/api/members/${memberId}`);
      await loadData();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to remove member');
    }
  };

  // Determine current active slot or fallback to morning
  const activeSlot: Slot = scheduleData?.currentSlot || 'morning';
  const currentSlotData = scheduleData?.slots.find((s) => s.slot === activeSlot);
  const itemsInCurrentSlot = currentSlotData?.items || [];
  const allSlotTaken = itemsInCurrentSlot.length > 0 && itemsInCurrentSlot.every((i) => i.status === 'taken' || i.status === 'taken_late' || i.status === 'skipped');

  // WhatsApp family URL
  const familyMember = members.find((m) => m.role === 'family');
  const whatsappUrl = buildWhatsAppShareUrl({
    phone: familyMember?.phone,
    elderName: preferredName,
    adherencePercentage: 100,
    todaySummary: allSlotTaken
      ? (lang === 'hi' ? 'आज की दवाइयां ले ली हैं' : 'All doses taken today')
      : (lang === 'hi' ? 'दवाई का समय हो गया है' : 'Checked medicines today'),
  });

  const handleVoiceConfirmAction = async (intent: VoiceIntent, payload?: Record<string, unknown>) => {
    if (intent === 'MARK_TAKEN') {
      const slotToTake = (payload?.slot as Slot) || activeSlot;
      await handleMarkAllSlotTaken(slotToTake, itemsInCurrentSlot);
    } else if (intent === 'SKIP') {
      const reason = (payload?.reason as string) || 'Felt unwell';
      const todayStr = scheduleData?.date || new Date().toISOString().slice(0, 10);
      for (const item of itemsInCurrentSlot) {
        if (item.status === 'pending') {
          await api.post('/api/events', {
            date: todayStr,
            slot: activeSlot,
            itemType: item.type,
            itemId: item.id,
            status: 'skipped',
            reason,
          });
        }
      }
      await loadData();
    } else if (intent === 'LOG_READING' && payload?.reading) {
      const todayStr = scheduleData?.date || new Date().toISOString().slice(0, 10);
      try {
        await api.post('/api/events', {
          date: todayStr,
          slot: activeSlot,
          itemType: 'routine',
          itemId: 'bp-reading',
          status: 'taken',
          reading: payload.reading as string,
        });
        await loadData();
      } catch (err: unknown) {
        setError((err as ApiError).message || 'Failed to log reading');
      }
    }
  };

  return (
    <div className="elder-theme" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      {/* Top Header */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '3px solid #000000',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0369a1' }}>
            {t.brand}
          </span>
          <span style={{ marginLeft: '0.75rem', fontSize: '1.1rem', color: '#44403c' }}>
            👵 {preferredName}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setMembersDialogOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.95rem', borderRadius: '18px' }}
            aria-label="Care Circle Members"
          >
            👥
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.95rem', borderRadius: '18px' }}
            aria-label="Sign out"
          >
            🚪
          </button>
        </div>
      </header>

      <main className="elder-container">
        {error && (
          <div
            role="alert"
            style={{
              padding: '1rem',
              background: '#fee2e2',
              border: '3px solid #dc2626',
              borderRadius: '16px',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '1.2rem',
              marginBottom: '1.5rem',
            }}
          >
            {error}
          </div>
        )}

        {/* ── Consent Cards (Top of Screen) per SPEC §4.2 (R9) ── */}
        {proposals.length > 0 && (
          <div
            className="card elder-card"
            style={{ background: '#fef3c7', borderColor: '#d97706', marginBottom: '2rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.45rem', color: '#92400e', fontWeight: 800 }}>
                🔔 {t.elder.consentTitle} ({proposals.length})
              </h2>
              {proposals.length > 1 && (
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  className="btn btn-success"
                  style={{ fontSize: '1.1rem', padding: '0.5rem 1rem', borderRadius: '12px' }}
                >
                  ✓ {t.elder.okayToAll}
                </button>
              )}
            </div>

            {proposals.map((prop) => {
              const medName = (prop.payload['medicineName'] as string) || 'Medicine';
              const strength = (prop.payload['strength'] as string) || '';
              const purpose = (prop.payload['purpose'] as string) || '';
              const slots = ((prop.payload['slots'] as string[]) || []).join(', ');

              return (
                <div
                  key={prop.id}
                  style={{
                    background: '#ffffff',
                    border: '2px solid #b45309',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    marginBottom: '1rem',
                  }}
                >
                  <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#000000', marginBottom: '0.4rem' }}>
                    {medName} {strength && `(${strength})`}
                  </p>
                  {purpose && (
                    <p style={{ fontSize: '1.1rem', color: '#44403c', marginBottom: '0.3rem' }}>
                      Purpose: {purpose}
                    </p>
                  )}
                  {slots && (
                    <p style={{ fontSize: '1.1rem', color: '#44403c', marginBottom: '1rem' }}>
                      Time: {slots}
                    </p>
                  )}

                  {/* Okay / Not now Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => handleProposalDecision(prop.id, 'approved')}
                      className="btn btn-success"
                      style={{ flex: 1, minHeight: '58px', fontSize: '1.25rem', fontWeight: 800, borderRadius: '14px' }}
                    >
                      ✓ {t.elder.okay}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProposalDecision(prop.id, 'declined')}
                      className="btn btn-secondary"
                      style={{ flex: 1, minHeight: '58px', fontSize: '1.15rem', fontWeight: 700, borderRadius: '14px' }}
                    >
                      ✕ {t.elder.notNow}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Main Now Card per SPEC §4.2 ── */}
        <div className="card elder-card" style={{ background: '#ffffff', border: '4px solid #000000' }}>
          <div style={{ borderBottom: '3px solid #000000', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1' }}>
              {t.slots[activeSlot]}
            </span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#000000', marginTop: '0.2rem' }}>
              {t.elder.nowTitle}
            </h1>
          </div>

          {/* List of items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {itemsInCurrentSlot.length === 0 ? (
              <p style={{ fontSize: '1.3rem', color: '#57534e', textAlign: 'center', padding: '1.5rem 0' }}>
                No medicines or routines scheduled for {t.slots[activeSlot]}.
              </p>
            ) : (
              itemsInCurrentSlot.map((item) => {
                const isTaken = item.status === 'taken' || item.status === 'taken_late';
                const isSkipped = item.status === 'skipped';

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1.1rem',
                      background: isTaken ? '#dcfce7' : isSkipped ? '#f1f5f9' : '#fffbeb',
                      border: '3px solid #000000',
                      borderRadius: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {item.type === 'medicine' && item.medicine ? (
                        <PillIcon color={item.medicine.pillColor} shape={item.medicine.pillShape} size={48} />
                      ) : (
                        <span style={{ fontSize: '2rem' }}>🩺</span>
                      )}
                      <div>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: '#000000' }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '1.1rem', color: '#44403c' }}>
                          {item.medicine
                            ? `${item.medicine.strength || ''} · ${t.food[item.medicine.foodInstruction] || ''}`
                            : item.routine?.needsReading
                              ? 'Record reading'
                              : 'Healthcare routine'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isTaken ? (
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#15803d' }}>
                          ✓ Taken
                        </span>
                      ) : isSkipped ? (
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#78716c' }}>
                          Skipped
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkTaken(activeSlot, item)}
                            className="btn btn-success"
                            style={{ minHeight: '56px', fontSize: '1.2rem', fontWeight: 800, borderRadius: '12px' }}
                            aria-label={`Mark ${item.name} as taken`}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setItemToSkip(item);
                              setSkipDialogOpen(true);
                            }}
                            className="btn btn-secondary"
                            style={{ minHeight: '56px', fontSize: '1rem', fontWeight: 700, borderRadius: '12px' }}
                            aria-label={`Skip ${item.name} with reason`}
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Big "I Took Them" Button */}
          {itemsInCurrentSlot.length > 0 && !allSlotTaken && (
            <button
              type="button"
              onClick={() => handleMarkAllSlotTaken(activeSlot, itemsInCurrentSlot)}
              className="btn btn-success btn-elder-big"
              style={{ minHeight: '70px', fontSize: '1.6rem', fontWeight: 900 }}
            >
              ✓ {t.elder.iTookThem}
            </button>
          )}

          {allSlotTaken && (
            <div
              style={{
                textAlign: 'center',
                padding: '1rem',
                background: '#dcfce7',
                border: '2px solid #16a34a',
                borderRadius: '14px',
                fontSize: '1.3rem',
                fontWeight: 800,
                color: '#15803d',
              }}
            >
              🎉 {t.elder.allTaken}
            </div>
          )}
        </div>

        {/* ── Next Doctor Visit Card ── */}
        {scheduleData?.nextAppointment && (
          <div className="card elder-card" style={{ background: '#f0fdf4', borderColor: '#16a34a' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d', marginBottom: '0.4rem' }}>
              🩺 {t.elder.nextAppt}
            </h2>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, color: '#000000' }}>
              {scheduleData.nextAppointment.doctorName}
              {scheduleData.nextAppointment.specialty ? ` (${scheduleData.nextAppointment.specialty})` : ''}
            </p>
            <p style={{ fontSize: '1.1rem', color: '#334155', marginTop: '0.2rem' }}>
              📅 {new Date(scheduleData.nextAppointment.startsAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            {scheduleData.nextAppointment.place && (
              <p style={{ fontSize: '1.1rem', color: '#334155', marginTop: '0.2rem' }}>
                📍 {scheduleData.nextAppointment.place}
              </p>
            )}
          </div>
        )}

        {/* ── Big Action Buttons (Talk, Call, WhatsApp, SOS) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="btn btn-primary btn-elder-big"
            style={{ background: '#0284c7', borderColor: '#000000' }}
          >
            🎙️ {t.elder.talkToHaamika}
          </button>

          <button
            type="button"
            onClick={() => setSosModalOpen(true)}
            className="btn btn-danger btn-elder-big"
            style={{ background: '#dc2626', borderColor: '#000000' }}
            aria-label="Open SOS emergency screen"
          >
            🆘 {t.elder.sos}
          </button>

          <a
            href="tel:+919876543210"
            className="btn btn-secondary btn-elder-big"
            style={{ textDecoration: 'none', background: '#ffffff', borderColor: '#000000' }}
          >
            📞 {t.elder.callFamily}
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-elder-big"
            style={{ textDecoration: 'none', background: '#dcfce7', borderColor: '#000000', color: '#15803d' }}
          >
            💬 {t.elder.whatsAppFamily}
          </a>
        </div>
      </main>

      {/* ── Phase 3 Voice Assistant Modal ── */}
      <VoiceModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        language={lang}
        onEmergency={() => setSosModalOpen(true)}
        onCallFamily={() => {
          window.location.href = 'tel:+919876543210';
        }}
        onConfirmAction={handleVoiceConfirmAction}
      />

      {/* ── Phase 3 SOS Modal ── */}
      <SosModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        elderName={preferredName}
        familyPhone="+919876543210"
      />

      {/* ── Skip With Reason Dialog (SPEC §4.2) ── */}
      <Dialog
        isOpen={skipDialogOpen}
        onClose={() => setSkipDialogOpen(false)}
        title={t.elder.skipWithReason}
      >
        <p style={{ fontSize: '1.15rem', color: '#44403c', marginBottom: '1.25rem' }}>
          Please choose a reason for skipping {itemToSkip?.name}. This is recorded as your healthcare decision.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => handleSkipReason(t.elder.skipReasons.unwell)}
            className="btn btn-secondary"
            style={{ minHeight: '60px', fontSize: '1.25rem', fontWeight: 700 }}
          >
            🤒 {t.elder.skipReasons.unwell}
          </button>
          <button
            type="button"
            onClick={() => handleSkipReason(t.elder.skipReasons.doctor)}
            className="btn btn-secondary"
            style={{ minHeight: '60px', fontSize: '1.25rem', fontWeight: 700 }}
          >
            🩺 {t.elder.skipReasons.doctor}
          </button>
          <button
            type="button"
            onClick={() => handleSkipReason(t.elder.skipReasons.ranOut)}
            className="btn btn-secondary"
            style={{ minHeight: '60px', fontSize: '1.25rem', fontWeight: 700 }}
          >
            💊 {t.elder.skipReasons.ranOut}
          </button>
          <button
            type="button"
            onClick={() => handleSkipReason(t.elder.skipReasons.other)}
            className="btn btn-secondary"
            style={{ minHeight: '60px', fontSize: '1.25rem', fontWeight: 700 }}
          >
            📝 {t.elder.skipReasons.other}
          </button>
        </div>
      </Dialog>

      {/* ── Circle Members & Elder Control Dialog (SPEC §4.1) ── */}
      <Dialog
        isOpen={membersDialogOpen}
        onClose={() => setMembersDialogOpen(false)}
        title="Your Care Circle Members"
      >
        <p style={{ fontSize: '1.05rem', color: '#44403c', marginBottom: '1rem' }}>
          You are at the center of your care. You can remove any member from your circle at any time.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(members || []).map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                border: '2px solid #cbd5e1',
                borderRadius: '12px',
              }}
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: '1.15rem' }}>{m.name}</p>
                <p style={{ fontSize: '0.95rem', color: '#64748b' }}>Role: {m.role}</p>
              </div>
              {m.role !== 'elder' && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.id)}
                  className="btn btn-danger"
                  style={{ minHeight: '44px', padding: '0.4rem 0.8rem', fontSize: '0.95rem' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
};
