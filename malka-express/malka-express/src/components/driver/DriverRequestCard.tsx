import { Calendar, Copy, FileText, KeyRound } from 'lucide-react';
import { useState } from 'react';
import * as api from '../../lib/api';
import { formatDateTime, formatEtb } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { canPay, latestRejection, paymentState } from '../../lib/payments';
import { useToast } from '../../lib/toast';
import type { Order } from '../../lib/types';
import { ProgressTracker } from '../ProgressTracker';
import { StatusBadge } from '../StatusBadge';
import { PaymentStatusBadge } from './PaymentStatusBadge';

/** One request as the driver sees it. No document previews, ever. */
export function DriverRequestCard({
  order,
  onChanged,
  onPay,
}: {
  order: Order;
  onChanged: () => Promise<void> | void;
  onPay: (order: Order) => void;
}) {
  const { t, tError, locale } = useI18n();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const state = paymentState(order);
  const reason = latestRejection(order);
  const canCancel = order.status === 'pending_review' || order.status === 'awaiting_payment';

  async function cancel() {
    if (!window.confirm(t('action.cancelConfirm'))) return;
    setBusy(true);
    try {
      await api.cancelOrder(order.id);
      notify('success', t('toast.updated'));
      await onChanged();
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`dcard ${order.status}`}>
      <div className="dcard-top">
        <b className="ref">{order.reference}</b>
        <StatusBadge status={order.status} />
      </div>
      <div className="dcard-meta">
        <span>
          <FileText size={15} aria-hidden /> {t(`doc.${order.document_type}`)}
        </span>
        <span>
          <Copy size={15} aria-hidden /> {order.copies} {t('order.copies')}
        </span>
        <span>
          <Calendar size={15} aria-hidden /> {formatDateTime(order.created_at, locale)}
        </span>
      </div>
      <div className="dcard-price">
        <small>{t('order.total')}</small>
        {order.quoted_price != null ? <strong>{formatEtb(order.quoted_price)}</strong> : <em>{t('order.pricePending')}</em>}
        <PaymentStatusBadge state={state} />
      </div>

      {order.status !== 'cancelled' && <ProgressTracker status={order.status} />}

      {state === 'pending_verification' && <p className="hint">{t('pay.pendingHint')}</p>}
      {state === 'rejected' && reason && (
        <p className="notice error">
          {t('pay.rejectedReason')}: {reason}
        </p>
      )}

      {order.status === 'ready' && order.pin && (
        <div className="pin-box">
          <KeyRound size={20} aria-hidden />
          <div>
            <small>{t('pin.title')}</small>
            <strong className="pin">{order.pin.pin}</strong>
            <small>{t('pin.hint')}</small>
          </div>
        </div>
      )}

      {(canPay(order) || canCancel) && (
        <div className="dcard-actions">
          {canPay(order) && (
            <button className="primary big" onClick={() => onPay(order)}>
              {state === 'rejected' ? t('pay.payAgain') : t('pay.payNow')}
            </button>
          )}
          {canCancel && (
            <button className="danger-link" disabled={busy} onClick={() => void cancel()}>
              {t('action.cancelOrder')}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
