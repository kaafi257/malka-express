import { Download, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useReportData } from '../hooks/useReportData';
import { formatDateTime, formatEtb, formatPhone } from '../lib/format';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { buildReport, copiesFrom, formatDuration, ordersToCsv, UNKNOWN_ACTOR, type RangeKey } from '../lib/reports';
import { isEventKey, useRt, type ReportKey } from '../lib/reports-i18n';

const RANGES: RangeKey[] = ['today', '7d', '30d', 'all'];
const PAGE = 20;

function Bar({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <div className="hbar">
      <div className="hbar-top">
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
      <div className="hbar-track">
        <i style={{ width: `${max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { t, tError, locale } = useI18n();
  const rt = useRt();
  const [range, setRange] = useState<RangeKey>('7d');
  const [shown, setShown] = useState(PAGE);
  const { base, scoped, ready, error, reload } = useReportData(range);

  const report = useMemo(
    () =>
      base && scoped
        ? buildReport({ orders: base.orders, events: scoped.events, staff: base.staff, drivers: base.drivers, payments: scoped.payments, range, now: new Date() })
        : null,
    [base, scoped, range],
  );

  const docLabel = (type: string) => (`doc.${type}` in { 'doc.waybill': 1, 'doc.t1': 1 } ? t(`doc.${type}` as TranslationKey) : type);
  const money = (n: number) => formatEtb(n);

  const exportCsv = () => {
    if (!report) return;
    const blob = new Blob([ordersToCsv(report.rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `malka-express-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const header = (
    <div className="intro">
      <div>
        <h1>{rt('title')}</h1>
        <p className="muted">{rt('subtitle')}</p>
      </div>
      <button className="secondary" onClick={reload}>
        <RefreshCw size={15} /> {t('common.refresh')}
      </button>
    </div>
  );

  if (error) {
    return (
      <>
        {header}
        <p className="notice error" role="alert">
          {tError(error)}
        </p>
      </>
    );
  }

  const chips = (
    <div className="chips" role="tablist">
      {RANGES.map((r) => (
        <button key={r} role="tab" aria-selected={range === r} className={`chip${range === r ? ' on' : ''}`} onClick={() => { setRange(r); setShown(PAGE); }}>
          {rt(`range.${r}` as ReportKey)}
        </button>
      ))}
    </div>
  );

  if (!report || !ready) {
    return (
      <>
        {header}
        {chips}
        <p className="muted">{t('common.loading')}</p>
      </>
    );
  }

  const maxDay = Math.max(1, ...report.days.map((d) => d.revenue));
  const maxPipe = Math.max(1, ...report.pipeline.map((p) => p.count));
  const maxType = Math.max(1, ...report.byType.map((p) => p.revenue));
  const maxPay = Math.max(1, ...report.payments.map((p) => p.amount));
  const unavailable = <p className="muted small">{rt('common.unavailable')}</p>;
  const empty = <p className="muted small">{rt('common.noData')}</p>;
  const actorName = (id: string, name: string) => (id === UNKNOWN_ACTOR ? rt('common.unknown') : name);
  const dayFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const hasAlerts = report.openOver24.length > 0 || report.wrongPins > 0;

  return (
    <>
      {header}
      {chips}

      <div className="stats">
        <div className="go">
          <strong>{money(report.revenue)}</strong>
          <small>{rt('kpi.revenue')}</small>
        </div>
        <div>
          <strong>{report.requests}</strong>
          <small>{rt('kpi.requests')}</small>
        </div>
        <div>
          <strong>{report.collected}</strong>
          <small>{rt('kpi.collected')}</small>
        </div>
        <div>
          <strong>{report.cancelled}</strong>
          <small>{rt('kpi.cancelled')}</small>
        </div>
        <div className={report.openCount > 0 ? 'hot' : ''}>
          <strong>{money(report.openValue)}</strong>
          <small>{rt('kpi.open')} ({report.openCount})</small>
        </div>
      </div>

      <section className="panel">
        <h2>{rt('sec.attention')}</h2>
        {!hasAlerts ? (
          <p className="muted">{rt('alert.clear')}</p>
        ) : (
          <ul className="rows">
            {report.openOver24.length > 0 && (
              <li className="row-alert">
                <span>
                  {rt('alert.over24')}: <strong>{report.openOver24.length}</strong>
                </span>
                <small>{report.openOver24.slice(0, 5).map((o) => o.reference).join(', ')}</small>
              </li>
            )}
            {report.wrongPins > 0 && (
              <li className="row-alert">
                <span>
                  {rt('alert.wrongPins')}: <strong>{report.wrongPins}</strong>
                </span>
              </li>
            )}
          </ul>
        )}
        {report.cancelRate != null && report.requests > 0 && (
          <p className="muted small">
            {rt('alert.cancelRate')}: {Math.round(report.cancelRate * 100)}%
          </p>
        )}
      </section>

      <section className="panel">
        <h2>{rt('sec.byDay')}</h2>
        <div className="bars" role="img" aria-label={rt('sec.byDay')}>
          {report.days.map((d) => (
            <div key={d.key} className="bar-col" title={`${dayFmt.format(d.date)} — ${money(d.revenue)}`}>
              <span className="bar-val">{d.revenue > 0 ? Math.round(d.revenue) : ''}</span>
              <i style={{ height: `${d.revenue > 0 ? Math.max(4, (d.revenue / maxDay) * 100) : 2}%` }} />
              <small>{report.days.length <= 8 ? dayFmt.format(d.date) : d.date.getDate()}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="rpt-grid">
        <section className="panel">
          <h2>{rt('sec.pipeline')}</h2>
          {report.pipeline.every((p) => p.count === 0) ? empty : report.pipeline.map((p) => (
            <Bar key={p.status} label={t(`status.${p.status}`)} value={p.count} max={maxPipe} text={String(p.count)} />
          ))}
        </section>

        <section className="panel">
          <h2>{rt('sec.byType')}</h2>
          {report.byType.length === 0 ? empty : report.byType.map((p) => (
            <Bar key={p.type} label={`${docLabel(p.type)} · ${p.count} ${rt('common.requests')}${p.copies ? ` · ${p.copies} ${rt('orders.copies').toLowerCase()}` : ''}`} value={p.revenue} max={maxType} text={money(p.revenue)} />
          ))}
        </section>

        <section className="panel">
          <h2>{rt('sec.speed')}</h2>
          <dl className="kv">
            <dt>{rt('speed.toReady')}</dt>
            <dd>{formatDuration(report.speed.toReady)}</dd>
            <dt>{rt('speed.readyToCollect')}</dt>
            <dd>{formatDuration(report.speed.readyToCollect)}</dd>
            <dt>{rt('speed.total')}</dt>
            <dd>{formatDuration(report.speed.total)}</dd>
          </dl>
        </section>

        <section className="panel">
          <h2>{rt('sec.drivers')}</h2>
          {!report.has.drivers ? unavailable : (
            <dl className="kv">
              <dt>{rt('drivers.total')}</dt>
              <dd>{report.totalDrivers}</dd>
              <dt>{rt('drivers.new')}</dt>
              <dd>{report.newDrivers}</dd>
              <dt>{rt('drivers.returning')}</dt>
              <dd>{report.returningDrivers}</dd>
            </dl>
          )}
          <h3>{rt('drivers.top')}</h3>
          {report.drivers.length === 0 ? empty : (
            <ul className="rows">
              {report.drivers.map((d) => (
                <li key={d.id}>
                  <span>
                    {d.name}
                    <small>{formatPhone(d.phone)} · {d.orders} {rt('common.requests')}</small>
                  </span>
                  <strong>{money(d.revenue)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>{rt('sec.staff')}</h2>
          {!report.has.events ? unavailable : report.staff.length === 0 ? empty : (
            <ul className="rows">
              {report.staff.map((s) => (
                <li key={s.id}>
                  <span>
                    {actorName(s.id, s.name)}
                    {!s.active && s.id !== UNKNOWN_ACTOR && <small> ({rt('common.inactive')})</small>}
                    <small>
                      {rt('staff.ready')}: {s.ready} · {rt('staff.collected')}: {s.collected}
                      {s.pinFailed > 0 ? ` · ${rt('staff.pinFailed')}: ${s.pinFailed}` : ''}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>{rt('sec.payments')}</h2>
          {!report.has.payments ? unavailable : report.payments.length === 0 ? empty : (
            <>
              {report.payments.map((p) => (
                <Bar key={p.method} label={`${p.method} · ${p.count}`} value={p.amount} max={maxPay} text={money(p.amount)} />
              ))}
              <p className="muted small">{money(report.paymentsTotal)}</p>
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>{rt('sec.activity')}</h2>
        {!report.has.events ? unavailable : report.activity.length === 0 ? empty : (
          <ul className="rows">
            {report.activity.map((a) => (
              <li key={a.id}>
                <span>
                  {isEventKey(a.event) ? rt(`event.${a.event}` as ReportKey) : a.event}
                  {a.to ? ` → ${a.to in { pending_review: 1, awaiting_payment: 1, paid: 1, printing: 1, ready: 1, collected: 1, cancelled: 1 } ? t(`status.${a.to}` as TranslationKey) : a.to}` : ''}
                  <small>{a.reference} · {a.actor === UNKNOWN_ACTOR ? rt('common.unknown') : a.actor}</small>
                </span>
                <small className="when">{formatDateTime(a.at, locale)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>{rt('sec.orders')}</h2>
          <button className="secondary" onClick={exportCsv} disabled={report.rows.length === 0}>
            <Download size={15} /> {rt('action.export')}
          </button>
        </div>
        {report.rows.length === 0 ? empty : (
          <>
            <div className="tablewrap">
              <table className="rtable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{rt('orders.date')}</th>
                    <th>{rt('orders.driver')}</th>
                    <th>{rt('orders.type')}</th>
                    <th>{rt('orders.copies')}</th>
                    <th>{rt('orders.amount')}</th>
                    <th>{rt('orders.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.slice(0, shown).map((o) => (
                    <tr key={o.id}>
                      <td>{o.reference}</td>
                      <td className="when">{formatDateTime(o.created_at, locale)}</td>
                      <td>{o.driver?.full_name ?? '—'}</td>
                      <td>{docLabel(o.document_type)}</td>
                      <td>{copiesFrom(o.description) ?? '—'}</td>
                      <td>{o.quoted_price != null ? money(o.quoted_price) : '—'}</td>
                      <td><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < report.rows.length && (
              <button className="secondary" onClick={() => setShown((n) => n + PAGE)}>
                {rt('action.more')} ({report.rows.length - shown})
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
