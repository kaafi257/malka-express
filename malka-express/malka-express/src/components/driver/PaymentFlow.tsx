import { ArrowLeft, Building2, Check, CircleCheck, Copy, CreditCard, Landmark, Smartphone, UploadCloud, Wallet, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchPaymentMethods, submitPayment, validateFiles } from '../../lib/api';
import { formatBytes, formatEtb } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { DRIVER_METHODS, isConfigured } from '../../lib/payments';
import { useToast } from '../../lib/toast';
import type { DriverPayMethod, Order, PaymentMethodConfig } from '../../lib/types';

const ICONS = { ebirr: Wallet, cbe_bank: Landmark, telebirr: Smartphone, awash_bank: Building2, cbe_birr: CreditCard } as const;

/** Full-screen payment sheet: choose method → see instructions → receipt → submit for verification. */
export function PaymentFlow({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => Promise<void> | void }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<DriverPayMethod | null>(null);
  const [step, setStep] = useState<'method' | 'details'>('method');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPaymentMethods()
      .then(setConfigs)
      .catch((e) => notify('error', tError(e)))
      .finally(() => setLoading(false));
  }, [notify, tError]);

  const cfg = (m: DriverPayMethod) => configs.find((c) => c.method === m);
  const selected = method ? cfg(method) : undefined;
  const ready = isConfigured(selected);
  const amount = order.quoted_price ?? 0;

  function pickFile(list: FileList | null) {
    const f = list?.[0] ?? null;
    if (f) {
      const problem = validateFiles([f]);
      if (problem) {
        notify('error', t(`err.${problem}` as 'err.file_too_large'));
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
    }
    setFile(f);
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(selected?.account_number ?? '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the number is visible anyway */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!method || !file) return;
    setBusy(true);
    try {
      // No reference number is asked from the driver: the receipt is the proof.
      // A unique code is generated so each submission stays distinct for the manager.
      const reference = `RCPT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await submitPayment({ orderId: order.id, method, reference, file });
      notify('success', t('pay.submitted'));
      await onDone();
      onClose();
    } catch (err) {
      notify('error', tError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t('pay.title')}>
      <header className="sheet-head">
        <button className="icon-btn dark" onClick={step === 'details' ? () => setStep('method') : onClose} aria-label={t('pay.back')}>
          <ArrowLeft size={22} />
        </button>
        <h2>{t('pay.title')}</h2>
        <button className="icon-btn dark" onClick={onClose} aria-label={t('common.close')}>
          <X size={22} />
        </button>
      </header>

      <div className="sheet-body">
        <div className="amount-box">
          <small>
            {t('order.ref')} {order.reference}
          </small>
          <small>{t('pay.amount')}</small>
          <strong>{formatEtb(amount)}</strong>
        </div>

        {loading ? (
          <p className="muted center-text">{t('common.loading')}</p>
        ) : step === 'method' ? (
          <>
            <div className="method-grid" role="radiogroup" aria-label={t('pay.title')}>
              {DRIVER_METHODS.map((m) => {
                const Icon = ICONS[m];
                const on = method === m;
                return (
                  <button key={m} type="button" role="radio" aria-checked={on} className={`method-card ${on ? 'selected' : ''}`} onClick={() => setMethod(m)}>
                    <span className="m-ico">
                      <Icon size={24} aria-hidden />
                    </span>
                    <b>{t(`method.${m}`)}</b>
                    {on && <CircleCheck className="m-check" size={20} aria-hidden />}
                  </button>
                );
              })}
            </div>
            <button className="primary big" disabled={!method} onClick={() => setStep('details')}>
              {t('pay.next')}
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void submit(e)}>
            <div className="instr">
              <div className="instr-head">
                <span className="label">{t('pay.selected')}</span>
                <b>{method && t(`method.${method}`)}</b>
              </div>
              {ready ? (
                <>
                  <dl>
                    {selected?.provider_name && (
                      <>
                        <dt>{t('pay.provider')}</dt>
                        <dd>{selected.provider_name}</dd>
                      </>
                    )}
                    {selected?.account_holder && (
                      <>
                        <dt>{t('pay.accountHolder')}</dt>
                        <dd>{selected.account_holder}</dd>
                      </>
                    )}
                    <dt>{t('pay.accountNumber')}</dt>
                    <dd className="acct">
                      <b>{selected?.account_number}</b>
                      <button type="button" className="link" onClick={() => void copyNumber()}>
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('pay.copied') : t('pay.copy')}
                      </button>
                    </dd>
                  </dl>
                  {selected?.instructions && (
                    <p className="instr-text">
                      <span className="label">{t('pay.instructions')}</span>
                      {selected.instructions}
                    </p>
                  )}
                </>
              ) : (
                <p className="notice">{t('pay.notConfigured')}</p>
              )}
            </div>

            <label className="upload">
              <UploadCloud />
              <b>{file ? file.name : t('pay.chooseReceipt')}</b>
              <small>{file ? formatBytes(file.size) : t('pay.receipt')}</small>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pickFile(e.target.files)} />
            </label>

            <button className="primary big" disabled={busy || !ready || !file}>
              {busy ? t('pay.submitting') : t('pay.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
