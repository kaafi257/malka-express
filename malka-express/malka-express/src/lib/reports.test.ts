import { describe, expect, it } from 'vitest';
import {
  buildReport,
  copiesFrom,
  formatDuration,
  ordersToCsv,
  rangeStart,
  type RptEvent,
  type RptOrder,
  type RptStaff,
} from './reports';

// All dates are built in local time so the tests pass in any time zone.
const local = (day: number, h = 10, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const NOW = new Date(2026, 10, 11, 18, 0);

function order(id: string, o: Partial<RptOrder>): RptOrder {
  return {
    id,
    reference: `MX-${id}`,
    driver_id: 'd1',
    document_type: 'waybill',
    description: '1 copies (30 ETB)',
    status: 'collected',
    quoted_price: 30,
    created_at: local(11, 8),
    ready_at: local(11, 8, 20),
    collected_at: local(11, 9),
    driver: { full_name: 'Ali', phone: '251911223344' },
    ...o,
  };
}

const staff: RptStaff[] = [
  { id: 's1', full_name: 'Hana', role: 'employee', active: true },
  { id: 's2', full_name: 'Owner', role: 'owner', active: true },
];

describe('rangeStart', () => {
  it('starts at local midnight', () => {
    const s = rangeStart('7d', NOW)!;
    expect([s.getMonth(), s.getDate(), s.getHours()]).toEqual([10, 5, 0]);
  });
  it('is null for all time', () => {
    expect(rangeStart('all', NOW)).toBeNull();
  });
});

describe('copiesFrom / formatDuration', () => {
  it('reads the copies count', () => {
    expect(copiesFrom('5 copies (200 ETB)')).toBe(5);
    expect(copiesFrom('No description')).toBeNull();
    expect(copiesFrom(null)).toBeNull();
  });
  it('formats durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(0.2)).toBe('<1 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(200)).toBe('3 h 20 min');
    expect(formatDuration(1500)).toBe('1 d 1 h');
  });
});

describe('buildReport', () => {
  const orders = [
    order('1', { quoted_price: 200, document_type: 't1', description: '5 copies (200 ETB)' }),
    order('2', { quoted_price: 30 }),
    order('3', { status: 'cancelled', quoted_price: 100, collected_at: null, ready_at: null }),
    order('4', { status: 'ready', quoted_price: 60, collected_at: null, created_at: local(9, 8), driver_id: 'd2', driver: { full_name: 'Bilal', phone: '251922334455' } }),
    order('5', { quoted_price: 90, created_at: local(1, 8), ready_at: local(1, 9), collected_at: local(1, 10) }), // older than 7 days
  ];
  const events: RptEvent[] = [
    { id: 1, order_id: '1', actor_id: 's1', event: 'status_changed', to_status: 'ready', created_at: local(11, 8, 20) },
    { id: 2, order_id: '1', actor_id: 's1', event: 'collected', to_status: 'collected', created_at: local(11, 9) },
    { id: 3, order_id: '2', actor_id: 's2', event: 'pin_failed', to_status: 'ready', created_at: local(11, 9, 5) },
    { id: 4, order_id: '2', actor_id: 'gone', event: 'collected', to_status: 'collected', created_at: local(11, 9, 6) },
    { id: 5, order_id: '1', actor_id: 'd1', event: 'created', to_status: 'pending_review', created_at: local(11, 8) },
  ];

  const r = buildReport({ orders, events, staff, drivers: [], payments: [], range: '7d', now: NOW });

  it('counts revenue only from collected orders inside the range', () => {
    expect(r.revenue).toBe(230); // 200 + 30, not the cancelled one, the ready one or the old one
    expect(r.collected).toBe(2);
  });

  it('counts requests created in range and the cancel rate', () => {
    expect(r.requests).toBe(4);
    expect(r.cancelled).toBe(1);
    expect(r.cancelRate).toBeCloseTo(0.25);
  });

  it('all time includes older orders', () => {
    const all = buildReport({ orders, events, staff, drivers: [], payments: [], range: 'all', now: NOW });
    expect(all.revenue).toBe(320);
    expect(all.requests).toBe(5);
  });

  it('tracks open orders and flags those older than 24 hours', () => {
    expect(r.openCount).toBe(1);
    expect(r.openValue).toBe(60);
    expect(r.openOver24.map((o) => o.reference)).toEqual(['MX-4']);
  });

  it('builds one bucket per day with revenue on the right day', () => {
    expect(r.days).toHaveLength(7);
    expect(r.days.at(-1)!.revenue).toBe(230);
    expect(r.days.at(-1)!.requests).toBe(3);
  });

  it('splits by document type', () => {
    const t1 = r.byType.find((t) => t.type === 't1')!;
    expect(t1).toMatchObject({ count: 1, revenue: 200, copies: 5 });
    expect(r.byType[0].type).toBe('t1');
  });

  it('measures turnaround', () => {
    expect(r.speed.toReady).toBe(20);
    expect(r.speed.readyToCollect).toBe(40);
    expect(r.speed.total).toBe(60);
  });

  it('ranks drivers by revenue', () => {
    expect(r.drivers[0]).toMatchObject({ id: 'd1', revenue: 230, orders: 3 });
  });

  it('attributes staff actions, ignoring driver events', () => {
    const hana = r.staff.find((s) => s.id === 's1')!;
    expect(hana).toMatchObject({ ready: 1, collected: 1 });
    expect(r.staff.find((s) => s.id === 's2')!.pinFailed).toBe(1);
    expect(r.staff.find((s) => s.id === '__unknown__')!.collected).toBe(1);
    expect(r.wrongPins).toBe(1);
  });

  it('flags missing data instead of failing', () => {
    const partial = buildReport({ orders, events: null, staff: null, drivers: null, payments: null, range: '7d', now: NOW });
    expect(partial.has).toEqual({ events: false, staff: false, drivers: false, payments: false });
    expect(partial.revenue).toBe(230);
  });

  it('summarises payments by method', () => {
    const p = buildReport({
      orders,
      events,
      staff,
      drivers: [],
      range: '7d',
      now: NOW,
      payments: [
        { amount: 30, method: 'cash', created_at: local(11, 9) },
        { amount: 200, method: 'telebirr', created_at: local(11, 9) },
        { amount: 999, method: 'cash', created_at: local(1, 9) },
      ],
    });
    expect(p.paymentsTotal).toBe(230);
    expect(p.payments[0]).toMatchObject({ method: 'telebirr', amount: 200 });
  });
});

describe('ordersToCsv', () => {
  it('adds a BOM, quotes commas and neutralises formulas', () => {
    const csv = ordersToCsv([order('9', { driver: { full_name: '=HYPERLINK("x")', phone: '251911223344' }, description: 'a, b' })]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
