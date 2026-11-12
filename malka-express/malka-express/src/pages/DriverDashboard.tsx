import { Globe, LogOut, Phone, RefreshCw, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DriverRequestCard } from '../components/driver/DriverRequestCard';
import { PaymentFlow } from '../components/driver/PaymentFlow';
import { QuickOrder } from '../components/driver/QuickOrder';
import { InstallButton } from '../components/InstallButton';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../lib/auth';
import { formatPhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Order } from '../lib/types';

/** Driver app: one page to order and pay, with the latest requests underneath. */
export function DriverDashboard() {
  const { t, tError } = useI18n();
  const { userId, profile, signOut } = useAuth();
  const { notify } = useToast();
  const { orders, loading, error, reload } = useOrders();
  const [view, setView] = useState<'home' | 'profile'>('home');
  const [paying, setPaying] = useState<Order | null>(null);

  useEffect(() => {
    if (error) notify('error', tError(error));
  }, [error, notify, tError]);

  if (!userId || !profile) return null;

  return (
    <div className="driver-shell">
      <header className="dhead">
        <div className="brand">
          <div className="mark mini">M</div>
          <b>{t('app.name')}</b>
        </div>
        <InstallButton />
        <button className="who" onClick={() => setView(view === 'home' ? 'profile' : 'home')} aria-label={t('nav.profile')}>
          <span>{profile.full_name}</span>
          <UserRound size={20} aria-hidden />
        </button>
      </header>

      <main className="dmain">
        {view === 'home' ? (
          <>
            <QuickOrder userId={userId} onDone={reload} />

            <div className="section-title">
              <h2>{t('driver.myRequests')}</h2>
              <button className="icon-btn dark" onClick={() => void reload()} aria-label={t('common.refresh')}>
                <RefreshCw size={18} />
              </button>
            </div>
            {loading ? (
              <p className="muted center-text">{t('common.loading')}</p>
            ) : orders.length === 0 ? (
              <div className="empty">{t('driver.noRequests')}</div>
            ) : (
              <div className="list">
                {orders.map((o) => (
                  <DriverRequestCard key={o.id} order={o} onChanged={reload} onPay={setPaying} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button className="link back" onClick={() => setView('home')}>
              ← {t('pay.back')}
            </button>
            <div className="section-title">
              <h2>{t('profile.title')}</h2>
            </div>
            <section className="panel">
              <div className="profile-row">
                <UserRound size={20} aria-hidden />
                <div>
                  <small className="label">{t('profile.name')}</small>
                  <b>{profile.full_name}</b>
                </div>
              </div>
              <div className="profile-row">
                <Phone size={20} aria-hidden />
                <div>
                  <small className="label">{t('profile.phone')}</small>
                  <b>{formatPhone(profile.phone)}</b>
                </div>
              </div>
              <div className="profile-row">
                <Globe size={20} aria-hidden />
                <div>
                  <small className="label">{t('common.language')}</small>
                  <LanguageSwitcher />
                </div>
              </div>
              <button className="secondary big" onClick={() => void signOut()}>
                <LogOut size={18} /> {t('common.signOut')}
              </button>
            </section>
          </>
        )}
      </main>

      {paying && <PaymentFlow order={paying} onClose={() => setPaying(null)} onDone={reload} />}
    </div>
  );
}
