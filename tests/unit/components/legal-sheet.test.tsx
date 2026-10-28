/** @vitest-environment jsdom */
// Legal sheet (docs/architecture/patron-zone.md, "Dokumenty prawne w kasie"): every link to a legal document inside the patron
// checkout opens ONE shared sheet on top of the checkout (nested dialog) instead of a new tab, in every step, and the
// checkout under it keeps its state. Stripe.js is a stub: no network, no charge.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const { PassCheckoutSheet } = await import('@/app/components/premium-pass/PassCheckoutSheet');
const { LegalLink } = await import('@/app/components/legal/legal-sheet-context');

const N = (text: string) => (name: string) => name.replace(/\s/g, ' ') === text;
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const PASS_TERMS = 'Regulamin strefy patrona (projekt)';
const TERMS = 'Regulamin serwisu';
const PRIVACY = 'Polityka Prywatności';

function renderCheckout() {
  const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2 });
  const onOpenChange = vi.fn();
  render(<PassCheckoutSheet open onOpenChange={onOpenChange} offer={offer} onWatch={() => undefined} />);
  return { onOpenChange };
}

const checkout = () => screen.getByRole('dialog', { name: 'Kup se Premium' });
const sheet = (name: string) => screen.findByRole('dialog', { name });

async function toStep2() {
  fireEvent.click(within(checkout()).getByRole('button', { name: N('Dalej · 29,99 zł') }));
  await within(checkout()).findByRole('heading', { name: 'Metoda płatności' });
}
async function toStep3() {
  await toStep2();
  fireEvent.click(within(checkout()).getByRole('button', { name: N('Dalej · 29,99 zł') }));
  await within(checkout()).findByRole('heading', { name: 'Płatność' });
}

