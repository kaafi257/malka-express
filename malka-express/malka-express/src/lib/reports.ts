import type { OrderStatus } from './types';

/* -------------------------------------------------------------------------- */
/* Row shapes (only columns the app already reads, so the report keeps working */
/* even if the database has extra columns or small differences).               */
/* -------------------------------------------------------------------------- */
export interface RptOrder {
  id: string;
  reference: string;
  driver_id: string;
  document_type: string;
  description: string | null;
  status: OrderStatus;
  quoted_price: number | null;
  created_at: string;
  ready_at: string | null;
  collected_at: string | null;
  driver: { full_name: string; phone: string } | null;
}
export interface RptEvent {
  id: number;
  order_id: string;
  actor_id: string | null;
  event: string;
  to_status: string | null;
  created_at: string;
}
export interface RptStaff {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
}
export interface RptDriver {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
}
export interface RptPayment {
  amount: number;
  method: string;
  created_at: string;
}

export type RangeKey = 'today' | '7d' | '30d' | 'all';

/* -------------------------------------------------------------------------- */
/* Dates and formatting                                                        */
/* -------------------------------------------------------------------------- */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** First instant of the range in the viewer's local time, or null for "all time". */
export function rangeStart(range: RangeKey, now: Date = new Date()): Date | null {
  if (range === 'all') return null;
  const back = range === 'today' ? 0 : range === '7d' ? 6 : 29;
  const s = startOfDay(now);
  s.setDate(s.getDate() - back);
  return s;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "5 copies (200 ETB)" → 5 */
export function copiesFrom(description: string | null): number | null {
  const m = /(\d+)\s*cop/i.exec(description ?? '');
  return m ? Number(m[1]) : null;
}

export function formatDuration(min: number | null): string {
  if (min == null || !Number.isFinite(min)) return '—';
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.round((min % 1440) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

function average(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** When a collected order was completed (falls back gracefully if a timestamp is missing). */
export function completedAt(o: RptOrder): string {
  return o.collected_at ?? o.ready_at ?? o.created_at;
}

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */
export interface DayBucket {
  key: string;
  date: Date;
  revenue: number;
  collected: number;
  requests: number;
}

export interface Report {
  has: { events: boolean; staff: boolean; drivers: boolean; payments: boolean };
  revenue: number;
  requests: number;
  collected: number;
  cancelled: number;
  cancelRate: number | null;
  openCount: number;
  openValue: number;
  openOver24: RptOrder[];
  days: DayBucket[];
  pipeline: { status: OrderStatus; count: number }[];
  byType: { type: string; count: number; collected: number; revenue: number; copies: number }[];
  speed: { toReady: number | null; readyToCollect: number | null; total: number | null };
  drivers: { id: string; name: string; phone: string; orders: number; revenue: number }[];
  newDrivers: number;
  totalDrivers: number;
  returningDrivers: number;
  staff: { id: string; name: string; role: string | null; active: boolean; ready: number; collected: number; pinFailed: number }[];
  wrongPins: number;
  activity: { id: number; at: string; reference: string; event: string; to: string | null; actor: string }[];
  payments: { method: string; count: number; amount: number }[];
  paymentsTotal: number;
  rows: RptOrder[];
}

const STATUS_ORDER: OrderStatus[] = ['pending_review', 'awaiting_payment', 'paid', 'printing', 'ready', 'collected', 'cancelled'];
export const UNKNOWN_ACTOR = '__unknown__';

export interface BuildInput {
  orders: RptOrder[];
  events: RptEvent[] | null;
  staff: RptStaff[] | null;
  drivers: RptDriver[] | null;
  payments: RptPayment[] | null;
  range: RangeKey;
  now: Date;
}

export function buildReport(input: BuildInput): Report {
  const { orders, events, staff, drivers, payments, range, now } = input;
  const from = rangeStart(range, now);
  const inRange = (iso: string) => from == null || new Date(iso) >= from;

  const created = orders.filter((o) => inRange(o.created_at));
  const collectedOrders = orders.filter((o) => o.status === 'collected' && inRange(completedAt(o)));
  const cancelledOrders = created.filter((o) => o.status === 'cancelled');
  const price = (o: RptOrder) => Number(o.quoted_price ?? 0);

  const revenue = collectedOrders.reduce((sum, o) => sum + price(o), 0);

  const open = orders.filter((o) => o.status !== 'collected' && o.status !== 'cancelled');
  const openOver24 = open
    .filter((o) => now.getTime() - new Date(o.created_at).getTime() > 24 * 3600 * 1000)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  /* ---- revenue by day (max 30 columns) ---- */
  const today = startOfDay(now);
  let first = from ?? today;
  if (range === 'all') {
    const oldest = orders.reduce<Date | null>((acc, o) => {
      const d = new Date(o.created_at);
      return !acc || d < acc ? d : acc;
    }, null);
    const floor = new Date(today);
    floor.setDate(floor.getDate() - 29);
    first = oldest && oldest > floor ? startOfDay(oldest) : floor;
  }
  const days: DayBucket[] = [];
  const byKey = new Map<string, DayBucket>();
  for (const d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) {
    const bucket: DayBucket = { key: dayKey(d), date: new Date(d), revenue: 0, collected: 0, requests: 0 };
    days.push(bucket);
    byKey.set(bucket.key, bucket);
  }
  for (const o of created) {
    const b = byKey.get(dayKey(new Date(o.created_at)));
    if (b) b.requests += 1;
  }
  for (const o of collectedOrders) {
    const b = byKey.get(dayKey(new Date(completedAt(o))));
    if (b) {
      b.revenue += price(o);
      b.collected += 1;
    }
  }

  /* ---- pipeline & document types ---- */
  const pipeline = STATUS_ORDER.map((status) => ({ status, count: created.filter((o) => o.status === status).length }));
  const types = new Map<string, { count: number; collected: number; revenue: number; copies: number }>();
  for (const o of created) {
    const row = types.get(o.document_type) ?? { count: 0, collected: 0, revenue: 0, copies: 0 };
    row.count += 1;
    row.copies += copiesFrom(o.description) ?? 0;
    types.set(o.document_type, row);
  }
  for (const o of collectedOrders) {
    const row = types.get(o.document_type) ?? { count: 0, collected: 0, revenue: 0, copies: 0 };
    row.collected += 1;
    row.revenue += price(o);
    types.set(o.document_type, row);
  }
  const byType = [...types.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.revenue - a.revenue || b.count - a.count);

  /* ---- turnaround ---- */
  const speed = {
    toReady: average(collectedOrders.map((o) => minutesBetween(o.created_at, o.ready_at))),
    readyToCollect: average(collectedOrders.map((o) => minutesBetween(o.ready_at, o.collected_at))),
    total: average(collectedOrders.map((o) => minutesBetween(o.created_at, o.collected_at))),
  };

  /* ---- drivers ---- */
  const perDriver = new Map<string, { id: string; name: string; phone: string; orders: number; revenue: number }>();
  for (const o of created) {
    const row = perDriver.get(o.driver_id) ?? { id: o.driver_id, name: o.driver?.full_name ?? '', phone: o.driver?.phone ?? '', orders: 0, revenue: 0 };
    row.orders += 1;
    perDriver.set(o.driver_id, row);
  }
  for (const o of collectedOrders) {
    const row = perDriver.get(o.driver_id) ?? { id: o.driver_id, name: o.driver?.full_name ?? '', phone: o.driver?.phone ?? '', orders: 0, revenue: 0 };
    row.revenue += price(o);
    perDriver.set(o.driver_id, row);
  }
  const driverRows = [...perDriver.values()].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);

  /* ---- staff activity ---- */
  const staffMap = new Map<string, Report['staff'][number]>();
  for (const s of staff ?? []) {
    staffMap.set(s.id, { id: s.id, name: s.full_name, role: s.role, active: s.active, ready: 0, collected: 0, pinFailed: 0 });
  }
  const evInRange = (events ?? []).filter((e) => inRange(e.created_at));
  for (const e of evInRange) {
    const isReady = e.to_status === 'ready' && e.event !== 'pin_failed' && e.event !== 'pin_regenerated';
    const isCollected = e.event === 'collected' || e.to_status === 'collected';
    const isPinFail = e.event === 'pin_failed';
    if (!isReady && !isCollected && !isPinFail) continue;
    const key = e.actor_id && staffMap.has(e.actor_id) ? e.actor_id : UNKNOWN_ACTOR;
    let row = staffMap.get(key);
    if (!row) {
      row = { id: key, name: '', role: null, active: true, ready: 0, collected: 0, pinFailed: 0 };
      staffMap.set(key, row);
    }
    if (isPinFail) row.pinFailed += 1;
    else if (isCollected) row.collected += 1;
    else row.ready += 1;
  }
  const staffRows = [...staffMap.values()].sort((a, b) => b.ready + b.collected - (a.ready + a.collected));

  /* ---- activity feed ---- */
  const refById = new Map(orders.map((o) => [o.id, o.reference] as const));
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name] as const));
  const driverName = new Map((drivers ?? []).map((d) => [d.id, d.full_name] as const));
  const activity = [...evInRange]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .slice(0, 25)
    .map((e) => ({
      id: e.id,
      at: e.created_at,
      reference: refById.get(e.order_id) ?? '',
      event: e.event,
      to: e.to_status,
      actor: (e.actor_id && (staffName.get(e.actor_id) ?? driverName.get(e.actor_id))) || '',
    }));

  /* ---- payments ---- */
  const payInRange = (payments ?? []).filter((p) => inRange(p.created_at));
  const byMethod = new Map<string, { count: number; amount: number }>();
  for (const p of payInRange) {
    const row = byMethod.get(p.method) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(p.amount);
    byMethod.set(p.method, row);
  }
  const paymentRows = [...byMethod.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount);

  return {
    has: { events: events != null, staff: staff != null, drivers: drivers != null, payments: payments != null },
    revenue,
    requests: created.length,
    collected: collectedOrders.length,
    cancelled: cancelledOrders.length,
    cancelRate: created.length ? cancelledOrders.length / created.length : null,
    openCount: open.length,
    openValue: open.reduce((sum, o) => sum + price(o), 0),
    openOver24,
    days,
    pipeline,
    byType,
    speed,
    drivers: driverRows.slice(0, 8),
    newDrivers: (drivers ?? []).filter((d) => inRange(d.created_at)).length,
    totalDrivers: (drivers ?? []).length,
    returningDrivers: driverRows.filter((d) => d.orders >= 2).length,
    staff: staffRows,
    wrongPins: evInRange.filter((e) => e.event === 'pin_failed').length,
    activity,
    payments: paymentRows,
    paymentsTotal: paymentRows.reduce((s, p) => s + p.amount, 0),
    rows: [...created].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

/* -------------------------------------------------------------------------- */
/* CSV export (Excel-safe: UTF-8 BOM, and cells that start with = + - @ are    */
/* neutralised so a malicious driver name can never run as a formula)          */
/* -------------------------------------------------------------------------- */
function csvCell(value: string | number | null): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ordersToCsv(rows: RptOrder[]): string {
  const head = ['Reference', 'Created', 'Status', 'Document', 'Copies', 'Amount (ETB)', 'Driver', 'Phone', 'Ready at', 'Collected at'];
  const lines = rows.map((o) =>
    [
      o.reference,
      o.created_at,
      o.status,
      o.document_type,
      copiesFrom(o.description),
      o.quoted_price,
      o.driver?.full_name ?? '',
      o.driver?.phone ? `+${o.driver.phone}` : '',
      o.ready_at,
      o.collected_at,
    ]
      .map(csvCell)
      .join(','),
  );
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}
