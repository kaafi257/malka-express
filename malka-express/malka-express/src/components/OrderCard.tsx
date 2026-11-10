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
    <article className={`order modern-card ${order.status}`}>
      {/* Top Header */}
      <div className="order-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <b style={{ fontSize: '1.1rem', letterSpacing: '0.02em' }}>{t(`doc.${order.document_type}`)}</b>
            <span className="ref-tag">{order.reference}</span>
          </div>
          <small style={{ color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            {formatDateTime(order.created_at, locale)}
          </small>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Driver Contact Pill (Staff View) */}
      {isStaff && order.driver && (
        <div className="driver-pill">
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver:</span>{' '}
            <strong>{order.driver.full_name}</strong>
          </div>
          <a className="driver-phone-link" href={`tel:+${order.driver.phone}`}>
            <Phone size={13} aria-hidden /> {formatPhone(order.driver.phone)}
          </a>
        </div>
      )}

      {/* Description / Quantity */}
      <p className="desc">{order.description || t('order.noDescription')}</p>

      {/* Attached Files */}
      <DocumentList documents={order.documents} />

      {/* Price Pill */}
      {order.quoted_price != null && (
        <div className="price-display-pill">
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Total Amount</span>
          <strong style={{ fontSize: '1.25rem', color: 'var(--brand)' }}>{formatEtb(order.quoted_price)}</strong>
        </div>
      )}

      {/* Driver Progress Stepper */}
      {isDriver && <ProgressTracker status={order.status} />}

      {/* ---------------- DRIVER SECRET PIN DISPLAY ---------------- */}
      {isDriver && order.status === 'ready' && order.pin && (
        <div className="driver-secret-box">
          <div className="secret-icon">
            <KeyRound size={26} />
          </div>
          <div>
            <small style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: '#8a6a14' }}>
              Your Secret Pickup Code
            </small>
            <div className="secret-code-digits">
              {order.pin.pin.split('').map((digit, i) => (
                <span key={i} className="pin-digit">{digit}</span>
              ))}
            </div>
            <small style={{ color: '#6d5310' }}>
              Show this secret code to the desk officer to collect your copies.
            </small>
          </div>
        </div>
      )}

      {/* Driver Info when pending */}
      {isDriver && order.status === 'pending_review' && (
        <p className="hint">We received your request. Copies are being printed at the desk.</p>
      )}

      {/* ---------------- STAFF ACTION 1: MARK READY ---------------- */}
      {isStaff && order.status !== 'ready' && order.status !== 'collected' && order.status !== 'cancelled' && (
        <div className="actions" style={{ marginTop: '6px' }}>
          <button
            className="primary modern-btn"
            disabled={busy}
            onClick={() => void run(() => api.markReady(order.id), 'Copies printed · Secret Code generated for driver!')}
          >
            <CheckCircle2 size={16} /> Mark Ready for Pickup
          </button>
        </div>
      )}

      {/* ---------------- STAFF ACTION 2: VERIFY SECRET PIN & HAND OVER ---------------- */}
      {isStaff && order.status === 'ready' && (
        <div className="staff-verify-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={18} style={{ color: 'var(--brand)' }} />
            <strong style={{ fontSize: '0.92rem' }}>Driver Secret Code Verification</strong>
          </div>
          <form className="inline-form" onSubmit={(e) => void handleVerifyPin(e)}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit Code"
              className="secret-input"
              autoComplete="off"
              required
            />
            <button className="primary modern-btn" disabled={busy || pinInput.length < 6}>
              Verify & Hand Over
            </button>
            {isManager && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                title="Generate a new secret code for driver"
                onClick={() => void run(() => api.regeneratePin(order.id), 'New secret code issued to driver!')}
              >
                <RotateCw size={14} /> New Code
              </button>
            )}
          </form>
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
