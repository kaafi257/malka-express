import type { DriverPayMethod, Order, PaymentMethodConfig, PaymentState } from './types';

export const DRIVER_METHODS: DriverPayMethod[] = ['ebirr', 'cbe_bank', 'telebirr', 'awash_bank', 'cbe_birr'];

/** Derives the driver-facing payment status from the order and its submissions. */
export function paymentState(order: Pick<Order, 'status' | 'payment_status' | 'submissions'>): PaymentState {
  if (order.payment_status === 'paid') return 'verified';
  if (order.status === 'cancelled') return 'none';
  const latest = [...(order.submissions ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (latest?.status === 'pending_verification') return 'pending_verification';
  if (latest?.status === 'rejected' && order.status === 'awaiting_payment') return 'rejected';
  if (order.status === 'awaiting_payment') return 'unpaid';
  return 'none';
}

/** The driver may pay only after the price is set, and not while a submission is waiting for review. */
export function canPay(order: Pick<Order, 'status' | 'payment_status' | 'submissions' | 'quoted_price'>): boolean {
  if (order.status !== 'awaiting_payment' || order.quoted_price == null) return false;
  const state = paymentState(order);
  return state === 'unpaid' || state === 'rejected';
}

export function latestRejection(order: Pick<Order, 'submissions'>): string | null {
  const latest = [...(order.submissions ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return latest?.status === 'rejected' ? latest.rejection_reason : null;
}

/** A method can be used by drivers only when the administrator has filled in the receiving account. */
export function isConfigured(cfg: Pick<PaymentMethodConfig, 'account_number'> | undefined): boolean {
  return !!cfg && cfg.account_number.trim().length > 0;
}
