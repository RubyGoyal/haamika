import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/index.js';
import { BarChart, type BarChartItem } from '../components/BarChart.js';
import { PillIcon } from '../components/PillIcon.js';
import { Dialog } from '../components/Dialog.js';
import { LanguageToggle } from '../components/LanguageToggle.js';
import { api, ApiError } from '../api/client.js';
import { buildWhatsAppShareUrl } from '../../shared/whatsappLink.js';
import type {
  Medicine, Routine, Appointment, Proposal,
  Activity, OutboxEntry, PillColor, PillShape,
  FoodInstruction, Slot,
} from '../../shared/types.js';

interface AdherenceResponse {
  overall7d: { percentage: number; taken: number; total: number };
  overall30d: { percentage: number; taken: number; total: number };
  byMedicine: Array<{ medicineId: string; medicineName: string; percentage: number }>;
  bySlot: Array<{ slot: string; percentage: number }>;
  dailyStats: BarChartItem[];
  insights: Array<{
    type: string;
    slot?: string;
    medicineName?: string;
    missCount: number;
    message: string;
    suggestion: string;
  }>;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'elder' | 'family' | 'caretaker';
}

interface FamilyDashboardViewProps {
  onSignOut: () => void;
}

export const FamilyDashboardView: React.FC<FamilyDashboardViewProps> = ({ onSignOut }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'overview' | 'medicines' | 'appointments' | 'circle' | 'activity' | 'outbox' | 'settings'>('overview');

  const [elderName, setElderName] = useState('Amma');
  const [adherenceData, setAdherenceData] = useState<AdherenceResponse | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [appointments, setAppointments] = useState<Array<Appointment & { googleCalendarUrl: string }>>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [proposeMedOpen, setProposeMedOpen] = useState(false);
  const [addRoutineOpen, setAddRoutineOpen] = useState(false);
  const [addApptOpen, setAddApptOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [targetMemberForPin, setTargetMemberForPin] = useState<FamilyMember | null>(null);

  // Form states
  const [newMed, setNewMed] = useState({
    name: '',
    strength: '',
    purpose: '',
    pillColor: 'white' as PillColor,
    pillShape: 'round' as PillShape,
    foodInstruction: 'after_food' as FoodInstruction,
    slots: ['morning'] as Slot[],
    dosePerSlot: 1,
    stockCount: 30,
  });

  const [newRoutine, setNewRoutine] = useState({
    label: '',
    type: 'bp_check' as 'bp_check' | 'sugar_check' | 'walk' | 'exercise' | 'custom',
    slot: 'morning' as Slot,
    needsReading: true,
  });

  const [newAppt, setNewAppt] = useState({
    doctorName: '',
    specialty: '',
    place: '',
    startsAt: '',
    notes: '',
    questions: [''],
  });

  const [inviteRole, setInviteRole] = useState<'family' | 'caretaker'>('caretaker');
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [newPinVal, setNewPinVal] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [meRes, adh, meds, rts, props, appts, mems, acts, out] = await Promise.all([
        api.get<{ circle: { preferredName?: string; elderName?: string } }>('/api/me'),
        api.get<AdherenceResponse>('/api/adherence'),
        api.get<Medicine[]>('/api/medicines'),
        api.get<Routine[]>('/api/routines'),
        api.get<Proposal[]>('/api/proposals'),
        api.get<Array<Appointment & { googleCalendarUrl: string }>>('/api/appointments'),
        api.get<FamilyMember[]>('/api/members'),
        api.get<Activity[]>('/api/activity'),
        api.get<OutboxEntry[]>('/api/outbox'),
      ]);

      setElderName(meRes.circle.preferredName || meRes.circle.elderName || 'Amma');
      setAdherenceData(adh);
      setMedicines(meds);
      setRoutines(rts);
      setProposals(props);
      setAppointments(appts);
      setMembers(mems);
      setActivities(acts);
      setOutbox(out);
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to load dashboard data');
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Propose medicine
  const handleProposeMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/medicines', newMed);
      setProposeMedOpen(false);
      setNewMed({
        name: '',
        strength: '',
        purpose: '',
        pillColor: 'white',
        pillShape: 'round',
        foodInstruction: 'after_food',
        slots: ['morning'],
        dosePerSlot: 1,
        stockCount: 30,
      });
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to propose medicine');
    }
  };

  // Add routine
  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/routines', newRoutine);
      setAddRoutineOpen(false);
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to add routine');
    }
  };

  // Add appointment
  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const questionsFiltered = newAppt.questions.filter((q) => q.trim().length > 0);
      await api.post('/api/appointments', { ...newAppt, questions: questionsFiltered });
      setAddApptOpen(false);
      setNewAppt({
        doctorName: '',
        specialty: '',
        place: '',
        startsAt: '',
        notes: '',
        questions: [''],
      });
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to add appointment');
    }
  };

  // Create invite
  const handleCreateInvite = async () => {
    try {
      const res = await api.post<{ code: string }>('/api/invites', { role: inviteRole });
      setGeneratedInviteCode(res.code);
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to create invite');
    }
  };

  // Reset member PIN
  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMemberForPin) return;
    try {
      await api.post(`/api/members/${targetMemberForPin.id}/reset-pin`, { newPin: newPinVal });
      setResetPinOpen(false);
      setTargetMemberForPin(null);
      setNewPinVal('');
      alert(`PIN successfully reset for ${targetMemberForPin.name}`);
      await loadAll();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to reset PIN');
    }
  };

  // WhatsApp share url
  const whatsappShareUrl = buildWhatsAppShareUrl({
    elderName,
    adherencePercentage: adherenceData?.overall7d.percentage || 100,
    todaySummary: `${adherenceData?.overall7d.taken || 0} doses taken this week`,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header className="header">
        <div>
          <span className="brand">{t.brand}</span>
          <span style={{ marginLeft: '0.75rem', fontSize: '1rem', color: '#64748b' }}>
            Care Circle: <strong>{elderName}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.9rem', color: '#15803d', borderColor: '#15803d' }}
          >
            💬 {t.family.shareWhatsApp}
          </a>
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

        {/* Navigation Tabs */}
        <nav className="tabs" aria-label="Dashboard navigation">
          {(['overview', 'medicines', 'appointments', 'circle', 'activity', 'outbox', 'settings'] as const).map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              >
                {t.family[tab] || tab}
              </button>
            ),
          )}
        </nav>

        {/* ── Tab 1: Overview ── */}
        {activeTab === 'overview' && (
          <div>
            {/* Top Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ borderLeft: '6px solid #0284c7' }}>
                <p style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 600 }}>{t.family.adherence7d}</p>
                <p style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0f172a' }}>
                  {adherenceData?.overall7d.percentage || 100}%
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {adherenceData?.overall7d.taken || 0} of {adherenceData?.overall7d.total || 0} doses taken
                </p>
              </div>

              <div className="card" style={{ borderLeft: '6px solid #15803d' }}>
                <p style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 600 }}>{t.family.adherence30d}</p>
                <p style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0f172a' }}>
                  {adherenceData?.overall30d.percentage || 100}%
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Past 30 days overall</p>
              </div>

              <div className="card" style={{ borderLeft: '6px solid #d97706' }}>
                <p style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 600 }}>Pending Proposals</p>
                <p style={{ fontSize: '2.4rem', fontWeight: 900, color: '#d97706' }}>
                  {proposals.filter((p) => p.status === 'pending').length}
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Awaiting elder's assent</p>
              </div>
            </div>

            {/* 7-Day Adherence SVG BarChart with Table Fallback */}
            {adherenceData?.dailyStats && (
              <div className="card">
                <BarChart data={adherenceData.dailyStats} />
              </div>
            )}

            {/* Care Insights Card (SPEC §4.5) */}
            {adherenceData?.insights && adherenceData.insights.length > 0 && (
              <div className="card" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
                <h3 style={{ fontSize: '1.25rem', color: '#b45309', marginBottom: '0.75rem', fontWeight: 800 }}>
                  💡 {t.family.insights}
                </h3>
                {adherenceData.insights.map((ins, i) => (
                  <div key={i} style={{ marginBottom: '0.75rem' }}>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>{ins.message}</p>
                    <p style={{ color: '#475569', marginTop: '0.2rem' }}>
                      <strong>Suggestion:</strong> {ins.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Medicines & Routines ── */}
        {activeTab === 'medicines' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Medications ({medicines.length})</h2>
              <button
                type="button"
                onClick={() => setProposeMedOpen(true)}
                className="btn btn-primary"
              >
                + {t.family.proposeMedicine}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
              {medicines.map((med) => (
                <div key={med.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <PillIcon color={med.pillColor} shape={med.pillShape} size={40} />
                    <div>
                      <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {med.name} {med.strength && `(${med.strength})`}
                      </p>
                      <p style={{ fontSize: '0.95rem', color: '#475569' }}>
                        {med.purpose ? `${med.purpose} · ` : ''}
                        Slots: {med.slots.join(', ')} · Stock: {med.stockCount ?? 'N/A'}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-${med.status}`}>{med.status}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Healthcare Routines ({routines.length})</h2>
              <button
                type="button"
                onClick={() => setAddRoutineOpen(true)}
                className="btn btn-secondary"
              >
                + {t.family.addRoutine}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {routines.map((rt) => (
                <div key={rt.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '1.15rem', fontWeight: 700 }}>{rt.label}</p>
                    <p style={{ fontSize: '0.95rem', color: '#475569' }}>
                      Slot: {rt.slot} · {rt.needsReading ? 'Reading required' : 'No reading needed'}
                    </p>
                  </div>
                  <span className="badge badge-active">{rt.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 3: Appointments ── */}
        {activeTab === 'appointments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Doctor Appointments ({appointments.length})</h2>
              <button
                type="button"
                onClick={() => setAddApptOpen(true)}
                className="btn btn-primary"
              >
                + {t.family.addAppointment}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {appointments.map((appt) => (
                <div key={appt.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                        {appt.doctorName} {appt.specialty && `(${appt.specialty})`}
                      </h3>
                      <p style={{ fontSize: '1rem', color: '#334155', marginTop: '0.2rem' }}>
                        📅 {new Date(appt.startsAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {appt.place && <p style={{ fontSize: '0.95rem', color: '#475569' }}>📍 {appt.place}</p>}
                    </div>

                    <a
                      href={appt.googleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.9rem', color: '#0284c7', borderColor: '#0284c7' }}
                    >
                      + Google Calendar
                    </a>
                  </div>

                  {appt.questions && appt.questions.length > 0 && (
                    <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: '#f1f5f9', borderRadius: '8px' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>Questions for Doctor:</p>
                      <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                        {appt.questions.map((q, i) => (
                          <li key={i} style={{ fontSize: '0.9rem', color: '#475569' }}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 4: Circle Management ── */}
        {activeTab === 'circle' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.4rem' }}>Circle Members ({members.length})</h2>
              <button
                type="button"
                onClick={() => {
                  setGeneratedInviteCode(null);
                  setInviteOpen(true);
                }}
                className="btn btn-primary"
              >
                + {t.family.createInvite}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {members.map((m) => (
                <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                      {m.role === 'elder' ? '👵 ' : m.role === 'family' ? '👨‍💼 ' : '👩‍⚕️ '}
                      {m.name}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Role: {m.role}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {m.role !== 'family' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetMemberForPin(m);
                          setResetPinOpen(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Reset PIN
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 5: Activity Log ── */}
        {activeTab === 'activity' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Activity History</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {activities.map((act) => (
                <div key={act.id} className="card" style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>By: {act.actorRole}</span>
                    <span>{new Date(act.at).toLocaleString()}</span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '0.2rem' }}>{act.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 6: Reminder Outbox ── */}
        {activeTab === 'outbox' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem' }}>Reminder Outbox (Proactive Emails)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {outbox.length === 0 ? (
                <p style={{ color: '#64748b' }}>No reminder emails logged yet.</p>
              ) : (
                outbox.map((out) => (
                  <div key={out.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="badge badge-active">{out.status}</span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(out.at).toLocaleString()}</span>
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.4rem' }}>{out.subject}</p>
                    <p style={{ fontSize: '0.9rem', color: '#475569' }}>To: {out.to} · Kind: {out.kind}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Tab 7: Settings ── */}
        {activeTab === 'settings' && (
          <div className="card" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Care Circle Settings</h2>
            <p style={{ color: '#475569', marginBottom: '1.25rem' }}>
              Day anchors and notification preferences are active.
            </p>
            <p><strong>Elder:</strong> {elderName}</p>
            <p><strong>Timezone:</strong> Asia/Kolkata</p>
            <p><strong>Default Anchors:</strong> Breakfast 08:00, Lunch 13:00, Evening 18:00, Dinner 20:30</p>
          </div>
        )}
      </div>

      {/* Propose Medicine Dialog */}
      <Dialog
        isOpen={proposeMedOpen}
        onClose={() => setProposeMedOpen(false)}
        title="Propose Medicine (Awaits Elder Assent)"
      >
        <form onSubmit={handleProposeMedicine}>
          <div className="form-group">
            <label htmlFor="med-name" className="form-label">Medicine Name</label>
            <input
              id="med-name"
              type="text"
              required
              className="form-input"
              value={newMed.name}
              onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
              placeholder="e.g. Calcium + Vitamin D3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="med-strength" className="form-label">Strength</label>
            <input
              id="med-strength"
              type="text"
              className="form-input"
              value={newMed.strength}
              onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
              placeholder="e.g. 500 mg"
            />
          </div>

          <div className="form-group">
            <label htmlFor="med-purpose" className="form-label">Purpose (Plain words)</label>
            <input
              id="med-purpose"
              type="text"
              className="form-input"
              value={newMed.purpose}
              onChange={(e) => setNewMed({ ...newMed, purpose: e.target.value })}
              placeholder="e.g. For bone strength"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="med-color" className="form-label">Color</label>
              <select
                id="med-color"
                className="form-select"
                value={newMed.pillColor}
                onChange={(e) => setNewMed({ ...newMed, pillColor: e.target.value as PillColor })}
              >
                <option value="white">White</option>
                <option value="yellow">Yellow</option>
                <option value="pink">Pink</option>
                <option value="orange">Orange</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="red">Red</option>
                <option value="brown">Brown</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="med-shape" className="form-label">Shape</label>
              <select
                id="med-shape"
                className="form-select"
                value={newMed.pillShape}
                onChange={(e) => setNewMed({ ...newMed, pillShape: e.target.value as PillShape })}
              >
                <option value="round">Round</option>
                <option value="oval">Oval</option>
                <option value="capsule">Capsule</option>
                <option value="liquid">Liquid</option>
                <option value="drops">Drops</option>
                <option value="inhaler">Inhaler</option>
                <option value="injection">Injection</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="med-food" className="form-label">Food Instruction</label>
            <select
              id="med-food"
              className="form-select"
              value={newMed.foodInstruction}
              onChange={(e) => setNewMed({ ...newMed, foodInstruction: e.target.value as FoodInstruction })}
            >
              <option value="after_food">After food</option>
              <option value="before_food">Before food</option>
              <option value="with_food">With food</option>
              <option value="any">Any time</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Submit Proposal for Elder Review
          </button>
        </form>
      </Dialog>

      {/* Add Routine Dialog */}
      <Dialog
        isOpen={addRoutineOpen}
        onClose={() => setAddRoutineOpen(false)}
        title="Add Healthcare Routine"
      >
        <form onSubmit={handleAddRoutine}>
          <div className="form-group">
            <label htmlFor="rt-label" className="form-label">Routine Label</label>
            <input
              id="rt-label"
              type="text"
              required
              className="form-input"
              value={newRoutine.label}
              onChange={(e) => setNewRoutine({ ...newRoutine, label: e.target.value })}
              placeholder="e.g. Sugar Check (Fasting)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rt-slot" className="form-label">Time of Day</label>
            <select
              id="rt-slot"
              className="form-select"
              value={newRoutine.slot}
              onChange={(e) => setNewRoutine({ ...newRoutine, slot: e.target.value as Slot })}
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Add Routine
          </button>
        </form>
      </Dialog>

      {/* Add Appointment Dialog */}
      <Dialog
        isOpen={addApptOpen}
        onClose={() => setAddApptOpen(false)}
        title="Add Doctor Appointment"
      >
        <form onSubmit={handleAddAppointment}>
          <div className="form-group">
            <label htmlFor="appt-doctor" className="form-label">Doctor Name</label>
            <input
              id="appt-doctor"
              type="text"
              required
              className="form-input"
              value={newAppt.doctorName}
              onChange={(e) => setNewAppt({ ...newAppt, doctorName: e.target.value })}
              placeholder="e.g. Dr. Mehta"
            />
          </div>

          <div className="form-group">
            <label htmlFor="appt-specialty" className="form-label">Specialty</label>
            <input
              id="appt-specialty"
              type="text"
              className="form-input"
              value={newAppt.specialty}
              onChange={(e) => setNewAppt({ ...newAppt, specialty: e.target.value })}
              placeholder="e.g. Cardiology"
            />
          </div>

          <div className="form-group">
            <label htmlFor="appt-time" className="form-label">Date & Time</label>
            <input
              id="appt-time"
              type="datetime-local"
              required
              className="form-input"
              value={newAppt.startsAt}
              onChange={(e) => setNewAppt({ ...newAppt, startsAt: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Schedule & Create Google Calendar Link
          </button>
        </form>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Care Circle Member"
      >
        {generatedInviteCode ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ fontSize: '1.1rem', color: '#15803d', fontWeight: 700 }}>Single-Use Invite Code:</p>
            <p style={{ fontSize: '2rem', letterSpacing: '4px', fontWeight: 900, color: '#0f172a', margin: '0.75rem 0' }}>
              {generatedInviteCode}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Valid for 48 hours. Share this code with the joiner.</p>
          </div>
        ) : (
          <div>
            <div className="form-group">
              <label htmlFor="invite-role" className="form-label">Select Role</label>
              <select
                id="invite-role"
                className="form-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'family' | 'caretaker')}
              >
                <option value="caretaker">Caretaker (Checklist & Pill-box view)</option>
                <option value="family">Family (Organizer & Management)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleCreateInvite}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              Generate Invite Code
            </button>
          </div>
        )}
      </Dialog>

      {/* Reset PIN Dialog */}
      <Dialog
        isOpen={resetPinOpen}
        onClose={() => setResetPinOpen(false)}
        title={`Reset PIN for ${targetMemberForPin?.name}`}
      >
        <form onSubmit={handleResetPin}>
          <div className="form-group">
            <label htmlFor="reset-pin-val" className="form-label">
              New PIN ({targetMemberForPin?.role === 'elder' ? '4 digits' : '6 digits'})
            </label>
            <input
              id="reset-pin-val"
              type="password"
              required
              className="form-input"
              value={newPinVal}
              onChange={(e) => setNewPinVal(e.target.value)}
              maxLength={targetMemberForPin?.role === 'elder' ? 4 : 6}
              minLength={targetMemberForPin?.role === 'elder' ? 4 : 6}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Confirm PIN Reset
          </button>
        </form>
      </Dialog>
    </div>
  );
};
