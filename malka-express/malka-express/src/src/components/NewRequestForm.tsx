import { ArrowRight, PackagePlus, UploadCloud, X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { submitRequest, validateFiles } from '../lib/api';
import { formatBytes, formatEtb } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { DocumentType } from '../lib/types';

export function NewRequestForm({ userId, onCreated }: { userId: string; onCreated: () => Promise<void> | void }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [type, setType] = useState<DocumentType>('waybill');
  const [quantity, setQuantity] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const minQty = type === 't1' ? 5 : 1;
  const price = type === 't1' ? Math.max(5, quantity) * 40 : Math.max(1, quantity) * 30;

  function handleTypeChange(newType: DocumentType) {
    setType(newType);
    if (newType === 't1' && quantity < 5) {
      setQuantity(5);
    } else if (newType === 'waybill' && quantity < 1) {
      setQuantity(1);
    }
  }

  function pick(list: FileList | null) {
    const next = list ? Array.from(list) : [];
    const problem = validateFiles(next);
    if (next.length && problem) {
      notify('error', t(`err.${problem}` as 'err.file_too_many'));
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFiles(next);
  }

  function removeAt(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
    if (inputRef.current) inputRef.current.value = '';
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitRequest(
        { 
          type, 
          description: description.trim(), 
          quantity: Math.max(minQty, quantity), 
          files 
        }, 
        userId
      );
      notify('success', t('form.success'));
      setDescription('');
      setFiles([]);
      setQuantity(type === 't1' ? 5 : 1);
      if (inputRef.current) inputRef.current.value = '';
      await onCreated();
    } catch (err) {
      notify('error', tError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>
        <PackagePlus size={18} /> {t('form.title')}
      </h2>
      <p className="muted">{t('form.subtitle')}</p>
      <form className="grid" onSubmit={(e) => void submit(e)}>
        <label>
          {t('form.type')}
          <select value={type} onChange={(e) => handleTypeChange(e.target.value as DocumentType)}>
            <option value="waybill">{t('doc.waybill')} (30 ETB / copy)</option>
            <option value="t1">{t('doc.t1')} (200 ETB / 5 copies)</option>
          </select>
        </label>

        <label>
          Copies / Quantity {type === 't1' ? '(Min 5 copies)' : '(Min 1 copy)'}
          <input
            type="number"
            min={minQty}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(minQty, Number(e.target.value) || minQty))}
            required
          />
        </label>

        <label className="full">
          <span>
            {t('form.reference')} <span className="muted">({t('common.optional')})</span>
          </span>
          <input
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('form.referenceHint')}
          />
        </label>

        <label className="upload full">
          <UploadCloud />
          <b>{files.length ? `${files.length} ✓` : t('form.chooseFiles')}</b>
          <small>{t('form.filesHint')}</small>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => pick(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <ul className="filelist full">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="docname">{f.name}</span>
                <small className="muted">{formatBytes(f.size)}</small>
                <button type="button" className="icon-btn" onClick={() => removeAt(i)} aria-label={t('common.cancel')}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Live calculated price */}
        <div className="quote full">
          <div>
            <span>Total price</span>
            <strong>{formatEtb(price)}</strong>
          </div>
          <small>{type === 't1' ? '200 ETB for 5 copies, 40 ETB per extra' : `${quantity} × 30 ETB`}</small>
        </div>

        <button className="primary full" disabled={busy || files.length === 0}>
          {busy ? t('form.submitting') : t('form.submit')} <ArrowRight size={16} />
        </button>
      </form>
    </section>
  );
}
