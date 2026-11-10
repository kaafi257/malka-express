import { RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ReportsPage } from './ReportsPage';
import { TeamPage } from './TeamPage';
import { OrderList } from '../components/OrderList';
import { StatCards } from '../components/StatCards';
import { useOrders } from '../hooks/useOrders';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { matchesFilter, type StatusFilter } from '../lib/format';
import type { StaffProfile } from '../lib/types';

type Tab = 'orders' | 'reports' | 'team';
const FILTERS: StatusFilter[] = ['all', 'new', 'payment', 'work', 'ready', 'done'];

export function StaffDashboard({ profile }: { profile: StaffProfile }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const { orders, loading, error, reload } = useOrders();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('orders');
  const isManager = profile.role === 'owner' || profile.role === 'manager';
  const tabs: Tab[] = ['orders', ...(isManager ? (['reports'] as const) : []), ...(profile.role === 'owner' ? (['team'] as const) : [])];

  // Show how many requests are waiting in the browser tab title.
  useEffect(() => {
    const waiting = orders.filter((o) => o.status === 'pending_review').length;
    document.title = waiting ? `(${waiting}) ${t('app.name')}` : t('app.name');
    return () => {
      document.title = t('app.name');
    };
  }, [orders, t]);

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

  const nav =
    tabs.length > 1 ? (
      <div className="tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'selected' : ''} onClick={() => setTab(x)}>
            {t(`nav.${x}`)}
          </button>
        ))}
      </div>
    ) : null;

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
