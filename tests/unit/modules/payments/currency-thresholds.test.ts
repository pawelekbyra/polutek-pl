import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPaymentCurrencyLimits } from '@/lib/payments/currency-settings';
import { PaymentPolicy } from '@/lib/modules/payments/domain/payment.policy';
import { PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentCurrencySetting: {
      findMany: vi.fn(),
    },
  },
}));

describe('Currency Threshold Defaults and Eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides default min amount of 10 for launch currencies', async () => {
    vi.mocked(prisma.paymentCurrencySetting.findMany).mockResolvedValue([]);
    const limits = await getPaymentCurrencyLimits();

    expect(limits.PLN.minAmount).toBe(10);
    expect(limits.EUR.minAmount).toBe(10);
    expect(limits.USD.minAmount).toBe(10);
    expect(limits.CHF.minAmount).toBe(10);
  });

  it('preserves GBP at 5 as per instructions', async () => {
    vi.mocked(prisma.paymentCurrencySetting.findMany).mockResolvedValue([]);
    const limits = await getPaymentCurrencyLimits();

    expect(limits.GBP.minAmount).toBe(5);
  });

  it('handles 9.99 (fail) and 10.00 (pass) for launch currencies', async () => {
    const currencies = ['PLN', 'EUR', 'USD', 'CHF'] as const;

    for (const currency of currencies) {
      const failEligibility = PaymentPolicy.evaluatePaymentPatronEligibility({
        status: PaymentStatus.SUCCEEDED,
        amountMinor: 999,
        currency,
        thresholdMinor: 1000,
      });
      expect(failEligibility.eligible).toBe(false);
      expect(failEligibility.code).toBe('BELOW_THRESHOLD');

      const passEligibility = PaymentPolicy.evaluatePaymentPatronEligibility({
        status: PaymentStatus.SUCCEEDED,
        amountMinor: 1000,
        currency,
        thresholdMinor: 1000,
      });
      expect(passEligibility.eligible).toBe(true);
      expect(passEligibility.code).toBe('ELIGIBLE');
    }
  });

  it('verifies admin DB override still works', async () => {
    vi.mocked(prisma.paymentCurrencySetting.findMany).mockResolvedValue([
      { currency: 'PLN', minAmountMinor: 5000 } as any, // 50 PLN
    ]);

    const limits = await getPaymentCurrencyLimits();
    expect(limits.PLN.minAmount).toBe(50);
    expect(limits.PLN.minAmountMinor).toBe(5000);

    // Other defaults should remain 10
    expect(limits.EUR.minAmount).toBe(10);
  });
});
