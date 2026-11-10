import { describe, expect, it } from 'vitest';
import { formatEtb, formatPhone, matchesFilter, normalizePhone } from './format';

describe('normalizePhone', () => {
  it.each([
    ['0911223344', '251911223344'],
    ['911223344', '251911223344'],
    ['+251 911 22 33 44', '251911223344'],
    ['251911223344', '251911223344'],
    ['00251911223344', '251911223344'],
    ['0711223344', '251711223344'],
  ])('accepts %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'abc', '091122334', '0511223344', '+1 202 555 0100', '25191122334455'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats stored numbers', () => {
    expect(formatPhone('251911223344')).toBe('+251 911 22 33 44');
  });
  it('handles empty values', () => {
    expect(formatPhone(null)).toBe('');
  });
});

describe('formatEtb', () => {
  it('appends the currency', () => {
    expect(formatEtb(1500)).toBe('1,500 ETB');
  });
});

describe('matchesFilter', () => {
  it('groups paid and printing as work in progress', () => {
    expect(matchesFilter('paid', 'work')).toBe(true);
    expect(matchesFilter('printing', 'work')).toBe(true);
    expect(matchesFilter('ready', 'work')).toBe(false);
  });
  it('all matches everything', () => {
    expect(matchesFilter('cancelled', 'all')).toBe(true);
  });
});
