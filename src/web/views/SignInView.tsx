import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/index.js';
import { PinPad } from '../components/PinPad.js';
import { api, ApiError } from '../api/client.js';

interface MemberTile {
  id: string;
  name: string;
  role: 'elder' | 'family' | 'caretaker';
}

interface SignInViewProps {
  onSuccess: (role: 'elder' | 'family' | 'caretaker') => void;
  onBack: () => void;
  prefillCode?: string;
  prefillRole?: 'elder' | 'family' | 'caretaker';
  prefillPin?: string;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onSuccess,
  onBack,
  prefillCode,
  prefillRole,
  prefillPin,
}) => {
  const { t } = useI18n();

  const [step, setStep] = useState<'code' | 'member' | 'pin'>('code');
  const [circleCode, setCircleCode] = useState(prefillCode || '');
  const [circleId, setCircleId] = useState('');
  const [elderName, setElderName] = useState('');
  const [members, setMembers] = useState<MemberTile[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberTile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If prefilled, trigger lookup automatically
  useEffect(() => {
    if (prefillCode) {
      handleLookup(prefillCode, prefillRole, prefillPin);
    }
  }, [prefillCode]);

  const handleLookup = async (codeToLookup: string, roleToSelect?: string, pinToSubmit?: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{
        circleId: string;
        elderName: string;
        preferredName: string;
        members: MemberTile[];
      }>('/api/auth/lookup', { circleCode: codeToLookup });

      setCircleId(res.circleId);
      setElderName(res.preferredName || res.elderName);
      setMembers(res.members);

      if (roleToSelect) {
        const found = res.members.find((m) => m.role === roleToSelect);
        if (found) {
          setSelectedMember(found);
          setStep('pin');
          if (pinToSubmit) {
            handlePinSubmit(res.circleId, found.id, pinToSubmit);
            return;
          }
        }
      } else {
        setStep('member');
      }
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to find circle');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (cId?: string, mId?: string, pinVal?: string) => {
    const activeCircleId = cId || circleId;
    const activeMemberId = mId || selectedMember?.id;
    const activePin = pinVal || pin;

    if (!activeCircleId || !activeMemberId || !activePin) return;

    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ memberId: string; name: string; role: 'elder' | 'family' | 'caretaker' }>(
        '/api/auth/signin',
        {
          circleId: activeCircleId,
          memberId: activeMemberId,
          pin: activePin,
        },
      );
      onSuccess(res.role);
    } catch (err: unknown) {
      setPin('');
      setError((err as ApiError).message || 'Incorrect PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '1.5rem' }}>
      <button
        type="button"
        onClick={step === 'pin' ? () => setStep('member') : step === 'member' ? () => setStep('code') : onBack}
        className="btn btn-secondary"
        style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem' }}
        aria-label="Go back"
      >
        ← Back
      </button>

      {error && (
        <div
          role="alert"
          style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            color: '#991b1b',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Circle Code */}
      {step === 'code' && (
        <div className="card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.auth.openCircle}</h2>
          <p style={{ color: '#475569', marginBottom: '1.25rem' }}>{t.auth.enterCircleCode}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(circleCode);
            }}
          >
            <div className="form-group">
              <label htmlFor="circle-code-input" className="form-label">
                Circle Code (e.g. AMMA-4729)
              </label>
              <input
                id="circle-code-input"
                type="text"
                value={circleCode}
                onChange={(e) => setCircleCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className="form-input"
                style={{ fontSize: '1.5rem', letterSpacing: '2px', textAlign: 'center', fontWeight: 700 }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !circleCode.trim()}
              className="btn btn-primary btn-elder-big"
            >
              {loading ? 'Checking...' : 'Continue →'}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Member Selection */}
      {step === 'member' && (
        <div className="card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Care Circle for {elderName}</h2>
          <p style={{ color: '#475569', marginBottom: '1.25rem' }}>{t.auth.whoIsSigningIn}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMember(m);
                  setPin('');
                  setStep('pin');
                }}
                className="btn btn-secondary"
                style={{
                  minHeight: '64px',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  border: '2px solid #000000',
                  borderRadius: '14px',
                }}
              >
                <span>
                  {m.role === 'elder' ? '👵 ' : m.role === 'family' ? '👨‍💼 ' : '👩‍⚕️ '}
                  {m.name}
                </span>
                <span className={`badge badge-${m.role === 'elder' ? 'active' : 'proposed'}`}>
                  {m.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: PIN Pad */}
      {step === 'pin' && selectedMember && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem' }}>{selectedMember.name}</h2>
          <p style={{ color: '#475569', fontSize: '1.05rem', margin: '0.25rem 0 1rem' }}>
            {t.auth.enterPin} ({selectedMember.role === 'elder' ? '4 digits' : '6 digits'})
          </p>

          <PinPad
            pin={pin}
            maxDigits={selectedMember.role === 'elder' ? 4 : 6}
            onChange={setPin}
            onSubmit={(p) => handlePinSubmit(circleId, selectedMember.id, p)}
            disabled={loading}
          />

          {loading && <p style={{ marginTop: '1rem', fontWeight: 600 }}>Verifying PIN...</p>}
        </div>
      )}
    </div>
  );
};
