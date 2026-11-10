import { useI18n } from '../lib/i18n';
import type { OrderStatus } from '../lib/types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return <span className={`status ${status}`}>{t(`status.${status}`)}</span>;
}
