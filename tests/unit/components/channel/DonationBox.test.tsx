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

vi.mock('@clerk/nextjs', () => ({
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
      pleaseAcceptTerms: 'Zaakceptuj regulamin, aby otrzymać dostęp do Strefy Fenkju',
      acceptWithdrawal: 'Wyrażam zgodę na natychmiastowy dostęp i utratę prawa odstąpienia',
      pleaseAcceptWithdrawal: 'Potwierdź zgodę na natychmiastowy dostęp i utratę prawa odstąpienia',
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
    const { container } = renderDonationBox({ viewerIsPatron: false });

    expect(container.textContent).toContain('Jednorazowe wsparcie pomaga rozwijać kanał i odblokowuje dożywotni dostęp');
    expect(screen.getByText('Wspieraj tworzenie wartościowych treści')).toBeInTheDocument();
    expect(
      screen.getByText(/Twoje wsparcie pomaga w rozwoju kanału/),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders the tip-gate variant and an editable amount for an existing patron', async () => {
    const { container } = renderDonationBox({ viewerIsPatron: true });

    expect(screen.getByText('Bramka Napiwkowa 💰')).toBeInTheDocument();
    expect(screen.getByText('Nic tu nie kupujesz. Tu się tylko dziękuje.')).toBeInTheDocument();
    // The explanation is visible copy here (not sr-only as in the non-patron variant) and must
    // keep stating that this tip unlocks nothing.
    expect(container.textContent).toContain('Tutaj nie kupujesz absolutnie niczego');
    expect(container.textContent).toContain('Zero nowych obietnic — masz już wszystko');
    // The gate's sales bullets must not leak into the tip jar.
    expect(container.textContent).not.toContain('Dostęp do specjalnych materiałów');

    await waitFor(() => {
      expect(screen.getByText('Wpisz kwotę napiwku')).toBeInTheDocument();
      expect(screen.getByLabelText('Wpisz kwotę napiwku')).toBeInTheDocument();
    });

    // The amount field must start empty (just the cursor/placeholder) rather than
    // pre-filled with a suggested amount — a patron picks their own amount freely.
    expect(screen.getByLabelText('Wpisz kwotę napiwku')).toHaveValue(null);
  });

  it('requires the withdrawal-consent checkbox separately from the Terms/Privacy checkbox before checkout proceeds', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/checkout/create-intent') {
        return Promise.resolve({ ok: true, json: async () => ({ clientSecret: 'cs_test', paymentId: 'pay_1' }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          limits: { PLN: { minAmount: 10 }, USD: { minAmount: 10 }, EUR: { minAmount: 10 }, CHF: { minAmount: 10 }, GBP: { minAmount: 10 } },
          patronThresholds: { PLN: { threshold: 20 }, USD: { threshold: 20 }, EUR: { threshold: 20 }, CHF: { threshold: 20 }, GBP: { threshold: 20 } },
        }),
      });
    }) as unknown as typeof fetch;

    const { container } = renderDonationBox({ viewerIsPatron: false });
    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Wspieram').closest('button')!;
    const termsCheckbox = container.querySelector('#donation-accept-terms')!;
    const withdrawalCheckbox = container.querySelector('#donation-accept-withdrawal')!;

    // Neither checkbox checked yet: clicking submit surfaces the Terms error first.
    fireEvent.click(submitButton);
    expect(await screen.findByText('Zaakceptuj regulamin, aby otrzymać dostęp do Strefy Fenkju')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());

    // Accepting only the Terms/Privacy checkbox is not enough — the separate withdrawal
    // consent (required by art. 38(1)(13) of the Polish Consumer Rights Act) must also be given.
    fireEvent.click(termsCheckbox);
    fireEvent.click(submitButton);
    expect(await screen.findByText('Potwierdź zgodę na natychmiastowy dostęp i utratę prawa odstąpienia')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());

    // With both explicit consents given, checkout proceeds.
    fireEvent.click(withdrawalCheckbox);
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/checkout/create-intent', expect.anything());
    });
  });
});
