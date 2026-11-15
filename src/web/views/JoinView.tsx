import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { api, ApiError } from '../api/client.js';

interface JoinViewProps {
  onSuccess: (role: 'elder' | 'family' | 'caretaker') => void;
  onBack: () => void;
}

interface JoinFormData {
  code: string;
  name: string;
  email: string;
  pin: string;
}

const JoinForm: React.FC<{
  formData: JoinFormData;
  loading: boolean;
  onChange: (d: JoinFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}> = ({ formData, loading, onChange, onSubmit }) => (
  <form onSubmit={onSubmit}>
    <div className="form-group">
      <label htmlFor="invite-code" className="form-label">
        Invite Code
      </label>
      <input
        id="invite-code"
        type="text"
        required
        className="form-input"
        value={formData.code}
        onChange={(e) => onChange({ ...formData, code: e.target.value.toUpperCase() })}
        placeholder="e.g. 8A3F2B1C..."
        style={{ letterSpacing: '1px', textTransform: 'uppercase' }}
      />
    </div>
    <div className="form-group">
      <label htmlFor="join-name" className="form-label">
        Your Name
      </label>
      <input
        id="join-name"
        type="text"
        required
        className="form-input"
        value={formData.name}
        onChange={(e) => onChange({ ...formData, name: e.target.value })}
        placeholder="e.g. Sunita"
      />
    </div>
    <div className="form-group">
      <label htmlFor="join-email" className="form-label">
        Email (Optional, for alerts)
      </label>
      <input
        id="join-email"
        type="email"
        className="form-input"
        value={formData.email}
        onChange={(e) => onChange({ ...formData, email: e.target.value })}
        placeholder="sunita@example.com"
      />
    </div>
    <div className="form-group">
      <label htmlFor="join-pin" className="form-label">
        Set Your 6-Digit PIN
      </label>
      <input
        id="join-pin"
        type="password"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        className="form-input"
        value={formData.pin}
        onChange={(e) => onChange({ ...formData, pin: e.target.value })}
        placeholder="6 digits"
      />
    </div>
    <button
      type="submit"
      disabled={loading}
      className="btn btn-primary btn-elder-big"
      style={{ marginTop: '1rem' }}
    >
      {loading ? 'Joining Circle...' : 'Join Circle →'}
    </button>
  </form>
);

export const JoinView: React.FC<JoinViewProps> = ({ onSuccess, onBack }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<JoinFormData>({
    code: '',
    name: '',
    email: '',
    pin: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ role: 'elder' | 'family' | 'caretaker' }>(
        '/api/invites/accept',
        formData,
      );
      onSuccess(res.role);
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Invalid or expired invite code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="container"
      style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '1.5rem' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="btn btn-secondary"
        style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem' }}
        aria-label="Go back"
      >
        ← Back
      </button>
      <div className="card">
        <h1 style={{ fontSize: '1.8rem', color: '#0284c7', marginBottom: '0.5rem' }}>
          {t.auth.joinCircle}
        </h1>
        <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
          Enter the single-use invite code shared by the family.
        </p>
        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
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
        <JoinForm
          formData={formData}
          loading={loading}
          onChange={setFormData}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};
