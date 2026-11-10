import { Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import type { Order, StaffRole } from '../lib/types';
import { OrderCard } from './OrderCard';

interface Props {
  title: string;
  orders: Order[];
  viewer: 'driver' | StaffRole;
  onChanged: () => Promise<void> | void;
  toolbar?: ReactNode;
}

export function OrderList({ title, orders, viewer, onChanged, toolbar }: Props) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>
          <Truck size={18} /> {title}
        </h2>
        <small>
          {orders.length} {t('common.requests')}
        </small>
      </div>
      {toolbar}
      {orders.length === 0 ? (
        <div className="empty">{t('common.noResults')}</div>
      ) : (
        <div className="list">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} viewer={viewer} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}
