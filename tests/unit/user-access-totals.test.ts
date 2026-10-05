import { afterEach, describe, expect, it, vi } from 'vitest';

const originalUsdRate = process.env.DISPLAY_USD_TO_PLN_RATE;
const originalChfRate = process.env.DISPLAY_CHF_TO_PLN_RATE;
const originalGbpRate = process.env.DISPLAY_GBP_TO_PLN_RATE;

afterEach(() => {
  if (originalUsdRate === undefined) {
    delete process.env.DISPLAY_USD_TO_PLN_RATE;
  } else {
    process.env.DISPLAY_USD_TO_PLN_RATE = originalUsdRate;
  }
  for (const [name, value] of [['DISPLAY_CHF_TO_PLN_RATE', originalChfRate], ['DISPLAY_GBP_TO_PLN_RATE', originalGbpRate]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
});

describe('normalizePaymentTotals display currency rates', () => {
  it('uses DISPLAY_USD_TO_PLN_RATE from env instead of a hardcoded 4.0 USD rate', async () => {
    process.env.DISPLAY_USD_TO_PLN_RATE = '4.75';
    vi.resetModules();

    const { normalizePaymentTotals } = await import('@/lib/modules/users/domain/payment-totals');

    expect(normalizePaymentTotals([{ currency: 'USD', amountMinor: 1000 }])).toBe(47.5);
  });

  it('does not use normalized display totals for access decisions', async () => {
    process.env.DISPLAY_USD_TO_PLN_RATE = '9.99';
    vi.resetModules();

    const { normalizePaymentTotals } = await import('@/lib/modules/users/domain/payment-totals');
    const largeDisplayTotal = normalizePaymentTotals([{ currency: 'USD', amountMinor: 100_000 }]);

    expect(largeDisplayTotal).toBe(9990);
    // isPatronLikeUser removed as it was part of decommissioned legacy AccessPolicy
  });

  it('counts CHF and GBP with the default display rates (PA-08)', async () => {
    delete process.env.DISPLAY_CHF_TO_PLN_RATE;
    delete process.env.DISPLAY_GBP_TO_PLN_RATE;
    vi.resetModules();
    const { normalizePaymentTotals } = await import('@/lib/modules/users/domain/payment-totals');

    expect(normalizePaymentTotals([{ currency: 'CHF', amountMinor: 1000 }])).toBeCloseTo(45);
    expect(normalizePaymentTotals([{ currency: 'GBP', amountMinor: 1000 }])).toBeCloseTo(49);
    expect(normalizePaymentTotals([{ currency: 'PLN', amountMinor: 500 }, { currency: 'CHF', amountMinor: 1000 }, { currency: 'GBP', amountMinor: 1000 }])).toBeCloseTo(99);
  });

  it('takes the CHF and GBP rates from DISPLAY_*_TO_PLN_RATE and ignores invalid values and unknown currencies', async () => {
    process.env.DISPLAY_CHF_TO_PLN_RATE = '5';
    process.env.DISPLAY_GBP_TO_PLN_RATE = 'abc';
    vi.resetModules();
    const { normalizePaymentTotals } = await import('@/lib/modules/users/domain/payment-totals');

    expect(normalizePaymentTotals([{ currency: 'CHF', amountMinor: 1000 }])).toBe(50);
    expect(normalizePaymentTotals([{ currency: 'GBP', amountMinor: 1000 }])).toBeCloseTo(49);
    expect(normalizePaymentTotals([{ currency: 'JPY', amountMinor: 100000 }])).toBe(0);
  });
});