describe('legal sheet in the patron checkout', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ offer: {}, pass: { state: 'none' } }), { status: 200 })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('step 1: the footer link keeps a real href and a plain click opens the sheet instead of a new tab', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const open = vi.spyOn(window, 'open');
    const terms = within(checkout()).getByRole('link', { name: 'Regulamin' });
    expect(terms).toHaveAttribute('href', '/regulamin-premium'); // works without JavaScript
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('aria-haspopup', 'dialog');
    expect(fireEvent.click(terms)).toBe(false); // default (navigation) prevented
    const dialog = await sheet(PASS_TERMS);
    expect(await within(dialog).findByText(/To jest projekt regulaminu i pokaz sprzedaży/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('a modified click (Ctrl) is left to the browser: no sheet', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const terms = within(checkout()).getByRole('link', { name: 'Regulamin' });
    expect(fireEvent.click(terms, { ctrlKey: true })).toBe(true);
    expect(screen.queryByRole('dialog', { name: PASS_TERMS })).toBeNull();
  });

  it('is a proper modal dialog: role, aria-modal, labelled by its title, a fixed Close button, the new-tab fallback, no test ribbon', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    fireEvent.click(within(checkout()).getByRole('link', { name: 'Polityka prywatności' }));
    const dialog = await sheet(PRIVACY);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const title = within(dialog).getByRole('heading', { name: PRIVACY });
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(await within(dialog).findByText(/Administratorem danych jest/)).toBeInTheDocument(); // the existing Privacy Policy text, unchanged
    expect(within(dialog).getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
    const newTab = within(dialog).getByRole('link', { name: 'Otwórz w nowej karcie' });
    expect(newTab).toHaveAttribute('href', expect.stringContaining('polityka-prywatnosci'));
    expect(newTab).toHaveAttribute('target', '_blank');
    expect(dialog.querySelector('[data-demo-ribbon]')).toBeNull();
    expect(document.querySelector('[data-demo-ribbon]')).toBeNull();
  });

  it('Escape closes only the sheet, never the checkout, and focus returns to the link that opened it', async () => {
    const { onOpenChange } = renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const link = within(checkout()).getByRole('link', { name: 'Regulamin' });
    link.focus();
    fireEvent.click(link);
    const dialog = await sheet(PASS_TERMS);
    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: PASS_TERMS })).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Kup se Premium' })).toBeInTheDocument();
    expect(document.activeElement).toBe(link);
    // a second Escape now reaches the checkout
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('the Close button closes the sheet only, and focus returns to the opener (also when the browser never focused the link)', async () => {
    const { onOpenChange } = renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const link = within(checkout()).getByRole('link', { name: 'Polityka prywatności' });
    expect(document.activeElement).not.toBe(link); // Safari: a click does not focus a link
    fireEvent.click(link);
    const dialog = await sheet(PRIVACY);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: PRIVACY })).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(link);
  });

  it('a press on the dimmed area closes the sheet only', async () => {
    const { onOpenChange } = renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    fireEvent.click(within(checkout()).getByRole('link', { name: 'Regulamin' }));
    const dialog = await sheet(PASS_TERMS);
    const backdrop = document.querySelector('[class*="backdrop"]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.pointerDown(backdrop);
    fireEvent.mouseDown(backdrop);
    fireEvent.pointerUp(backdrop);
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Kup se Premium' })).toBeInTheDocument();
  });

  it('keeps the checkout under it inert while open (so Tab and the screen reader stay in the sheet)', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const parent = checkout();
    fireEvent.click(within(parent).getByRole('link', { name: 'Regulamin' }));
    const dialog = await sheet(PASS_TERMS);
    expect(parent).toHaveAttribute('data-base-ui-inert');
    expect(dialog).not.toHaveAttribute('data-base-ui-inert');
    expect(document.activeElement && dialog.contains(document.activeElement)).toBe(true); // focus moved into the sheet (its title)
  });

  it('step 2: both footer links open their documents in the sheet', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    await toStep2();
    fireEvent.click(within(checkout()).getByRole('link', { name: 'Polityka prywatności' }));
    const privacy = await sheet(PRIVACY);
    expect(await within(privacy).findByText(/Administratorem danych jest/)).toBeInTheDocument();
    fireEvent.click(within(privacy).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(privacy).not.toBeInTheDocument());
    fireEvent.click(within(checkout()).getByRole('link', { name: 'Regulamin' }));
    await sheet(PASS_TERMS);
  });

  it('step 3: the consent links open the sheet and the checkout keeps its choices (option, ticked box)', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    fireEvent.click(within(checkout()).getByRole('radio', { name: /Dostęp na 30 dni/ }));
    await toStep3Cheaper();
    const terms = within(checkout()).getByRole('checkbox', { name: /Akceptuję/ }) as HTMLInputElement;
    fireEvent.click(terms);
    expect(terms.checked).toBe(true);

    // the label's own links: clicking a link inside a label must neither tick the box nor navigate
    fireEvent.click(within(checkout()).getByRole('link', { name: 'Politykę prywatności' }));
    const privacy = await sheet(PRIVACY);
    expect(terms.checked).toBe(true);
    fireEvent.click(within(privacy).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(privacy).not.toBeInTheDocument());

    fireEvent.click(within(checkout()).getAllByRole('link', { name: 'Regulamin strefy patrona' }).at(-1)!); // the consent label's link (the seller card note has one too)
    const passTerms = await sheet(PASS_TERMS);
    fireEvent.keyDown(document.activeElement ?? passTerms, { key: 'Escape' });
    await waitFor(() => expect(passTerms).not.toBeInTheDocument());

    // nothing was lost: still step 3, same product and price, the box still ticked, the other one untouched
    expect(within(checkout()).getByText('Krok 3 z 3')).toBeInTheDocument();
    expect(within(checkout()).getByRole('button', { name: N('Zapłać 14,99 zł') })).toBeInTheDocument();
    expect((within(checkout()).getByRole('checkbox', { name: /Akceptuję/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(checkout()).getByRole('checkbox', { name: /Chcę dostępu od razu/ }) as HTMLInputElement).checked).toBe(false);
  });

  async function toStep3Cheaper() {
    fireEvent.click(within(checkout()).getByRole('button', { name: N('Dalej · 14,99 zł') }));
    await within(checkout()).findByRole('heading', { name: 'Metoda płatności' });
    fireEvent.click(within(checkout()).getByRole('button', { name: N('Dalej · 14,99 zł') }));
    await within(checkout()).findByRole('heading', { name: 'Płatność' });
  }

  it('the seller card links to the Patron Zone Terms (in steps 1, 2 and 3)', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    for (const step of [1, 2, 3]) {
      if (step === 2) await toStep2();
      if (step === 3) {
        fireEvent.click(within(checkout()).getByRole('button', { name: N('Dalej · 29,99 zł') }));
        await within(checkout()).findByRole('heading', { name: 'Płatność' });
      }
      const card = checkout().querySelector('[data-seller-card]') as HTMLElement;
      const link = within(card).getByRole('link', { name: 'Regulamin strefy patrona', hidden: true });
      expect(link).toHaveAttribute('href', '/regulamin-premium');
      fireEvent.click(link);
      const dialog = await sheet(PASS_TERMS);
      expect(await within(dialog).findByText(/Sprzedawca:/)).toBeInTheDocument(); // the seller information is in the document
      fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
    }
  });

  it('from the Patron Zone Terms the link to the site Terms swaps the document inside the same sheet; closing returns to the first opener', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const opener = within(checkout()).getByRole('link', { name: 'Regulamin' });
    fireEvent.click(opener);
    const dialog = await sheet(PASS_TERMS);
    const inner = await within(dialog).findByRole('link', { name: TERMS === 'Regulamin serwisu' ? 'Regulamin serwisu' : TERMS });
    expect(inner).toHaveAttribute('href', expect.stringContaining('regulamin'));
    fireEvent.click(inner);
    expect(await within(dialog).findByRole('heading', { name: TERMS })).toBeInTheDocument();
    expect(await within(dialog).findByText(/Informacje o serwisie/)).toBeInTheDocument();
    expect(screen.getAllByRole('dialog').filter((d) => d.getAttribute('aria-modal') === 'true')).toHaveLength(1); // still one sheet
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(document.activeElement).toBe(opener);
  });

  it('keeps the page scroll locked after the sheet closes (the checkout under it still owns the lock)', async () => {
    renderCheckout();
    await screen.findByRole('dialog', { name: 'Kup se Premium' });
    const locked = () => document.documentElement.style.overflow === 'hidden' || document.documentElement.style.overflowY === 'hidden';
    expect(locked()).toBe(true);
    fireEvent.click(within(checkout()).getByRole('link', { name: 'Regulamin' }));
    const dialog = await sheet(PASS_TERMS);
    expect(locked()).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(locked()).toBe(true);
  });

  describe('swipe down on the header (touch)', () => {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'touch';
        this.isPrimary = init.isPrimary ?? true;
      }
    }
    beforeEach(() => vi.stubGlobal('PointerEvent', TestPointerEvent));

    const swipe = (head: Element, from: number, to: number) => {
      fireEvent.pointerDown(head, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientY: from });
      fireEvent.pointerMove(head, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientY: to });
      fireEvent.pointerUp(head, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientY: to });
    };

    it('a long swipe closes the sheet only; a short one springs back', async () => {
      const { onOpenChange } = renderCheckout();
      await screen.findByRole('dialog', { name: 'Kup se Premium' });
      fireEvent.click(within(checkout()).getByRole('link', { name: 'Regulamin' }));
      const dialog = await sheet(PASS_TERMS);
      const head = dialog.querySelector('[class*="head"]') as HTMLElement;
      swipe(head, 100, 140);
      expect(dialog).toBeInTheDocument();
      expect(dialog.style.transform).toBe('');
      swipe(head, 100, 260);
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Kup se Premium' })).toBeInTheDocument();
    });

    it('a mouse never starts a swipe, and the Close button is not a drag handle', async () => {
      renderCheckout();
      await screen.findByRole('dialog', { name: 'Kup se Premium' });
      fireEvent.click(within(checkout()).getByRole('link', { name: 'Regulamin' }));
      const dialog = await sheet(PASS_TERMS);
      const head = dialog.querySelector('[class*="head"]') as HTMLElement;
      fireEvent.pointerDown(head, { pointerId: 3, pointerType: 'mouse', isPrimary: true, clientY: 0 });
      fireEvent.pointerUp(head, { pointerId: 3, pointerType: 'mouse', isPrimary: true, clientY: 400 });
      const close = within(dialog).getByRole('button', { name: 'Zamknij' });
      fireEvent.pointerDown(close, { pointerId: 4, pointerType: 'touch', isPrimary: true, clientY: 0 });
      fireEvent.pointerUp(close, { pointerId: 4, pointerType: 'touch', isPrimary: true, clientY: 400 });
      expect(dialog).toBeInTheDocument();
    });
  });
});

