import React from 'react';
import { useI18n } from '../../i18n/index.js';
import { PinPad } from '../PinPad.js';

export interface MemberTile {
  id: string;
  name: string;
  role: 'elder' | 'family' | 'caretaker';
}

export const StepCircleCode: React.FC<{
  circleCode: string;
  loading: boolean;
  onChangeCode: (v: string) => void;
  onSubmitCode: () => void;
}> = ({ circleCode, loading, onChangeCode, onSubmitCode }) => {
  const { t } = useI18n();
  return (
    <div className="card">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.auth.openCircle}</h2>
      <p style={{ color: '#475569', marginBottom: '1.25rem' }}>{t.auth.enterCircleCode}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitCode();
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
            onChange={(e) => onChangeCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            className="form-input"
            style={{
              fontSize: '1.5rem',
              letterSpacing: '2px',
              textAlign: 'center',
              fontWeight: 700,
            }}
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
  );
};

export const StepMemberList: React.FC<{
  elderName: string;
  members: MemberTile[];
  onSelectMember: (m: MemberTile) => void;
}> = ({ elderName, members, onSelectMember }) => {
  const { t } = useI18n();
  return (
    <div className="card">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Care Circle for {elderName}</h2>
      <p style={{ color: '#475569', marginBottom: '1.25rem' }}>{t.auth.whoIsSigningIn}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelectMember(m)}
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
  );
};

export const StepPinPad: React.FC<{
  member: MemberTile;
  pin: string;
  loading: boolean;
  onChangePin: (p: string) => void;
  onSubmitPin: (p: string) => void;
}> = ({ member, pin, loading, onChangePin, onSubmitPin }) => {
  const { t } = useI18n();
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2 style={{ fontSize: '1.4rem' }}>{member.name}</h2>
      <p style={{ color: '#475569', fontSize: '1.05rem', margin: '0.25rem 0 1rem' }}>
        {t.auth.enterPin} ({member.role === 'elder' ? '4 digits' : '6 digits'})
      </p>
      <PinPad
        pin={pin}
        maxDigits={member.role === 'elder' ? 4 : 6}
        onChange={onChangePin}
        onSubmit={onSubmitPin}
        disabled={loading}
      />
      {loading && <p style={{ marginTop: '1rem', fontWeight: 600 }}>Verifying PIN...</p>}
    </div>
  );
};
