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

vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: mocks.language, tx: txFor(mocks.language) }) }));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({ useAuthModal: () => ({ open: mocks.openAuthModal }) }));
vi.mock('@/lib/auth/react', () => ({
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
import { txFor } from "../../i18n/mock-language";

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
      <SupportModal onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

function createIntentBody() {
  const call = vi.mocked(global.fetch).mock.calls.find(([url]) => url === '/api/checkout/create-intent');
  return call ? JSON.parse((call[1] as RequestInit).body as string) : null;
}

// The gate opens on the recipient step (terms consent), then a disclaimer, then the amount.
async function fillAmountStep(amount: string) {
  fireEvent.click(document.getElementById('tip-accept-terms-recipient')!);
  fireEvent.click(await screen.findByRole('button', { name: 'Dalej' }));
  expect(await screen.findByText('Rozumiem, spoko.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: amount } });
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
    window.sessionStorage.clear();
    mockFetch();
  });
  afterEach(() => cleanup());

  it('walks recipient (terms consent) -> disclaimer -> amount, and Next explains what is missing instead of continuing', async () => {
    renderModal();

    // Step 1: recipient. Consent to the Terms/Privacy is required before continuing.
    expect(screen.getAllByText('Bramka napiwkowa').length).toBeGreaterThan(0);
    expect(screen.getByText('Odbiorca napiwku')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wstecz' })).not.toBeInTheDocument();
    // Legal documents open as a second modal on top of the gate, not a new tab.
    fireEvent.click(screen.getByRole('button', { name: 'Regulamin' }));
    expect(await screen.findByRole('heading', { name: 'Regulamin serwisu' })).toBeInTheDocument();
    expect(document.getElementById('tip-accept-terms-recipient')).not.toHaveAttribute('data-checked');
    fireEvent.click(screen.getAllByRole('button', { name: 'Zamknij' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Regulamin serwisu' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Politykę Prywatności' })).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Dalej' });
    fireEvent.click(next);
    expect(screen.getByText('Zaakceptuj Regulamin i Politykę Prywatności.').className).toContain('opacity-100');
    expect(screen.queryByText('Rozumiem, spoko.')).not.toBeInTheDocument();

    // Step 2: the disclaimer says a tip unlocks nothing.
    fireEvent.click(document.getElementById('tip-accept-terms-recipient')!);
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(await screen.findByText('Napiwek jest dobrowolny i niczego nie odblokowuje.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wstecz' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));

    // Step 3: amount, with a currency dropdown pre-selected by locale.
    expect(await screen.findByText('Kwota napiwku')).toBeInTheDocument();
    const currency = screen.getByRole('combobox', { name: 'Wybierz walutę napiwku' });
    expect(currency).toHaveTextContent('Złoty (PLN)');
    fireEvent.click(currency);
    fireEvent.click(screen.getByRole('option', { name: /Euro \(EUR\)/ }));
    expect(currency).toHaveTextContent('Euro (EUR)');
    fireEvent.click(currency);
    fireEvent.click(screen.getByRole('option', { name: /Złoty \(PLN\)/ }));
    expect(screen.queryByPlaceholderText('Widzi to tylko twórca')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Dalej/ }));
    expect(await screen.findByText(/Wpisz kwotę napiwku/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    expect(screen.getByText(/Kwota jest za niska\. Minimum: 5\szł/)).toHaveAttribute('role', 'alert');
    expect(createIntentBody()).toBeNull();
    expect(screen.queryByText('Metoda napiwku')).not.toBeInTheDocument();
  });

  it('builds the method tiles from the methods Stripe returns and pays with BLIK', async () => {
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    // Step 2: automatic intent, tiles in our order from Stripe's list, Link hidden.
    expect(await screen.findByText('Metoda napiwku')).toBeInTheDocument();
    // Back sits in the footer, next to the main button.
    expect(screen.getByRole('button', { name: 'Wstecz' }).nextElementSibling).toContainElement(screen.getByRole('button', { name: 'Dalej' }));
    const body = createIntentBody();
    expect(body).toMatchObject({ amountMinor: 2000, currency: 'PLN' });
    expect(typeof body.requestId).toBe('string');
    // The intent description is built on the server; the client sends no free text.
    expect(body).not.toHaveProperty('title');
    expect(body).not.toHaveProperty('paymentMethod');
    const select = screen.getByRole('combobox', { name: 'Wybierz metodę napiwku' });
    expect(select).toHaveTextContent('BLIK');
    fireEvent.click(select);
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([expect.stringMatching(/BLIK/), expect.stringMatching(/Przelewy24/), expect.stringMatching(/Karta/), expect.stringMatching(/Crypto/)]);
    expect(screen.getByRole('option', { name: /BLIK/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('option', { name: /BLIK/ }));
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
      payment_method: { blik: {}, billing_details: { email: 'fan@example.com' } },
      payment_method_options: { blik: { code: '123456' } },
    });
  });

  it('clears a used BLIK code after a failed attempt and shows the error', async () => {
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dalej' }));

    const code = await screen.findByLabelText('Kod BLIK');
    fireEvent.change(code, { target: { value: '123456' } });
    mocks.confirmBlikPayment.mockResolvedValue({ error: { message: 'Kod BLIK wygasł.' } });
    fireEvent.click(screen.getByRole('button', { name: /Wyślij/ }));

    expect(await screen.findByText('Kod BLIK wygasł.')).toBeInTheDocument();
    expect(code).toHaveValue('');
  });

  it("falls back to Stripe's form when Stripe reports no methods", async () => {
    mocks.paymentMethodTypes = [];
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    expect(await screen.findByRole('combobox', { name: 'Wybierz metodę napiwku' })).toHaveTextContent('Karta i inne');
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
  });

  it('lists a Crypto placeholder that only says it is coming soon', async () => {
    renderModal();
    await fillAmountStep('20');
    await waitFor(() => expect(screen.getByRole('button', { name: /Dalej/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Dalej/ }));

    fireEvent.click(await screen.findByRole('combobox', { name: 'Wybierz metodę napiwku' }));
    fireEvent.click(screen.getByRole('option', { name: /Crypto/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(await screen.findByText(/kryptowalutach będą dostępne już wkrótce/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wybierz inną metodę' }));
    expect(await screen.findByText('Metoda napiwku')).toBeInTheDocument();
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
