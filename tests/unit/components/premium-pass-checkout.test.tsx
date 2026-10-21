/** @vitest-environment jsdom */
// experiment: premium-pass (docs/experiments/premium-pass.md, "Strefa patrona"): the two-step checkout. Step 1: amount
// (suggested or own), payment method dropdown, Terms/Privacy as LINKS. Step 2: the payment and the two boxes. Stripe.js
// and Elements are replaced by stubs: no network, no charge.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { buildPremiumPassOffer } from '@/lib/modules/experiment-premium-pass/domain/offer';
import type { PremiumPaymentsDto } from '@/lib/modules/experiment-premium-pass/domain/payments-mode';

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
    method: 'blik', priceMinor: 2999, totalMinor: 2999, waiverAt: '2026-10-21T10:00:00.000Z',
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

describe('patron checkout, step 1', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    route({});
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers two option cards (unlimited preselected, best value), a method dropdown and Terms/Privacy as links only', async () => {
    open();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Zostań patronem i uzyskaj dostęp do strefy premium' })).toBeInTheDocument();
    const group = within(dialog).getByRole('group', { name: 'Wybierz dostęp' });
    const cards = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(cards.map((r) => r.value)).toEqual(['ACCESS_30D', 'ACCESS_LIFETIME']);
    expect(cards.map((r) => r.checked)).toEqual([false, true]);
    expect(within(group).getByText('Dostęp na 30 dni')).toBeInTheDocument();
    expect(within(group).getByText('Dostęp bez limitu')).toBeInTheDocument();
    expect(within(group).getByText('jednorazowo, 30 dni')).toBeInTheDocument();
    expect(within(group).getByText('Najlepsza wartość')).toBeInTheDocument();
    expect(within(group).getAllByText('Najlepsza wartość')).toHaveLength(1);
    expect(within(dialog).queryByRole('textbox')).toBeNull(); // no custom amount field
    expect(within(dialog).queryByText(/Zapłać ile chcesz/)).toBeNull();
    expect(within(dialog).getByRole('combobox', { name: 'Metoda płatności' })).toBeInTheDocument();
    // no checkbox here: the consent is given in step 2
    expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(dialog).getByRole('link', { name: 'Regulamin strefy patrona' })).toHaveAttribute('href', '/regulamin-premium');
    expect(within(dialog).getByRole('link', { name: 'Polityka prywatności' })).toHaveAttribute('href', expect.stringContaining('polityka-prywatnosci'));
    expect(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeInTheDocument();
    expect(dialog.querySelector('[data-demo-ribbon]')).toBeNull();
  });

  it('has a step indicator and announces the step', async () => {
    open();
    const dialog = await screen.findByRole('dialog');
    const steps = within(dialog).getByRole('list', { name: 'Etapy zakupu' });
    const items = within(steps).getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).not.toHaveAttribute('aria-current');
    expect(within(dialog).getByText('Krok 1 z 2')).toHaveAttribute('aria-live', 'polite');
  });

  it('the dropdown works from the keyboard and lists the available methods', async () => {
    open();
    const combo = await screen.findByRole('combobox', { name: 'Metoda płatności' });
    expect(combo).toHaveAttribute('aria-expanded', 'false');
    combo.focus();
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(combo).toHaveAttribute('aria-expanded', 'true');
    const list = await screen.findByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('BLIK'), expect.stringContaining('Przelewy24'), expect.stringContaining('Karta')]);
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(combo).toHaveAttribute('aria-expanded', 'false');
    expect(combo).toHaveTextContent('Przelewy24');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Escape' });
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });

  it('choosing an option updates the summary and the button price (brutto, VAT 23%)', async () => {
    open();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Razem do zapłaty (brutto)').parentElement).toHaveTextContent('29,99');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Dostęp na 30 dni/ }));
    expect(within(dialog).getByRole('button', { name: N('Dalej · 14,99 zł') })).toBeInTheDocument();
    expect(within(dialog).getByText('Razem do zapłaty (brutto)').parentElement).toHaveTextContent('14,99');
    expect(within(dialog).getByText('kwota brutto, zawiera 23% VAT')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Dostęp bez limitu/ }));
    expect(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeInTheDocument();
  });

  it('with unlimited access already held: says so and offers nothing to buy', async () => {
    route({ '/api/user/premium-pass?': () => new Response(JSON.stringify({ offer: {}, pass: { ...activePass('STRIPE'), lifetime: true, expiresAt: null } }), { status: 200 }) });
    open();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Masz już dostęp bez limitu.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeDisabled();
    for (const radio of within(dialog).getAllByRole('radio')) expect(radio).toBeDisabled();
  });

  it('a running 30-day access explains extension and conversion', async () => {
    route({ '/api/user/premium-pass?': () => new Response(JSON.stringify({ offer: {}, pass: activePass('STRIPE') }), { status: 200 }) });
    open();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Masz dostęp do 20\.11\.2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeEnabled();
  });
});

