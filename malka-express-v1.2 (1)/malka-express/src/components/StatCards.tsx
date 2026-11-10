import { BadgeCheck, ClipboardList, Clock, Hammer, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import type { Order } from '../lib/types';

export function StatCards({ orders, detailed }: { orders: Order[]; detailed: boolean }) {
  const { t } = useI18n();
  const counts = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending_review').length,
      payment: orders.filter((o) => o.status === 'awaiting_payment').length,
      work: orders.filter((o) => o.status === 'paid' || o.status === 'printing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
    }),
    [orders],
  );

  return (
    <div className="stats">
      <div>
        <ClipboardList size={18} />
        <small>{t('stats.total')}</small>
        <strong>{counts.total}</strong>
      </div>
      <div>
        <Clock size={18} />
        <small>{t('stats.new')}</small>
        <strong>{counts.pending}</strong>
      </div>
      {detailed && (
        <>
          <div>
            <Wallet size={18} />
            <small>{t('stats.payment')}</small>
            <strong>{counts.payment}</strong>
          </div>
          <div>
            <Hammer size={18} />
            <small>{t('stats.work')}</small>
            <strong>{counts.work}</strong>
          </div>
        </>
      )}
      <div>
        <BadgeCheck size={18} />
        <small>{t('stats.ready')}</small>
        <strong>{counts.ready}</strong>
      </div>
    </div>
  );
}
