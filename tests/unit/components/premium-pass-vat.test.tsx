/** @vitest-environment jsdom */
// VAT status (lib/config/vat.ts) in the patron-zone texts: the order summary, the terms and the receipt, in both modes and in German.
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { createTx } from '@/lib/i18n/ui';
import { loadCatalog } from '@/lib/i18n/catalog';
import { buildPremiumPassOffer } from '@/lib/modules/patron-zone/domain/offer';
import { PassOrderSummary } from '@/app/components/premium-pass/PassPlanSteps';
import { PassTermsContent } from '@/app/components/premium-pass/PassTermsContent';
import { PassReceipt } from '@/app/components/premium-pass/PassSuccess';
import { receiptPriceSuffix, totalLabel, vatLine, vatTermsNote } from '@/app/components/premium-pass/pass-copy';

const pl = createTx('pl');
const offer = buildPremiumPassOffer({ signedIn: true, premiumCount: 2 });
const product = offer.products[1]!;
const pass = { state: 'active', lifetime: true, productId: 'ACCESS_LIFETIME', provider: 'STRIPE', ref: 'pay_1', expiresAt: null, grantedAt: '2026-10-21T10:00:00.000Z', method: 'blik', priceMinor: 2999, currency: 'PLN', totalMinor: 2999, waiverAt: '2026-10-21T10:00:00.000Z' } as never;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe.each([
  ['exempt', { vat: 'sprzedawca zwolniony z VAT', total: 'Razem do zapłaty', terms: 'ceny końcowe, sprzedawca jest zwolniony z VAT', receipt: '' }],
  ['active', { vat: 'zawiera VAT', total: 'Razem do zapłaty (brutto)', terms: 'ceny brutto', receipt: 'brutto' }],
] as const)('VAT status %s (Polish)', (status, want) => {
  const set = () => vi.stubEnv('NEXT_PUBLIC_PLATFORM_VAT_STATUS', status);

  it('copy helpers', () => {
    set();
    expect(vatLine(pl)).toBe(want.vat);
    expect(totalLabel(pl)).toBe(want.total);
    expect(receiptPriceSuffix(pl)).toBe(want.receipt);
    expect(vatTermsNote(pl)).toBe(status === 'exempt' ? 'Cena końcowa; sprzedawca jest zwolniony z VAT' : 'zawiera VAT');
  });

  it('the order summary keeps the total bar: label, amount and the note inside it, the same amount in both modes', () => {
    set();
    render(<PassOrderSummary tx={pl} language="pl" offer={offer} product={product} currency="PLN" />);
    const group = screen.getByRole('group', { name: 'Podsumowanie zamówienia' });
    const bar = group.querySelector('[class*="orderTotal"]') as HTMLElement;
    expect(bar).toHaveTextContent(want.total);
    expect(bar).toHaveTextContent(want.vat);
    expect(bar.querySelector('b')?.textContent?.replace(/\s/g, ' ')).toBe('29,99 zł');
    expect(group.querySelectorAll('[class*="orderLine"] b')).toHaveLength(2); // product name + its price, unchanged
    if (status === 'exempt') expect(group).not.toHaveTextContent(/brutto|zawiera VAT|23/);
  });

  it('the terms say it once, the receipt prints the amount', () => {
    set();
    const { container } = render(<><PassTermsContent tx={pl} locale="pl" demo={false} termsLink={null} /><PassReceipt tx={pl} language="pl" pass={pass} /></>);
    expect(container.textContent).toContain(want.terms);
    const amount = screen.getByText('Kwota').nextElementSibling as HTMLElement;
    expect(amount.textContent?.replace(/\s/g, ' ').trim()).toBe(want.receipt ? `29,99 zł ${want.receipt}` : '29,99 zł');
    if (status === 'exempt') expect(container.textContent).not.toMatch(/ceny brutto|zawiera VAT|23 ?%/);
  });
});

describe('VAT status in German', () => {
  it('exempt and active texts come from the catalog', async () => {
    const de = createTx('de', (await loadCatalog('de')) ?? undefined);
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_VAT_STATUS', 'exempt');
    expect([vatLine(de), totalLabel(de), receiptPriceSuffix(de)]).toEqual(['Verkäufer von der MwSt. befreit', 'Gesamtbetrag', '']);
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_VAT_STATUS', 'active');
    expect([vatLine(de), totalLabel(de), receiptPriceSuffix(de)]).toEqual(['inkl. MwSt.', 'Gesamtbetrag (inkl. MwSt.)', 'brutto']);
  });
});
