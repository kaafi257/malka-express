import { Check } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { PROGRESS_STEPS, progressIndex } from '../lib/format';
import type { OrderStatus } from '../lib/types';

/** Simple step bar for drivers: review → payment → paid → printing → ready → collected. */
export function ProgressTracker({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  if (status === 'cancelled') return null;
  const current = progressIndex(status);
  return (
    <ol className="tracker" aria-label="progress">
      {PROGRESS_STEPS.map((step, index) => (
        <li key={step} className={index < current ? 'done' : index === current ? 'current' : ''}>
          <span className="dot">{index < current ? <Check size={12} /> : index + 1}</span>
          <small>{t(`status.${step}`)}</small>
        </li>
      ))}
    </ol>
  );
}
