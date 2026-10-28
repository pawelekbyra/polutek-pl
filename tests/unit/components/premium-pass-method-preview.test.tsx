/** @vitest-environment jsdom */
// patron zone (docs/architecture/patron-zone.md): step 2 shows the REAL method list of Stripe for the chosen currency (asked
// before "Dalej" through POST /api/user/premium-pass/methods), keeps the candidate tiles until the answer, ignores a
// late answer for an old currency and falls back to the candidates on any error. Demo mode never asks. Stripe is a stub.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { buildPremiumPassOffer } from '@/lib/modules/patron-zone/domain/offer';
import type { PremiumPaymentsDto } from '@/lib/modules/patron-zone/domain/payments-mode';

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ userId: 'u1', isLoaded: true }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'pawel.perfect@gmail.com' } } }),
}));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));
vi.mock('@/lib/payments/stripe-browser', () => ({
  getStripeBrowser: vi.fn(() => Promise.resolve({ paymentRequest: () => ({ canMakePayment: async () => null }) })),
}));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div />,
  CardElement: () => <div />,
  ExpressCheckoutElement: () => <div />,
  useStripe: () => ({}),
  useElements: () => ({}),
}));

const { PassCheckoutSheet } = await import('@/app/components/premium-pass/PassCheckoutSheet');

const N = (text: string) => (name: string) => name.replace(/\s/g, ' ') === text;
const fetchMock = vi.fn();
const methodCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/premium-pass/methods'));
const TEST: PremiumPaymentsDto = { mode: 'stripe', available: true, stripeMode: 'test' };

type Dialog = ReturnType<typeof within>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const clickNext = (dialog: Dialog, label: string) => fireEvent.click(dialog.getByRole('button', { name: N(label) }));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function open(payments?: PremiumPaymentsDto) {
  render(<PassCheckoutSheet open onOpenChange={() => undefined} offer={buildPremiumPassOffer({ signedIn: true, premiumCount: 2, payments })} onWatch={vi.fn()} />);
}

async function pickCurrency(dialog: Dialog, title: string) {
  fireEvent.click(dialog.getByRole('combobox', { name: 'Waluta' }));
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(title) }));
}

/** The tiles of the method dropdown, in order (opens and closes the list). */
async function tiles(dialog: Dialog): Promise<string[]> {
  const combo = dialog.getByRole('combobox', { name: 'Metoda płatności' });
  fireEvent.click(combo);
  const titles = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent ?? '');
  fireEvent.keyDown(combo, { key: 'Escape' });
  return titles;
}

const has = (...names: string[]) => names.map((n) => expect.stringContaining(n));
const EUR = ['card', 'bancontact', 'eps', 'ideal', 'p24', 'sofort', 'multibanco', 'link', 'mb_way', 'mobilepay', 'klarna', 'paypal', 'revolut_pay'];
const PLN_CANDIDATES = has('BLIK', 'Przelewy24', 'Karta');

