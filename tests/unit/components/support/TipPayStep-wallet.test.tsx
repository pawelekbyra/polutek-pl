/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import React, { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  available: { googlePay: true } as Record<string, boolean> | undefined,
  confirmPayment: vi.fn(),
  eceOptions: null as unknown,
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => null,
  CardElement: () => null,
  ExpressCheckoutElement: ({
    options,
    onReady,
    onConfirm,
  }: {
    options: unknown;
    onReady: (event: { availablePaymentMethods?: Record<string, boolean> }) => void;
    onConfirm: () => void;
  }) => {
    mocks.eceOptions = options;
    useEffect(() => onReady({ availablePaymentMethods: mocks.available }), [onReady]);
    return (
      <button type="button" onClick={onConfirm}>
        wallet-button
      </button>
    );
  },
  useStripe: () => ({ confirmPayment: mocks.confirmPayment }),
  useElements: () => ({}),
}));

import { TipPayStep } from '@/app/components/support/TipPayStep';

function renderWallet(onConfirmed = vi.fn(), onChangeMethod = vi.fn()) {
  render(
    <TipPayStep
      language="pl"
      amount={20}
      currency="PLN"
      method="google_pay"
      clientSecret="cs_1"
      paymentId="pay_1"
      stripePromise={null}
      onChangeMethod={onChangeMethod}
      onConfirmed={onConfirmed}
    />,
  );
  return { onConfirmed, onChangeMethod };
}

describe('TipPayStep — Google Pay / Apple Pay', () => {
  beforeEach(() => {
    mocks.available = { googlePay: true };
    mocks.confirmPayment.mockReset();
  });
  afterEach(() => cleanup());

  it("renders Stripe's wallet button limited to the chosen wallet and confirms through it", async () => {
    const { onConfirmed } = renderWallet();
    expect(mocks.eceOptions).toMatchObject({ paymentMethods: { googlePay: 'always', applePay: 'never', link: 'never' } });

    mocks.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    fireEvent.click(screen.getByRole('button', { name: 'wallet-button' }));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith('succeeded'));
    expect(mocks.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'if_required' }));
  });

  it('explains and offers another method when the wallet is not available', async () => {
    mocks.available = undefined;
    const { onChangeMethod } = renderWallet();
    expect(await screen.findByText(/nie jest dostępna na tym urządzeniu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wybierz inną metodę' }));
    expect(onChangeMethod).toHaveBeenCalled();
  });
});
