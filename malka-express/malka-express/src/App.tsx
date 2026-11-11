import { useState } from 'react';
import { Header } from './components/Header';
import { useAuth } from './lib/auth';
import { useI18n } from './lib/i18n';
import { supabaseReady } from './lib/supabase';
import { ConfigMissing } from './pages/ConfigMissing';
import { DriverDashboard } from './pages/DriverDashboard';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';
import { StaffDashboard } from './pages/StaffDashboard';
import { useRt } from './lib/reports-i18n';

export default function App() {
  const { loading, profile } = useAuth();
  const { t } = useI18n();
  const rt = useRt();
  const [view, setView] = useState<'orders' | 'reports'>('orders');

  if (!supabaseReady) return <ConfigMissing />;
  if (loading) return <main className="center muted">{t('common.loading')}</main>;
  if (!profile) return <LoginPage />;

  return (
    <div className="shell">
      <Header />
      <main className="main">
        {profile.kind === 'staff' && profile.role === 'owner' && (
          <nav className="tabs viewnav" aria-label="View">
            <button className={view === 'orders' ? 'selected' : ''} aria-pressed={view === 'orders'} onClick={() => setView('orders')}>
              {rt('nav.orders')}
            </button>
            <button className={view === 'reports' ? 'selected' : ''} aria-pressed={view === 'reports'} onClick={() => setView('reports')}>
              {rt('nav.reports')}
            </button>
          </nav>
        )}
        {profile.kind === 'staff' ? (
          profile.role === 'owner' && view === 'reports' ? <ReportsPage /> : <StaffDashboard profile={profile} />
        ) : (
          <DriverDashboard />
        )}
      </main>
      <footer>{t('app.footer')}</footer>
    </div>
  );
}
