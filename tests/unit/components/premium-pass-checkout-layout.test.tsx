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

  it('step 1: the currency is a small pill on a slim row above the access cards (label visible, 44 px touch area); field labels share one typography class', async () => {
    openCheckout();
    const dialog = within(await screen.findByRole('dialog'));
    const legend = dialog.getAllByText('Wybierz dostęp').find((el) => el.tagName === 'LEGEND')!;
    expect(legend.className).toContain('sr-only');
    const visible = dialog.getAllByText('Wybierz dostęp').find((el) => el.tagName === 'DIV')!;
    expect(visible).toBeInTheDocument();
    const field = dialog.getByRole('combobox', { name: 'Waluta płatności' });
    const row = field.closest('[class*="currencyRow"]') as HTMLElement;
    const visibleLabel = row.querySelector('[class*="currencyLabel"]') as HTMLElement;
    expect(visibleLabel).toHaveTextContent('Waluta płatności'); // readable label next to the pill (aria-hidden: the pill carries the same name)
    expect(visibleLabel).toHaveAttribute('aria-hidden', 'true');
    expect(field).toHaveTextContent('zł · PLN');
    expect(field.className).toContain('h-8 '); // 32 px pill, not the 52 px tile
    expect(field.className).not.toContain('w-full');
    expect(field.className).toContain('before:-inset-y-[6px]'); // 6 + 32 + 6 = 44 px touch height
    expect(row.nextElementSibling).toBe(visible); // access cards follow the currency row
    expect(FIELD_LABEL_CLASS).toMatch(/text-\[13px\].*text-\[var\(--chan-body\)\]|text-\[var\(--chan-body\)\].*text-\[13px\]/);
    expect(FIELD_LABEL_CLASS).toContain('font-[weight:var(--field-label-weight,400)]'); // regular in the gate, bold in the checkout via the one variable
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

  it('the dots are a stepper: 8 px dots 44 px apart, a 44 px touch area from a pseudo-element, a focus ring, no motion when reduced', () => {
    const dots = css.match(/\.stepDots \{([^}]*)\}/)?.[1] ?? '';
    expect(dots).toContain('gap: 36px'); // 8 + 36 = 44 px between centres: the touch areas never overlap
    expect(dots).toContain('z-index: 1'); // above the sticky action bar the touch area reaches into
    expect(css).toMatch(/\.stepPip \{[^}]*width: 8px; height: 8px;/);
    expect(css).toMatch(/\.stepBtn::before \{[^}]*inset: -18px;/); // 8 + 18 + 18 = 44
    expect(css).toMatch(/\.stepBtn:focus-visible \{ outline: 3px solid/);
    expect(css).toMatch(/\.stepBtn:disabled \{/);
  });

  it('the payment boxes use the blue family: tokens for the edge (3.6:1) and the placeholder (6.1:1), both AA on white', () => {
    expect(css).toMatch(/--pass-field-edge: #5f87c9;/);
    expect(css).toMatch(/--pass-blue-ink: #4b6384;/);
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: string) => 1.05 / (lum(a) + 0.05);
    expect(ratio('#5f87c9')).toBeGreaterThanOrEqual(3); // WCAG 1.4.11 (the edge of the field)
    expect(ratio('#4b6384')).toBeGreaterThanOrEqual(4.5); // WCAG 1.4.3 (the placeholder)
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

  it('the slim desktop sheet fills the right edge, uses only left radii and a single vertical transition on entry and exit', () => {
    const sheet = css.match(/\.sheet \{([^}]*)\}/)?.[1] ?? '';
    expect(sheet).toMatch(/right: 0; top: 0; bottom: 0/);
    expect(sheet).toContain('width: min(400px, 100vw)');
    expect(sheet).toContain('height: 100dvh; max-height: 100dvh');
    expect(sheet).toContain('border-radius: 20px 0 0 20px');
    expect(sheet).toContain('border-right: 0');
    expect(sheet).toMatch(/transition: transform 320ms/);
    expect(sheet).not.toMatch(/animation:|translateX|left: 50%/);
    expect(css).not.toMatch(/@keyframes sheet(?:In|Up|Drop)/);
    expect(css).toMatch(/\.sheet\[data-starting-style\], \.sheet\[data-ending-style\] \{ transform: translateY\(calc\(-100% - 48px\)\); \}/);
    expect(css).toMatch(/\.overlay \{[^}]*transition: opacity 320ms/);
    expect(css).toMatch(/\.overlay\[data-starting-style\], \.overlay\[data-ending-style\] \{ opacity: 0; \}/);
    expect(css).toMatch(/@media \(min-width: 900px\) \{ \.overlay \{ background: rgba\(5, 7, 13, \.2\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{[^@]*\.sheet, \.overlay, \.stepPip \{ transition: none; \}/);
    expect(css).toMatch(/@media \(max-width: 560px\) \{\s*\.sheet \{ left: 0; right: 0; top: 0; bottom: 0; width: 100%; height: 100dvh;[^}]*border-radius: 0;/);
  });

  it('the dialog is modal (aria-modal) and a tap on the dimmed backdrop closes it; a tap inside does not', async () => {
    const onOpenChange = vi.fn();
    const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2 });
    render(<PassCheckoutSheet open onOpenChange={onOpenChange} offer={offer} onWatch={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(within(dialog).getByRole('heading', { level: 2 }));
    expect(onOpenChange).not.toHaveBeenCalled();
    const backdrop = document.querySelector('[class*="overlay"]') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
