import type { OrderStatus } from './types';

/**
 * Normalises an Ethiopian mobile number to the stored form 2519XXXXXXXX / 2517XXXXXXXX.
 * Accepts: 0911223344, 911223344, +251 911 22 33 44, 251911223344, 00251911223344.
 * Returns null when the number is not a valid Ethiopian mobile number.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00251')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '251' + digits.slice(1);
  else if (/^[79]\d{8}$/.test(digits)) digits = '251' + digits;
  return /^251[79]\d{8}$/.test(digits) ? digits : null;
}

/** 251911223344 → +251 911 22 33 44 (falls back to the raw value). */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const m = /^251(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(stored);
  return m ? `+251 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : stored;
}

export function formatEtb(amount: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ETB`;
}

export function formatDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Order of the happy path, used for the driver progress tracker. */
export const PROGRESS_STEPS: OrderStatus[] = ['pending_review', 'awaiting_payment', 'paid', 'printing', 'ready', 'collected'];

export function progressIndex(status: OrderStatus): number {
  return PROGRESS_STEPS.indexOf(status);
}

export type StatusFilter = 'all' | 'new' | 'payment' | 'work' | 'ready' | 'done';

export const FILTER_STATUSES: Record<Exclude<StatusFilter, 'all'>, OrderStatus[]> = {
  new: ['pending_review'],
  payment: ['awaiting_payment'],
  work: ['paid', 'printing'],
  ready: ['ready'],
  done: ['collected', 'cancelled'],
};

export function matchesFilter(status: OrderStatus, filter: StatusFilter): boolean {
  return filter === 'all' || FILTER_STATUSES[filter].includes(status);
}
