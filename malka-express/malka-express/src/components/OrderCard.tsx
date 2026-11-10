import { useState } from 'react';
import { Phone } from 'lucide-react';
import * as api from '../lib/api';
import { formatDateTime, formatEtb, formatPhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Order, StaffRole } from '../lib/types';
import { DocumentList } from './DocumentList';
import { ProgressTracker } from './ProgressTracker';
import { StatusBadge } from './StatusBadge';

interface Props {
  order: Order;
  viewer: 'driver' | StaffRole;
  onChanged: () => Promise<void> | void;
}

export function OrderCard({ order, viewer, onChanged }: Props) {
  const { t, tError, locale } = useI18n();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  const isDriver = viewer === 'driver';
  const isManager = viewer === 'owner' || viewer === 'manager';
  const isStaff = !isDriver;

  async function run(action: () => Promise<unknown>, successText = t('toast.updated')) {
    setBusy(true);
    try {
      await action();
      notify('success', successText);
      await onChanged();
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (window.confirm(t('action.cancelConfirm'))) void run(() => api.cancelOrder(order.id));
  }

  const canCancel = isDriver
    ? ['pending_review', 'awaiting_payment'].includes(order.status)
    : isManager && ['pending_review', 'awaiting_payment', 'paid', 'printing', 'ready'].includes(order.status);

  return (
    <article className={`order ${order.status}`}>
      <div className="order-head">
        <div>
          <b>{t(`doc.${order.document_type}`)}</b>
          <small>
            {t('order.ref')} {order.reference} · {formatDateTime(order.created_at, locale)}
          </small>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {isStaff && order.driver && (
        <div className="driver-line">
          <span>
            {t('order.driver')}: <b>{order.driver.full_name}</b>
          </span>
          <a className="link" href={`tel:+${order.driver.phone}`}>
            <Phone size={13} aria-hidden /> {formatPhone(order.driver.phone)}
          </a>
        </div>
      )}

      <p className="desc">{order.description || t('order.noDescription')}</p>

      <DocumentList documents={order.documents} />

      {order.quoted_price != null && (
        <div className="price-line">
          <small className="label">{t('order.price')}</small>
          <strong>{formatEtb(order.quoted_price)}</strong>
        </div>
      )}

      {isDriver && <ProgressTracker status={order.status} />}

      {isDriver && order.status === 'pending_review' && (
        <p className="hint">We received your request. Copies are being printed.</p>
      )}

      {isDriver && order.status === 'ready' && (
        <div className="notice" style={{ background: '#dff3e8', color: '#1f7a4d', fontWeight: 600 }}>
          ✓ Your copies are ready for collection at the desk!
        </div>
      )}

      {/* ---------------- 1-Click Staff Actions ---------------- */}
      {isStaff && order.status !== 'ready' && order.status !== 'collected' && order.status !== 'cancelled' && (
        <div className="actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run(() => api.markReady(order.id), 'Copies printed · Marked as Ready!')}
          >
            ✓ Mark Ready for Pickup
          </button>
        </div>
      )}

      {isStaff && order.status === 'ready' && (
        <div className="actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run(async () => {
              await api.collectOrder(order.id, order.pin?.pin || '000000');
            }, 'Copies handed over to driver!')}
          >
            ✓ Complete & Hand Over
          </button>
        </div>
      )}

      {canCancel && (
        <div className="actions">
          <button className="danger-link" disabled={busy} onClick={cancel}>
            {t('action.cancelOrder')}
          </button>
        </div>
      )}
    </article>
  );
}
