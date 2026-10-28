// Two Stripe key sets: STRIPE_* (tips, everything else) and PREMIUM_PASS_STRIPE_* (patron-zone checkout only).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const constructed: string[] = [];
vi.mock('stripe', () => ({
  default: class FakeStripe {
    static webhooks = {};
    key: string;
    constructor(key: string) {
      this.key = key;
      constructed.push(key);
    }
  },
}));

import {
  keySetForNewPayment,
  paymentKeySet,
  premiumCheckoutKeySet,
  premiumKeysConfigured,
  premiumKeysPartiallyConfigured,
  secretKeyIsLive,
  stripePublishableKeyFor,
  stripeSecretKeyFor,
  stripeWebhookSecretFor,
} from '@/lib/payments/stripe-key-sets';

const base = { STRIPE_SECRET_KEY: 'sk_live_a', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_a', STRIPE_WEBHOOK_SECRET: 'whsec_live' };
const premium = { PREMIUM_PASS_STRIPE_SECRET_KEY: 'sk_test_b', NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: 'pk_test_b', PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: 'whsec_test' };

describe('key set selection (pure)', () => {
  it('without the new variables everything uses the default set, exactly as before', () => {
    expect(premiumKeysConfigured(base)).toBe(false);
    expect(premiumCheckoutKeySet(base)).toBe('default');
    expect(keySetForNewPayment('premium_pass', base)).toBe('default');
    expect(keySetForNewPayment(undefined, base)).toBe('default');
    expect(stripeSecretKeyFor('default', base)).toBe('sk_live_a');
  });

  it('the premium set is all-or-nothing: any missing variable falls back to the default set', () => {
    for (const missing of Object.keys(premium)) {
      const partial = { ...base, ...premium, [missing]: undefined };
      expect(premiumKeysConfigured(partial)).toBe(false);
      expect(premiumKeysPartiallyConfigured(partial)).toBe(true);
      expect(keySetForNewPayment('premium_pass', partial)).toBe('default');
    }
    expect(premiumKeysConfigured({ ...base, ...premium, PREMIUM_PASS_STRIPE_SECRET_KEY: '   ' })).toBe(false);
    expect(premiumKeysPartiallyConfigured(base)).toBe(false);
    expect(premiumKeysPartiallyConfigured({ ...base, ...premium })).toBe(false);
  });

  it('with the full set, the patron-zone checkout uses it and tips keep the default keys', () => {
    const env = { ...base, ...premium };
    expect(premiumKeysConfigured(env)).toBe(true);
    expect(keySetForNewPayment('premium_pass', env)).toBe('premium');
    expect(keySetForNewPayment(undefined, env)).toBe('default');
    expect(keySetForNewPayment(null, env)).toBe('default');
    expect(stripeSecretKeyFor('premium', env)).toBe('sk_test_b');
    expect(stripePublishableKeyFor('premium', env)).toBe('pk_test_b');
    expect(stripeWebhookSecretFor('premium', env)).toBe('whsec_test');
    expect(stripeSecretKeyFor('default', env)).toBe('sk_live_a');
    expect(stripePublishableKeyFor('default', env)).toBe('pk_live_a');
    expect(stripeWebhookSecretFor('default', env)).toBe('whsec_live');
  });

  it('the premium set never falls back to the default key', () => {
    expect(stripeSecretKeyFor('premium', base)).toBeUndefined();
    expect(stripeWebhookSecretFor('premium', base)).toBeUndefined();
  });

  it('a payment belongs to the set in its marker; no marker (all old payments) is the default set', () => {
    expect(paymentKeySet({ stripeKeySet: 'premium', purpose: 'premium_pass' })).toBe('premium');
    expect(paymentKeySet({ purpose: 'premium_pass' })).toBe('default');
    expect(paymentKeySet({})).toBe('default');
    expect(paymentKeySet(null)).toBe('default');
    expect(paymentKeySet({ stripeKeySet: 'anything-else' })).toBe('default');
  });

  it('knows the mode of each set from its own secret key', () => {
    const env = { ...base, ...premium };
    expect(secretKeyIsLive('default', env)).toBe(true);
    expect(secretKeyIsLive('premium', env)).toBe(false);
    expect(secretKeyIsLive('premium', base)).toBeNull();
  });
});

describe('getStripeClient per set', () => {
  beforeEach(() => {
    vi.resetModules();
    constructed.length = 0;
    for (const name of ['STRIPE_SECRET_KEY', 'PREMIUM_PASS_STRIPE_SECRET_KEY']) delete process.env[name];
  });

  it('builds one memoized client per set from that set own key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_a';
    process.env.PREMIUM_PASS_STRIPE_SECRET_KEY = 'sk_test_b';
    const { getStripeClient } = await import('@/lib/modules/payments/infrastructure/stripe-client');
    const live = getStripeClient();
    const test = getStripeClient('premium');
    expect(live).not.toBe(test);
    expect(getStripeClient('default')).toBe(live);
    expect(getStripeClient('premium')).toBe(test);
    expect(constructed).toEqual(['sk_live_a', 'sk_test_b']);
  });

  it('a missing premium key throws instead of using the live key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_a';
    const { getStripeClient } = await import('@/lib/modules/payments/infrastructure/stripe-client');
    expect(() => getStripeClient('premium')).toThrow('PREMIUM_PASS_STRIPE_SECRET_KEY is missing');
    expect(constructed).toEqual([]);
  });

  it('a missing default key still throws as before', async () => {
    const { getStripeClient } = await import('@/lib/modules/payments/infrastructure/stripe-client');
    expect(() => getStripeClient()).toThrow('STRIPE_SECRET_KEY is missing');
  });
});
