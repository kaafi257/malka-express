import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPayments } from '../lib/api';
import { formatEtb } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { formatMinutes, paymentsToCsv, rangeStart, summarize, type RangeKey } from '../lib/reports';
import { useToast } from '../lib/toast';
import type { Order, PaymentRow } from '../lib/types';

const RANGES: RangeKey[] = ['today', '7d', '30d', 'all'];

export function ReportsPage({ orders }: { orders: Order[] }) {
  const { t, tError } = useI18n();
  const { notify } = useToast();
  const [range, setRange] = useState<RangeKey>('7d');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const from = useMemo(() => rangeStart(range), [range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPayments(await fetchPayments(from));
    } catch (e) {
      notify('error', tError(e));
    } finally {
      setLoading(false);
    }
  }, [from, notify, tError]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = useMemo(() => summarize(payments, orders, from), [payments, orders, from]);
  const maxDay = Math.max(1, ...s.byDay.map((d) => d.amount));
  const maxMethod = Math.max(1, ...s.byMethod.map((m) => m.amount));

  function exportCsv() {
    const blob = new Blob([paymentsToCsv(payments)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `malka-express-payments-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="intro">
        <div>
          <p className="eyebrow">{t('staff.eyebrow')}</p>
          <h1>{t('reports.title')}</h1>
          <p className="muted">{t('reports.subtitle')}</p>
        </div>
        <button className="secondary" onClick={() => void load()}>
          <RefreshCw size={15} /> {t('common.refresh')}
        </button>
      </div>

      <div className="chips" role="tablist">
        {RANGES.map((r) => (
          <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'chip on' : 'chip'} onClick={() => setRange(r)}>
            {t(`reports.${r}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted center-text">{t('common.loading')}</p>
      ) : (
        <>
          <div className="stats">
            <div>
              <small>{t('reports.revenue')}</small>
              <strong>{formatEtb(s.revenue)}</strong>
            </div>
            <div>
              <small>{t('reports.payments')}</small>
              <strong>{s.count}</strong>
            </div>
            <div>
              <small>{t('reports.average')}</small>
              <strong>{formatEtb(Math.round(s.average * 100) / 100)}</strong>
            </div>
            <div>
              <small>{t('reports.outstanding')}</small>
              <strong>{formatEtb(s.outstanding)}</strong>
            </div>
            <div>
              <small>{t('reports.avgTime')}</small>
              <strong>{formatMinutes(s.avgMinutesToReady)}</strong>
            </div>
          </div>

          {s.count === 0 ? (
            <div className="empty">{t('reports.noData')}</div>
          ) : (
            <div className="report-grid">
              <section className="panel">
                <h2>{t('reports.byMethod')}</h2>
                <ul className="bars">
                  {s.byMethod.map((m) => (
                    <li key={m.method}>
                      <span>
                        {t(`method.${m.method}`)} <small>×{m.count}</small>
                      </span>
                      <div className="bar" style={{ ['--w' as string]: `${(m.amount / maxMethod) * 100}%` }} />
                      <b>{formatEtb(m.amount)}</b>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>{t('reports.byDay')}</h2>
                  <button className="link" onClick={exportCsv}>
                    <Download size={14} /> {t('reports.export')}
                  </button>
                </div>
                <ul className="bars">
                  {s.byDay.map((d) => (
                    <li key={d.day}>
                      <span>
                        {d.day} <small>×{d.count}</small>
                      </span>
                      <div className="bar" style={{ ['--w' as string]: `${(d.amount / maxDay) * 100}%` }} />
                      <b>{formatEtb(d.amount)}</b>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
