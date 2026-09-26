import { describe, expect, it } from 'vitest';
import { TIP_FALLBACK_METHOD, describeTipMethod, getTipMethodTiles } from '@/app/components/support/tip-flow-config';

describe('tip gate method tiles (list comes from Stripe)', () => {
  it('shows exactly what Stripe allows, local methods first, Link hidden', () => {
    expect(getTipMethodTiles(['card', 'link', 'p24', 'blik'])).toEqual(['blik', 'p24', 'card']);
    expect(getTipMethodTiles(['card', 'paypal'])).toEqual(['card', 'paypal']);
  });

  it('keeps a method Stripe adds later, with a generic tile at the end', () => {
    expect(getTipMethodTiles(['card', 'some_new_method'])).toEqual(['card', 'some_new_method']);
    expect(describeTipMethod('some_new_method', true).title).toBe('Some New Method');
  });

  it('falls back to Stripe\'s full form when no list came back', () => {
    expect(getTipMethodTiles([])).toEqual([TIP_FALLBACK_METHOD]);
  });
});
