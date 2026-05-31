import { describe, it, expect } from 'vitest';
import { validatePaymentAmountMinor } from '@/lib/payments/checkout.schema';

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
});
