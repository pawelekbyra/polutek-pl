/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import DonationBox from '@/app/components/channel/DonationBox';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user_123' }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'user@example.com' } } }),
  useClerk: () => ({ openSignIn: vi.fn() }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

// Simulates the Navbar/Hero "Wspieraj" deep-link: arriving with ?support=1 already
// in the URL, matching how DonationBox first mounts after the button's click.
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('support=1'),
  useRouter: () => ({ refresh: vi.fn(), replace: mockReplace }),
  usePathname: () => '/',
}));

vi.mock('@/app/hooks/useToast', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl',
    t: {
      currency: 'PLN',
      pleaseAcceptTerms: 'Zaakceptuj regulamin i politykę prywatności',
      tipTheGuy: 'Wspieram',
    },
  }),
}));

function renderDonationBox(props: Partial<React.ComponentProps<typeof DonationBox>> = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DonationBox {...props} />
    </QueryClientProvider>,
  );
}

describe('DonationBox ?support=1 deep-link auto-submit', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
        patronThresholds: { PLN: { threshold: 20 }, USD: { threshold: 20 }, EUR: { threshold: 20 }, CHF: { threshold: 20 }, GBP: { threshold: 20 } },
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not surface the "accept the terms" error just from the deep-link mount, before any real payment attempt', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderDonationBox();

    // Give the settings-loading effect and the ?support=1 effect a chance to run.
    await waitFor(() => {
      expect(screen.getByLabelText('Wpisz kwotę napiwku')).toBeInTheDocument();
      expect(replaceState).toHaveBeenCalled();
    });

    // Terms start unchecked (no persistence across mounts) — the deep-link effect must
    // not call the full onSupport() unconditionally, which would flag this error before
    // the viewer has even seen the box.
    expect(screen.queryByText('Zaakceptuj regulamin i politykę prywatności')).not.toBeInTheDocument();
    expect(global.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalledWith(
      '/api/checkout/create-intent',
      expect.anything(),
    );

    // The ?support=1 param is still stripped — shallowly, without a server re-render.
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
