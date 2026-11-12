import { Building2, Check, CircleCheck, Copy, CreditCard, Landmark, Minus, Plus, Smartphone, UploadCloud, Wallet, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { driverQuote, fetchDocPrices, fetchPaymentMethods, submitPayment, submitRequest, validateFiles } from '../../lib/api';
import { formatBytes, formatEtb } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { DRIVER_METHODS, isConfigured } from '../../lib/payments';
import { useToast } from '../../lib/toast';
import type { DocumentType, DriverPayMethod, PaymentMethodConfig } from '../../lib/types';

const ICONS = { ebirr: Wallet, cbe_bank: Landmark, telebirr: Smartphone, awash_bank: Building2, cbe_birr: CreditCard } as const;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** One page: photo(s) + copies + payment method + receipt → request created, priced and paid in one tap. */
export function QuickOrder({ userId, onDone }: { userId: string; onDone: () => Promise<void> | void }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [type, setType] = useState<DocumentType>('waybill');
  const [copies, setCopies] = useState(1);
  const [photos, setPhotos] = useState<File[]>([]);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [method, setMethod] = useState<DriverPayMethod | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [configs, setConfigs] = useState<PaymentMethodConfig[]>([]);
  // Once the request exists we keep its id, so a retry never creates a duplicate request.
  const [stage, setStage] = useState<{ id: string; quoted: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([fetchDocPrices(), fetchPaymentMethods()])
      .then(([p, c]) => {
        setPrices(p);
        setConfigs(c);
      })
      .catch((e) => notify('error', tError(e)));
  }, [notify, tError]);

  const total = (prices[type] ?? 0) * copies;
  const selected = method ? configs.find((c) => c.method === method) : undefined;
  const ready = isConfigured(selected);
  const canSubmit = !busy && photos.length > 0 && !!receipt && !!method && ready && total > 0;

  function pickPhotos(list: FileList | null) {
    const next = list ? Array.from(list) : [];
    const problem = validateFiles(next);
    if (next.length && problem) {
      notify('error', t(`err.${problem}` as 'err.file_too_many'));
      if (photoRef.current) photoRef.current.value = '';
      return;
    }
    setPhotos(next);
  }

  function pickReceipt(list: FileList | null) {
    const f = list?.[0] ?? null;
    if (f) {
      const problem = validateFiles([f]);
      if (problem) {
        notify('error', t(`err.${problem}` as 'err.file_too_large'));
        if (receiptRef.current) receiptRef.current.value = '';
        return;
      }
    }
    setReceipt(f);
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(selected?.account_number ?? '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the number is visible anyway */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !method || !receipt) return;
    setBusy(true);
    try {
      let current = stage;
      if (!current) {
        const id = await submitRequest({ type, description: '', copies, files: photos }, userId);
        current = { id, quoted: false };
        setStage(current);
      }
      if (!current.quoted) {
        await driverQuote(current.id);
        current = { ...current, quoted: true };
        setStage(current);
      }
      const reference = `RCPT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await submitPayment({ orderId: current.id, method, reference, file: receipt });
      notify('success', t('pay.submitted'));
      setStage(null);
      setPhotos([]);
      setReceipt(null);
      setMethod(null);
      setCopies(1);
      if (photoRef.current) photoRef.current.value = '';
      if (receiptRef.current) receiptRef.current.value = '';
      await onDone();
    } catch (err) {
      notify('error', tError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel qorder" onSubmit={(e) => void submit(e)}>
      <fieldset className="qfs" disabled={busy || stage !== null}>
        <section className="qstep">
          <h3>
            <span>1</span>
            {t('form.type')}
          </h3>
          <div className="seg" role="radiogroup" aria-label={t('form.type')}>
            {(['waybill', 't1'] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={type === d} className={type === d ? 'on' : ''} onClick={() => setType(d)}>
                {t(`doc.${d}`)}
              </button>
            ))}
          </div>
          <label className="upload">
            <UploadCloud />
            <b>{photos.length ? `${photos.length} ✓` : t('form.chooseFiles')}</b>
            <small>{t('form.filesHint')}</small>
            <input ref={photoRef} type="file" multiple accept={ACCEPT} onChange={(e) => pickPhotos(e.target.files)} />
          </label>
          {photos.length > 0 && (
            <ul className="filelist">
              {photos.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span className="docname">{f.name}</span>
                  <small className="muted">{formatBytes(f.size)}</small>
                  <button type="button" className="icon-btn" onClick={() => setPhotos((cur) => cur.filter((_, n) => n !== i))} aria-label={t('common.cancel')}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="qstep">
          <h3>
            <span>2</span>
            {t('form.copies')}
          </h3>
          <div className="qty">
            <button type="button" aria-label="−" disabled={copies <= 1} onClick={() => setCopies((c) => Math.max(1, c - 1))}>
              <Minus size={22} aria-hidden />
            </button>
            <output aria-live="polite">{copies}</output>
            <button type="button" aria-label="+" disabled={copies >= 100} onClick={() => setCopies((c) => Math.min(100, c + 1))}>
              <Plus size={22} aria-hidden />
            </button>
          </div>
        </section>
      </fieldset>

      <section className="qstep">
        <h3>
          <span>3</span>
          {t('pay.title')}
        </h3>
        <div className="amount-box">
          <small>{t('pay.amount')}</small>
          <strong>{formatEtb(total)}</strong>
        </div>
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

        {method && (
          <div className="instr">
            {ready ? (
              <>
                <dl>
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
                {selected?.instructions && <p className="instr-text">{selected.instructions}</p>}
              </>
            ) : (
              <p className="notice">{t('pay.notConfigured')}</p>
            )}
          </div>
        )}

        <label className="upload">
          <UploadCloud />
          <b>{receipt ? receipt.name : t('pay.chooseReceipt')}</b>
          <small>{receipt ? formatBytes(receipt.size) : t('pay.receipt')}</small>
          <input ref={receiptRef} type="file" accept={ACCEPT} onChange={(e) => pickReceipt(e.target.files)} />
        </label>
      </section>

      <button className="primary big" disabled={!canSubmit}>
        {busy ? t('pay.submitting') : `${t('pay.submit')} · ${formatEtb(total)}`}
      </button>
    </form>
  );
}
