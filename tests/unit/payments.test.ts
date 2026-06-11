import { describe, it, expect } from 'vitest';
import { validatePaymentAmountMinor } from '@/lib/payments/checkout.schema';

describe('Payment Validation', () => {
  it('rejects amounts below the minimum for PLN', () => {
    const result = validatePaymentAmountMinor(999, 'PLN'); // 9.99 PLN < 10 PLN min
    expect(result).toContain(' zbyt niska');
  });

  it('accepts valid amounts for PLN', () => {
    const result = validatePaymentAmountMinor(1000, 'PLN');
    expect(result).toBeNull();
  });

  it('rejects amounts below the minimum for EUR', () => {
    const result = validatePaymentAmountMinor(999, 'EUR'); // 9.99 EUR < 10 EUR min
    expect(result).toContain(' zbyt niska');
  });

  it('accepts valid amounts for EUR', () => {
    const result = validatePaymentAmountMinor(1000, 'EUR');
    expect(result).toBeNull();
  });
});
