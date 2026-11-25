/** @vitest-environment jsdom */
// patron zone (docs/architecture/patron-zone.md, "Premium od razu po płatności"): right after the server records the
// payment (the payment-status endpoint checks Stripe itself), the checkout announces it once and every surface asks the
// server again without a reload: avatar ring / role (Navbar -> /api/user/profile), Hero button, the video gate
// (PremiumPassOverlay -> plan refresh), the account panel (usePremiumPassStatus), router.refresh() and comment caches.
// The browser never grants anything: no success, no announcement.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { buildPremiumPassOffer } from '@/lib/modules/patron-zone/domain/offer';

const auth = { userId: 'u1' as string | null, isLoaded: true };
vi.mock('@/lib/auth/react', () => ({
  useAuth: () => auth,
  useUser: () => ({
    user: auth.userId ? { id: auth.userId, primaryEmailAddress: { emailAddress: 'pawel.perfect@gmail.com' } } : null,
    isLoaded: true,
    isSignedIn: Boolean(auth.userId),
  }),
}));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl'), t: {}, setLanguage: vi.fn() }) }));
const openAuthModal = vi.fn();
vi.mock('@/app/components/auth/AuthModalProvider', () => ({ useAuthModal: () => ({ open: openAuthModal }) }));
const routerRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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
const { PremiumPassOverlay } = await import('@/app/components/premium-pass/PremiumPassOverlay');
const { PatronCheckoutHostContext } = await import('@/app/components/premium-pass/PatronCheckoutHost');
const { PASS_ACTIVATED_EVENT, announcePassActivated } = await import('@/app/components/premium-pass/pass-activation');
const { PremiumPassSync } = await import('@/app/components/premium-pass/PremiumPassSync');
const { pollPatronPayment, usePremiumPassStatus } = await import('@/app/components/premium-pass/usePremiumPass');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');

const N = (text: string) => (name: string) => name.replace(/\s/g, ' ') === text;
const fetchMock = vi.fn();
const calls = (needle: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(needle));
const TEST = { mode: 'stripe', available: true, stripeMode: 'test' } as const;
const READY = { paymentId: 'pay_1', clientSecret: 'pi_1_secret_x', paymentMethodTypes: ['blik', 'card', 'p24'], terminal: false };
const ACTIVE = {
  state: 'active', lifetime: false, productId: 'ACCESS_3M', provider: 'STRIPE', ref: 'pay_1', expiresAt: '2027-02-20T10:00:00.000Z', grantedAt: '2026-11-20T10:00:00.000Z',
  method: 'blik', priceMinor: 2999, currency: 'PLN', totalMinor: 2999, waiverAt: '2026-11-20T10:00:00.000Z',
};

function route(paymentStatuses: string[]) {
  let polled = 0;
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes('/premium-pass/intent')) return new Response(JSON.stringify(READY), { status: 200 });
    if (u.includes('/premium-pass/consent')) return new Response(JSON.stringify({ recorded: true }), { status: 200 });
    if (u.includes('/api/payments/pay_1')) {
      const uiStatus = paymentStatuses[Math.min(polled++, paymentStatuses.length - 1)];
      return new Response(JSON.stringify({ uiStatus }), { status: 200 });
    }
    if (u.startsWith('/api/user/premium-pass')) return new Response(JSON.stringify({ offer: {}, pass: ACTIVE }), { status: 200 });
    if (u.startsWith('/api/user/profile')) return new Response(JSON.stringify({ isAdmin: false, role: 'VIP' }), { status: 200 });
    return new Response('{}', { status: 404 });
  });
}

function countActivations() {
  const seen = { count: 0 };
  const listener = () => { seen.count += 1; };
  window.addEventListener(PASS_ACTIVATED_EVENT, listener);
  return { seen, stop: () => window.removeEventListener(PASS_ACTIVATED_EVENT, listener) };
}

