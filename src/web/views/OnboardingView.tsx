import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { api, ApiError } from '../api/client.js';

interface OnboardingViewProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onSuccess, onBack }) => {
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    elderName: '',
    preferredName: 'Amma',
    language: 'hi' as 'hi' | 'en',
    timezone: 'Asia/Kolkata',
    organizerName: '',
    organizerEmail: '',
    organizerPin: '',
    elderPin: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/api/circles', formData);
      onSuccess();
    } catch (err: unknown) {
      setError((err as ApiError).message || 'Failed to create care circle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '520px', margin: '0 auto', paddingTop: '1.5rem' }}>
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
          {t.auth.startCircle}
        </h1>
        <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
          Set up a care circle for your elderly family member.
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="elderName" className="form-label">Elder's Full Name</label>
            <input
              id="elderName"
              type="text"
              required
              className="form-input"
              value={formData.elderName}
              onChange={(e) => setFormData({ ...formData, elderName: e.target.value })}
              placeholder="e.g. Kamla Devi"
            />
          </div>

          <div className="form-group">
            <label htmlFor="preferredName" className="form-label">What do you call them?</label>
            <input
              id="preferredName"
              type="text"
              required
              className="form-input"
              value={formData.preferredName}
              onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
              placeholder="e.g. Amma, Dadi, Ma"
            />
          </div>

          <div className="form-group">
            <label htmlFor="language" className="form-label">Elder's Preferred Language</label>
            <select
              id="language"
              className="form-select"
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value as 'hi' | 'en' })}
            >
              <option value="hi">हिंदी (Hindi)</option>
              <option value="en">English</option>
            </select>
          </div>

          <hr style={{ margin: '1.5rem 0', borderColor: '#e2e8f0' }} />

          <div className="form-group">
            <label htmlFor="organizerName" className="form-label">Your Name (Family Organizer)</label>
            <input
              id="organizerName"
              type="text"
              required
              className="form-input"
              value={formData.organizerName}
              onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
              placeholder="e.g. Rohan"
            />
          </div>

          <div className="form-group">
            <label htmlFor="organizerEmail" className="form-label">Your Email (for Reminders)</label>
            <input
              id="organizerEmail"
              type="email"
              className="form-input"
              value={formData.organizerEmail}
              onChange={(e) => setFormData({ ...formData, organizerEmail: e.target.value })}
              placeholder="rohan@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="organizerPin" className="form-label">Your 6-Digit PIN</label>
            <input
              id="organizerPin"
              type="password"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="form-input"
              value={formData.organizerPin}
              onChange={(e) => setFormData({ ...formData, organizerPin: e.target.value })}
              placeholder="6 digits"
            />
          </div>

          <div className="form-group">
            <label htmlFor="elderPin" className="form-label">Elder's 4-Digit PIN (Set together with them)</label>
            <input
              id="elderPin"
              type="password"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              className="form-input"
              value={formData.elderPin}
              onChange={(e) => setFormData({ ...formData, elderPin: e.target.value })}
              placeholder="4 digits"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: '52px', marginTop: '1rem', fontSize: '1.2rem' }}
          >
            {loading ? 'Creating Circle...' : 'Create Care Circle →'}
          </button>
        </form>
      </div>
    </div>
  );
};
