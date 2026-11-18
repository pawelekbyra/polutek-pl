/** @vitest-environment jsdom */
// patron zone: the seller card (steps 1-3) and the provider-neutral security footer of the checkout.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { PATRON_SELLER } from '@/app/components/premium-pass/pass-copy';
import { PassSellerCard } from '@/app/components/premium-pass/PassSellerCard';
import { PassSecurityFooter } from '@/app/components/premium-pass/PassSecurityFooter';

afterEach(() => {
  cleanup();
  PATRON_SELLER.nip = null;
});

describe('seller card', () => {
  it('shows the NBSP-protected name (no legal form, no registry line) and no NIP by default', () => {
    render(<PassSellerCard tx={txFor('pl')} />);
    const card = screen.getByRole('region', { name: 'Sprzedawca' });
    // The label is on its own row and the company name (bold) on the next one, so the name never breaks away from it.
    expect(card.querySelector('[class*="sellerLabel"]')?.textContent).toBe('Sprzedawca:');
    expect(card.querySelector('b')?.textContent?.replace(/ /g, ' ')).toBe('Paweł Perfect');
    expect(card.textContent).not.toContain('sp. z o.o.');
    expect(card).not.toHaveTextContent('Spółka zarejestrowana');
    // Only the label span (no NIP line under the name).
    expect(card.querySelectorAll('[class*="sellerCardText"] > span')).toHaveLength(1);
    expect(card).not.toHaveTextContent('NIP');
  });

  it('shows the NIP under the name only when one is configured', () => {
    PATRON_SELLER.nip = '1234567890';
    render(<PassSellerCard tx={txFor('pl')} />);
    expect(screen.getByRole('region', { name: 'Sprzedawca' })).toHaveTextContent('NIP: 1234567890');
  });

  it('is a passive card: no button, no extra paragraph', () => {
    render(<PassSellerCard tx={txFor('pl')} mode="live" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('region', { name: 'Sprzedawca' })).not.toHaveTextContent('Zakupu dokonujesz');
  });

  it('the compact variant (step 3) is one line, without a button', () => {
    PATRON_SELLER.nip = '1234567890';
    render(<PassSellerCard tx={txFor('pl')} compact />);
    const card = screen.getByRole('region', { name: 'Sprzedawca' });
    expect(card).toHaveTextContent('Sprzedawca: Paweł Perfect');
    expect(card).not.toHaveTextContent('sp. z o.o.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('speaks English too', () => {
    render(<PassSellerCard tx={txFor('en')} />);
    const card = screen.getByRole('region', { name: 'Seller' });
    expect(card).toHaveTextContent('Seller:');
    expect(card).not.toHaveTextContent('registered in Poland');
  });
});

describe('security footer', () => {
  it('real payments: encrypted + trusted provider, never names Stripe or claims anything about demo', () => {
    for (const lang of ['pl', 'en'] as const) {
      const { container, unmount } = render(<PassSecurityFooter tx={txFor(lang)} language={lang} demo={false} />);
      expect(container.textContent).toMatch(lang === 'pl' ? /szyfrowana.*zaufany operator płatności.*Nie przechowujemy danych karty/ : /encrypted.*trusted provider.*never store your card/);
      expect(container.textContent).not.toMatch(/stripe/i);
      unmount();
    }
  });

  it('demo: says nothing is charged and does not claim real processing', () => {
    const { container } = render(<PassSecurityFooter tx={txFor('pl')} language="pl" demo />);
    expect(container).toHaveTextContent('Tryb demonstracyjny: nic nie zostanie pobrane.');
    expect(container.textContent).not.toMatch(/szyfrowana|operatora|stripe/i);
  });
});
