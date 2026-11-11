import { BarChart3, ClipboardList, CreditCard, Menu, RefreshCw, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PaymentsAdminPage } from './PaymentsAdminPage';
import { ReportsPage } from './ReportsPage';
import { TeamPage } from './TeamPage';
import { OrderList } from '../components/OrderList';
import { StatCards } from '../components/StatCards';
import { useOrders } from '../hooks/useOrders';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { matchesFilter, type StatusFilter } from '../lib/format';
import type { StaffProfile } from '../lib/types';

type Tab = 'orders' | 'payments' | 'reports' | 'team';
const FILTERS: StatusFilter[] = ['all', 'new', 'payment', 'work', 'ready', 'done'];

export function StaffDashboard({ profile }: { profile: StaffProfile }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const { orders, loading, error, reload } = useOrders();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('orders');
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingPayments = orders.filter((o) => o.submissions.some((s) => s.status === 'pending_verification')).length;
  const isManager = profile.role === 'owner' || profile.role === 'manager';
  const tabs: Tab[] = ['orders', ...(isManager ? (['payments', 'reports'] as const) : []), ...(profile.role === 'owner' ? (['team'] as const) : [])];

  // Show how many requests are waiting in the browser tab title.
  useEffect(() => {
    const waiting = orders.filter((o) => o.status === 'pending_review').length;
    document.title = waiting ? `(${waiting}) ${t('app.name')}` : t('app.name');
    return () => {
      document.title = t('app.name');
    };
  }, [orders, t]);

  // Close the menu with Escape and lock page scroll while it is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (error) notify('error', tError(error));
  }, [error, notify, tError]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    return orders.filter((o) => {
      if (!matchesFilter(o.status, filter)) return false;
      if (!q) return true;
      const haystack = `${o.reference} ${o.driver?.full_name ?? ''} ${o.driver?.phone ?? ''} ${o.description ?? ''}`
        .toLowerCase()
        .replace(/\s+/g, '');
      return haystack.includes(q);
    });
  }, [orders, filter, query]);

  const toolbar = (
    <div className="toolbar">
      <label className="searchbox">
        <Search size={16} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} />
      </label>
      <div className="chips" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>
    </div>
  );

  const ICONS = { orders: ClipboardList, payments: CreditCard, reports: BarChart3, team: Users } as const;
  const nav =
    tabs.length > 1 ? (
      <>
        <div className="navbar">
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu" aria-expanded={menuOpen}>
            <Menu size={22} aria-hidden />
          </button>
          <b className="menu-title">{t(`nav.${tab}`)}</b>
          {pendingPayments > 0 && tab !== 'payments' && <span className="drawer-badge">{pendingPayments}</span>}
        </div>
        <div className={menuOpen ? 'drawer-scrim open' : 'drawer-scrim'} onClick={() => setMenuOpen(false)} />
        <aside className={menuOpen ? 'drawer open' : 'drawer'} role="dialog" aria-modal="true" aria-label="Menu" inert={!menuOpen}>
          <div className="drawer-head">
            <button className="icon-btn drawer-close" onClick={() => setMenuOpen(false)} aria-label={t('common.close')}>
              <X size={22} aria-hidden />
            </button>
            <span className="mark mini">M</span>
            <b>{profile.full_name}</b>
            <span className="role">{profile.role}</span>
          </div>
          <nav>
            {tabs.map((x, n) => {
              const Icon = ICONS[x];
              return (
                <button
                  key={x}
                  className={tab === x ? 'drawer-item on' : 'drawer-item'}
                  style={{ ['--i' as string]: n }}
                  onClick={() => {
                    setTab(x);
                    setMenuOpen(false);
                  }}
                >
                  <span className="ico"><Icon size={20} aria-hidden /></span>
                  {t(`nav.${x}`)}
                  {x === 'payments' && pendingPayments > 0 && <span className="drawer-badge">{pendingPayments}</span>}
                </button>
              );
            })}
          </nav>
        </aside>
      </>
    ) : null;

  if (tab === 'payments' && isManager)
    return (
      <>
        {nav}
        <PaymentsAdminPage onChanged={reload} />
      </>
    );
  if (tab === 'reports' && isManager)
    return (
      <>
        {nav}
        <ReportsPage orders={orders} />
      </>
    );
  if (tab === 'team' && profile.role === 'owner')
    return (
      <>
        {nav}
        <TeamPage me={profile} />
      </>
    );

  return (
    <>
      {nav}
      <div className="intro">
        <div>
          <p className="eyebrow">{t('staff.eyebrow')}</p>
          <h1>{t('staff.title')}</h1>
          <p className="muted">{t('staff.subtitle')}</p>
        </div>
        <button className="secondary" onClick={() => void reload()}>
          <RefreshCw size={15} /> {t('common.refresh')}
        </button>
      </div>
      <StatCards orders={orders} detailed />
      {loading ? (
        <p className="muted center-text">{t('common.loading')}</p>
      ) : (
        <OrderList title={t('staff.title')} orders={visible} viewer={profile.role} onChanged={reload} toolbar={toolbar} />
      )}
    </>
  );
}
