import { useState, useEffect } from 'react';
import { I18nProvider } from './i18n/index.js';
import './styles/theme.css';
import { LandingView } from './views/LandingView.js';
import { SignInView } from './views/SignInView.js';
import { OnboardingView } from './views/OnboardingView.js';
import { JoinView } from './views/JoinView.js';
import { ElderHomeView } from './views/ElderHomeView.js';
import { FamilyDashboardView } from './views/FamilyDashboardView.js';
import { CaretakerView } from './views/CaretakerView.js';
import { api, clearOfflineStateAndCaches } from './api/client.js';

type ViewMode = 'landing' | 'signin' | 'onboarding' | 'join' | 'authenticated';

export default function App() {
  const [view, setView] = useState<ViewMode>('landing');
  const [role, setRole] = useState<'elder' | 'family' | 'caretaker' | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [navParams, setNavParams] = useState<Record<string, string>>({});

  // Check if session cookie is already present
  useEffect(() => {
    api.get<{ role: 'elder' | 'family' | 'caretaker' }>('/api/me')
      .then((res) => {
        setRole(res.role);
        setView('authenticated');
      })
      .catch(() => {
        setView('landing');
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, []);

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/signout');
    } catch {
      // ignore
    }
    clearOfflineStateAndCaches();
    setRole(null);
    setView('landing');
  };

  const handleSignInSuccess = (userRole: 'elder' | 'family' | 'caretaker') => {
    setRole(userRole);
    setView('authenticated');
  };

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Haamika...</p>
      </div>
    );
  }

  return (
    <I18nProvider>
      {view === 'authenticated' && role === 'elder' && (
        <ElderHomeView onSignOut={handleSignOut} />
      )}
      {view === 'authenticated' && role === 'family' && (
        <FamilyDashboardView onSignOut={handleSignOut} />
      )}
      {view === 'authenticated' && role === 'caretaker' && (
        <CaretakerView onSignOut={handleSignOut} />
      )}

      {view === 'landing' && (
        <LandingView
          onNavigate={(target, params) => {
            if (params) setNavParams(params);
            setView(target as ViewMode);
          }}
        />
      )}

      {view === 'signin' && (
        <SignInView
          onSuccess={handleSignInSuccess}
          onBack={() => setView('landing')}
          prefillCode={navParams.prefillCode}
          prefillRole={navParams.prefillRole as 'elder' | 'family' | 'caretaker' | undefined}
          prefillPin={navParams.prefillPin}
        />
      )}

      {view === 'onboarding' && (
        <OnboardingView
          onSuccess={() => handleSignInSuccess('family')}
          onBack={() => setView('landing')}
        />
      )}

      {view === 'join' && (
        <JoinView
          onSuccess={(joinedRole) => handleSignInSuccess(joinedRole)}
          onBack={() => setView('landing')}
        />
      )}
    </I18nProvider>
  );
}
