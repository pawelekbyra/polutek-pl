/** @vitest-environment jsdom */
// experiment: premium-pass (docs/experiments/premium-pass.md, section 15): the locked stage of the patron zone.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { buildPremiumPassOffer } from '@/lib/modules/experiment-premium-pass/domain/offer';
import type { PremiumPaymentsDto } from '@/lib/modules/experiment-premium-pass/domain/payments-mode';

const auth = { userId: 'u1' as string | null, isLoaded: true };
vi.mock('@/lib/auth/react', () => ({
  useAuth: () => auth,
  useUser: () => ({ user: auth.userId ? { primaryEmailAddress: { emailAddress: 'pawel.perfect@gmail.com' } } : null }),
}));
const openAuthModal = vi.fn();
vi.mock('@/app/components/auth/AuthModalProvider', () => ({ useAuthModal: () => ({ open: openAuthModal }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));

const { PremiumPassOverlay } = await import('@/app/components/premium-pass/PremiumPassOverlay');

const fetchMock = vi.fn();

function renderOverlay(signedIn: boolean, expiredAt?: string, payments?: PremiumPaymentsDto) {
  auth.userId = signedIn ? 'u1' : null;
  const offer = buildPremiumPassOffer({ signedIn, premiumCount: 2, expiredAt, payments });
  const onRefresh = vi.fn();
  render(<PremiumPassOverlay offer={offer} poster="/thumb.jpg" title="Zbieram hajs" variant="default" onRefresh={onRefresh} />);
  return { onRefresh, offer };
}

describe('PremiumPassOverlay (patron zone)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).startsWith('/api/user/premium-pass?')) {
        return new Response(JSON.stringify({ offer: buildPremiumPassOffer({ signedIn: true, premiumCount: 2 }), pass: { state: 'none' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 'DEMO_DECLINED' }), { status: 402 });
    });
    window.history.replaceState(null, '', '/?v=jj');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    openAuthModal.mockReset();
  });

  it('guest: sign-in CTA marks the return to checkout and opens the sign-in window', () => {
    renderOverlay(false);
    expect(screen.getByRole('heading', { name: 'Strefa patrona' })).toBeInTheDocument();
    const cta = screen.getAllByRole('button', { name: /Zaloguj się i zostań patronem/ })[0]!;
    fireEvent.click(cta);
    expect(openAuthModal).toHaveBeenCalledWith('sign-in');
    expect(window.location.search).toContain('pass=checkout');
    expect(screen.getByText('TRYB DEMO')).toBeInTheDocument();
  });

  it('shows the pay-what-you-want offer: minimum amount, access length, no fixed passes', () => {
    renderOverlay(true);
    expect(screen.getAllByRole('button', { name: /Zostań patronem · od 5\s*zł/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/płacisz, ile chcesz, od 5\s*zł/)).toBeInTheDocument();
    expect(screen.getByText(/dostęp na 30 dni, bez subskrypcji/)).toBeInTheDocument();
    expect(screen.queryByText(/Wejściówka/)).toBeNull();
    expect(screen.queryByText(/7 dni/)).toBeNull();
  });

  it('shows no demo marker in stripe mode and a test marker with test keys', () => {
    renderOverlay(true, undefined, { mode: 'stripe', available: true, stripeMode: 'test' });
    expect(screen.queryByText('TRYB DEMO')).toBeNull();
    expect(screen.getByText('TRYB TESTOWY')).toBeInTheDocument();
    cleanup();
    renderOverlay(true, undefined, { mode: 'stripe', available: true, stripeMode: 'live' });
    expect(screen.queryByText('TRYB DEMO')).toBeNull();
    expect(screen.queryByText('TRYB TESTOWY')).toBeNull();
  });

  it('signed in: the CTA opens the two-step checkout on step 1, without a DEMO bar inside it', async () => {
    renderOverlay(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Zostań patronem · od 5\s*zł/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Zostań patronem');
    expect(dialog).toHaveTextContent('Ile chcesz wesprzeć?');
    expect(dialog).toHaveTextContent('Sprzedawca: POLUTEK Sp. z o.o. (dane demo)');
    expect(dialog.querySelector('[data-demo-ribbon]')).toBeNull();
  });

  it('expired access: banner and "support again"', () => {
    renderOverlay(true, '2026-11-20T10:00:00.000Z');
    expect(screen.getByRole('status')).toHaveTextContent('Twój dostęp do strefy patrona wygasł 20.11.2026.');
    expect(screen.getAllByRole('button', { name: /Wesprzyj ponownie/ }).length).toBeGreaterThan(0);
  });
});
