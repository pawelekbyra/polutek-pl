import { describe, expect, it } from 'vitest';
import { checkoutSchema, TIP_MESSAGE_MAX_LENGTH } from '@/lib/payments/checkout.schema';
import { getTipMethodChoices, getTipPresets } from '@/app/components/support/tip-flow-config';

const base = { amountMinor: 2000, title: 'Napiwek' };

describe('tip checkout schema', () => {
  it('accepts a method that works in the chosen currency', () => {
    expect(checkoutSchema.safeParse({ ...base, currency: 'PLN', paymentMethod: 'blik' }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, currency: 'EUR', paymentMethod: 'p24' }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, currency: 'USD', paymentMethod: 'card' }).success).toBe(true);
  });

  it('rejects BLIK outside PLN and Przelewy24 outside PLN/EUR', () => {
    expect(checkoutSchema.safeParse({ ...base, currency: 'EUR', paymentMethod: 'blik' }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, currency: 'USD', paymentMethod: 'p24' }).success).toBe(false);
  });

  it('rejects an unknown method and an overlong message', () => {
    expect(checkoutSchema.safeParse({ ...base, currency: 'PLN', paymentMethod: 'klarna' }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, currency: 'PLN', message: 'x'.repeat(TIP_MESSAGE_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('tip gate config', () => {
  it('offers local methods first and hides the ones a currency cannot use', () => {
    expect(getTipMethodChoices('PLN', false)).toEqual(['blik', 'p24', 'card']);
    expect(getTipMethodChoices('EUR', true)).toEqual(['card', 'wallet', 'p24']);
    expect(getTipMethodChoices('USD', false)).toEqual(['card']);
  });

  it('keeps presets at or above the minimum', () => {
    expect(getTipPresets('PLN', 5)).toEqual([10, 20, 50, 100]);
    expect(getTipPresets('EUR', 4)).toEqual([5, 10, 25]);
    expect(getTipPresets('EUR', 30).every((value) => value >= 30)).toBe(true);
  });
});
