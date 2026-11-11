import { useCallback, useEffect, useState } from 'react';
import { fetchReportDrivers, fetchReportEvents, fetchReportOrders, fetchReportPayments, fetchReportStaff } from '../lib/reportsApi';
import { rangeStart, type RangeKey, type RptDriver, type RptEvent, type RptOrder, type RptPayment, type RptStaff } from '../lib/reports';

interface Base {
  orders: RptOrder[];
  staff: RptStaff[] | null;
  drivers: RptDriver[] | null;
}
interface Scoped {
  range: RangeKey;
  events: RptEvent[] | null;
  payments: RptPayment[] | null;
}

/**
 * Orders, staff and drivers load once; events and payments reload when the range changes.
 * Optional sources (events, payments, staff, drivers) fail soft: the report simply hides that section.
 */
export function useReportData(range: RangeKey) {
  const [base, setBase] = useState<Base | null>(null);
  const [scoped, setScoped] = useState<Scoped | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    void (async () => {
      const [orders, staff, drivers] = await Promise.allSettled([fetchReportOrders(), fetchReportStaff(), fetchReportDrivers()]);
      if (off) return;
      if (orders.status === 'rejected') {
        setError(orders.reason);
        return;
      }
      setError(null);
      setBase({
        orders: orders.value,
        staff: staff.status === 'fulfilled' ? staff.value : null,
        drivers: drivers.status === 'fulfilled' ? drivers.value : null,
      });
    })();
    return () => {
      off = true;
    };
  }, [tick]);

  useEffect(() => {
    let off = false;
    const from = rangeStart(range);
    void (async () => {
      const [events, payments] = await Promise.allSettled([fetchReportEvents(from), fetchReportPayments(from)]);
      if (off) return;
      setScoped({
        range,
        events: events.status === 'fulfilled' ? events.value : null,
        payments: payments.status === 'fulfilled' ? payments.value : null,
      });
    })();
    return () => {
      off = true;
    };
  }, [range, tick]);

  const reload = useCallback(() => setTick((x) => x + 1), []);
  const ready = base != null && scoped != null && scoped.range === range;
  return { base, scoped, ready, error, reload };
}
