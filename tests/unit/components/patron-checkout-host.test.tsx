// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const fetchPassStatus = vi.fn();
vi.mock('@/app/components/premium-pass/usePremiumPass', () => ({ fetchPassStatus: (...args: unknown[]) => fetchPassStatus(...args) }));
vi.mock('@/app/components/premium-pass/PassCheckoutSheet', () => ({
  PASS_PAYMENT_PARAM: 'pass_payment',
  PassCheckoutSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog">patron checkout</div> : <div data-testid="checkout-mounted" />),
}));

import { PatronCheckoutHost } from '@/app/components/premium-pass/PatronCheckoutHost';

describe('PatronCheckoutHost', () => {
  beforeEach(() => fetchPassStatus.mockReset());
  afterEach(cleanup);

  it('opens the patron checkout when the patron zone is visible', async () => {
    fetchPassStatus.mockResolvedValue({ offer: { minMinor: 2000, maxMinor: 100000 }, pass: { state: 'none' } });
    const { findByRole } = render(<PatronCheckoutHost />);
    window.dispatchEvent(new CustomEvent('polutek:open-patron'));
    expect((await findByRole('dialog')).textContent).toBe('patron checkout');
  });

  it('opens nothing when the patron zone is off and never falls back to the hidden tip gate', async () => {
    fetchPassStatus.mockResolvedValue(null);
    const seen: string[] = [];
    const listener = (event: Event) => seen.push(event.type);
    window.addEventListener('polutek:open-support', listener);
    const { queryByRole } = render(<PatronCheckoutHost />);
    window.dispatchEvent(new CustomEvent('polutek:open-patron'));
    await waitFor(() => expect(fetchPassStatus).toHaveBeenCalledWith('checkout'));
    await Promise.resolve();
    expect(queryByRole('dialog')).toBeNull();
    expect(seen).toEqual([]);
    window.removeEventListener('polutek:open-support', listener);
  });

  it('back from a redirect method (?pass_payment=...) mounts the checkout so it can resume the payment (no click needed)', async () => {
    fetchPassStatus.mockResolvedValue({ offer: { minMinor: 2000, maxMinor: 100000 }, pass: { state: 'none' } });
    window.history.replaceState(null, '', '/?pass_payment=pay_1&redirect_status=succeeded');
    const { findByTestId } = render(<PatronCheckoutHost />);
    expect(await findByTestId('checkout-mounted')).toBeTruthy();
    expect(fetchPassStatus).toHaveBeenCalledWith(undefined); // not counted as a checkout opening
    window.history.replaceState(null, '', '/');
  });

  it('a normal page load mounts nothing and asks nothing', async () => {
    window.history.replaceState(null, '', '/?v=jj');
    const { queryByTestId } = render(<PatronCheckoutHost />);
    await Promise.resolve();
    expect(queryByTestId('checkout-mounted')).toBeNull();
    expect(fetchPassStatus).not.toHaveBeenCalled();
  });
});
