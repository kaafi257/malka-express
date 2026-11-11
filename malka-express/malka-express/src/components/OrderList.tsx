
import type { ReactNode } from 'react';
import type { Order, StaffRole } from '../lib/types';
import { OrderCard } from './OrderCard';

interface OrderListProps {
  title: string;
  orders: Order[];
  viewer: StaffRole;
  onChanged: () => Promise<void> | void;
  toolbar?: ReactNode;
}

export function OrderList({
  title,
  orders,
  viewer,
  onChanged,
  toolbar,
}: OrderListProps) {
  return (
    <section className="order-list-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            Manage and track document-copying requests.
          </p>
        </div>

        <span className="order-count">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </span>
      </div>

      {toolbar && (
        <div className="order-list-toolbar">
          {toolbar}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <span>📄</span>
          </div>

          <h3>No orders found</h3>

          <p className="muted">
            There are no orders matching your current search or filter.
            Try changing the filter or search term.
          </p>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              viewer={viewer}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}
