// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const fetchPassStatus = vi.fn();
vi.mock('@/app/components/premium-pass/usePremiumPass', () => ({ fetchPassStatus: (...args: unknown[]) => fetchPassStatus(...args) }));
vi.mock('@/app/components/premium-pass/PassCheckoutSheet', () => ({
  PassCheckoutSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog">patron checkout</div> : null),
}));

import { PatronCheckoutHost } from '@/app/components/premium-pass/PatronCheckoutHost';

describe('PatronCheckoutHost', () => {
  beforeEach(() => fetchPassStatus.mockReset());
  afterEach(cleanup);

  it('opens the patron checkout when the experiment is visible', async () => {
    fetchPassStatus.mockResolvedValue({ offer: { minMinor: 2000, maxMinor: 100000 }, pass: { state: 'none' } });
    const { findByRole } = render(<PatronCheckoutHost />);
    window.dispatchEvent(new CustomEvent('polutek:open-patron'));
    expect((await findByRole('dialog')).textContent).toBe('patron checkout');
  });

  it('falls back to the old tip gate when the experiment is off', async () => {
    fetchPassStatus.mockResolvedValue(null);
    const seen: string[] = [];
    const listener = (event: Event) => seen.push(event.type);
    window.addEventListener('polutek:open-support', listener);
    render(<PatronCheckoutHost />);
    window.dispatchEvent(new CustomEvent('polutek:open-patron'));
    await waitFor(() => expect(seen).toEqual(['polutek:open-support']));
    window.removeEventListener('polutek:open-support', listener);
  });
});
