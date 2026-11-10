import { useCallback, useEffect, useState } from 'react';
import { fetchOrders } from '../lib/api';
import type { Order } from '../lib/types';

const POLL_MS = 30_000;

/** Loads the caller's orders (RLS-filtered) and refreshes every 30 s while the tab is visible. */
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    try {
      setOrders(await fetchOrders());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  return { orders, loading, error, reload };
}
