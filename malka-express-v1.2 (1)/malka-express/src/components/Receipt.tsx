import { createPortal } from 'react-dom';
import { formatDateTime, formatEtb } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Order, PaymentRow } from '../lib/types';

/** Print-only receipt. Rendered into <body>; print CSS hides the rest of the app. */
export function Receipt({ order, payment }: { order: Order; payment: PaymentRow }) {
  const { t, locale } = useI18n();
  return createPortal(
    <div className="receipt-print">
      <h1>{t('app.name')}</h1>
      <p>{t('app.port')}</p>
      <h2>{t('receipt.title')}</h2>
      <dl>
        <dt>{t('order.ref')}</dt>
        <dd>{order.reference}</dd>
        <dt>{t('form.type')}</dt>
        <dd>{t(`doc.${order.document_type}`)}</dd>
        {order.driver && (
          <>
            <dt>{t('order.driver')}</dt>
            <dd>{order.driver.full_name}</dd>
          </>
        )}
        <dt>{t('receipt.date')}</dt>
        <dd>{formatDateTime(payment.created_at, locale)}</dd>
        <dt>{t('receipt.paidVia')}</dt>
        <dd>
          {t(`method.${payment.method}`)}
          {payment.reference ? ` · ${payment.reference}` : ''}
        </dd>
        <dt>{t('receipt.amount')}</dt>
        <dd className="total">{formatEtb(payment.amount)}</dd>
      </dl>
      <p className="thanks">{t('receipt.thanks')}</p>
    </div>,
    document.body,
  );
}
