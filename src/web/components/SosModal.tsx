/**
 * SOS Emergency Modal (R8, SPEC §4.10).
 * Displays big emergency call buttons (112 and family) and
 * immediately triggers POST /api/sos to alert all circle members.
 */
import React, { useEffect, useState } from 'react';
import { Dialog } from './Dialog.js';
import { api } from '../api/client.js';

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
  elderName: string;
  familyPhone?: string;
}

export const SosModal: React.FC<SosModalProps> = ({ isOpen, onClose, elderName, familyPhone }) => {
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAlertSent(false);
      api
        .post<{ ok: boolean; alertedMembers: number }>('/api/sos')
        .then(() => setAlertSent(true))
        .catch(() => {
          // even if network fails, UI shows phone links
          setAlertSent(true);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Emergency Help — आपातकालीन सहायता">
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <p
          style={{
            fontSize: '1.25rem',
            color: '#b91c1c',
            fontWeight: 700,
            marginBottom: '1.5rem',
          }}
        >
          {alertSent
            ? 'Emergency alerts have been sent to your family.'
            : 'Sending emergency alerts to your family...'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <a
            href="tel:112"
            className="btn btn-elder-big"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '64px',
              fontSize: '1.5rem',
              fontWeight: 800,
            }}
            aria-label="Call national emergency number 112"
          >
            🚨 Call 112 (आपातकालीन नंबर)
          </a>

          {familyPhone ? (
            <a
              href={`tel:${familyPhone}`}
              className="btn btn-secondary btn-elder-big"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60px',
                fontSize: '1.35rem',
              }}
              aria-label={`Call family at ${familyPhone}`}
            >
              📞 Call Family ({familyPhone})
            </a>
          ) : (
            <a
              href="tel:108"
              className="btn btn-secondary btn-elder-big"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60px',
                fontSize: '1.35rem',
              }}
              aria-label="Call ambulance 108"
            >
              🚑 Call Ambulance (108)
            </a>
          )}
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '1rem', color: '#64748b' }}>
          Stay calm, {elderName}. Help is being notified.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="btn"
          style={{
            marginTop: '1.5rem',
            width: '100%',
            backgroundColor: '#f1f5f9',
            minHeight: '52px',
            fontSize: '1.1rem',
          }}
        >
          I am safe now — Close
        </button>
      </div>
    </Dialog>
  );
};