async function payWithBlik() {
  const dialog = within(await screen.findByRole('dialog'));
  fireEvent.click(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') }));
  await dialog.findByRole('heading', { name: 'Metoda płatności' });
  fireEvent.click(dialog.getByRole('button', { name: N('Dalej · 29,99 zł') }));
  fireEvent.change(await dialog.findByRole('textbox', { name: 'Kod BLIK' }), { target: { value: '123456' } });
  dialog.getAllByRole('checkbox').forEach((box) => fireEvent.click(box));
  fireEvent.click(dialog.getByRole('button', { name: N('Zapłać 29,99 zł') }));
  return dialog;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  confirmBlikPayment.mockReset();
  routerRefresh.mockReset();
  openAuthModal.mockReset();
  auth.userId = 'u1';
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/?v=jj');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('checkout: access shows at once after the server confirms the payment', () => {
  it('Stripe still processing, then recorded: polls every second, shows what was unlocked, announces the activation once', async () => {
    route(['PROCESSING', 'PROCESSING', 'SUCCEEDED']);
    confirmBlikPayment.mockResolvedValue({ paymentIntent: { status: 'processing' } });
    const { seen, stop } = countActivations();
    render(<PassCheckoutSheet open onOpenChange={() => undefined} offer={buildPremiumPassOffer({ signedIn: true, premiumCount: 7, payments: TEST })} onWatch={vi.fn()} />);
    const started = Date.now();
    const dialog = await payWithBlik();

    expect(await dialog.findByRole('heading', { name: 'Masz Premium. Dziękuję!' }, { timeout: 6000 })).toBeInTheDocument();
    expect(Date.now() - started).toBeLessThan(5000); // ~1 s between the status checks, not 2 s
    expect(calls('/api/payments/pay_1')).toHaveLength(3);
    expect(dialog.getByText('Wszystkie filmy Strefy Premium (7)')).toBeInTheDocument();
    expect(seen.count).toBe(1);
    expect(calls('/premium-pass/checkout')).toHaveLength(0); // the browser never writes access
    stop();
  }, 10_000);

  it('a failed payment shows the failure and announces nothing', async () => {
    route(['FAILED']);
    confirmBlikPayment.mockResolvedValue({ paymentIntent: { status: 'processing' } });
    const { seen, stop } = countActivations();
    render(<PassCheckoutSheet open onOpenChange={() => undefined} offer={buildPremiumPassOffer({ signedIn: true, premiumCount: 2, payments: TEST })} onWatch={vi.fn()} />);
    const dialog = await payWithBlik();
    expect(await dialog.findByRole('heading', { name: 'Płatność nie przeszła' }, { timeout: 4000 })).toBeInTheDocument();
    expect(seen.count).toBe(0);
    stop();
  });

  it('pollPatronPayment: asks every interval, gives up as PENDING (no access) when Stripe never succeeds', async () => {
    route(['PROCESSING']);
    const result = await pollPatronPayment('pay_1', { attempts: 4, intervalMs: 5 });
    expect(result).toBe('PENDING');
    expect(calls('/api/payments/pay_1')).toHaveLength(4);
  });
});

describe('every surface asks the server again after the activation', () => {
  it('PremiumPassSync: router.refresh() and the comment caches are re-asked', async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(<QueryClientProvider client={client}><PremiumPassSync /></QueryClientProvider>);
    act(() => announcePassActivated());
    expect(routerRefresh).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['comments'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['comment-replies'] });
  });

  it('account panel status (usePremiumPassStatus) reloads; a disabled one does not', async () => {
    route(['SUCCEEDED']);
    const { result } = renderHook(() => usePremiumPassStatus(true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    renderHook(() => usePremiumPassStatus(false));
    const before = calls('/api/user/premium-pass').length;
    act(() => announcePassActivated());
    await waitFor(() => expect(calls('/api/user/premium-pass').length).toBe(before + 1));
  });

  it('the video gate in Hero: opens the host checkout (no local one) and re-asks the plan at once', async () => {
    route(['SUCCEEDED']);
    const opened = vi.fn();
    window.addEventListener('polutek:open-patron', opened);
    const onRefresh = vi.fn();
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, payments: TEST });
    render(
      <PatronCheckoutHostContext.Provider value={true}>
        <PremiumPassOverlay offer={offer} poster={null} title="Film" variant="default" onRefresh={onRefresh} />
      </PatronCheckoutHostContext.Provider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Kup Premium/ })[0]!);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => announcePassActivated());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    window.removeEventListener('polutek:open-patron', opened);
  });

  it('a gate with its own checkout (no host) waits until that checkout is closed, so the success screen is not unmounted', async () => {
    route(['SUCCEEDED']);
    const onRefresh = vi.fn();
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2, payments: TEST });
    render(<PremiumPassOverlay offer={offer} poster={null} title="Film" variant="default" onRefresh={onRefresh} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Kup Premium/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    act(() => announcePassActivated());
    expect(onRefresh).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('Navbar asks /api/user/profile again (the avatar ring turns VIP)', async () => {
    vi.doMock('@/app/components/auth/UserMenu', () => ({ default: ({ role }: { role: string | null }) => <span data-testid="role">{role ?? 'none'}</span> }));
    vi.doMock('@/app/components/notifications/NotificationBell', () => ({ default: () => null }));
    vi.doMock('@/app/components/LanguageSwitcher', () => ({ default: () => null }));
    vi.doMock('@/app/components/useSwitchLanguage', () => ({ useSwitchLanguage: () => vi.fn() }));
    vi.doMock('@/app/components/TopbarPremiere', () => ({ default: () => null, TopbarPremiereSpacer: () => null, isTopbarPremiereActive: () => false }));
    vi.doMock('@/app/components/BrandHomeLink', () => ({ default: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> }));
    let role = 'BASE';
    fetchMock.mockImplementation(async (url: string) =>
      String(url).startsWith('/api/user/profile') ? new Response(JSON.stringify({ isAdmin: false, role }), { status: 200 }) : new Response('{}', { status: 404 }));
    const { default: Navbar } = await import('@/app/components/Navbar');
    render(<Navbar />);
    await waitFor(() => expect(screen.getAllByTestId('role')[0]).toHaveTextContent('BASE'));
    role = 'VIP';
    act(() => announcePassActivated());
    await waitFor(() => expect(screen.getAllByTestId('role')[0]).toHaveTextContent('VIP'));
    expect(calls('/api/user/profile')).toHaveLength(2);
  });
});