describe('patron checkout, step 2 in demo mode (simulated payment)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    window.sessionStorage.clear();
    route({ '/premium-pass/checkout': () => new Response(JSON.stringify({ pass: activePass('DEMO') }), { status: 200 }) });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('asks for both boxes HERE, shows errors instead of paying, then pays the chosen amount', async () => {
    const { onWatch } = open();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') }));

    const pay = await within(dialog).findByRole('button', { name: N('Zapłać 29,99 zł') });
    expect(within(dialog).getByRole('listitem', { current: 'step' })).toHaveAttribute('aria-label', 'Płatność');
    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(within(dialog).getByRole('checkbox', { name: /Akceptuję/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Zaznacz obie zgody, aby zapłacić.')).toBeInTheDocument();

    fireEvent.click(pay);
    expect(within(dialog).getAllByText('Zaznacz to pole, aby kontynuować.')).toHaveLength(2);
    expect(calls('/premium-pass/checkout')).toHaveLength(0);

    boxes.forEach((box) => fireEvent.click(box));
    fireEvent.click(within(dialog).getByRole('button', { name: N('Zapłać 29,99 zł') }));
    expect(await within(dialog).findByRole('heading', { name: 'Jesteś patronem. Dziękuję!' }, { timeout: 4000 })).toBeInTheDocument();
    expect(jsonBody('/premium-pass/checkout')).toMatchObject({ productId: 'ACCESS_LIFETIME', method: 'blik', consents: { terms: true, waiver: true }, simulate: 'success' });
    expect(dialog).toHaveTextContent('Strefa patrona jest otwarta do 20.11.2026');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wejdź do strefy patrona' }));
    expect(onWatch).toHaveBeenCalled();
  });

  it('"Zmień" goes back to step 1 with the choice kept', async () => {
    open();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Dostęp na 30 dni/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 14,99 zł') }));
    await within(dialog).findByRole('button', { name: N('Zapłać 14,99 zł') });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zmień' }));
    expect(await within(dialog).findByRole('button', { name: N('Dalej · 14,99 zł') })).toBeInTheDocument();
    expect((within(dialog).getByRole('radio', { name: /Dostęp na 30 dni/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('never asks Stripe for anything in demo mode', async () => {
    open();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') }));
    await within(dialog).findByRole('button', { name: N('Zapłać 29,99 zł') });
    expect(getStripeBrowser).not.toHaveBeenCalled();
    expect(calls('/intent')).toHaveLength(0);
    expect(screen.queryByTestId('stripe-elements')).toBeNull();
  });
});

describe('patron checkout, step 2 with real Stripe payments', () => {
  const READY = { paymentId: 'pay_1', clientSecret: 'pi_1_secret_x', paymentMethodTypes: ['blik', 'card', 'p24'], terminal: false };
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    confirmBlikPayment.mockReset();
    vi.mocked(getStripeBrowser).mockClear();
    window.sessionStorage.clear();
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

  it('test mode: labelled "Tryb testowy", Stripe.js is requested only now, the payment is created for the chosen product (no amount sent)', async () => {
    open({ mode: 'stripe', available: true, stripeMode: 'test' });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Tryb testowy')).toBeInTheDocument();
    await waitFor(() => expect(getStripeBrowser).toHaveBeenCalledTimes(1));
    fireEvent.click(within(dialog).getByRole('radio', { name: /Dostęp na 30 dni/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 14,99 zł') }));
    await within(dialog).findByTestId('stripe-elements');
    expect(jsonBody('/premium-pass/intent')).toMatchObject({ productId: 'ACCESS_30D' });
    expect(jsonBody('/premium-pass/intent').requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(jsonBody('/premium-pass/intent')).sort()).toEqual(['productId', 'requestId']);
  });

  it('live mode shows no test label', async () => {
    open({ mode: 'stripe', available: true, stripeMode: 'live' });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('Tryb testowy')).toBeNull();
  });

  it('the BLIK form is the tip gateway\'s; paying needs the code AND both boxes; consent is recorded before the confirmation; access shows after the server confirms', async () => {
    open({ mode: 'stripe', available: true, stripeMode: 'test' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') }));
    const code = await within(dialog).findByRole('textbox', { name: 'Kod BLIK' });
    const pay = within(dialog).getByRole('button', { name: N('Zapłać 29,99 zł') });
    fireEvent.change(code, { target: { value: '123456' } });
    expect(pay).toBeDisabled(); // boxes not ticked
    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[0]!);
    expect(pay).toBeDisabled();
    fireEvent.click(boxes[1]!);
    expect(pay).toBeEnabled();

    fireEvent.click(pay);
    expect(await within(dialog).findByRole('heading', { name: 'Jesteś patronem. Dziękuję!' }, { timeout: 4000 })).toBeInTheDocument();
    expect(jsonBody('/premium-pass/consent')).toEqual({ paymentId: 'pay_1', method: 'blik', consents: { terms: true, waiver: true } });
    expect(confirmBlikPayment).toHaveBeenCalledTimes(1);
    expect(confirmBlikPayment.mock.calls[0]![0]).toBe('pi_1_secret_x');
    // order: consent first, then the confirmation, then the status poll
    const order = fetchMock.mock.calls.map(([url]) => String(url));
    expect(order.findIndex((u) => u.includes('/consent'))).toBeLessThan(order.findIndex((u) => u.includes('/api/payments/pay_1')));
    // the browser never wrote access: it only read the status
    expect(calls('/premium-pass/checkout')).toHaveLength(0);
    expect(dialog).toHaveTextContent('Strefa patrona jest otwarta do 20.11.2026');
  });

  it('a failed consent write stops the payment before Stripe is asked', async () => {
    route({
      '/premium-pass/intent': () => new Response(JSON.stringify(READY), { status: 200 }),
      '/premium-pass/consent': () => new Response('{}', { status: 500 }),
    });
    open({ mode: 'stripe', available: true, stripeMode: 'test' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') }));
    const code = await within(dialog).findByRole('textbox', { name: 'Kod BLIK' });
    fireEvent.change(code, { target: { value: '123456' } });
    within(dialog).getAllByRole('checkbox').forEach((box) => fireEvent.click(box));
    fireEvent.click(within(dialog).getByRole('button', { name: N('Zapłać 29,99 zł') }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nie udało się zapisać Twojej zgody');
    expect(confirmBlikPayment).not.toHaveBeenCalled();
  });

  it('a method Stripe does not allow for this payment sends the viewer back to choose another, with a message', async () => {
    route({
      '/premium-pass/intent': () => new Response(JSON.stringify({ ...READY, paymentMethodTypes: ['card'] }), { status: 200 }),
    });
    open({ mode: 'stripe', available: true, stripeMode: 'test' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') })); // BLIK is the default
    expect(await within(dialog).findByText('Ta metoda nie jest dostępna dla tej płatności. Wybierz inną.')).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Metoda płatności' })).toHaveTextContent('Karta');
    expect(within(dialog).queryByTestId('stripe-elements')).toBeNull();
  });

  it('stripe mode that is not fully configured offers no payment and never falls back to the simulation', async () => {
    open({ mode: 'stripe', available: false });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Płatności są chwilowo niedostępne');
    expect(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') })).toBeDisabled();
    expect(getStripeBrowser).not.toHaveBeenCalled();
    expect(calls('/intent')).toHaveLength(0);
    expect(calls('/checkout')).toHaveLength(0);
  });

  it('a refusal from the server (unlimited already held) ends in "Masz już dostęp bez limitu", no payment form', async () => {
    route({ '/premium-pass/intent': () => new Response(JSON.stringify({ code: 'ALREADY_LIFETIME' }), { status: 409 }) });
    open({ mode: 'stripe', available: true, stripeMode: 'test' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: N('Dalej · 29,99 zł') }));
    expect(await within(dialog).findByRole('heading', { name: 'Masz już dostęp bez limitu' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Kod BLIK' })).toBeNull();
  });
});
