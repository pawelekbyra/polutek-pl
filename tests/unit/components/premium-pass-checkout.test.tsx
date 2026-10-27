/** @vitest-environment jsdom */
// patron zone (docs/architecture/patron-zone.md): the three-step checkout (1 currency + option, 2 payment method, 3 payment + the two boxes; the order summary in all three). Stripe.js and Elements are stubs: no network, no charge.
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

const confirmBlikPayment = vi.fn();
vi.mock('@/lib/payments/stripe-browser', () => ({
  getStripeBrowser: vi.fn(() => Promise.resolve({ paymentRequest: () => ({ canMakePayment: async () => null }) })),
}));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  CardElement: () => <div data-testid="card-element" />,
  ExpressCheckoutElement: () => <div data-testid="express-element" />,
  useStripe: () => ({ confirmBlikPayment }),
  useElements: () => ({}),
}));

const { PassCheckoutSheet } = await import('@/app/components/premium-pass/PassCheckoutSheet');
const { getStripeBrowser } = await import('@/lib/payments/stripe-browser');

/** Prices are formatted with a no-break space; match any whitespace. */
const N = (text: string) => (name: string) => name.replace(/\s/g, ' ') === text;

const fetchMock = vi.fn();
const calls = (needle: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(needle));
const jsonBody = (needle: string, index = 0) => JSON.parse(String(calls(needle)[index]![1].body));

function activePass(provider: 'DEMO' | 'STRIPE') {
  return {
    state: 'active', lifetime: false, productId: 'ACCESS_LIFETIME', provider, ref: provider === 'DEMO' ? 'DEMO-AAAA-BBBB' : 'pay_1', expiresAt: '2026-11-20T10:00:00.000Z', grantedAt: '2026-10-21T10:00:00.000Z',
    method: 'blik', priceMinor: 2999, currency: 'PLN', totalMinor: 2999, waiverAt: '2026-10-21T10:00:00.000Z',
  };
}

function route(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (url: string) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (key) return handlers[key]!();
    if (String(url).startsWith('/api/user/premium-pass?')) return new Response(JSON.stringify({ offer: {}, pass: { state: 'none' } }), { status: 200 });
    return new Response('{}', { status: 404 });
  });
}

function open(payments?: PremiumPaymentsDto) {
  const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, payments });
  const onWatch = vi.fn();
  render(<PassCheckoutSheet open onOpenChange={() => undefined} offer={offer} onWatch={onWatch} />);
  return { offer, onWatch };
}


type Dialog = ReturnType<typeof within>;
const clickNext = (dialog: Dialog, label: string) => fireEvent.click(dialog.getByRole('button', { name: N(label) }));
const summaryOf = (dialog: Dialog) => dialog.getByRole('group', { name: 'Podsumowanie zamówienia' });

async function pickCurrency(dialog: Dialog, title: string) {
  const combo = dialog.getByRole('combobox', { name: 'Waluta' });
  fireEvent.click(combo);
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(title) }));
}

