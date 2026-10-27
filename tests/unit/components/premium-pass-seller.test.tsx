/** @vitest-environment jsdom */
// patron zone: the seller card (steps 1-3) and the provider-neutral security footer of the checkout.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('shows the NBSP-protected name and the registry line, and no NIP by default', () => {
    render(<PassSellerCard tx={txFor('pl')} />);
    const card = screen.getByRole('region', { name: 'Sprzedawca' });
    // The label is on its own row and the company name (bold) on the next one, so the name never breaks away from it.
    expect(card.querySelector('span')?.textContent).toBe('Sprzedawca:');
    expect(card.querySelector('b')?.textContent?.replace(/ /g, ' ')).toBe('Paweł Perfect S.Ą.');
    expect(card.textContent).toContain('Sp. z o.o.');
    expect(card).toHaveTextContent('Spółka zarejestrowana w Polsce');
    expect(card).not.toHaveTextContent('NIP');
  });

  it('shows the NIP only when one is configured', () => {
    PATRON_SELLER.nip = '1234567890';
    render(<PassSellerCard tx={txFor('pl')} />);
    expect(screen.getByRole('region', { name: 'Sprzedawca' })).toHaveTextContent('Spółka zarejestrowana w Polsce, NIP: 1234567890');
  });

  it('the info button toggles the extra paragraph with aria-expanded / aria-controls', () => {
    render(<PassSellerCard tx={txFor('pl')} />);
    const button = screen.getByRole('button', { name: 'Informacje o sprzedawcy' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const note = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(note).toHaveTextContent('Zakupu dokonujesz od sprzedawcy wskazanego powyżej.');
    expect(note.className).not.toMatch(/Open/);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(note.className).toMatch(/Open/);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('the compact variant (step 3) drops the registry line and keeps the info button', () => {
    PATRON_SELLER.nip = '1234567890';
    render(<PassSellerCard tx={txFor('pl')} compact />);
    const card = screen.getByRole('region', { name: 'Sprzedawca' });
    expect(card).toHaveTextContent('Sprzedawca: Paweł Perfect S.Ą.');
    expect(card).not.toHaveTextContent('Spółka zarejestrowana');
    expect(screen.getByRole('button', { name: 'Informacje o sprzedawcy' })).toBeInTheDocument();
  });

  it('speaks English too', () => {
    render(<PassSellerCard tx={txFor('en')} />);
    expect(screen.getByRole('region', { name: 'Seller' })).toHaveTextContent('Company registered in Poland');
  });
});

describe('security footer', () => {
  it('real payments: encrypted + trusted provider, never names Stripe or claims anything about demo', () => {
    for (const lang of ['pl', 'en'] as const) {
      const { container, unmount } = render(<PassSecurityFooter tx={txFor(lang)} demo={false} />);
      expect(container.textContent).toMatch(lang === 'pl' ? /szyfrowana.*zaufany operator płatności.*Nie przechowujemy danych karty/ : /encrypted.*trusted provider.*never store your card/);
      expect(container.textContent).not.toMatch(/stripe/i);
      unmount();
    }
  });

  it('demo: says nothing is charged and does not claim real processing', () => {
    const { container } = render(<PassSecurityFooter tx={txFor('pl')} demo />);
    expect(container).toHaveTextContent('Tryb demonstracyjny: nic nie zostanie pobrane.');
    expect(container.textContent).not.toMatch(/szyfrowana|operatora|stripe/i);
  });
});
