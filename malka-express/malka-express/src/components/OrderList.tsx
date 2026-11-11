import { useState, type FormEvent } from 'react';
import {
  KeyRound,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Printer,
  RotateCw,
} from 'lucide-react';
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

  async function run(
    action: () => Promise<unknown>,
    successText = t('toast.updated'),
  ) {
    if (busy) return;

    setBusy(true);
    try {
      await action();
      notify('success', successText);
      await onChanged();
    } catch (error) {
      notify('error', tError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const price = Number(priceInput.trim());
    if (!Number.isFinite(price) || price <= 0) {
      notify('error', 'Enter a valid price greater than 0 ETB.');
      return;
    }

    await run(
      () => api.setPrice(order.id, price),
      'Price saved. The order is ready for driver payment.',
    );
  }

  async function handleVerifyPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pinInput.trim().length !== 6) {
      notify('error', 'Please enter the 6-digit Secret Code.');
      return;
    }

    setBusy(true);
    try {
      const result = await api.collectOrder(order.id, pinInput.trim());

      if (result === 'collected') {
        notify('success', 'Secret Code verified. Documents handed over.');
        setPinInput('');
        await onChanged();
      } else if (result === 'wrong_pin') {
        notify('error', "Wrong Secret Code. Check the code on the driver's phone.");
      } else if (result === 'locked') {
        notify('error', 'Code locked after 5 incorrect attempts. Use New Code to reset it.');
      } else {
        notify('error', 'The code could not be verified. Refresh and try again.');
      }
    } catch (error) {
      notify('error', tError(error));
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
    : isManager &&
      ['pending_review', 'awaiting_payment', 'paid', 'printing', 'ready'].includes(
        order.status,
      );

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
            <Phone size={14} aria-hidden />
            {formatPhone(order.driver.phone)}
          </a>
        </div>
      )}

      <p className="desc">{order.description || t('order.noDescription')}</p>

      <DocumentList documents={order.documents} />

      {isDriver && <ProgressTracker status={order.status} />}

      {/* Driver sees the pickup code only after the order is ready. */}
      {isDriver && order.status === 'ready' && order.pin && (
        <div className="driver-secret-box">
          <div className="secret-icon">
            <KeyRound size={22} />
          </div>
          <small>Your secret pickup code</small>
          <div
            className="secret-code-digits"
            aria-label={order.pin.pin.split('').join(' ')}
          >
            {order.pin.pin.split('').map((digit, index) => (
              <span key={index} className="pin-digit">
                {digit}
              </span>
            ))}
          </div>
          <small>Show this code to the desk officer to collect your copies.</small>
        </div>
      )}

      {isDriver && order.status === 'pending_review' && (
        <p className="hint">
          Your request has been received. The desk team is reviewing it and will
          send you the price before printing begins.
        </p>
      )}

      {isDriver && order.status === 'awaiting_payment' && (
        <p className="hint">
          Your price is ready. Please complete payment using one of the available
          payment methods.
        </p>
      )}

      {/* Owner/manager enters the price directly inside this order card. */}
      {isManager && order.status === 'pending_review' && (
        <form className="actions" onSubmit={(event) => void handleSavePrice(event)}>
          <label htmlFor={`price-${order.id}`}>Set document-copying price (ETB)</label>
          <input
            id={`price-${order.id}`}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
            placeholder="Enter price in ETB"
            disabled={busy}
            required
          />
          <button
            type="submit"
            className="primary modern-btn"
            disabled={busy || !priceInput.trim()}
          >
            {busy ? 'Saving…' : 'Save Price & Send Payment Request'}
          </button>
        </form>
      )}

      {/* Staff can begin printing only after payment has been confirmed. */}
      {isStaff && order.status === 'paid' && (
        <div className="actions">
          <button
            type="button"
            className="primary modern-btn"
            disabled={busy}
            onClick={() =>
              void run(
                () => api.startPrinting(order.id),
                'Printing started.',
              )
            }
          >
            <Printer size={18} />
            Start printing
          </button>
        </div>
      )}

      {/* Staff can mark the order ready only after printing has started. */}
      {isStaff && order.status === 'printing' && (
        <div className="actions">
          <button
            type="button"
            className="primary modern-btn"
            disabled={busy}
            onClick={() =>
              void run(
                () => api.markReady(order.id),
                'Copies are ready. Pickup code generated for the driver.',
              )
            }
          >
            <CheckCircle2 size={18} />
            Mark ready for pickup
          </button>
        </div>
      )}

      {/* Staff verifies the driver's pickup code before handing over documents. */}
      {isStaff && order.status === 'ready' && (
        <div className="staff-verify-section">
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} />
            Verify driver's secret code
          </strong>

          <form
            className="inline-form"
            onSubmit={(event) => void handleVerifyPin(event)}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinInput}
              onChange={(event) =>
                setPinInput(event.target.value.replace(/\D/g, ''))
              }
              placeholder="6-digit code"
              className="secret-input"
              autoComplete="off"
              required
            />

            <button
              type="submit"
              className="primary modern-btn"
              disabled={busy || pinInput.length !== 6}
            >
              Verify &amp; hand over
            </button>

            {isManager && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                title="Generate a new secret code for the driver"
                onClick={() =>
                  void run(
                    () => api.regeneratePin(order.id),
                    'New secret code issued to driver.',
                  )
                }
              >
                <RotateCw size={15} />
                New code
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
              <button
                type="button"
                className="danger-link"
                disabled={busy}
                onClick={cancel}
              >
                {t('action.cancelOrder')}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
