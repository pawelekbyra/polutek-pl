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
      },
    ]),
  );
}

describe('GET /api/payment-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only { limits }: one minimum per currency, the one the server enforces', async () => {
    const limits = buildLimits();
    vi.mocked(getPaymentCurrencyLimits).mockResolvedValue(limits as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ limits });
    expect(Object.keys(body.limits)).toEqual([...SUPPORTED_CURRENCIES]);
  });

  it('returns a 500 if getPaymentCurrencyLimits throws', async () => {
    vi.mocked(getPaymentCurrencyLimits).mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