describe('patron checkout, step 1 (currency and option)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    route({});
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers only the currency and the two option cards (unlimited preselected, best value) and the order summary', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Uzyskaj dostęp do strefy premium' })).toBeInTheDocument();
    expect(dialog.queryByText(/Zostań patronem i uzyskaj/)).toBeNull(); // the lead no longer repeats the title
    expect(dialog.getByRole('combobox', { name: 'Waluta' })).toHaveTextContent('zł · PLN'); // a small pill beside the "Wybierz dostęp" label, not a full field
    const group = dialog.getByRole('group', { name: 'Wybierz dostęp' });
    const cards = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(cards.map((r) => [r.value, r.checked])).toEqual([['ACCESS_30D', false], ['ACCESS_LIFETIME', true]]);
    expect(within(group).getAllByText('Bestseller')).toHaveLength(1);
    expect(summaryOf(dialog)).toHaveTextContent('Dostęp bez limitu');
    expect(summaryOf(dialog)).toHaveTextContent('29,99');
    expect(summaryOf(dialog)).toHaveTextContent('zawiera VAT');
    // payment method and legal links belong to step 2; nothing to tick, no text field
    expect(dialog.queryByRole('combobox', { name: 'Metoda płatności' })).toBeNull();
    expect(dialog.queryAllByRole('checkbox')).toHaveLength(0);
    expect(dialog.queryByRole('textbox')).toBeNull();
    expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('[data-demo-ribbon]')).toBeNull();
  });

  it('has three step dots, marks the current one and announces "Krok 1 z 3"', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    const dots = within(dialog.getByRole('list', { name: 'Etapy zakupu' })).getAllByRole('listitem');
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute('aria-current', 'step');
    expect(dots[1]).not.toHaveAttribute('aria-current');
    expect(dialog.getByText('Krok 1 z 3')).toHaveAttribute('aria-live', 'polite');
  });

  it('lists the tip gateway\'s currencies and the prices follow the chosen currency', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    const combo = dialog.getByRole('combobox', { name: 'Waluta' });
    fireEvent.click(combo);
    const titles = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(titles).toEqual([
      expect.stringContaining('Złoty'), expect.stringContaining('Euro'), expect.stringContaining('Dolar'), expect.stringContaining('Frank'), expect.stringContaining('Funt'),
    ]);
    fireEvent.click(await screen.findByRole('option', { name: /Euro/ }));
    expect(combo).toHaveTextContent('€ · EUR');
    expect(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }).closest('label')).toHaveTextContent('3,99');
    expect(dialog.getByRole('radio', { name: /Dostęp bez limitu/ }).closest('label')).toHaveTextContent('7,99');
    expect(dialog.getByRole('button', { name: N('Dalej · 7,99 €') })).toBeInTheDocument();
    expect(summaryOf(dialog)).toHaveTextContent('7,99');
    await pickCurrency(dialog, 'Dolar');
    expect(dialog.getByRole('button', { name: /Dalej · 8,99/ })).toBeInTheDocument();
    await pickCurrency(dialog, 'Funt');
    expect(dialog.getByRole('button', { name: /Dalej · 6,99/ })).toBeInTheDocument();
    await pickCurrency(dialog, 'Frank');
    expect(dialog.getByRole('button', { name: /Dalej · 7,99/ })).toBeInTheDocument();
    await pickCurrency(dialog, 'Złoty');
    expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeInTheDocument();
  });

  it('choosing an option updates the summary and the button price', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }));
    expect(dialog.getByRole('button', { name: N('Dalej · 14,99 zł') })).toBeInTheDocument();
    expect(summaryOf(dialog)).toHaveTextContent('Dostęp na 30 dni');
    expect(summaryOf(dialog)).toHaveTextContent('14,99');
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp bez limitu/ }));
    expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeInTheDocument();
  });

  it('with unlimited access already held: no "you already have access" message, and nothing to buy', async () => {
    route({ '/api/user/premium-pass?': () => new Response(JSON.stringify({ offer: {}, pass: { ...activePass('STRIPE'), lifetime: true, expiresAt: null } }), { status: 200 }) });
    open();
    const dialog = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeDisabled());
    expect(dialog.queryByText(/Masz już dostęp/)).toBeNull();
    expect(dialog.getByRole('combobox', { name: 'Waluta' })).toBeDisabled();
    for (const radio of dialog.getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('a running 30-day access can be extended, without any notice about the current access', async () => {
    route({ '/api/user/premium-pass?': () => new Response(JSON.stringify({ offer: {}, pass: activePass('STRIPE') }), { status: 200 }) });
    open();
    const dialog = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeEnabled());
    expect(dialog.queryByText(/Masz dostęp do/)).toBeNull();
  });
});

describe('patron checkout, step 2 (payment method)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    route({});
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the method dropdown, the order summary and Terms/Privacy as links only; nothing to tick yet', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    expect(await dialog.findByRole('heading', { name: 'Metoda płatności' })).toBeInTheDocument();
    expect(dialog.getByText('Krok 2 z 3')).toBeInTheDocument();
    expect(within(dialog.getByRole('list', { name: 'Etapy zakupu' })).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    expect(dialog.getByRole('combobox', { name: 'Metoda płatności' })).toBeInTheDocument();
    expect(summaryOf(dialog)).toHaveTextContent('29,99');
    expect(dialog.getByRole('link', { name: 'Regulamin' })).toHaveAttribute('href', '/regulamin-premium');
    expect(dialog.getByRole('link', { name: 'Polityka prywatności' })).toHaveAttribute('href', expect.stringContaining('polityka-prywatnosci'));
    expect(dialog.queryAllByRole('checkbox')).toHaveLength(0);
    expect(dialog.queryByRole('radio')).toBeNull();
    expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/intent'))).toHaveLength(0);
  });

  it('the dropdown works from the keyboard; PLN lists BLIK, Przelewy24 and card', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    const combo = await dialog.findByRole('combobox', { name: 'Metoda płatności' });
    expect(combo).toHaveAttribute('aria-expanded', 'false');
    combo.focus();
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('BLIK'), expect.stringContaining('Przelewy24'), expect.stringContaining('Karta')]);
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(combo).toHaveTextContent('Przelewy24');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Escape' });
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });

  it('other currencies get the card only (BLIK and Przelewy24 are Polish methods) and the summary is in that currency', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    await pickCurrency(dialog, 'Euro');
    clickNext(dialog, 'Dalej · 7,99 €');
    const combo = await dialog.findByRole('combobox', { name: 'Metoda płatności' });
    expect(combo).toHaveTextContent('Karta');
    fireEvent.click(combo);
    expect(within(await screen.findByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    expect(summaryOf(dialog)).toHaveTextContent('7,99');
  });

  it('the back arrow returns to step 1 and keeps the currency and the option', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    await pickCurrency(dialog, 'Euro');
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }));
    clickNext(dialog, 'Dalej · 3,99 €');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    fireEvent.click(dialog.getByRole('button', { name: 'Wstecz' }));
    expect(await dialog.findByRole('heading', { name: 'Uzyskaj dostęp do strefy premium' })).toBeInTheDocument();
    expect(dialog.getByRole('combobox', { name: 'Waluta' })).toHaveTextContent('€ · EUR');
    expect((dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }) as HTMLInputElement).checked).toBe(true);
  });
});

