/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mocks = vi.hoisted(() => ({ routerReplace: vi.fn(), routerPush: vi.fn() }));

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ userId: 'user_123' }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'user@example.com' } } }),
}));
vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), replace: mocks.routerReplace, push: mocks.routerPush }),
  usePathname: () => '/',
}));
vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useCheckoutFlow } from '@/lib/hooks/useCheckoutFlow';
import { createTx } from "@/lib/i18n/ui";

function renderFlow() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCheckoutFlow({ tx: createTx("pl") }), { wrapper });
}

describe('useCheckoutFlow — closing the checkout without paying', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('never triggers a router navigation (which re-rendered the whole page on the server)', () => {
    window.history.replaceState(null, '', '/?v=video-2');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { result } = renderFlow();

    act(() => result.current.closeSuccessAndSync());

    expect(mocks.routerReplace).not.toHaveBeenCalled();
    expect(mocks.routerPush).not.toHaveBeenCalled();
    // No Stripe return params in the URL → nothing to strip, the address is left alone.
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?v=video-2');
  });

  it('strips only Stripe return params, shallowly, keeping the open video', () => {
    window.history.replaceState(null, '', '/?v=video-2&success=true&payment_id=pay_1&redirect_status=failed');
    const { result } = renderFlow();

    act(() => result.current.closeSuccessAndSync());

    expect(mocks.routerReplace).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?v=video-2');
  });
});
