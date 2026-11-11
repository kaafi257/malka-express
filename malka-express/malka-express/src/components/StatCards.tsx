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
        <strong>{counts.total}</strong>
        <small>{t('stats.total')}</small>
      </div>
      <div className={counts.pending > 0 ? 'hot' : ''}>
        <strong>{counts.pending}</strong>
        <small>{t('stats.new')}</small>
      </div>
      {detailed && (
        <>
          <div>
            <strong>{counts.payment}</strong>
            <small>{t('stats.payment')}</small>
          </div>
          <div>
            <strong>{counts.work}</strong>
            <small>{t('stats.work')}</small>
          </div>
        </>
      )}
      <div className={counts.ready > 0 ? 'go' : ''}>
        <strong>{counts.ready}</strong>
        <small>{t('stats.ready')}</small>
      </div>
    </div>
  );
}
