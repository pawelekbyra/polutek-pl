import { describe, expect, it } from 'vitest';
import { createTx } from '@/lib/i18n/ui';
import { TIP_CRYPTO_PLACEHOLDER, TIP_FALLBACK_METHOD, describeTipMethod, getTipMethodTiles } from '@/app/components/support/tip-flow-config';

describe('tip gate method tiles (list comes from Stripe)', () => {
  it('shows exactly what Stripe allows, local methods first, Link hidden', () => {
    expect(getTipMethodTiles(['card', 'link', 'p24', 'blik'])).toEqual(['blik', 'p24', 'card', TIP_CRYPTO_PLACEHOLDER]);
    expect(getTipMethodTiles(['card', 'paypal'])).toEqual(['card', 'paypal', TIP_CRYPTO_PLACEHOLDER]);
  });

  it('keeps a method Stripe adds later, with a generic tile at the end', () => {
    expect(getTipMethodTiles(['card', 'some_new_method'])).toEqual(['card', 'some_new_method', TIP_CRYPTO_PLACEHOLDER]);
    expect(describeTipMethod('some_new_method', createTx('pl')).title).toBe('Some New Method');
  });

  it('adds Apple Pay / Google Pay as ordinary tiles only when the device has them and cards are allowed', () => {
    expect(getTipMethodTiles(['card', 'p24', 'blik'], ['google_pay'])).toEqual(['blik', 'google_pay', 'p24', 'card', TIP_CRYPTO_PLACEHOLDER]);
    expect(getTipMethodTiles(['blik'], ['apple_pay'])).toEqual(['blik', TIP_CRYPTO_PLACEHOLDER]);
  });

  it("never lets the Crypto placeholder shadow Stripe's real crypto method", () => {
    expect(getTipMethodTiles(['card', 'crypto'])).toEqual(['card', 'crypto', TIP_CRYPTO_PLACEHOLDER]);
    expect(TIP_CRYPTO_PLACEHOLDER).not.toBe('crypto');
  });

  it('falls back to Stripe\'s full form when no list came back', () => {
    expect(getTipMethodTiles([])).toEqual([TIP_FALLBACK_METHOD, TIP_CRYPTO_PLACEHOLDER]);
  });
});
