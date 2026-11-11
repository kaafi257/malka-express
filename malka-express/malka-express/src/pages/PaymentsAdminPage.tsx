import { ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPaymentMethods, fetchSubmissions, getReceiptUrl, rejectPayment, savePaymentMethod, verifyPayment } from '../lib/api';
import { formatDateTime, formatEtb, formatPhone } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { PaymentMethodConfig, SubmissionDetail, SubmissionStatus } from '../lib/types';

type Tab = 'pending' | 'history' | 'settings';
type HistoryFilter = 'all' | Exclude<SubmissionStatus, 'pending_verification'>;

export function PaymentsAdminPage({ onChanged }: { onChanged: () => Promise<void> | void }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<SubmissionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const load = useCallback(async () => {
    try {
      setItems(await fetchSubmissions());
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setLoading(false);
    }
  }, [notify, tError]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => items.filter((s) => s.status === 'pending_verification'), [items]);
  const history = useMemo(
    () => items.filter((s) => s.status !== 'pending_verification' && (filter === 'all' || s.status === filter)),
    [items, filter],
  );

  return (
    <>
      <div className="intro">
        <div>
          <p className="eyebrow">{t('staff.eyebrow')}</p>
          <h1>{t('padmin.title')}</h1>
          <p className="muted">{t('padmin.subtitle')}</p>
        </div>
        <button className="secondary" onClick={() => void load()}>
          <RefreshCw size={15} /> {t('common.refresh')}
        </button>
      </div>

      <div className="tabs sub" role="tablist">
        {(['pending', 'history', 'settings'] as Tab[]).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'selected' : ''} onClick={() => setTab(x)}>
            {t(`padmin.${x}`)}
            {x === 'pending' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'settings' ? (
        <MethodSettings />
      ) : loading ? (
        <p className="muted center-text">{t('common.loading')}</p>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div className="empty">{t('padmin.noPending')}</div>
        ) : (
          <div className="list">
            {pending.map((s) => (
              <SubmissionCard
                key={s.id}
                s={s}
                reviewable
                onChanged={async () => {
                  await load();
                  await onChanged();
                }}
              />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="chips">
            {(['all', 'verified', 'rejected'] as HistoryFilter[]).map((f) => (
              <button key={f} className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>
                {t(`padmin.${f}`)}
              </button>
            ))}
          </div>
          {history.length === 0 ? (
            <div className="empty">{t('common.noResults')}</div>
          ) : (
            <div className="list">
              {history.map((s) => (
                <SubmissionCard key={s.id} s={s} onChanged={load} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function SubmissionCard({ s, reviewable, onChanged }: { s: SubmissionDetail; reviewable?: boolean; onChanged: () => Promise<void> | void }) {
  const { t, tError, locale } = useI18n();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      notify('success', done);
      setRejecting(false);
      await onChanged();
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setBusy(false);
    }
  }

  async function openReceipt() {
    try {
      window.open(await getReceiptUrl(s.receipt_path), '_blank', 'noopener');
    } catch (e) {
      notify('error', tError(e));
    }
  }

  return (
    <article className={`sub-card ${s.status}`}>
      <div className="order-head">
        <div>
          <b>
            {s.order?.reference} · {formatEtb(s.amount)}
          </b>
          <small>{formatDateTime(s.created_at, locale)}</small>
        </div>
        <span className={`pstate ${s.status}`}>{t(`pstate.${s.status}`)}</span>
      </div>
      <dl>
        <dt>{t('order.driver')}</dt>
        <dd>
          {s.driver?.full_name} · {formatPhone(s.driver?.phone)}
        </dd>
        <dt>{t('form.type')}</dt>
        <dd>
          {s.order && t(`doc.${s.order.document_type}`)} · {s.order?.copies} {t('order.copies')}
          {s.order?.description ? ` · ${s.order.description}` : ''}
        </dd>
        <dt>{t('pay.method')}</dt>
        <dd>{t(`method.${s.method}`)}</dd>
        <dt>{t('pay.transactionRef')}</dt>
        <dd>{s.reference}</dd>
        {s.verified_at && (
          <>
            <dt>{t('padmin.reviewedAt')}</dt>
            <dd>{formatDateTime(s.verified_at, locale)}</dd>
          </>
        )}
        {s.rejection_reason && (
          <>
            <dt>{t('pay.rejectedReason')}</dt>
            <dd>{s.rejection_reason}</dd>
          </>
        )}
      </dl>
      <div className="actions">
        <button className="link" onClick={() => void openReceipt()}>
          <ExternalLink size={14} /> {t('padmin.viewReceipt')}
        </button>
      </div>
      {reviewable && !rejecting && (
        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => void run(() => verifyPayment(s.id), t('padmin.verifiedToast'))}>
            {t('padmin.verify')}
          </button>
          <button className="secondary" disabled={busy} onClick={() => setRejecting(true)}>
            {t('padmin.reject')}
          </button>
        </div>
      )}
      {reviewable && rejecting && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => rejectPayment(s.id, reason), t('padmin.rejectedToast'));
          }}
        >
          <label>
            {t('padmin.rejectReason')}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required minLength={3} />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy || reason.trim().length < 3}>
              {t('padmin.confirmReject')}
            </button>
            <button type="button" className="secondary" onClick={() => setRejecting(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function MethodSettings() {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [rows, setRows] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethods()
      .then(setRows)
      .catch((e) => notify('error', tError(e)))
      .finally(() => setLoading(false));
  }, [notify, tError]);

  const edit = (m: string, patch: Partial<PaymentMethodConfig>) => setRows((r) => r.map((x) => (x.method === m ? { ...x, ...patch } : x)));

  async function save(row: PaymentMethodConfig) {
    setSaving(row.method);
    try {
      await savePaymentMethod(row);
      notify('success', t('padmin.saved'));
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="muted center-text">{t('common.loading')}</p>;
  return (
    <div className="list">
      <p className="hint">{t('padmin.settingsHint')}</p>
      {rows.map((r) => (
        <form
          key={r.method}
          className="method-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(r);
          }}
        >
          <div className="panel-title">
            <h2>{t(`method.${r.method}`)}</h2>
            <label className="check">
              <input type="checkbox" checked={r.enabled} onChange={(e) => edit(r.method, { enabled: e.target.checked })} />
              {t('padmin.enabled')}
            </label>
          </div>
          <div className="grid">
            <label>
              {t('pay.provider')}
              <input value={r.provider_name} maxLength={80} onChange={(e) => edit(r.method, { provider_name: e.target.value })} />
            </label>
            <label>
              {t('pay.accountHolder')}
              <input value={r.account_holder} maxLength={80} placeholder="—" onChange={(e) => edit(r.method, { account_holder: e.target.value })} />
            </label>
            <label className="full">
              {t('pay.accountNumber')}
              <input value={r.account_number} maxLength={60} placeholder="—" onChange={(e) => edit(r.method, { account_number: e.target.value })} />
            </label>
            <label className="full">
              {t('pay.instructions')}
              <textarea value={r.instructions} maxLength={600} onChange={(e) => edit(r.method, { instructions: e.target.value })} />
            </label>
          </div>
          <button className="primary" disabled={saving === r.method}>
            {t('padmin.save')}
          </button>
        </form>
      ))}
    </div>
  );
}
