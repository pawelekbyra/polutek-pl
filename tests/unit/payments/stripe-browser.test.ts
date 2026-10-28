/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadStripe = vi.fn();
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: (...args: unknown[]) => loadStripe(...args) }));

describe('getStripeBrowser (Stripe.js only for the tip gate, PAY-07)', () => {
  beforeEach(() => {
    vi.resetModules();
    loadStripe.mockReset();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy';
  });

  it('importing the module downloads nothing', async () => {
    await import('@/lib/payments/stripe-browser');
    expect(loadStripe).not.toHaveBeenCalled();
  });

  it('loads Stripe.js once, on first use', async () => {
    loadStripe.mockResolvedValue({ id: 'stripe' });
    const { getStripeBrowser } = await import('@/lib/payments/stripe-browser');

    await getStripeBrowser();
    await getStripeBrowser();

    expect(loadStripe).toHaveBeenCalledTimes(1);
    expect(loadStripe).toHaveBeenCalledWith('pk_test_dummy');
  });

  it('a failed download is retried on the next opening', async () => {
    loadStripe.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'stripe' });
    const { getStripeBrowser } = await import('@/lib/payments/stripe-browser');

    await expect(getStripeBrowser()).rejects.toThrow('offline');
    await expect(getStripeBrowser()).resolves.toEqual({ id: 'stripe' });
    expect(loadStripe).toHaveBeenCalledTimes(2);
  });

  it('without a publishable key there is no Stripe at all', async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const { getStripeBrowser } = await import('@/lib/payments/stripe-browser');
    await expect(getStripeBrowser()).resolves.toBeNull();
    expect(loadStripe).not.toHaveBeenCalled();
  });

  it('the premium key set loads Stripe.js with the patron-zone publishable key, separately from the shared one', async () => {
    process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY = 'pk_test_premium';
    loadStripe.mockImplementation(async (key: string) => ({ key }));
    const { getStripeBrowser } = await import('@/lib/payments/stripe-browser');

    await expect(getStripeBrowser('premium')).resolves.toEqual({ key: 'pk_test_premium' });
    await expect(getStripeBrowser()).resolves.toEqual({ key: 'pk_test_dummy' });
    await getStripeBrowser('premium');
    expect(loadStripe).toHaveBeenCalledTimes(2);
    expect(loadStripe.mock.calls.map((call) => call[0])).toEqual(['pk_test_premium', 'pk_test_dummy']);
    delete process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY;
  });

  it('the premium key set never falls back to the shared key when no premium key is built in', async () => {
    delete process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY;
    const { getStripeBrowser } = await import('@/lib/payments/stripe-browser');
    await expect(getStripeBrowser('premium')).resolves.toBeNull();
    expect(loadStripe).not.toHaveBeenCalled();
  });
});
