import { ArrowRight, CheckCircle2, Clock, CreditCard, FilePlus2, Globe, LogOut, Phone, RefreshCw, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomNav, type DriverView } from '../components/driver/BottomNav';
import { DriverRequestCard } from '../components/driver/DriverRequestCard';
import { PaymentFlow } from '../components/driver/PaymentFlow';
import { PaymentStatusBadge } from '../components/driver/PaymentStatusBadge';
import { InstallButton } from '../components/InstallButton';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { NewRequestForm } from '../components/NewRequestForm';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../lib/auth';
import { formatDateTime, formatEtb, formatPhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { canPay, latestRejection, paymentState } from '../lib/payments';
import { useToast } from '../lib/toast';
import type { Order } from '../lib/types';

export function DriverDashboard() {
  const { t, tError, locale } = useI18n();
  const { userId, profile, signOut } = useAuth();
  const { notify } = useToast();
  const { orders, loading, error, reload } = useOrders();
  const [view, setView] = useState<DriverView>('home');
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Order | null>(null);

  useEffect(() => {
    if (error) notify('error', tError(error));
  }, [error, notify, tError]);

  const needsPayment = useMemo(() => orders.filter(canPay), [orders]);
  const ready = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);
  const payable = useMemo(() => orders.filter((o) => paymentState(o) !== 'none'), [orders]);

  if (!userId || !profile) return null;
  const go = (v: DriverView) => {
    setCreating(false);
    setView(v);
    window.scrollTo({ top: 0 });
  };
  const list = (items: Order[]) =>
    items.length === 0 ? (
      <div className="empty">{t('driver.noRequests')}</div>
    ) : (
      <div className="list">
        {items.map((o) => (
          <DriverRequestCard key={o.id} order={o} onChanged={reload} onPay={setPaying} />
        ))}
      </div>
    );

  return (
    <div className="driver-shell">
      <header className="dhead">
        <div className="brand">
          <div className="mark mini">M</div>
          <b>{t('app.name')}</b>
        </div>
        <InstallButton />
        <button className="who" onClick={() => go('profile')} aria-label={t('nav.profile')}>
          <span>{profile.full_name}</span>
          <UserRound size={20} aria-hidden />
        </button>
      </header>

      <main className="dmain">
        {creating ? (
          <>
            <button className="link back" onClick={() => setCreating(false)}>
              ← {t('pay.back')}
            </button>
            <NewRequestForm
              userId={userId}
              onCreated={async () => {
                await reload();
                go('requests');
              }}
            />
          </>
        ) : view === 'home' ? (
          <>
            <section className="welcome">
              <p>
                {t('driver.welcome')}, <b>{profile.full_name.split(' ')[0]}</b>
              </p>
              <span className="status-chip">
                <CheckCircle2 size={14} aria-hidden /> {t('driver.accountStatus')}: {t('driver.active')}
              </span>
            </section>

            <button className="cta" onClick={() => setCreating(true)}>
              <FilePlus2 size={28} aria-hidden />
              <span>{t('driver.newRequest')}</span>
              <ArrowRight size={22} aria-hidden />
            </button>

            <div className="tiles">
              <button className="tile" onClick={() => go('payments')}>
                <CreditCard size={20} aria-hidden />
                <strong>{needsPayment.length}</strong>
                <small>{t('driver.needsPayment')}</small>
              </button>
              <button className="tile" onClick={() => go('requests')}>
                <Clock size={20} aria-hidden />
                <strong>{ready.length}</strong>
                <small>{t('driver.readyNow')}</small>
              </button>
            </div>

            <div className="section-title">
              <h2>{t('driver.recent')}</h2>
              <button className="link" onClick={() => go('requests')}>
                {t('nav.requests')} →
              </button>
            </div>
            {loading ? <p className="muted center-text">{t('common.loading')}</p> : list(orders.slice(0, 3))}
          </>
        ) : view === 'requests' ? (
          <>
            <div className="section-title">
              <h2>{t('driver.myRequests')}</h2>
              <button className="icon-btn dark" onClick={() => void reload()} aria-label={t('common.refresh')}>
                <RefreshCw size={18} />
              </button>
            </div>
            {loading ? <p className="muted center-text">{t('common.loading')}</p> : list(orders)}
          </>
        ) : view === 'payments' ? (
          <>
            <div className="section-title">
              <h2>{t('nav.payments')}</h2>
            </div>
            {payable.length === 0 ? (
              <div className="empty">{t('pay.noPayments')}</div>
            ) : (
              <div className="list">
                {payable.map((o) => {
                  const state = paymentState(o);
                  const last = [...o.submissions].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
                  const reason = latestRejection(o);
                  return (
                    <article key={o.id} className="dcard pay-row">
                      <div className="dcard-top">
                        <b className="ref">{o.reference}</b>
                        <PaymentStatusBadge state={state} />
                      </div>
                      <div className="dcard-price">
                        <small>{t('pay.amount')}</small>
                        <strong>{o.quoted_price != null ? formatEtb(o.quoted_price) : '—'}</strong>
                      </div>
                      {last && (
                        <p className="hint">
                          {t(`method.${last.method}`)} · {last.reference} · {formatDateTime(last.created_at, locale)}
                        </p>
                      )}
                      {state === 'rejected' && reason && (
                        <p className="notice error">
                          {t('pay.rejectedReason')}: {reason}
                        </p>
                      )}
                      {state === 'pending_verification' && <p className="hint">{t('pay.pendingHint')}</p>}
                      {state === 'verified' && <p className="hint">{t('pay.verifiedHint')}</p>}
                      {canPay(o) && (
                        <button className="primary big" onClick={() => setPaying(o)}>
                          {state === 'rejected' ? t('pay.payAgain') : t('pay.payNow')}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
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

      <BottomNav view={creating ? 'home' : view} onChange={go} badge={needsPayment.length} />

      {paying && <PaymentFlow order={paying} onClose={() => setPaying(null)} onDone={reload} />}
    </div>
  );
}