describe('patron checkout, step 3 in demo mode (simulated payment)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear(); // the last-used method is remembered across checkouts
    route({ '/premium-pass/checkout': () => new Response(JSON.stringify({ pass: activePass('DEMO') }), { status: 200 }) });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function toStep3(dialog: Dialog, label = 'Dalej · 29,99 zł') {
    clickNext(dialog, label);
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    clickNext(dialog, label);
    await dialog.findByRole('heading', { name: 'Płatność' });
  }

  it('asks for both boxes HERE, with the order summary still visible; errors instead of paying; then pays', async () => {
    const { onWatch } = open();
    const dialog = within(await screen.findByRole('dialog'));
    await toStep3(dialog);
    expect(dialog.getByText('Krok 3 z 3')).toBeInTheDocument();
    expect(summaryOf(dialog)).toHaveTextContent('Dostęp bez limitu');
    expect(summaryOf(dialog)).toHaveTextContent('29,99');
    const pay = dialog.getByRole('button', { name: N('Zapłać 29,99 zł') });
    const boxes = dialog.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(dialog.getByText('Zaznacz obie zgody, aby zapłacić.')).toBeInTheDocument();

    fireEvent.click(pay);
    expect(dialog.getAllByText('Zaznacz to pole, aby kontynuować.')).toHaveLength(2);
    expect(calls('/premium-pass/checkout')).toHaveLength(0);

    boxes.forEach((box) => fireEvent.click(box));
    fireEvent.click(dialog.getByRole('button', { name: N('Zapłać 29,99 zł') }));
    expect(await dialog.findByRole('heading', { name: 'Jesteś patronem. Dziękuję!' }, { timeout: 4000 })).toBeInTheDocument();
    expect(jsonBody('/premium-pass/checkout')).toMatchObject({ productId: 'ACCESS_LIFETIME', currency: 'PLN', method: 'blik', consents: { terms: true, waiver: true }, simulate: 'success' });
    expect(Object.keys(jsonBody('/premium-pass/checkout'))).not.toContain('amountMinor');
    fireEvent.click(dialog.getByRole('button', { name: 'Wejdź do strefy patrona' }));
    expect(onWatch).toHaveBeenCalled();
  });

  it('pays in the chosen currency', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    await pickCurrency(dialog, 'Dolar');
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }));
    await toStep3(dialog, 'Dalej · 4,49 USD');
    expect(dialog.getByRole('button', { name: /Zapłać 4,49/ })).toBeInTheDocument();
    dialog.getAllByRole('checkbox').forEach((box) => fireEvent.click(box));
    fireEvent.click(dialog.getByRole('button', { name: /Zapłać 4,49/ }));
    await dialog.findByRole('heading', { name: 'Jesteś patronem. Dziękuję!' }, { timeout: 4000 });
    expect(jsonBody('/premium-pass/checkout')).toMatchObject({ productId: 'ACCESS_30D', currency: 'USD' });
  });

  it('"Zmień" and the back arrow go back to step 2 with the choices kept', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }));
    await toStep3(dialog, 'Dalej · 14,99 zł');
    fireEvent.click(dialog.getByRole('button', { name: 'Zmień' }));
    expect(await dialog.findByRole('heading', { name: 'Metoda płatności' })).toBeInTheDocument();
    expect(summaryOf(dialog)).toHaveTextContent('14,99');
    clickNext(dialog, 'Dalej · 14,99 zł');
    await dialog.findByRole('heading', { name: 'Płatność' });
    fireEvent.click(dialog.getByRole('button', { name: 'Wstecz' }));
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    fireEvent.click(dialog.getByRole('button', { name: 'Wstecz' }));
    expect((await dialog.findByRole('radio', { name: /Dostęp na 30 dni/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('moves focus to the heading of each step', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    const second = await dialog.findByRole('heading', { name: 'Metoda płatności' });
    await waitFor(() => expect(document.activeElement).toBe(second));
    clickNext(dialog, 'Dalej · 29,99 zł');
    const third = await dialog.findByRole('heading', { name: 'Płatność' });
    await waitFor(() => expect(document.activeElement).toBe(third));
  });

  it('never asks Stripe for anything in demo mode', async () => {
    open();
    const dialog = within(await screen.findByRole('dialog'));
    await toStep3(dialog);
    expect(getStripeBrowser).not.toHaveBeenCalled();
    expect(calls('/intent')).toHaveLength(0);
    expect(screen.queryByTestId('stripe-elements')).toBeNull();
  });

  it('the old seller footer is gone: the bottom line is the provider-neutral demo notice, the seller is a card', async () => {
    open();
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelectorAll('[data-seller-card]')).toHaveLength(1);
    // Steps 1 and 2 carry the two documents in the footer (no 'read the documents' box); the notice returns in step 3.
    expect(dialog.querySelector('[data-legal-footer]')).toHaveTextContent('Regulamin i Polityka prywatności');
    expect(dialog).not.toHaveTextContent('Przed zapłatą zapoznaj się');
    expect(dialog).not.toHaveTextContent('@polutek.com');
    expect(dialog).not.toHaveTextContent('pawelperfect.com');
  });
});

