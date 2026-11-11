import { Header } from './components/Header';
import { useAuth } from './lib/auth';
import { useI18n } from './lib/i18n';
import { supabaseReady } from './lib/supabase';
import { ConfigMissing } from './pages/ConfigMissing';
import { DriverDashboard } from './pages/DriverDashboard';
import { LoginPage } from './pages/LoginPage';
import { StaffDashboard } from './pages/StaffDashboard';

export default function App() {
  const { loading, profile } = useAuth();
  const { t } = useI18n();

  if (!supabaseReady) return <ConfigMissing />;
  if (loading) return <main className="center muted">{t('common.loading')}</main>;
  if (!profile) return <LoginPage />;

  if (profile.kind === 'driver') return <DriverDashboard />;

  return (
    <div className="shell">
      <Header />
      <main className="main"><StaffDashboard profile={profile} /></main>
      <footer>{t('app.footer')}</footer>
    </div>
  );
}
