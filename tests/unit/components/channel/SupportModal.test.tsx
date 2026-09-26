/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  language: 'pl' as 'pl' | 'en',
  userId: 'user_1' as string | null,
  openAuthModal: vi.fn(),
  confirmPayment: vi.fn(),
}));

vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: mocks.language }) }));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({ useAuthModal: () => ({ open: mocks.openAuthModal }) }));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: mocks.userId }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'fan@example.com' } } }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/payments/detect-currency', () => ({ detectDefaultCurrency: () => (mocks.language === 'pl' ? 'PLN' : 'USD') }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="payment-element" />,
  ExpressCheckoutElement: () => <div data-testid="express-checkout" />,
  useStripe: () => ({ confirmPayment: mocks.confirmPayment }),
  useElements: () => ({}),
}));

import SupportModal from '@/app/components/channel/SupportModal';

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/checkout/create-intent') {
      return Promise.resolve({ ok: true, json: async () => ({ clientSecret: 'cs_1', paymentId: 'pay_1' }) });
    }
    if (url.startsWith('/api/payments/')) {
      return Promise.resolve({ ok: true, json: async () => ({ uiStatus: 'SUCCEEDED' }) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        limits: { PLN: { minAmount: 5 }, USD: { minAmount: 1 }, EUR: { minAmount: 1 }, CHF: { minAmount: 1 }, GBP: { minAmount: 1 } },
      }),
    });
  }) as unknown as typeof fetch;
}

function renderModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SupportModal videoTitle="Film" onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

function createIntentBody() {
  const call = vi.mocked(global.fetch).mock.calls.find(([url]) => url === '/api/checkout/create-intent');
  return call ? JSON.parse((call[1] as RequestInit).body as string) : null;
}

describe('SupportModal (tip gate)', () => {
  beforeEach(() => {
    mocks.language = 'pl';
    mocks.userId = 'user_1';
    mocks.confirmPayment.mockReset();
    window.localStorage.clear();
    mockFetch();
  });
  afterEach(() => cleanup());

  it('walks amount → method → pay with the chosen method and message, then thanks', async () => {
    renderModal();

    // Step 1: the second PLN preset is highlighted once minimums load.
    await waitFor(() => expect(screen.getByRole('radio', { name: /^\D*20\szł$/ })).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(screen.getByRole('radio', { name: /^\D*50\szł$/ }));
    fireEvent.change(screen.getByPlaceholderText('Widzi to tylko twórca'), { target: { value: 'Super film' } });
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    // Step 2: local methods for PLN, BLIK first and preselected.
    expect(await screen.findByText('Jak chcesz przesłać?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /BLIK/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Przelewy24/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));

    // Step 3: intent restricted to BLIK, with the message; Stripe shows only that method.
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(createIntentBody()).toMatchObject({ amountMinor: 5000, currency: 'PLN', paymentMethod: 'blik', message: 'Super film' });
    expect(screen.getByText(/BLIK/)).toBeInTheDocument();

    const send = screen.getByRole('button', { name: /Wyślij/ });
    expect(send).toBeDisabled();
    fireEvent.click(document.getElementById('tip-accept-terms')!);
    mocks.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    fireEvent.click(send);

    expect(await screen.findByText('Dziękuję!')).toBeInTheDocument();
    expect(mocks.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'if_required' }));
  });

  it('skips the method step when only one method exists (USD without a wallet)', async () => {
    mocks.language = 'en';
    renderModal();

    await waitFor(() => expect(screen.getByRole('radio', { name: /US\$5$/ })).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(createIntentBody()).toMatchObject({ currency: 'USD', paymentMethod: 'card' });
  });

  it('asks a signed-out viewer to sign in instead of continuing', async () => {
    mocks.userId = null;
    renderModal();

    const next = await screen.findByRole('button', { name: /Dalej/ });
    await waitFor(() => expect(next).not.toBeDisabled());
    fireEvent.click(next);

    expect(mocks.openAuthModal).toHaveBeenCalledWith('sign-in');
    expect(screen.queryByText('Jak chcesz przesłać?')).not.toBeInTheDocument();
  });

  it('closes from the header', async () => {
    const onClose = renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalled();
  });
});
