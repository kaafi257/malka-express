import { useI18n } from '../../lib/i18n';
import type { PaymentState } from '../../lib/types';

export function PaymentStatusBadge({ state }: { state: PaymentState }) {
  const { t } = useI18n();
  if (state === 'none') return null;
  return <span className={`pstate ${state}`}>{t(`pstate.${state}`)}</span>;
}