describe('patron checkout, step 3 with real Stripe payments', () => {
  const READY = { paymentId: 'pay_1', clientSecret: 'pi_1_secret_x', paymentMethodTypes: ['blik', 'card', 'p24'], terminal: false };
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    confirmBlikPayment.mockReset();
    vi.mocked(getStripeBrowser).mockClear();
    window.sessionStorage.clear();
    window.localStorage.clear(); // the last-used method is remembered across checkouts
    route({
      '/premium-pass/intent': () => new Response(JSON.stringify(READY), { status: 200 }),
      '/premium-pass/consent': () => new Response(JSON.stringify({ recorded: true }), { status: 200 }),
      '/api/payments/pay_1': () => new Response(JSON.stringify({ uiStatus: 'SUCCEEDED' }), { status: 200 }),
      '/api/user/premium-pass': () => new Response(JSON.stringify({ offer: {}, pass: activePass('STRIPE') }), { status: 200 }),
    });
    confirmBlikPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const TEST = { mode: 'stripe', available: true, stripeMode: 'test' } as const;

  it('test mode: labelled "Tryb testowy", Stripe.js only now; the payment is created at the step 2 -> 3 move, for product and currency (no amount sent)', async () => {
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Tryb testowy')).toBeInTheDocument();
    await waitFor(() => expect(getStripeBrowser).toHaveBeenCalledTimes(1));
    await pickCurrency(dialog, 'Euro');
    fireEvent.click(dialog.getByRole('radio', { name: /Dostęp na 30 dni/ }));
    clickNext(dialog, 'Dalej · 3,99 €');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    expect(calls('/intent')).toHaveLength(0); // nothing is created by choosing currency, option or method
    clickNext(dialog, 'Dalej · 3,99 €');
    await screen.findAllByTestId('stripe-elements');
    expect(jsonBody('/premium-pass/intent')).toMatchObject({ productId: 'ACCESS_30D', currency: 'EUR' });
    expect(jsonBody('/premium-pass/intent').requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(jsonBody('/premium-pass/intent')).sort()).toEqual(['currency', 'productId', 'requestId']);
  });

  it('live mode shows no test label', async () => {
    open({ mode: 'stripe', available: true, stripeMode: 'live' });
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByText('Tryb testowy')).toBeNull();
  });

  it('seller card in every step (compact in step 3) and the provider-neutral footer without the word Stripe', async () => {
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    const root = screen.getByRole('dialog');
    expect(root.querySelector('[data-seller-card]')).toHaveTextContent('Spółka zarejestrowana w Polsce');
    expect(root.querySelector('[data-legal-footer]')).toHaveTextContent('Regulamin i Polityka prywatności');
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    expect(root.querySelector('[data-seller-card]')).toHaveTextContent('Spółka zarejestrowana w Polsce');
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('textbox', { name: 'Kod BLIK' });
    expect(root.querySelectorAll('[data-seller-card]')).toHaveLength(1);
    expect(root.querySelector('[data-seller-card]')).not.toHaveTextContent('Spółka zarejestrowana');
    expect(root.querySelector('[data-secure-footer]')).toHaveTextContent('Płatność jest szyfrowana i obsługuje ją zaufany operator płatności.');
    expect(root.querySelector('[data-secure-footer]')!.textContent).not.toMatch(/stripe/i);
  });

  it('the BLIK form is the tip gateway\'s; the summary stays visible; paying needs the code AND both boxes; consent is recorded before the confirmation; access shows after the server confirms', async () => {
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    clickNext(dialog, 'Dalej · 29,99 zł');
    const code = await dialog.findByRole('textbox', { name: 'Kod BLIK' });
    expect(summaryOf(dialog)).toHaveTextContent('29,99');
    const pay = dialog.getByRole('button', { name: N('Zapłać 29,99 zł') });
    fireEvent.change(code, { target: { value: '123456' } });
    expect(pay).toBeDisabled(); // boxes not ticked
    const boxes = dialog.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[0]!);
    expect(pay).toBeDisabled();
    fireEvent.click(boxes[1]!);
    expect(pay).toBeEnabled();

    fireEvent.click(pay);
    expect(await dialog.findByRole('heading', { name: 'Jesteś patronem. Dziękuję!' }, { timeout: 4000 })).toBeInTheDocument();
    expect(jsonBody('/premium-pass/consent')).toEqual({ paymentId: 'pay_1', method: 'blik', consents: { terms: true, waiver: true } });
    expect(confirmBlikPayment).toHaveBeenCalledTimes(1);
    expect(confirmBlikPayment.mock.calls[0]![0]).toBe('pi_1_secret_x');
    const order = fetchMock.mock.calls.map(([url]) => String(url));
    expect(order.findIndex((u) => u.includes('/consent'))).toBeLessThan(order.findIndex((u) => u.includes('/api/payments/pay_1')));
    expect(calls('/premium-pass/checkout')).toHaveLength(0); // the browser never writes access
  });

  it('a failed consent write stops the payment before Stripe is asked', async () => {
    route({
      '/premium-pass/intent': () => new Response(JSON.stringify(READY), { status: 200 }),
      '/premium-pass/consent': () => new Response('{}', { status: 500 }),
    });
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    clickNext(dialog, 'Dalej · 29,99 zł');
    const code = await dialog.findByRole('textbox', { name: 'Kod BLIK' });
    fireEvent.change(code, { target: { value: '123456' } });
    dialog.getAllByRole('checkbox').forEach((box) => fireEvent.click(box));
    fireEvent.click(dialog.getByRole('button', { name: N('Zapłać 29,99 zł') }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Nie udało się zapisać Twojej zgody');
    expect(confirmBlikPayment).not.toHaveBeenCalled();
  });

  it('a method Stripe does not allow for this payment keeps the viewer in step 2 with a message', async () => {
    route({ '/premium-pass/intent': () => new Response(JSON.stringify({ ...READY, paymentMethodTypes: ['card'] }), { status: 200 }) });
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    clickNext(dialog, 'Dalej · 29,99 zł'); // BLIK is the default
    expect(await dialog.findByText('Ta metoda nie jest dostępna dla tej płatności. Wybierz inną.')).toBeInTheDocument();
    expect(dialog.getByRole('combobox', { name: 'Metoda płatności' })).toHaveTextContent('Karta');
    expect(screen.queryByTestId('stripe-elements')).toBeNull();
  });

  it('stripe mode that is not fully configured offers no payment and never falls back to the simulation', async () => {
    open({ mode: 'stripe', available: false });
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('alert')).toHaveTextContent('Płatności są chwilowo niedostępne');
    expect(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeDisabled();
    expect(getStripeBrowser).not.toHaveBeenCalled();
    expect(calls('/intent')).toHaveLength(0);
    expect(calls('/checkout')).toHaveLength(0);
  });

  it('a refusal from the server (unlimited already held) ends in "Masz już dostęp bez limitu", no payment form', async () => {
    route({ '/premium-pass/intent': () => new Response(JSON.stringify({ code: 'ALREADY_LIFETIME' }), { status: 409 }) });
    open(TEST);
    const dialog = within(await screen.findByRole('dialog'));
    clickNext(dialog, 'Dalej · 29,99 zł');
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    clickNext(dialog, 'Dalej · 29,99 zł');
    expect(await dialog.findByRole('heading', { name: 'Masz już dostęp bez limitu' })).toBeInTheDocument();
    expect(dialog.queryByRole('textbox', { name: 'Kod BLIK' })).toBeNull();
  });
});
