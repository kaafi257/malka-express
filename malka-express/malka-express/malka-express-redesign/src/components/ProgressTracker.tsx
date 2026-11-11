import { Check } from 'lucide-react';
import type { OrderStatus } from '../lib/types';

export function ProgressTracker({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;

  const isReady = status === 'ready' || status === 'collected';
  const isDone = status === 'collected';

  return (
    <ol className="tracker" aria-label="progress">
      <li className={isReady ? 'done' : 'current'}>
        <span className="dot">{isReady ? <Check size={12} /> : 1}</span>
        <small>1. In Progress</small>
      </li>
      <li className={isDone ? 'done' : isReady ? 'current' : ''}>
        <span className="dot">{isDone ? <Check size={12} /> : 2}</span>
        <small>2. Ready for Pickup</small>
      </li>
    </ol>
  );
}
