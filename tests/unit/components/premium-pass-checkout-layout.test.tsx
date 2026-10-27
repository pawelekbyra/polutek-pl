/** @vitest-environment jsdom */
// patron zone (docs/architecture/patron-zone.md): the checkout's title and layout rules (owner 2026-10-26): the title text, ONE visible
// 'Metoda płatności' label, the same label typography everywhere and one shared title-to-first-label gap variable.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { txFor } from '../i18n/mock-language';
import { buildPremiumPassOffer } from '@/lib/modules/patron-zone/domain/offer';

vi.mock('@/lib/auth/react', () => ({
  useAuth: () => ({ userId: 'u1', isLoaded: true }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'pawel.perfect@gmail.com' } } }),
}));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));
vi.mock('@/lib/payments/stripe-browser', () => ({ getStripeBrowser: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => null,
  CardElement: () => null,
  ExpressCheckoutElement: () => null,
  useStripe: () => ({}),
  useElements: () => ({}),
}));

const { PassCheckoutSheet } = await import('@/app/components/premium-pass/PassCheckoutSheet');
const { FIELD_LABEL_CLASS } = await import('@/app/components/support/TipSelect');

const css = fs.readFileSync(path.join(process.cwd(), 'app/components/premium-pass/premium-pass.module.css'), 'utf8');

function openCheckout() {
  const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2 });
  render(<PassCheckoutSheet open onOpenChange={() => undefined} offer={offer} onWatch={() => undefined} />);
}

describe('patron checkout layout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ offer: {}, pass: { state: 'none' } }), { status: 200 })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('the modal title is "Kup se Premium" (capital P), also the accessible name of the dialog', async () => {
    openCheckout();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Kup se Premium' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName('Kup se Premium');
    expect(dialog).not.toHaveTextContent('Zostań patronem');
    expect(dialog).not.toHaveTextContent('Kup se premium');
  });

  it('step 2 has ONE visible "Metoda płatności" (the dropdown label); the heading for focus and screen readers is visually hidden', async () => {
    openCheckout();
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: /^Dalej/ }));
    const heading = await dialog.findByRole('heading', { name: 'Metoda płatności' });
    expect(heading.className).toContain('srOnly');
    const same = dialog.getAllByText('Metoda płatności');
    expect(same).toHaveLength(2);
    expect(same.filter((el) => !el.className.includes('srOnly'))).toHaveLength(1);
    expect(dialog.getByRole('combobox', { name: 'Metoda płatności' })).toBeInTheDocument();
  });

  it('step 1: the "Wybierz dostęp" label sits in one row with the small currency pill ("Waluta" is screen-reader only); the other field labels share one typography class', async () => {
    openCheckout();
    const dialog = within(await screen.findByRole('dialog'));
    const legend = dialog.getAllByText('Wybierz dostęp').find((el) => el.tagName === 'LEGEND')!;
    expect(legend.className).toContain('sr-only');
    const visible = dialog.getAllByText('Wybierz dostęp').find((el) => el.tagName === 'SPAN')!;
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    const pill = dialog.getByRole('combobox', { name: 'Waluta' });
    expect(visible.parentElement).toBe(pill.closest('div')?.parentElement); // same row
    expect(dialog.getByText('Waluta').className).toContain('sr-only');
    expect(pill.className).toContain('h-7'); // 28 px pill, hit area grown to 44 px by the ::before
    expect(pill.className).toContain('before:-top-2.5');
    expect(FIELD_LABEL_CLASS).toMatch(/text-\[13px\].*text-\[var\(--chan-body\)\]|text-\[var\(--chan-body\)\].*text-\[13px\]/);
    expect(FIELD_LABEL_CLASS).toContain('mb-[var(--field-label-gap,8px)]'); // label to field: one variable (8 px in the gate, 0 in the checkout, like step 3)
    fireEvent.click(dialog.getByRole('button', { name: /^Dalej/ }));
    await dialog.findByRole('heading', { name: 'Metoda płatności' });
    expect(dialog.getByRole('combobox', { name: 'Metoda płatności' }).closest('div')?.parentElement?.querySelector('span')?.className).toBe(FIELD_LABEL_CLASS);
    fireEvent.click(dialog.getByRole('button', { name: /^Dalej/ }));
    const pay = await dialog.findByRole('heading', { name: 'Płatność' });
    expect(pay.className).toContain(FIELD_LABEL_CLASS);
  });

  it('the three step dots sit at the bottom, right above the action bar (outside the scrolling body, not in the title row)', async () => {
    openCheckout();
    const dialog = await screen.findByRole('dialog');
    const dots = within(dialog).getByRole('list', { name: 'Etapy zakupu' });
    expect(within(dots).getAllByRole('listitem')).toHaveLength(3);
    const title = within(dialog).getByRole('heading', { level: 2 });
    expect(title.parentElement?.contains(dots)).toBe(false);
    expect(title.parentElement?.nextElementSibling).not.toBe(dots);
    const button = within(dialog).getByRole('button', { name: /^Dalej/ });
    const bar = button.parentElement;
    expect(dots.nextElementSibling).toBe(bar);
    expect(dots.previousElementSibling?.contains(dots)).toBe(false);
  });

  it('the dots take no part in the scroll: a plain flex item with ~9px under it, no pull-up margin', () => {
    const rule = css.match(/\.stepDots \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('flex: 0 0 auto');
    expect(rule).toContain('padding: 0 0 9px');
    expect(rule).not.toMatch(/--pass-title-gap/);
  });

  it('one variable, --pass-title-gap, sets the distance from the title row to the first label in every step (no per-step hacks)', () => {
    expect(css).toMatch(/\.pass \{[^}]*--pass-title-gap: \d+px;/);
    expect(css).toMatch(/\.sheetBody \{[^}]*padding: var\(--pass-title-gap\)/);
    expect(css).toMatch(/\.payHead \{[^}]*padding: var\(--pass-title-gap\)/);
    expect(css).not.toMatch(/\.sheetHead \+ \.sheetBody/);
    // defined twice (default + short-phone override) and consumed by exactly two containers: no per-step values
    expect((css.match(/--pass-title-gap:/g) ?? []).length).toBe(2);
    expect((css.match(/var\(--pass-title-gap\)/g) ?? []).length).toBe(2);
  });

  it('radii and the blue family come from tokens (fields 16, cards 14, pills 999)', () => {
    expect(css).toMatch(/--pass-r-field: 16px;/);
    expect(css).toMatch(/--pass-r-card: 14px;/);
    expect(css).toMatch(/--pass-r-pill: 999px;/);
    for (const hex of ['#d4e7ff', '#9fc3f5', '#e8f1ff', '#bcd4f6']) expect(css.split(hex).length - 1).toBe(1); // defined once, used via var()
  });
});
