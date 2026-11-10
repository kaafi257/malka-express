import { FileText, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { getDocumentUrl } from '../lib/api';
import { formatBytes } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { OrderDocument } from '../lib/types';

export function DocumentList({ documents }: { documents: OrderDocument[] }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(doc: OrderDocument) {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed link.
    const tab = window.open('', '_blank');
    setOpening(doc.id);
    try {
      const url = await getDocumentUrl(doc.storage_path);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      notify('error', tError(e));
    } finally {
      setOpening(null);
    }
  }

  if (documents.length === 0) return null;
  return (
    <div className="docs">
      <small className="label">{t('order.documents')}</small>
      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>
            <FileText size={15} aria-hidden />
            <span className="docname">{doc.file_name}</span>
            <small className="muted">{formatBytes(doc.file_size)}</small>
            <button className="link" disabled={opening === doc.id} onClick={() => void open(doc)}>
              {t('order.openDocument')} <ExternalLink size={13} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
