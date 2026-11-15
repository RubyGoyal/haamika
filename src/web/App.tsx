import { useState, useEffect, useCallback } from 'react';
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
type UserRole = 'elder' | 'family' | 'caretaker';

function useAuthSession() {
  const [view, setView] = useState<ViewMode>('landing');
  const [role, setRole] = useState<UserRole | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ role: UserRole }>('/api/me')
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

  const handleSignOut = useCallback(async () => {
    try {
      await api.post('/api/auth/signout');
    } catch {
      /* ignore */
    }
    clearOfflineStateAndCaches();
    setRole(null);
    setView('landing');
  }, []);

  const handleSignInSuccess = useCallback((userRole: UserRole) => {
    setRole(userRole);
    setView('authenticated');
  }, []);

  return { view, setView, role, initialLoading, handleSignOut, handleSignInSuccess };
}

const AuthRouter: React.FC<{ role: UserRole | null; onSignOut: () => void }> = ({
  role,
  onSignOut,
}) => {
  if (role === 'elder') return <ElderHomeView onSignOut={onSignOut} />;
  if (role === 'family') return <FamilyDashboardView onSignOut={onSignOut} />;
  if (role === 'caretaker') return <CaretakerView onSignOut={onSignOut} />;
  return null;
};

const PublicRouter: React.FC<{
  view: ViewMode;
  navParams: Record<string, string>;
  onNavigate: (t: ViewMode, p?: Record<string, string>) => void;
  onSuccess: (role: UserRole) => void;
}> = ({ view, navParams, onNavigate, onSuccess }) => {
  if (view === 'landing')
    return <LandingView onNavigate={(t, p) => onNavigate(t as ViewMode, p)} />;
  if (view === 'signin') {
    return (
      <SignInView
        onSuccess={onSuccess}
        onBack={() => onNavigate('landing')}
        prefillCode={navParams.prefillCode}
        prefillRole={navParams.prefillRole as UserRole | undefined}
        prefillPin={navParams.prefillPin}
      />
    );
  }
  if (view === 'onboarding')
    return (
      <OnboardingView onSuccess={() => onSuccess('family')} onBack={() => onNavigate('landing')} />
    );
  if (view === 'join')
    return <JoinView onSuccess={onSuccess} onBack={() => onNavigate('landing')} />;
  return null;
};

export default function App() {
  const { view, setView, role, initialLoading, handleSignOut, handleSignInSuccess } =
    useAuthSession();
  const [navParams, setNavParams] = useState<Record<string, string>>({});

  if (initialLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'system-ui',
        }}
      >
        <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Haamika...</p>
      </div>
    );
  }

  return (
    <I18nProvider>
      {view === 'authenticated' ? (
        <AuthRouter role={role} onSignOut={handleSignOut} />
      ) : (
        <PublicRouter
          view={view}
          navParams={navParams}
          onNavigate={(target, params) => {
            if (params) setNavParams(params);
            setView(target);
          }}
          onSuccess={handleSignInSuccess}
        />
      )}
    </I18nProvider>
  );
}
