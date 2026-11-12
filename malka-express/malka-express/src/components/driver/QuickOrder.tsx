import { Minus, Plus, UploadCloud, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchDocPrices, submitRequest, validateFiles } from '../../lib/api';
import { formatBytes, formatEtb } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useToast } from '../../lib/toast';
import type { DocumentType } from '../../lib/types';

/** One simple page: choose the document, upload the photo(s), set the copies and send. Staff review and approve. */
export function QuickOrder({ userId, onDone }: { userId: string; onDone: () => Promise<void> | void }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [type, setType] = useState<DocumentType>('waybill');
  const [copies, setCopies] = useState(1);
  const [photos, setPhotos] = useState<File[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocPrices()
      .then(setPrices)
      .catch(() => undefined); // the estimate is optional
  }, []);

  const estimate = (prices[type] ?? 0) * copies;

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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || photos.length === 0) return;
    setBusy(true);
    try {
      await submitRequest({ type, description: '', copies, files: photos }, userId);
      notify('success', t('form.success'));
      setPhotos([]);
      setCopies(1);
      if (photoRef.current) photoRef.current.value = '';
      await onDone();
    } catch (err) {
      notify('error', tError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel qorder" onSubmit={(e) => void submit(e)}>
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
          <input ref={photoRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pickPhotos(e.target.files)} />
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
        {estimate > 0 && (
          <div className="amount-box">
            <small>{t('order.price')}</small>
            <strong>{formatEtb(estimate)}</strong>
          </div>
        )}
      </section>

      <button className="primary big" disabled={busy || photos.length === 0}>
        {busy ? t('form.submitting') : t('form.submit')}
      </button>
    </form>
  );
}
