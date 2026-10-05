/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCheckoutFlow } from '@/lib/hooks/useCheckoutFlow';
import { createTx } from "@/lib/i18n/ui";

const openAuthModal = vi.fn();
const toast = vi.fn();
let authState: { userId: string | null } = { userId: 'user_123' };
let searchParams = new URLSearchParams();

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => authState,
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'user@example.com' } } }),
}));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: openAuthModal, close: vi.fn(), isOpen: false }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

type IntentBody = { amountMinor: number; currency: string; requestId: string };
let intentResponses: Array<{ status?: number; body: Record<string, unknown> }> = [];
const intentRequests: IntentBody[] = [];

function renderFlow() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCheckoutFlow({ tx: createTx("pl") }), { wrapper });
}

beforeEach(() => {
  authState = { userId: 'user_123' };
  searchParams = new URLSearchParams();
  intentResponses = [];
  intentRequests.length = 0;
  window.sessionStorage.clear();
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/payment-settings') {
      return { ok: true, json: async () => ({ limits: { PLN: { minAmount: 7 }, EUR: { minAmount: 3 } } }) } as Response;
    }
    if (url === '/api/checkout/create-intent') {
      intentRequests.push(JSON.parse(String(init?.body)));
      const next = intentResponses.shift() ?? { body: { clientSecret: 'cs_1', paymentId: 'pay_1', paymentMethodTypes: ['card'] } };
      return { ok: (next.status ?? 200) < 400, status: next.status ?? 200, json: async () => next.body } as Response;
    }
    if (String(url).startsWith('/api/payments/')) {
      return { ok: true, json: async () => ({ uiStatus: 'SUCCEEDED' }) } as Response;
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useCheckoutFlow', () => {
  it('uses the one server minimum per currency', async () => {
    const { result } = renderFlow();
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(result.current.minimums.PLN).toBe(7);
    expect(result.current.minimums.EUR).toBe(3);
  });

  it('sends signed-out viewers to sign in instead of calling the API', async () => {
    authState = { userId: null };
    const { result } = renderFlow();
    let ready = true;
    await act(async () => {
      ready = await result.current.submit(10, 'PLN', 5);
    });
    expect(ready).toBe(false);
    expect(openAuthModal).toHaveBeenCalledWith('sign-in');
    expect(intentRequests).toHaveLength(0);
  });

  it('blocks an amount under the minimum', async () => {
    const { result } = renderFlow();
    await act(async () => {
      await result.current.submit(2, 'PLN', 5);
    });
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('5 PLN'), 'error');
    expect(intentRequests).toHaveLength(0);
  });

  it('keeps one attempt id while the amount changes, so the server updates one intent (PAY-08)', async () => {
    const { result } = renderFlow();
    await act(async () => {
      await result.current.submit(10, 'PLN', 5);
    });
    await act(async () => {
      await result.current.submit(25, 'EUR', 3);
    });

    expect(intentRequests).toHaveLength(2);
    expect(intentRequests[0]).toMatchObject({ amountMinor: 1000, currency: 'PLN' });
    expect(intentRequests[1]).toMatchObject({ amountMinor: 2500, currency: 'EUR' });
    expect(intentRequests[0].requestId).toBe(intentRequests[1].requestId);
    expect(result.current.clientSecret).toBe('cs_1');
  });

  it('reuses the attempt after the gate is closed and opened again in the same tab', async () => {
    const first = renderFlow();
    await act(async () => {
      await first.result.current.submit(10, 'PLN', 5);
    });
    first.unmount();

    const second = renderFlow();
    await act(async () => {
      await second.result.current.submit(10, 'PLN', 5);
    });

    expect(intentRequests[0].requestId).toBe(intentRequests[1].requestId);
  });

  it('starts a new attempt automatically when the stored one is finished', async () => {
    intentResponses = [
      { body: { paymentId: 'pay_old', clientSecret: null, status: 'CANCELED', terminal: true } },
      { body: { clientSecret: 'cs_new', paymentId: 'pay_new', paymentMethodTypes: ['blik'] } },
    ];
    const { result } = renderFlow();
    let ready = false;
    await act(async () => {
      ready = await result.current.submit(10, 'PLN', 5);
    });

    expect(ready).toBe(true);
    expect(intentRequests).toHaveLength(2);
    expect(intentRequests[0].requestId).not.toBe(intentRequests[1].requestId);
    expect(result.current.paymentId).toBe('pay_new');
  });

  it('shows a generic message, never the server error text', async () => {
    intentResponses = [{ status: 502, body: { error: 'PAYMENT_PROVIDER_ERROR', message: 'details' } }];
    const { result } = renderFlow();
    await act(async () => {
      await result.current.submit(10, 'PLN', 5);
    });
    expect(toast).toHaveBeenCalledWith('Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.', 'error');
  });

  it('a confirmed payment finishes the attempt, so the next tip gets a new one', async () => {
    const { result } = renderFlow();
    await act(async () => {
      await result.current.submit(10, 'PLN', 5);
    });
    act(() => result.current.trackConfirmedPayment('pay_1', 'succeeded'));
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.paymentUiStatus).toBe('SUCCEEDED');

    act(() => result.current.resetCheckout());
    await act(async () => {
      await result.current.submit(10, 'PLN', 5);
    });
    expect(intentRequests[0].requestId).not.toBe(intentRequests[1].requestId);
  });

  it('a Stripe redirect return with redirect_status=failed shows the failure screen', async () => {
    searchParams = new URLSearchParams('success=true&payment_id=pay_9&redirect_status=failed');
    const { result } = renderFlow();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.paymentUiStatus).toBe('FAILED');
  });

  it('a Stripe redirect return that is still processing upgrades to success once recorded', async () => {
    searchParams = new URLSearchParams('success=true&payment_id=pay_9&redirect_status=processing');
    const { result } = renderFlow();
    await waitFor(() => expect(result.current.paymentUiStatus).toBe('SUCCEEDED'));
  });
});
