import { describe, it, expect } from 'vitest';
import { checkoutSchema, validatePaymentAmountMinor } from '@/lib/payments/checkout.schema';
import { paymentQualifiesForPatron } from '@/lib/services/payment.service';
import { SUPPORTED_CURRENCIES } from '@/lib/constants';

describe('Payment Validation', () => {
  it('rejects amounts below the minimum for PLN', () => {
    const result = validatePaymentAmountMinor(1000, 'PLN'); // 10 PLN < 20 PLN min
    expect(result).toContain(' zbyt niska');
  });

  it('accepts valid amounts for PLN', () => {
    const result = validatePaymentAmountMinor(2500, 'PLN');
    expect(result).toBeNull();
  });

  it('rejects amounts below the minimum for EUR', () => {
    const result = validatePaymentAmountMinor(200, 'EUR'); // 2 EUR < 5 EUR min
    expect(result).toContain(' zbyt niska');
  });

  it('accepts valid amounts for EUR', () => {
    const result = validatePaymentAmountMinor(1000, 'EUR');
    expect(result).toBeNull();
  });

  it.each(['GBP', 'CHF'] as const)('accepts %s 5 as a patron-qualifying amount', (currency) => {
    expect(validatePaymentAmountMinor(500, currency)).toBeNull();
    expect(paymentQualifiesForPatron(500, currency)).toBe(true);
  });

  it.each(['GBP', 'CHF'] as const)('does not grant patron below 5 %s', (currency) => {
    expect(validatePaymentAmountMinor(499, currency)).toContain(' zbyt niska');
    expect(paymentQualifiesForPatron(499, currency)).toBe(false);
  });

  it('keeps GBP and CHF in the supported checkout currency list', () => {
    expect(SUPPORTED_CURRENCIES).toEqual(['PLN', 'EUR', 'USD', 'GBP', 'CHF']);
  });

  it('rejects unsupported currencies outside the allow-list', () => {
    const result = checkoutSchema.safeParse({ amountMinor: 500, currency: 'JPY', title: 'Unsupported currency' });
    expect(result.success).toBe(false);
  });
});
