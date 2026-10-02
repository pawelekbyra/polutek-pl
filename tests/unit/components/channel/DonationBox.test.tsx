/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import DonationBox from '@/app/components/channel/DonationBox';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ userId: 'user_123' }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'user@example.com' } } }),
  useClerk: () => ({ openSignIn: vi.fn() }),
}));

vi.mock('@/app/components/auth/AuthModalProvider', () => ({
  useAuthModal: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
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

  it('renders the tip jar, promises nothing in return and starts with an empty free amount', async () => {
    const { container } = renderDonationBox();

    expect(screen.getByText('Bramka Napiwkowa 💰')).toBeInTheDocument();
    expect(container.textContent).toContain('Bez wsparcia widzów tego projektu by nie było. Dziękuję.');
    // Support is a gift (CLAUDE.md §4.10): no access/benefit promises anywhere in the box.
    expect(container.textContent).not.toMatch(/Strefy Fenkjuu|dożywotni|Dostęp do specjalnych materiałów/);

    await waitFor(() => {
      expect(screen.getByLabelText('Wpisz kwotę napiwku')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Wpisz kwotę napiwku')).toHaveValue(null);
  });

  it('requires only the Terms/Privacy checkbox before checkout proceeds', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/checkout/create-intent') {
        return Promise.resolve({ ok: true, json: async () => ({ clientSecret: 'cs_test', paymentId: 'pay_1' }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
        }),
      });
    }) as unknown as typeof fetch;

    const { container } = renderDonationBox();
    const submitButton = screen.getByText('Wyślij napiwek').closest('button')!;
    fireEvent.change(await screen.findByLabelText('Wpisz kwotę napiwku'), { target: { value: '25' } });
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    fireEvent.click(submitButton);
    expect(await screen.findByText('Zaakceptuj regulamin i politykę prywatności')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
    expect(container.querySelector('#donation-accept-withdrawal')).toBeNull();

    fireEvent.click(container.querySelector('#donation-accept-terms')!);
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
    });
  });
});
