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

// Mutable so each test can drive the Stripe return URL params (success / redirect_status).
let returnParams = new URLSearchParams();
const routerReplace = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user_123' }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'user@example.com' } } }),
  useClerk: () => ({ openSignIn: vi.fn() }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => returnParams,
  useRouter: () => ({ refresh: vi.fn(), replace: routerReplace }),
}));

vi.mock('@/app/hooks/useToast', () => ({ useToast: () => vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('@/app/components/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pl',
    t: { currency: 'PLN', pleaseAcceptTerms: 'Zaakceptuj regulamin', tipTheGuy: 'Wspieram' },
  }),
}));

function renderDonationBox() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DonationBox />
    </QueryClientProvider>,
  );
}

describe('DonationBox — Stripe return flow', () => {
  beforeEach(() => {
    // Settings fetch + any status poll: default OK. Individual tests can override.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
        patronThresholds: { PLN: { threshold: 20 }, USD: { threshold: 20 }, EUR: { threshold: 20 }, CHF: { threshold: 20 }, GBP: { threshold: 20 } },
        uiStatus: 'ACCESS_SYNC_PENDING',
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    returnParams = new URLSearchParams();
  });

  it('shows the success message immediately on redirect_status=succeeded without any "confirming/webhook" jargon', async () => {
    returnParams = new URLSearchParams('success=true&payment_id=pay_1&redirect_status=succeeded');

    renderDonationBox();

    // The thank-you + confirmed copy appear from Stripe's redirect signal alone, without
    // waiting on any backend poll.
    await waitFor(() => {
      expect(screen.getByText('Wielkie dzięki!')).toBeInTheDocument();
    });
    expect(screen.getByText('Wpłata potwierdzona, a dostęp Patrona jest aktywny.')).toBeInTheDocument();

    // No internal jargon or pending-style captions leak to the user.
    expect(document.body.textContent).not.toMatch(/webhook/i);
    expect(document.body.textContent).not.toMatch(/PENDING_WEBHOOK/);
    expect(document.body.textContent).not.toMatch(/Czekamy/i);
  });

  it('shows a failure header on redirect_status=failed (no green thank-you)', async () => {
    returnParams = new URLSearchParams('success=true&payment_id=pay_2&redirect_status=failed');

    renderDonationBox();

    await waitFor(() => {
      expect(screen.getByText('Coś poszło nie tak')).toBeInTheDocument();
    });
    expect(screen.queryByText('Wielkie dzięki!')).not.toBeInTheDocument();
  });
});
