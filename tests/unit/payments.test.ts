import { describe, it, expect } from 'vitest';
import { validatePaymentAmountMinor } from '@/lib/payments/checkout.schema';

describe('Payment Validation', () => {
  it('rejects amounts below the minimum for PLN', () => {
    const result = validatePaymentAmountMinor(1000, 'PLN');
    expect(result).toContain(' zbyt niska');
  });

  it('accepts valid amounts for PLN', () => {
    const result = validatePaymentAmountMinor(2500, 'PLN');
    expect(result).toBeNull();
  });
});
