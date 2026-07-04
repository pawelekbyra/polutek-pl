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
  useClerk: () => ({ openSignIn: vi.fn() }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
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
      pleaseAcceptTerms: 'Zaakceptuj regulamin, aby otrzymać dostęp do Strefy Fenkju',
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

describe('DonationBox', () => {
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

  it('renders the access-granting copy and a fixed, non-editable amount for a non-patron viewer', async () => {
    renderDonationBox({ viewerIsPatron: false });

    expect(screen.getByText('Zostań Patronem Projektu')).toBeInTheDocument();
    expect(screen.getByText('Wspieraj POLUTEK.PL i wbijaj do Strefy Fenkju')).toBeInTheDocument();
    expect(
      screen.getByText(/Na razie niewiele materiałów, ale dzięki Tobie będzie ich coraz więcej/),
    ).toBeInTheDocument();
    expect(screen.getByText(/sfinansuje rozwój kanału POLUTEK.PL/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders the no-new-benefit copy and an editable amount for an existing patron', async () => {
    renderDonationBox({ viewerIsPatron: true });

    expect(screen.getByText('Masz już dostęp do Strefy Fenkju')).toBeInTheDocument();
    expect(screen.getByText(/nie odblokowuje niczego nowego|niczego nowego nie odblokowuje/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText(/Dowolna kwota \(min\. 10 PLN\)/)).toBeInTheDocument();
    });
  });
});