describe('LegalLink outside a legal sheet', () => {
  afterEach(cleanup);
  it('stays a plain link: real href, new tab, the click is not intercepted', () => {
    render(<LegalLink doc="terms" language="pl">Regulamin</LegalLink>);
    const link = screen.getByRole('link', { name: 'Regulamin' });
    expect(link).toHaveAttribute('href', expect.stringContaining('regulamin'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).not.toHaveAttribute('aria-haspopup');
    expect(fireEvent.click(link)).toBe(true);
  });
});

describe('legal documents inside the checkout: one mechanism, one source of text', () => {
  it('no component of the patron checkout links to a legal document page by hand any more', () => {
    const dir = 'app/components/premium-pass';
    const offenders = fs
      .readdirSync(path.join(process.cwd(), dir))
      .filter((file) => /\.tsx$/.test(file) && file !== 'PassTermsPage.tsx')
      .filter((file) => /getLocalizedHref\([^)]*"(passTerms|privacy|terms)"\)/.test(read(`${dir}/${file}`)));
    expect(offenders).toEqual([]);
  });

  it('the checkout wraps its popup content in the legal sheet provider, inside the dialog (so the dialogs nest)', () => {
    const source = read('app/components/premium-pass/PassCheckoutSheet.tsx');
    expect(source.indexOf('<DialogPrimitive.Popup')).toBeLessThan(source.indexOf('<LegalSheetProvider'));
    expect(source.indexOf('</LegalSheetProvider>')).toBeLessThan(source.indexOf('</DialogPrimitive.Popup>'));
    expect(source).not.toContain('DemoRibbon');
  });

  it('the page and the sheet render the same Patron Zone Terms component, and the sheet shows the existing Terms/Privacy components', () => {
    expect(read('app/components/premium-pass/PassTermsPage.tsx')).toContain('<PassTermsContent');
    const body = read('app/components/legal/LegalDocBody.tsx');
    expect(body).toContain('<PassTermsContent');
    for (const component of ['RegulaminContent', 'TermsContentEn', 'PolitykaContent', 'PrivacyContentEn']) expect(body).toContain(`<${component} />`);
    expect(read('app/components/premium-pass/PassTermsContent.tsx')).not.toContain('DemoRibbon');
  });

  it('the stylesheet gives the sheet a 44 px Close, safe areas, contained scrolling, a higher layer than the checkout and reduced motion', () => {
    const css = read('app/components/legal/legal-sheet.module.css');
    expect(css).toMatch(/\.close\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.close\s*\{[^}]*min-width:\s*44px/);
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toMatch(/\.body\s*\{[^}]*overscroll-behavior:\s*contain/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*transition:\s*none/);
    const z = (file: string, cls: string) => Number(new RegExp(`\\.${cls}\\s*\\{[^}]*z-index:\\s*(\\d+)`).exec(read(file))?.[1]);
    expect(z('app/components/legal/legal-sheet.module.css', 'sheet')).toBeGreaterThan(z('app/components/premium-pass/premium-pass.module.css', 'sheet'));
    expect(z('app/components/legal/legal-sheet.module.css', 'backdrop')).toBeGreaterThan(z('app/components/premium-pass/premium-pass.module.css', 'sheet'));
    expect(css).not.toMatch(/ribbon|repeating-linear-gradient/i); // no striped test bar
  });
});
