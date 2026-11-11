import type { Order, PaymentMethod, PaymentRow } from './types';

export type RangeKey = 'today' | '7d' | '30d' | 'all';

/** Start of the range in the viewer's local time (null = no lower bound). */
export function rangeStart(range: RangeKey, now: Date = new Date()): Date | null {
  if (range === 'all') return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === '7d') d.setDate(d.getDate() - 6);
  if (range === '30d') d.setDate(d.getDate() - 29);
  return d;
}

/** Local calendar day, e.g. 2026-11-10 (not UTC, so a 23:30 payment stays on its own day). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface ReportSummary {
  revenue: number;
  count: number;
  average: number;
  byMethod: { method: PaymentMethod; amount: number; count: number }[];
  byDay: { day: string; amount: number; count: number }[];
  /** Quoted value of requests still waiting for payment. */
  outstanding: number;
  /** Average minutes from request to ready, for orders made ready in range (null when none). */
  avgMinutesToReady: number | null;
}

export function summarize(payments: PaymentRow[], orders: Order[], from: Date | null): ReportSummary {
  const inRange = payments.filter((p) => !from || new Date(p.created_at) >= from);
  const revenue = inRange.reduce((s, p) => s + Number(p.amount), 0);

  const methods = new Map<PaymentMethod, { amount: number; count: number }>();
  const days = new Map<string, { amount: number; count: number }>();
  for (const p of inRange) {
    const m = methods.get(p.method) ?? { amount: 0, count: 0 };
    m.amount += Number(p.amount);
    m.count += 1;
    methods.set(p.method, m);

    const k = dayKey(p.created_at);
    const d = days.get(k) ?? { amount: 0, count: 0 };
    d.amount += Number(p.amount);
    d.count += 1;
    days.set(k, d);
  }

  const mins = orders
    .filter((o) => o.ready_at && (!from || new Date(o.ready_at) >= from))
    .map((o) => (new Date(o.ready_at as string).getTime() - new Date(o.created_at).getTime()) / 60000)
    .filter((m) => m >= 0);

  return {
    revenue,
    count: inRange.length,
    average: inRange.length ? revenue / inRange.length : 0,
    byMethod: [...methods.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount),
    byDay: [...days.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => (a.day < b.day ? 1 : -1)),
    outstanding: orders
      .filter((o) => o.status === 'awaiting_payment' && o.quoted_price != null)
      .reduce((s, o) => s + Number(o.quoted_price), 0),
    avgMinutesToReady: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null,
  };
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  // Neutralise spreadsheet formula injection from driver/staff-entered text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV (with BOM so Excel opens UTF-8 correctly) of payments, newest first. */
export function paymentsToCsv(payments: PaymentRow[]): string {
  const rows = [
    ['Date', 'Request', 'Document', 'Method', 'Reference', 'Amount (ETB)'],
    ...payments.map((p) => [
      p.created_at,
      p.order?.reference ?? '',
      p.order?.document_type ?? '',
      p.method,
      p.reference ?? '',
      Number(p.amount).toFixed(2),
    ]),
  ];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function formatMinutes(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}
