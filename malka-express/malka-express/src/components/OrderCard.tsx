import { useState, type FormEvent } from 'react';
import { KeyRound, Phone, ShieldCheck, CheckCircle2, RotateCw } from 'lucide-react';
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

  // Verify driver's secret PIN
  async function handleVerifyPin(e: FormEvent) {
    e.preventDefault();
    if (pinInput.trim().length < 6) {
      notify('error', 'Please enter the 6-digit Secret Code.');
      return;
    }
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
    if (window.confirm(t('action.cancelConfirm'))) void run(() => api.cancelOrder(order.id));
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
        <p className="hint">We received your request. Copies are being printed at the desk.</p>
      )}

      {/* Staff: mark ready */}
      {isStaff && order.status !== 'ready' && order.status !== 'collected' && order.status !== 'cancelled' && (
        <div className="actions">
          <button
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
            <button className="primary modern-btn" disabled={busy || pinInput.length < 6}>
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
              <button className="danger-link" disabled={busy} onClick={cancel}>
                {t('action.cancelOrder')}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
