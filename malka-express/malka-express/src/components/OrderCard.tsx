import { useState, type FormEvent } from 'react';
import { KeyRound, Phone } from 'lucide-react';
import * as api from '../lib/api';
import { formatDateTime, formatEtb, formatPhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Order, PaymentMethod, StaffRole } from '../lib/types';
import { DocumentList } from './DocumentList';
import { ProgressTracker } from './ProgressTracker';
import { StatusBadge } from './StatusBadge';

const METHODS: PaymentMethod[] = ['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'other'];

interface Props {
  order: Order;
  /** 'driver' for drivers; the staff role otherwise. */
  viewer: 'driver' | StaffRole;
  onChanged: () => Promise<void> | void;
}

export function OrderCard({ order, viewer, onChanged }: Props) {
  const { t, tError, locale } = useI18n();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(order.quoted_price ? String(order.quoted_price) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [pin, setPin] = useState('');

  const isDriver = viewer === 'driver';
  const isManager = viewer === 'owner' || viewer === 'manager';
  const isStaff = !isDriver;

  /** Runs an action, shows the right toast and refreshes the list. */
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

  function submitPrice(e: FormEvent) {
    e.preventDefault();
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return notify('error', t('err.invalid_price'));
    void run(() => api.setPrice(order.id, value));
  }

  function submitPayment(e: FormEvent) {
    e.preventDefault();
    void run(() => api.recordPayment(order.id, method, reference));
  }

  async function submitCollect(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return notify('error', t('err.pin_invalid'));
    setBusy(true);
    try {
      const result = await api.collectOrder(order.id, pin);
      if (result === 'collected') {
        notify('success', t('toast.collected'));
        setPin('');
        await onChanged();
      } else {
        notify('error', result === 'locked' ? t('collect.locked') : t('collect.wrong'));
      }
    } catch (err) {
      notify('error', tError(err));
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

      {isDriver && order.status === 'pending_review' && <p className="hint">{t('order.waitingPrice')}</p>}
      {isDriver && order.status === 'awaiting_payment' && <p className="hint">{t('order.payAtDesk')}</p>}

      {isDriver && order.status === 'ready' && order.pin && (
        <div className="pin-box">
          <KeyRound size={20} aria-hidden />
          <div>
            <small>{t('pin.title')}</small>
            <strong className="pin">{order.pin.pin}</strong>
            <small>{t('pin.hint')}</small>
          </div>
        </div>
      )}

      {/* ---------------- staff actions ---------------- */}
      {isManager && order.status === 'pending_review' && (
        <form className="inline-form" onSubmit={submitPrice}>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t('action.pricePlaceholder')}
            aria-label={t('action.pricePlaceholder')}
            required
          />
          <button className="primary" disabled={busy}>
            {t('action.setPrice')}
          </button>
        </form>
      )}

      {isManager && order.status === 'awaiting_payment' && (
        <form className="inline-form wrap" onSubmit={submitPayment}>
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label={t('pay.method')}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`method.${m}`)}
              </option>
            ))}
          </select>
          {method !== 'cash' && (
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('pay.reference')}
              aria-label={t('pay.reference')}
              required
            />
          )}
          <button className="primary" disabled={busy}>
            {t('action.recordPayment')}
          </button>
        </form>
      )}

      {isStaff && order.status === 'paid' && (
        <div className="actions">
          <button className="secondary" disabled={busy} onClick={() => void run(() => api.startPrinting(order.id))}>
            {t('action.startPrinting')}
          </button>
        </div>
      )}

      {isStaff && order.status === 'printing' && (
        <div className="actions">
          <button className="secondary" disabled={busy} onClick={() => void run(() => api.markReady(order.id))}>
            {t('action.markReady')}
          </button>
        </div>
      )}

      {isStaff && order.status === 'ready' && (
        <form className="inline-form" onSubmit={(e) => void submitCollect(e)}>
          <input
            className="pin-input"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder={t('action.enterPin')}
            aria-label={t('action.enterPin')}
          />
          <button className="primary" disabled={busy}>
            {t('action.collect')}
          </button>
          {isManager && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void run(() => api.regeneratePin(order.id), t('toast.pinRegenerated'))}
            >
              {t('action.regeneratePin')}
            </button>
          )}
        </form>
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
