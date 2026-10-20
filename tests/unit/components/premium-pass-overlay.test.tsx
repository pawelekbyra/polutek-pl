/** @vitest-environment jsdom */
// experiment: premium-pass (docs/experiments/premium-pass.md, section 15)
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { buildPremiumPassOffer } from '@/lib/modules/experiment-premium-pass/domain/offer';

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

function renderOverlay(signedIn: boolean, expiredAt?: string) {
  auth.userId = signedIn ? 'u1' : null;
  const offer = buildPremiumPassOffer({ signedIn, premiumCount: 2, expiredAt });
  const onRefresh = vi.fn();
  render(<PremiumPassOverlay offer={offer} poster="/thumb.jpg" title="Zbieram hajs" variant="default" onRefresh={onRefresh} />);
  return { onRefresh };
}

describe('PremiumPassOverlay', () => {
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
    expect(screen.getByRole('heading', { name: 'Materiał za kulisami' })).toBeInTheDocument();
    const cta = screen.getAllByRole('button', { name: /Zaloguj się i kup wejściówkę/ })[0]!;
    fireEvent.click(cta);
    expect(openAuthModal).toHaveBeenCalledWith('sign-in');
    expect(window.location.search).toContain('pass=checkout');
    expect(screen.getByText('TRYB DEMO')).toBeInTheDocument();
  });

  it('signed in: buy CTA shows the cheapest price and opens the checkout with both passes and the DEMO ribbon', async () => {
    renderOverlay(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Kup wejściówkę · od 14,99/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Demo: bez obciążenia');
    expect(dialog).toHaveTextContent('Wejściówka 7 dni');
    expect(dialog).toHaveTextContent('Wejściówka 30 dni');
    expect(dialog).toHaveTextContent('Najlepsza wartość');
    expect(dialog).toHaveTextContent('Sprzedawca: POLUTEK Sp. z o.o. (dane demo)');
    expect(dialog).toHaveTextContent('cena brutto, zawiera 23% VAT');
    // 30 days is preselected; switching to 7 days changes the total on the button
    expect(screen.getByRole('button', { name: /Zamawiam i płacę 29,00/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Wejściówka 7 dni/ }));
    expect(screen.getByRole('button', { name: /Zamawiam i płacę 14,99/ })).toBeInTheDocument();
    // no field to type anything into
    expect(dialog.querySelectorAll('input:not([type="radio"]):not([type="checkbox"])')).toHaveLength(0);
    expect(dialog.querySelector('[autocomplete^="cc-"]')).toBeNull();
  });

  it('shows a consent error at the box instead of a disabled button, and sends nothing', async () => {
    renderOverlay(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Kup wejściówkę/ })[0]!);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /Zamawiam i płacę/ }));
    expect(screen.getAllByText('Zaznacz to pole, aby kontynuować.')).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: /Akceptuję/ })).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/checkout'))).toHaveLength(0);
  });

  it('expired pass: banner and "get a new pass"', () => {
    renderOverlay(true, '2026-11-20T10:00:00.000Z');
    expect(screen.getByRole('status')).toHaveTextContent('Twoja wejściówka wygasła 20.11.2026.');
    expect(screen.getAllByRole('button', { name: /Kup nową wejściówkę/ }).length).toBeGreaterThan(0);
  });

  it('simulated decline: "nothing was charged" and retry', async () => {
    renderOverlay(true);
    fireEvent.click(screen.getAllByRole('button', { name: /Kup wejściówkę/ })[0]!);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('checkbox', { name: /Akceptuję/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Chcę dostępu od razu/ }));
    fireEvent.click(screen.getByRole('button', { name: /Symuluj odrzuconą płatność/ }));
    await waitFor(() => expect(screen.getByText('Płatność nie przeszła. Nic nie zostało pobrane.')).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
  });
});
