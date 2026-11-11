import { History } from 'lucide-react';
import { useState } from 'react';
import { fetchOrderEvents } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useI18n, type TranslationKey } from '../lib/i18n';
import type { OrderEvent } from '../lib/types';

/** Staff-only audit trail of an order, loaded on demand. */
export function OrderTimeline({ orderId }: { orderId: string }) {
  const { t, tError, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        setError(null);
        setEvents(await fetchOrderEvents(orderId));
      } catch (e) {
        setError(tError(e));
      }
    }
  }

  const label = (e: OrderEvent) => {
    const key = `event.${e.event}` as TranslationKey;
    const base = t(key);
    if (e.event === 'status_changed' && e.to_status) return `${base}: ${t(`status.${e.to_status}`)}`;
    if ((e.event === 'price_set' || e.event === 'payment_recorded') && e.note) return `${base} (${e.note})`;
    return base;
  };

  return (
    <div className="timeline">
      <button type="button" className="link" onClick={() => void toggle()} aria-expanded={open}>
        <History size={13} aria-hidden /> {open ? t('history.hide') : t('history.show')}
      </button>
      {open && error && <p className="hint">{error}</p>}
      {open && !error && events && (
        <ol>
          {events.length === 0 && <li className="hint">{t('history.empty')}</li>}
          {events.map((e) => (
            <li key={e.id}>
              <span>{label(e)}</span>
              <small>{formatDateTime(e.created_at, locale)}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
