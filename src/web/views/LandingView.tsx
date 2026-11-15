import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { LanguageToggle } from '../components/LanguageToggle.js';
import { api } from '../api/client.js';

interface LandingViewProps {
  onNavigate: (view: string, params?: Record<string, string>) => void;
}

interface DemoInfo {
  enabled: boolean;
  code?: string;
  elderPin?: string;
  familyPin?: string;
  caretakerPin?: string;
}

function useDemoInfo() {
  const [demoInfo, setDemoInfo] = useState<DemoInfo | null>(null);
  useEffect(() => {
    api
      .get<DemoInfo>('/api/auth/demo')
      .then(setDemoInfo)
      .catch(() => setDemoInfo({ enabled: false }));
  }, []);
  return demoInfo;
}

const DemoCard: React.FC<{
  demoInfo: DemoInfo;
  onDemoSignIn: (role: 'elder' | 'family' | 'caretaker') => void;
}> = ({ demoInfo, onDemoSignIn }) => {
  const { t } = useI18n();
  if (!demoInfo.enabled) return null;
  return (
    <div
      className="card"
      style={{ marginTop: '1.5rem', background: '#fef3c7', borderColor: '#d97706' }}
    >
      <h2 style={{ fontSize: '1.15rem', color: '#92400e', marginBottom: '0.75rem' }}>
        🎯 {t.auth.tryDemo} (Circle: {demoInfo.code})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <button
          type="button"
          onClick={() => onDemoSignIn('elder')}
          className="btn btn-secondary"
          style={{ background: '#ffffff', borderColor: '#d97706', fontWeight: 700 }}
        >
          👵 {t.auth.demoElder} (PIN: 2580)
        </button>
        <button
          type="button"
          onClick={() => onDemoSignIn('family')}
          className="btn btn-secondary"
          style={{ background: '#ffffff', borderColor: '#d97706', fontWeight: 700 }}
        >
          👨‍💼 {t.auth.demoFamily} (PIN: 135790)
        </button>
        <button
          type="button"
          onClick={() => onDemoSignIn('caretaker')}
          className="btn btn-secondary"
          style={{ background: '#ffffff', borderColor: '#d97706', fontWeight: 700 }}
        >
          👩‍⚕️ {t.auth.demoCaretaker} (PIN: 246802)
        </button>
      </div>
    </div>
  );
};

export const LandingView: React.FC<LandingViewProps> = ({ onNavigate }) => {
  const { t } = useI18n();
  const demoInfo = useDemoInfo();

  const handleDemoSignIn = (role: 'elder' | 'family' | 'caretaker') => {
    if (!demoInfo?.code) return;
    const pin =
      role === 'elder'
        ? demoInfo.elderPin
        : role === 'family'
          ? demoInfo.familyPin
          : demoInfo.caretakerPin;
    onNavigate('signin', { prefillCode: demoInfo.code, prefillRole: role, prefillPin: pin || '' });
  };

  return (
    <div className="container" style={{ textAlign: 'center', paddingTop: '2.5rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <LanguageToggle />
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, color: '#0284c7', marginBottom: '0.5rem' }}>
          {t.brand}
        </h1>
        <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f172a' }}>
          <em>{t.slogan}</em>
        </p>
        <p style={{ fontSize: '1.1rem', color: '#475569', marginTop: '0.5rem' }}>{t.tagline}</p>
      </header>

      <main
        style={{
          maxWidth: '440px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => onNavigate('signin')}
          className="btn btn-primary btn-elder-big"
          style={{ background: '#0284c7', color: '#ffffff' }}
        >
          🔑 {t.auth.openCircle}
        </button>
        <button
          type="button"
          onClick={() => onNavigate('onboarding')}
          className="btn btn-secondary"
          style={{ minHeight: '56px', fontSize: '1.15rem' }}
        >
          ➕ {t.auth.startCircle}
        </button>
        <button
          type="button"
          onClick={() => onNavigate('join')}
          className="btn btn-secondary"
          style={{ minHeight: '56px', fontSize: '1.15rem' }}
        >
          ✉️ {t.auth.joinCircle}
        </button>
        {demoInfo && <DemoCard demoInfo={demoInfo} onDemoSignIn={handleDemoSignIn} />}
      </main>
    </div>
  );
};
