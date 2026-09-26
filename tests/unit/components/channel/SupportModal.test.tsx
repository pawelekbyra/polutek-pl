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
  confirmBlikPayment: vi.fn(),
  paymentMethodTypes: ['card', 'blik', 'p24', 'link'] as string[],
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
  CardElement: () => <div data-testid="card-element" />,
  ExpressCheckoutElement: () => <div data-testid="express-checkout" />,
  useStripe: () => ({ confirmPayment: mocks.confirmPayment, confirmBlikPayment: mocks.confirmBlikPayment }),
  useElements: () => ({ getElement: () => null }),
}));

import SupportModal from '@/app/components/channel/SupportModal';

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/checkout/create-intent') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clientSecret: 'cs_1', paymentId: 'pay_1', paymentMethodTypes: mocks.paymentMethodTypes }),
      });
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

async function fillAmountStep(amount: string) {
  fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: amount } });
  fireEvent.click(document.getElementById('tip-accept-terms')!);
}

describe('SupportModal (tip gate)', () => {
  beforeEach(() => {
    mocks.language = 'pl';
    mocks.userId = 'user_1';
    mocks.paymentMethodTypes = ['card', 'blik', 'p24', 'link'];
    mocks.confirmPayment.mockReset();
    mocks.confirmBlikPayment.mockReset();
    mocks.openAuthModal.mockReset();
    window.localStorage.clear();
    mockFetch();
  });
  afterEach(() => cleanup());

  it('shows the badge, currency select, legal links and keeps Next locked until terms are accepted', async () => {
    renderModal();

    expect(screen.getAllByText('Bramka napiwkowa').length).toBeGreaterThan(0);
    expect(screen.getByText('Kwota napiwku')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('PLN');
    expect(screen.getByRole('link', { name: 'Regulamin' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Politykę Prywatności' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Widzi to tylko twórca')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } });
    expect(await screen.findByRole('button', { name: /Dalej/ })).toBeDisabled();
    fireEvent.click(document.getElementById('tip-accept-terms')!);
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
  });

  it('builds the method tiles from the methods Stripe returns and pays with BLIK', async () => {
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    // Step 2: automatic intent, tiles in our order from Stripe's list, Link hidden.
    expect(await screen.findByText('Metoda napiwku')).toBeInTheDocument();
    const body = createIntentBody();
    expect(body).toMatchObject({ amountMinor: 2000, currency: 'PLN' });
    expect(body).not.toHaveProperty('paymentMethod');
    const tiles = screen.getAllByRole('radio').map((tile) => tile.textContent);
    expect(tiles[0]).toMatch(/BLIK/);
    expect(tiles[1]).toMatch(/Przelewy24/);
    expect(tiles[2]).toMatch(/Karta/);
    expect(tiles).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /BLIK/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));

    // Step 3: our own BLIK code field, confirmed with Stripe's BLIK call.
    const code = await screen.findByLabelText('Kod BLIK');
    const send = screen.getByRole('button', { name: /Wyślij/ });
    expect(send).toBeDisabled();
    fireEvent.change(code, { target: { value: '123456' } });
    mocks.confirmBlikPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    fireEvent.click(send);

    expect(await screen.findByText('Dziękuję!')).toBeInTheDocument();
    expect(mocks.confirmBlikPayment).toHaveBeenCalledWith('cs_1', {
      payment_method: { blik: {} },
      payment_method_options: { blik: { code: '123456' } },
    });
  });

  it("falls back to Stripe's form when Stripe reports no methods", async () => {
    mocks.paymentMethodTypes = [];
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    expect(await screen.findByRole('radio', { name: /Karta i inne/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
  });

  it('asks a signed-out viewer to sign in instead of continuing', async () => {
    mocks.userId = null;
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    expect(mocks.openAuthModal).toHaveBeenCalledWith('sign-in');
    expect(createIntentBody()).toBeNull();
    expect(screen.queryByText('Metoda napiwku')).not.toBeInTheDocument();
  });

  it('closes from the header', async () => {
    const onClose = renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalled();
  });
});
