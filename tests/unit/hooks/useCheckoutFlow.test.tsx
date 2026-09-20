/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCheckoutFlow } from '@/lib/hooks/useCheckoutFlow';

// This exercises the shared checkout plumbing (useCheckoutFlow) in isolation — the settings
// fetch, terms/modal state, and the create-intent -> CheckoutModal handoff — independent of any
// of the three components (DonationBox, SecretPledgeBox, SecretPledgeBox2) that consume it. Their
// own component tests already cover the Stripe return-URL reconciliation loop end-to-end
// (tests/unit/components/channel/DonationBox-return-flow.test.tsx) and the ?support=1 deep-link
// guard (DonationBox-deep-link-terms.test.tsx), which stays out of this hook entirely.

const openAuthModal = vi.fn();
const toast = vi.fn();
let authState: { userId: string | null } = { userId: 'user_123' };

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'user@example.com' } } }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: openAuthModal, close: vi.fn(), isOpen: false }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/app/hooks/useToast', () => ({
  useToast: () => toast,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function renderCheckoutFlow(
  overrides: Partial<Parameters<typeof useCheckoutFlow>[0]> = {},
) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useCheckoutFlow({
        isPl: true,
        logPrefix: 'TestBox',
        title: 'Test Title',
        getMinAmountTooLowMessage: (min, currency) => `Minimalna kwota to ${min} ${currency}`,
        attemptFinishedMessage: 'Ta próba płatności jest zakończona.',
        ...overrides,
      }),
    { wrapper },
  );
}

describe('useCheckoutFlow', () => {
  beforeEach(() => {
    authState = { userId: 'user_123' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
        patronThresholds: { PLN: { threshold: 20 }, USD: { threshold: 20 }, EUR: { threshold: 20 }, CHF: { threshold: 20 }, GBP: { threshold: 20 } },
        patronBoxMinimums: { PLN: { min: 5 }, USD: { min: 5 }, EUR: { min: 5 }, CHF: { min: 5 }, GBP: { min: 5 } },
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('fetches /api/payment-settings once and populates minimums/thresholds', async () => {
    const { result } = renderCheckoutFlow();

    expect(result.current.isInitialLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(false);
    });

    expect(result.current.patronThresholds.PLN).toBe(20);
    expect(result.current.patronBoxMinimums.PLN).toBe(5);
    expect(global.fetch).toHaveBeenCalledWith('/api/payment-settings', { cache: 'no-store' });
  });

  it('opens the auth modal instead of calling create-intent when signed out', async () => {
    authState = { userId: null };
    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    await act(async () => {
      await result.current.submit(50, 'PLN', 20);
    });

    expect(openAuthModal).toHaveBeenCalledWith('sign-in');
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
  });

  it('sets showTermsError instead of calling create-intent when terms are not accepted', async () => {
    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.isTermsAccepted).toBe(false);

    await act(async () => {
      await result.current.submit(50, 'PLN', 20);
    });

    expect(result.current.showTermsError).toBe(true);
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
  });

  it('onTermsCheckedChange accepts terms and clears a shown error', async () => {
    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    await act(async () => {
      await result.current.submit(50, 'PLN', 20);
    });
    expect(result.current.showTermsError).toBe(true);

    act(() => {
      result.current.onTermsCheckedChange(true);
    });

    expect(result.current.isTermsAccepted).toBe(true);
    expect(result.current.showTermsError).toBe(false);
  });

  it('sets showWithdrawalError instead of calling create-intent when terms are accepted but withdrawal consent is not', async () => {
    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.onTermsCheckedChange(true);
    });
    expect(result.current.isWithdrawalAcknowledged).toBe(false);

    await act(async () => {
      await result.current.submit(50, 'PLN', 20);
    });

    expect(result.current.showWithdrawalError).toBe(true);
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
  });

  it('onWithdrawalCheckedChange accepts the withdrawal consent and clears a shown error', async () => {
    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.onTermsCheckedChange(true);
    });
    await act(async () => {
      await result.current.submit(50, 'PLN', 20);
    });
    expect(result.current.showWithdrawalError).toBe(true);

    act(() => {
      result.current.onWithdrawalCheckedChange(true);
    });

    expect(result.current.isWithdrawalAcknowledged).toBe(true);
    expect(result.current.showWithdrawalError).toBe(false);
  });

  it('toasts the caller-provided min-amount message and skips create-intent when the amount is too low', async () => {
    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.onTermsCheckedChange(true);
      result.current.onWithdrawalCheckedChange(true);
    });

    await act(async () => {
      await result.current.submit(5, 'PLN', 20);
    });

    expect(toast).toHaveBeenCalledWith('Minimalna kwota to 20 PLN', 'error');
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
  });

  it('posts the exact create-intent request body and opens the checkout modal on a clientSecret response', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/payment-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
            patronThresholds: { PLN: { threshold: 20 }, USD: { threshold: 20 }, EUR: { threshold: 20 }, CHF: { threshold: 20 }, GBP: { threshold: 20 } },
          }),
        });
      }
      if (url === '/api/checkout/create-intent') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clientSecret: 'cs_test_123', paymentId: 'pay_1' }),
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderCheckoutFlow({ title: 'Napiwek / Patron' });
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.onTermsCheckedChange(true);
      result.current.onWithdrawalCheckedChange(true);
    });

    await act(async () => {
      await result.current.submit(50, 'pln', 20);
    });

    const createIntentCall = fetchMock.mock.calls.find(([url]) => url === '/api/checkout/create-intent');
    expect(createIntentCall).toBeDefined();
    const [, init] = createIntentCall!;
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      amountMinor: 5000,
      currency: 'PLN',
      title: 'Napiwek / Patron',
      requestId: expect.any(String),
    });

    expect(result.current.clientSecret).toBe('cs_test_123');
    expect(result.current.paymentId).toBe('pay_1');
    expect(result.current.isCheckoutModalOpen).toBe(true);
  });

  it('toasts the attempt-finished message and clears state on a terminal response', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/payment-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
            patronThresholds: { PLN: { threshold: 20 }, USD: { threshold: 20 }, EUR: { threshold: 20 }, CHF: { threshold: 20 }, GBP: { threshold: 20 } },
          }),
        });
      }
      if (url === '/api/checkout/create-intent') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ terminal: true, status: 'FAILED_CANCELED', paymentId: 'pay_2' }),
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderCheckoutFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    act(() => {
      result.current.onTermsCheckedChange(true);
      result.current.onWithdrawalCheckedChange(true);
    });

    await act(async () => {
      await result.current.submit(50, 'PLN', 20);
    });

    expect(toast).toHaveBeenCalledWith('Ta próba płatności jest zakończona.', 'error');
    expect(result.current.paymentUiStatus).toBe('FAILED_CANCELED');
    expect(result.current.isCheckoutModalOpen).toBe(false);
  });
});
