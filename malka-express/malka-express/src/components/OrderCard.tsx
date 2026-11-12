import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Phone, ShieldCheck, CheckCircle2, RotateCw, Printer, Banknote } from 'lucide-react';
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
  const [pinInput, setPinInput] = useState('');
  const [priceInput, setPriceInput] = useState(
    order.quoted_price != null ? String(order.quoted_price) : '',
  );

  const isDriver = viewer === 'driver';
  const isManager = viewer === 'owner' || viewer === 'manager';
  const isStaff = !isDriver;
  const canSetPrice =
    isManager &&
    ['pending_review', 'awaiting_payment'].includes(order.status) &&
    order.documents.length > 0;

  // Pre-fill the suggested price (copies x price per copy) so the manager only has to check and confirm.
  useEffect(() => {
    if (!canSetPrice || order.quoted_price != null) return;
    let alive = true;
    api
      .fetchDocPrices()
      .then((p) => {
        const unit = p[order.document_type];
        if (alive && unit) setPriceInput((cur) => cur || String(unit * order.copies));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [canSetPrice, order.quoted_price, order.document_type, order.copies]);

  async function run(action: () => Promise<unknown>, successText = t('toast.updated')) {
    if (busy) return;

    setBusy(true);
    try {
      await action();
      notify('success', successText);
      await onChanged();
    } catch (e) {
      notify('error', tError(e));
      // Reload after a conflict so the card reflects the latest server status.
      try {
        await onChanged();
      } catch {
        // Keep the original action error visible.
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPrice(e: FormEvent) {
    e.preventDefault();
    const price = Number(priceInput);

    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
      notify('error', t('err.invalid_price'));
      return;
    }

    await run(
      () => api.setPrice(order.id, price),
      'Price saved. Order moved to Awaiting Payment.',
    );
  }

  // Verify driver's secret PIN
  async function handleVerifyPin(e: FormEvent) {
    e.preventDefault();
    if (pinInput.trim().length !== 6) {
      notify('error', 'Please enter the 6-digit Secret Code.');
      return;
    }
    if (busy) return;

    setBusy(true);
    try {
      const result = await api.collectOrder(order.id, pinInput.trim());
      if (result === 'collected') {
        notify('success', 'Secret Code verified! Documents handed over.');
        setPinInput('');
        await onChanged();
      } else if (result === 'wrong_pin') {
        notify('error', 'Wrong Secret Code. Please check the code on driver\'s phone.');
      } else if (result === 'locked') {
        notify('error', 'Code locked due to 5 wrong attempts. Click "New Code" to reset.');
      }
    } catch (err) {
      notify('error', tError(err));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (window.confirm(t('action.cancelConfirm'))) {
      void run(() => api.cancelOrder(order.id));
    }
  }

  const canCancel = isDriver
    ? ['pending_review', 'awaiting_payment'].includes(order.status)
    : isManager && ['pending_review', 'awaiting_payment', 'paid', 'printing', 'ready'].includes(order.status);

  return (
    <article className={`order ${order.status}`}>
      <div className="order-head">
        <div className="order-title">
          <span className="doctype">{t(`doc.${order.document_type}`)}</span>
          <small>
            <span className="ref-tag">{order.reference}</span>
            <span className="when">{formatDateTime(order.created_at, locale)}</span>
          </small>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {isStaff && order.driver && (
        <div className="driver-pill">
          <div>
            <span>{t('order.driver')}</span>
            <strong>{order.driver.full_name}</strong>
          </div>
          <a className="driver-phone-link" href={`tel:+${order.driver.phone}`}>
            <Phone size={14} aria-hidden /> {formatPhone(order.driver.phone)}
          </a>
        </div>
      )}

      <p className="desc">{order.description || t('order.noDescription')}</p>

      <DocumentList documents={order.documents} />

      {isDriver && <ProgressTracker status={order.status} />}

      {/* Driver: secret pickup code */}
      {isDriver && order.status === 'ready' && order.pin && (
        <div className="driver-secret-box">
          <div className="secret-icon">
            <KeyRound size={22} />
          </div>
          <small>Your secret pickup code</small>
          <div className="secret-code-digits" aria-label={order.pin.pin.split('').join(' ')}>
            {order.pin.pin.split('').map((digit, i) => (
              <span key={i} className="pin-digit">
                {digit}
              </span>
            ))}
          </div>
          <small>Show this code to the desk officer to collect your copies.</small>
        </div>
      )}

      {isDriver && order.status === 'pending_review' && (
        <p className="hint">Your request is waiting for staff review and pricing.</p>
      )}

      {/* Manager/owner: set or update the price directly on the order card. */}
      {canSetPrice && (
        <form className="actions" onSubmit={(e) => void handleSetPrice(e)}>
          <label className="price-entry" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <span>{t('action.setPrice')} (ETB)</span>
            <input
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder={t('action.pricePlaceholder')}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" className="primary modern-btn" disabled={busy || !priceInput.trim()}>
            <Banknote size={18} />
            {busy ? t('common.loading') : 'Save Price & Send Payment Request'}
          </button>
        </form>
      )}

      {/* Staff: only show the action valid for the current order status. */}
      {isStaff && order.status === 'paid' && (
        <div className="actions">
          <button
            type="button"
            className="primary modern-btn"
            disabled={busy}
            onClick={() => void run(() => api.startPrinting(order.id), 'Printing started successfully!')}
          >
            <Printer size={18} /> Start Printing
          </button>
        </div>
      )}

      {isStaff && order.status === 'printing' && (
        <div className="actions">
          <button
            type="button"
            className="primary modern-btn"
            disabled={busy}
            onClick={() => void run(() => api.markReady(order.id), 'Copies printed · Secret Code generated for driver!')}
          >
            <CheckCircle2 size={18} /> Mark ready for pickup
          </button>
        </div>
      )}

      {/* Staff: verify the driver's code and hand over */}
      {isStaff && order.status === 'ready' && (
        <div className="staff-verify-section">
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} /> Verify driver&rsquo;s secret code
          </strong>
          <form className="inline-form" onSubmit={(e) => void handleVerifyPin(e)}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code"
              className="secret-input"
              autoComplete="off"
              required
            />
            <button type="submit" className="primary modern-btn" disabled={busy || pinInput.length !== 6}>
              Verify &amp; hand over
            </button>
            {isManager && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                title="Generate a new secret code for driver"
                onClick={() => void run(() => api.regeneratePin(order.id), 'New secret code issued to driver!')}
              >
                <RotateCw size={15} /> New code
              </button>
            )}
          </form>
        </div>
      )}

      {(order.quoted_price != null || canCancel) && (
        <div className="stub">
          {order.quoted_price != null ? (
            <div className="price-display-pill">
              <span>{t('order.price')}</span>
              <strong>{formatEtb(order.quoted_price)}</strong>
            </div>
          ) : (
            <span />
          )}
          {canCancel && (
            <div className="actions">
              <button type="button" className="danger-link" disabled={busy} onClick={cancel}>
                {t('action.cancelOrder')}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