/** A fetch whose /methods answers are released one by one; everything else is a 404. */
function controlledMethods() {
  const pending: Array<{ body: { currency: string }; resolve: (res: Response) => void }> = [];
  fetchMock.mockImplementation((url: string, init?: { body?: string }) => {
    if (String(url).endsWith('/premium-pass/methods')) {
      return new Promise<Response>((resolve) => pending.push({ body: JSON.parse(String(init?.body)), resolve }));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
  return pending;
}

describe('patron checkout, step 2: the real method list from Stripe', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('asks on entering step 2 (product and currency only) and shows the methods of Stripe, without Link, in the usual order', async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith('/premium-pass/methods') ? json({ paymentMethodTypes: EUR }) : new Response('{}', { status: 404 })));
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    await pickCurrency(dialog, 'Euro');
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }));
    expect(methodCalls()).toHaveLength(0); // step 1 asks nothing
    clickNext(dialog, 'Dalej · 3,99 €');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(() => expect(methodCalls()).toHaveLength(1));
    expect(JSON.parse(String(methodCalls()[0]![1].body))).toEqual({ productId: 'ACCESS_30D', currency: 'EUR' });
    await waitFor(async () => expect((await tiles(dialog)).length).toBeGreaterThan(1));
    const list = await tiles(dialog);
    expect(list).toEqual(has('Przelewy24', 'iDEAL', 'Bancontact', 'EPS', 'Sofort', 'MB WAY', 'Multibanco', 'MobilePay', 'Karta', 'PayPal', 'Revolut Pay', 'Klarna'));
    expect(list.some((t) => /link/i.test(t))).toBe(false);
  });

  it('shows the candidates until the answer arrives, then swaps in the list', async () => {
    const pending = controlledMethods();
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    await pickCurrency(dialog, 'Euro');
    clickNext(dialog, 'Dalej · 7,99 €');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(await tiles(dialog)).toEqual(has('Karta')); // the EUR candidate
    pending[0]!.resolve(json({ paymentMethodTypes: ['card', 'ideal', 'klarna'] }));
    await waitFor(async () => expect(await tiles(dialog)).toHaveLength(3));
    expect(await tiles(dialog)).toEqual(has('iDEAL', 'Karta', 'Klarna'));
  });

  it('ignores a late answer for the old currency', async () => {
    const pending = controlledMethods();
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł'); // PLN: request 1 stays open
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(dialog.getByRole('button', { name: 'Wstecz' }));
    await dialog.findByRole('heading', { name: 'Uzyskaj dostęp do strefy premium' });
    await pickCurrency(dialog, 'Dolar');
    clickNext(dialog, 'Dalej · 8,99 USD');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending.map((p) => p.body.currency)).toEqual(['PLN', 'USD']);
    pending[1]!.resolve(json({ paymentMethodTypes: ['card', 'link', 'paypal'] }));
    await waitFor(async () => expect(await tiles(dialog)).toEqual(has('Karta', 'PayPal')));
    pending[0]!.resolve(json({ paymentMethodTypes: ['blik', 'p24', 'revolut_pay'] })); // the PLN answer arrives last
    await wait(20);
    expect(await tiles(dialog)).toEqual(has('Karta', 'PayPal'));
  });

  it.each([
    ['a server error', () => Promise.resolve(json({ code: 'PAYMENTS_UNAVAILABLE' }, 503))],
    ['a null list (Stripe did not answer)', () => Promise.resolve(json({ paymentMethodTypes: null }))],
    ['an empty list', () => Promise.resolve(json({ paymentMethodTypes: [] }))],
    ['a network failure', () => Promise.reject(new Error('offline'))],
  ])('keeps the candidate tiles after %s', async (_name, answer) => {
    fetchMock.mockImplementation((url: string) => (String(url).endsWith('/premium-pass/methods') ? answer() : Promise.resolve(new Response('{}', { status: 404 }))));
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(() => expect(methodCalls()).toHaveLength(1));
    await wait(20);
    expect(await tiles(dialog)).toEqual(PLN_CANDIDATES);
  });

  it('does not ask again for the same product and currency when coming back to step 2', async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith('/premium-pass/methods') ? json({ paymentMethodTypes: ['card', 'paypal'] }) : new Response('{}', { status: 404 })));
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(async () => expect(await tiles(dialog)).toHaveLength(2));
    fireEvent.click(dialog.getByRole('button', { name: 'Wstecz' }));
    await dialog.findByRole('heading', { name: 'Uzyskaj dostęp do strefy premium' });
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    expect(await tiles(dialog)).toHaveLength(2);
    expect(methodCalls()).toHaveLength(1);
  });

  it('demo mode never asks; the candidates stay', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 404 }));
    open();
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await wait(20);
    expect(await tiles(dialog)).toEqual(PLN_CANDIDATES);
    expect(methodCalls()).toHaveLength(0);
  });

  it('Stripe mode that is not available never asks either', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 404 }));
    open({ mode: 'stripe', available: false });
    await screen.findByRole('dialog');
    await wait(20);
    expect(methodCalls()).toHaveLength(0);
  });
});
