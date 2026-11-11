import { Check } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { OrderStatus } from '../lib/types';

const STEPS: { label: string; at: OrderStatus[] }[] = [
  { label: 'Review', at: ['pending_review'] },
  { label: 'Payment', at: ['awaiting_payment'] },
  { label: 'Printing', at: ['paid', 'printing'] },
  { label: 'Ready', at: ['ready'] },
];

/** Shows the real stage of the request, one step per status. */
export function ProgressTracker({ status }: { status: OrderStatus }) {
  useI18n();
  if (status === 'cancelled') return null;
  const current = status === 'collected' ? STEPS.length : STEPS.findIndex((s) => s.at.includes(status));

  return (
    <ol className="tracker" aria-label="progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        return (
          <li key={s.label} className={done ? 'done' : i === current ? 'current' : ''}>
            <span className="dot">{done ? <Check size={12} /> : i + 1}</span>
            <small>{s.label}</small>
          </li>
        );
      })}
    </ol>
  );
}
