import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPatronLikeUser } from '@/lib/access/comment-access';

const originalUsdRate = process.env.DISPLAY_USD_TO_PLN_RATE;

afterEach(() => {
  if (originalUsdRate === undefined) {
    delete process.env.DISPLAY_USD_TO_PLN_RATE;
  } else {
    process.env.DISPLAY_USD_TO_PLN_RATE = originalUsdRate;
  }
  vi.resetModules();
});

describe('normalizePaymentTotals display currency rates', () => {
  it('uses DISPLAY_USD_TO_PLN_RATE from env instead of a hardcoded 4.0 USD rate', async () => {
    process.env.DISPLAY_USD_TO_PLN_RATE = '4.75';
    vi.resetModules();

    const { normalizePaymentTotals } = await import('@/lib/services/user-access.service');

    expect(normalizePaymentTotals([{ currency: 'USD', amountMinor: 1000 }])).toBe(47.5);
  });

  it('does not use normalized display totals for Patron-only access decisions', async () => {
    process.env.DISPLAY_USD_TO_PLN_RATE = '9.99';
    vi.resetModules();

    const { normalizePaymentTotals } = await import('@/lib/services/user-access.service');
    const largeDisplayTotal = normalizePaymentTotals([{ currency: 'USD', amountMinor: 100_000 }]);

    expect(largeDisplayTotal).toBe(9990);
    expect(isPatronLikeUser({ isPatron: false, role: 'USER', referralPoints: 999 })).toBe(false);
    expect(isPatronLikeUser({ isPatron: true, role: 'USER', referralPoints: 0 })).toBe(true);
  });
});
