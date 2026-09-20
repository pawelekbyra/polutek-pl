import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/payment-settings/route';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { SUPPORTED_CURRENCIES } from '@/lib/constants';

vi.mock('@/lib/payments/currency-settings', () => ({
  getPaymentCurrencyLimits: vi.fn(),
}));

function buildLimits() {
  return Object.fromEntries(
    SUPPORTED_CURRENCIES.map((currency, index) => [
      currency,
      {
        currency,
        minAmountMinor: 1000 + index,
        minAmount: (1000 + index) / 100,
        maxAmountMinor: 999999,
        maxAmount: 9999.99,
        patronThresholdMinor: 5000 + index,
        patronThreshold: (5000 + index) / 100,
        patronBoxMinMinor: 2000 + index,
        patronBoxMin: (2000 + index) / 100,
      },
    ]),
  );
}

describe('GET /api/payment-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns limits, patronThresholds and patronBoxMinimums for every supported currency', async () => {
    const limits = buildLimits();
    vi.mocked(getPaymentCurrencyLimits).mockResolvedValue(limits as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.limits).toEqual(limits);
    expect(Object.keys(body.patronThresholds)).toEqual([...SUPPORTED_CURRENCIES]);
    expect(Object.keys(body.patronBoxMinimums)).toEqual([...SUPPORTED_CURRENCIES]);
  });

  it('keeps the checkout floor, patron threshold and patron-box minimum as three distinct values per currency', async () => {
    const limits = buildLimits();
    vi.mocked(getPaymentCurrencyLimits).mockResolvedValue(limits as any);

    const res = await GET();
    const body = await res.json();

    const pln = limits.PLN;
    expect(body.limits.PLN.minAmountMinor).toBe(pln.minAmountMinor);
    expect(body.patronThresholds.PLN).toEqual({
      thresholdMinor: pln.patronThresholdMinor,
      threshold: pln.patronThreshold,
    });
    expect(body.patronBoxMinimums.PLN).toEqual({
      minMinor: pln.patronBoxMinMinor,
      min: pln.patronBoxMin,
    });
    // The three minimums must not collapse into the same value for this endpoint's contract.
    expect(pln.minAmountMinor).not.toBe(pln.patronThresholdMinor);
    expect(pln.patronThresholdMinor).not.toBe(pln.patronBoxMinMinor);
  });

  it('returns a 500 if getPaymentCurrencyLimits throws', async () => {
    vi.mocked(getPaymentCurrencyLimits).mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
