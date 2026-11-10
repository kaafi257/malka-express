import { describe, expect, it } from 'vitest';
import { dayKey, formatMinutes, paymentsToCsv, rangeStart, summarize } from './reports';
import type { Order, PaymentRow } from './types';

const pay = (id: string, amount: number, method: PaymentRow['method'], at: string, ref: string | null = null): PaymentRow => ({
  id, order_id: id, amount, method, reference: ref, created_at: at, order: { reference: `MX-${id}`, document_type: 'waybill' },
});
const order = (o: Partial<Order>): Order =>
  ({ id: 'x', reference: 'MX', driver_id: 'd', document_type: 't1', description: null, status: 'ready', quoted_price: null,
    payment_status: 'unpaid', created_at: '2026-11-10T08:00:00', paid_at: null, ready_at: null, collected_at: null,
    driver: null, documents: [], pin: null, ...o }) as Order;

describe('summarize', () => {
  const payments = [
    pay('1', 100, 'cash', '2026-11-10T09:00:00'),
    pay('2', 250, 'telebirr', '2026-11-10T10:00:00', 'TB1'),
    pay('3', 50, 'cash', '2026-11-08T10:00:00'),
  ];
  it('totals revenue, average and groups by method/day', () => {
    const s = summarize(payments, [], null);
    expect(s.revenue).toBe(400);
    expect(s.count).toBe(3);
    expect(s.average).toBeCloseTo(133.33, 1);
    expect(s.byMethod[0]).toEqual({ method: 'telebirr', amount: 250, count: 1 });
    expect(s.byDay.map((d) => d.day)).toEqual(['2026-11-10', '2026-11-08']);
  });
  it('respects the range start', () => {
    expect(summarize(payments, [], new Date('2026-11-10T00:00:00')).revenue).toBe(350);
  });
  it('sums outstanding and averages time to ready', () => {
    const s = summarize([], [
      order({ status: 'awaiting_payment', quoted_price: 120 }),
      order({ status: 'awaiting_payment', quoted_price: 80 }),
      order({ ready_at: '2026-11-10T08:30:00' }),
      order({ ready_at: '2026-11-10T09:30:00' }),
    ], null);
    expect(s.outstanding).toBe(200);
    expect(s.avgMinutesToReady).toBe(60);
  });
  it('handles empty data', () => {
    const s = summarize([], [], null);
    expect(s.average).toBe(0);
    expect(s.avgMinutesToReady).toBeNull();
  });
});

describe('helpers', () => {
  it('rangeStart', () => {
    const now = new Date(2026, 10, 10, 15, 0);
    expect(rangeStart('all', now)).toBeNull();
    expect(rangeStart('today', now)).toEqual(new Date(2026, 10, 10));
    expect(rangeStart('7d', now)).toEqual(new Date(2026, 10, 4));
    expect(rangeStart('30d', now)).toEqual(new Date(2026, 9, 12));
  });
  it('dayKey uses local calendar day', () => {
    expect(dayKey(new Date(2026, 10, 10, 23, 30).toISOString())).toBe('2026-11-10');
  });
  it('formatMinutes', () => {
    expect(formatMinutes(null)).toBe('—');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(125)).toBe('2 h 5 min');
  });
  it('csv escapes quotes/commas and blocks formula injection', () => {
    const csv = paymentsToCsv([pay('1', 10, 'other', '2026-11-10T09:00:00', '=HYPERLINK("x"), a')]);
    expect(csv.startsWith('﻿Date,')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x""), a"`);
    expect(csv).toContain('10.00');
  });
});
