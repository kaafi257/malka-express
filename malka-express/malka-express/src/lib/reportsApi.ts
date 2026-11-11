import { supabase } from './supabase';
import { toAppError } from './errors';
import type { RptDriver, RptEvent, RptOrder, RptPayment, RptStaff } from './reports';

const PAGE = 1000; // Supabase returns at most 1000 rows per request
const MAX_PAGES = 30;

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** Reads every page of a query so totals are never silently cut off at 1000 rows. */
async function allPages<T>(page: (from: number, to: number) => Page): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw toAppError(error);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function fetchReportOrders(): Promise<RptOrder[]> {
  const rows = await allPages<RptOrder>((a, b) =>
    supabase
      .from('orders')
      .select(
        'id, reference, driver_id, document_type, description, status, quoted_price, created_at, ready_at, collected_at, driver:driver_profiles ( full_name, phone )',
      )
      .order('created_at', { ascending: false })
      .order('id')
      .range(a, b),
  );
  return rows.map((o) => ({ ...o, quoted_price: o.quoted_price == null ? null : Number(o.quoted_price) }));
}

export async function fetchReportEvents(since: Date | null): Promise<RptEvent[]> {
  return allPages<RptEvent>((a, b) => {
    let q = supabase.from('order_events').select('id, order_id, actor_id, event, to_status, created_at');
    if (since) q = q.gte('created_at', since.toISOString());
    return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b);
  });
}

export async function fetchReportPayments(since: Date | null): Promise<RptPayment[]> {
  const rows = await allPages<RptPayment>((a, b) => {
    let q = supabase.from('payments').select('amount, method, created_at');
    if (since) q = q.gte('created_at', since.toISOString());
    return q.order('created_at', { ascending: false }).range(a, b);
  });
  return rows.map((p) => ({ ...p, amount: Number(p.amount) }));
}

export async function fetchReportStaff(): Promise<RptStaff[]> {
  return allPages<RptStaff>((a, b) => supabase.from('staff_profiles').select('id, full_name, role, active').order('created_at').range(a, b));
}

export async function fetchReportDrivers(): Promise<RptDriver[]> {
  return allPages<RptDriver>((a, b) =>
    supabase.from('driver_profiles').select('id, full_name, phone, created_at').order('created_at', { ascending: false }).range(a, b),
  );
}
