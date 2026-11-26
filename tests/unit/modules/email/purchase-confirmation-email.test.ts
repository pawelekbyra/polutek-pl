/**
 * "Potwierdzenie zakupu" (Premium purchase confirmation): the content a consumer needs to be told after paying so the
 * right of withdrawal can lapse (order number, service, price, date, consent to immediate performance and the loss of
 * the right, link to the terms) and the way the mail is handed to the transport. Pure builder + a mocked transport.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
vi.mock('@/lib/modules/email/infrastructure/resend-email.transport', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

const { buildPurchaseConfirmationEmail, sendPurchaseConfirmationEmail } = await import('@/lib/modules/email/application/send-purchase-confirmation-email');
const { htmlToPlainText } = await import('@/lib/modules/email/domain/email-content');
const { PURCHASE_CONFIRMATION_SELLER } = await import('@/lib/modules/payments/application/send-purchase-confirmation.use-case');
const { SELLER_NAME } = await import('@/app/components/premium-pass/pass-copy');

const PAID_AT = new Date('2026-11-26T09:30:00.000Z'); // 10:30 CET
const WAIVER_AT = new Date('2026-11-26T09:28:00.000Z');

const base = {
  to: 'buyer@example.com',
  language: 'pl' as const,
  orderNumber: '0b8b6b1e-52a0-4f55-9b5d-0a1f5f9d3c11',
  serviceName: 'Dostęp Premium na 30 dni',
  amountMinor: 1499,
  currency: 'PLN',
  paidAt: PAID_AT,
  waiverAt: WAIVER_AT as Date | null,
  vatExempt: true,
  sellerName: 'Paweł Perfect',
  testMode: false,
};

const text = (html: string) => htmlToPlainText(html).replace(/ /g, ' ');

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.pawelperfect.com');
});

describe('buildPurchaseConfirmationEmail (Polish)', () => {
  it('names the order, service, price, payment date, seller, consent and the terms', () => {
    const { subject, html } = buildPurchaseConfirmationEmail(base);
    const body = text(html);

    expect(subject).toBe('Potwierdzenie zakupu: Dostęp Premium na 30 dni');
    expect(body).toContain('Numer zamówienia');
    expect(body).toContain(base.orderNumber);
    expect(body).toContain('Dostęp Premium na 30 dni');
    expect(body).toContain('14,99 zł');
    expect(body).toContain('sprzedawca jest zwolniony z VAT');
    expect(body).toContain('26.11.2026, 10:30'); // Warsaw time, not UTC
    expect(body).toContain('Paweł Perfect');
    expect(body).toContain('wyraźną zgodę na rozpoczęcie świadczenia');
    expect(body).toContain('tracisz prawo odstąpienia od umowy');
    expect(body).toContain('26.11.2026, 10:28'); // the moment of the consent
    expect(html).toContain('href="https://www.pawelperfect.com/pl/regulamin-premium"'); // explicit language: a Polish buyer with an English browser still gets Polish terms
    expect(html).toContain('href="https://www.pawelperfect.com/pl/regulamin"');
  });

  it('with VAT active the price says it includes VAT', () => {
    expect(text(buildPurchaseConfirmationEmail({ ...base, vatExempt: false }).html)).toContain('cena zawiera VAT');
  });

  it('no consent recorded: does not claim one, tells the buyer the 14 days still apply', () => {
    const body = text(buildPurchaseConfirmationEmail({ ...base, waiverAt: null }).html);
    expect(body).not.toContain('wyraziłeś(-aś) wyraźną zgodę');
    expect(body).not.toContain('tracisz prawo odstąpienia');
    expect(body).toContain('Nie odnotowaliśmy Twojej zgody');
    expect(body).toContain('14 dni');
  });

  it('a real order carries no test banner and no [TEST] subject prefix', () => {
    const { subject, html } = buildPurchaseConfirmationEmail(base);
    expect(subject.startsWith('[TEST]')).toBe(false);
    expect(html).not.toContain('TEST');
  });

  it('test mode: [TEST] subject, banner saying nothing was charged and no contract was concluded', () => {
    const { subject, html } = buildPurchaseConfirmationEmail({ ...base, testMode: true });
    expect(subject.startsWith('[TEST] Potwierdzenie zakupu')).toBe(true);
    expect(text(html)).toContain('to zamówienie testowe');
    expect(text(html)).toContain('Nie pobrano żadnych pieniędzy');
  });

  it('escapes values that come from data (service name, order number, seller)', () => {
    const { html } = buildPurchaseConfirmationEmail({ ...base, serviceName: '<script>x</script>', orderNumber: '"><b>1</b>', sellerName: '<i>S</i>' });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>1</b>');
    expect(html).not.toContain('<i>S</i>');
  });

  it('keeps the subject on one line', async () => {
    sendEmail.mockResolvedValue({ ok: true, id: 'm1' });
    await sendPurchaseConfirmationEmail({ ...base, serviceName: 'Dostęp\nPremium\r\nBcc: x@y.z' });
    expect(sendEmail.mock.calls[0][0].subject).not.toMatch(/[\r\n]/);
  });
});

describe('buildPurchaseConfirmationEmail (English)', () => {
  it('has the same facts in English with the English terms link', () => {
    const { subject, html } = buildPurchaseConfirmationEmail({ ...base, language: 'en', serviceName: 'Premium access for 30 days' });
    const body = text(html);
    expect(subject).toBe('Purchase confirmation: Premium access for 30 days');
    expect(body).toContain('Order number');
    expect(body).toContain(base.orderNumber);
    expect(body).toContain('PLN');
    expect(body).toContain('exempt from VAT');
    expect(body).toContain('26/11/2026');
    expect(body).toContain('express consent');
    expect(body).toContain('you lose your right to withdraw');
    expect(html).toContain('href="https://www.pawelperfect.com/en/premium-terms"');
    expect(html).toContain('href="https://www.pawelperfect.com/en/terms"');
  });

  it('no consent recorded: says the right of withdrawal remains', () => {
    const body = text(buildPurchaseConfirmationEmail({ ...base, language: 'en', waiverAt: null }).html);
    expect(body).toContain('We have no record of your consent');
    expect(body).not.toContain('you lose your right to withdraw');
  });
});

describe('sendPurchaseConfirmationEmail', () => {
  it('hands a service mail (no unsubscribe) to the transport with a per-order idempotency key', async () => {
    sendEmail.mockResolvedValue({ ok: true, id: 'm1' });

    const result = await sendPurchaseConfirmationEmail(base);

    expect(result).toEqual({ ok: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({
      to: 'buyer@example.com',
      language: 'pl',
      kind: 'purchase-confirmation',
      idempotencyKey: `purchase-confirmation-${base.orderNumber}`,
    });
    expect(sent.unsubscribe).toBeUndefined();
  });

  it('reports a transport failure instead of throwing', async () => {
    sendEmail.mockResolvedValue({ ok: false, error: { name: 'rate_limit', message: 'slow down', statusCode: 429 } });
    expect(await sendPurchaseConfirmationEmail(base)).toEqual({ ok: false, error: 'slow down' });
  });
});

describe('the seller name', () => {
  it('is the one the Premium terms and the checkout show', () => {
    expect(PURCHASE_CONFIRMATION_SELLER).toBe(SELLER_NAME);
  });
});
