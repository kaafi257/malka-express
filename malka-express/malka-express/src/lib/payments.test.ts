import { describe, expect, it } from 'vitest';
import { canPay, isConfigured, latestRejection, paymentState } from './payments';
import type { OrderSubmission } from './types';

const sub = (status: OrderSubmission['status'], at: string, reason: string | null = null): OrderSubmission => ({
  id: at, method: 'telebirr', reference: 'R' + at, status, rejection_reason: reason, created_at: at, verified_at: null,
});
const o = (status: string, paid: 'paid' | 'unpaid', submissions: OrderSubmission[] = [], price: number | null = 100) =>
  ({ status, payment_status: paid, submissions, quoted_price: price }) as never;

describe('paymentState', () => {
  it('unpaid when awaiting payment with no submission', () => expect(paymentState(o('awaiting_payment', 'unpaid'))).toBe('unpaid'));
  it('pending when the latest submission is pending', () =>
    expect(paymentState(o('awaiting_payment', 'unpaid', [sub('pending_verification', '2')]))).toBe('pending_verification'));
  it('rejected when the latest is rejected', () =>
    expect(paymentState(o('awaiting_payment', 'unpaid', [sub('rejected', '1', 'bad')]))).toBe('rejected'));
  it('uses the newest submission', () =>
    expect(paymentState(o('awaiting_payment', 'unpaid', [sub('pending_verification', '2'), sub('rejected', '1', 'x')]))).toBe('pending_verification'));
  it('verified once the order is paid', () => expect(paymentState(o('printing', 'paid', [sub('verified', '1')]))).toBe('verified'));
  it('none for a request still in review or cancelled', () => {
    expect(paymentState(o('pending_review', 'unpaid'))).toBe('none');
    expect(paymentState(o('cancelled', 'unpaid'))).toBe('none');
  });
});

describe('canPay / helpers', () => {
  it('only when priced, awaiting payment and nothing pending', () => {
    expect(canPay(o('awaiting_payment', 'unpaid'))).toBe(true);
    expect(canPay(o('awaiting_payment', 'unpaid', [sub('rejected', '1', 'x')]))).toBe(true);
    expect(canPay(o('awaiting_payment', 'unpaid', [sub('pending_verification', '1')]))).toBe(false);
    expect(canPay(o('awaiting_payment', 'unpaid', [], null))).toBe(false);
    expect(canPay(o('paid', 'paid'))).toBe(false);
  });
  it('latestRejection returns the reason only when the newest is rejected', () => {
    expect(latestRejection({ submissions: [sub('rejected', '1', 'Wrong amount')] })).toBe('Wrong amount');
    expect(latestRejection({ submissions: [sub('rejected', '1', 'x'), sub('pending_verification', '2')] })).toBeNull();
  });
  it('isConfigured needs an account number', () => {
    expect(isConfigured(undefined)).toBe(false);
    expect(isConfigured({ account_number: '  ' })).toBe(false);
    expect(isConfigured({ account_number: '0911' })).toBe(true);
  });
});
