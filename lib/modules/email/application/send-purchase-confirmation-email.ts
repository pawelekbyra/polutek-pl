import { logger } from "@/lib/logger";
import { getExplicitLocaleHref } from "@/lib/i18n/routing";
import { escapeHtml } from "../domain/email-content";
import { sendEmail } from "../infrastructure/resend-email.transport";

/**
 * "Potwierdzenie zakupu" (purchase confirmation) for a Premium payment. A consumer loses the 14-day right of
 * withdrawal for digital content only when the seller, after the purchase, confirms on a durable medium that the
 * contract was concluded, what was bought, that the consumer expressly agreed to immediate performance and was
 * informed about losing the right (art. 38 pkt 13 and art. 21 ustawy o prawach konsumenta). This mail is that
 * confirmation, so the text is fixed code (not an admin-editable template) and carries: order number, service,
 * price, date, the consent, the link to the terms.
 *
 * Service mail: no unsubscribe link (payment mail never has one). The pure builder is separate from the sender so it
 * is trivially testable; the once-per-payment guarantee lives in the payments module (send-purchase-confirmation).
 */

type Lang = "pl" | "en";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export type PurchaseConfirmationEmailInput = {
  to: string;
  language: Lang;
  /** The order number the buyer can quote to support: the payment id. */
  orderNumber: string;
  /** What was bought, already in the mail language (e.g. "Dostęp Premium na 30 dni"). */
  serviceName: string;
  amountMinor: number;
  /** ISO 4217 code of the payment (the currency the buyer paid in). */
  currency: string;
  /** When the payment was confirmed. */
  paidAt: Date;
  /** When the buyer ticked the consent to immediate performance (`Payment.metadata.consents.waiverAt`); null = none recorded. */
  waiverAt: Date | null;
  /** The seller is exempt from VAT (lib/config/vat.ts): the price is final, with no VAT shown. */
  vatExempt: boolean;
  /** Who sells (the seller named in the Premium terms). */
  sellerName: string;
  /** Stripe test keys: the mail says so and nothing was charged (subject gets a [TEST] prefix). */
  testMode: boolean;
};

const WARSAW = "Europe/Warsaw";

function formatMoney(minor: number, currency: string, lang: Lang): string {
  const locale = lang === "pl" ? "pl-PL" : "en-GB";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDateTime(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "pl" ? "pl-PL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WARSAW,
    timeZoneName: "short",
  }).format(date);
}

const CELL = "padding:6px 12px 6px 0;vertical-align:top;color:#555555;";
const VALUE = "padding:6px 0;vertical-align:top;color:#111111;";

function row(label: string, value: string): string {
  return `<tr><td style="${CELL}">${escapeHtml(label)}</td><td style="${VALUE}">${escapeHtml(value)}</td></tr>`;
}

export function buildPurchaseConfirmationEmail(input: PurchaseConfirmationEmailInput): { subject: string; html: string } {
  const pl = input.language === "pl";
  const termsUrl = `${appUrl()}${getExplicitLocaleHref(input.language, "passTerms")}`;
  const siteTermsUrl = `${appUrl()}${getExplicitLocaleHref(input.language, "terms")}`;
  const link = (url: string) => `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
  const price = formatMoney(input.amountMinor, input.currency, input.language);
  const vat = input.vatExempt
    ? pl ? "cena końcowa, sprzedawca jest zwolniony z VAT" : "final price, the seller is exempt from VAT"
    : pl ? "cena zawiera VAT" : "price includes VAT";

  const subject = (input.testMode ? "[TEST] " : "") +
    (pl ? `Potwierdzenie zakupu: ${input.serviceName}` : `Purchase confirmation: ${input.serviceName}`);

  const test = input.testMode
    ? `<p style="padding:10px 12px;background:#fff4d6;border:1px solid #e0b84a;color:#5a4300"><strong>TEST</strong>: ` +
      (pl
        ? "to zamówienie testowe (testowe klucze płatności). Nie pobrano żadnych pieniędzy i żadna umowa nie została zawarta."
        : "this is a test order (test payment keys). No money was charged and no contract was concluded.") +
      "</p>"
    : "";

  const consent = input.waiverAt
    ? pl
      ? `<p>Przed zapłatą wyraziłeś(-aś) wyraźną zgodę na rozpoczęcie świadczenia usługi (dostępu do treści cyfrowych) przed upływem terminu na odstąpienie od umowy (zgoda z ${escapeHtml(formatDateTime(input.waiverAt, "pl"))}). Zostałeś(-aś) poinformowany(-a), że po rozpoczęciu świadczenia tracisz prawo odstąpienia od umowy (art. 38 pkt 13 ustawy o prawach konsumenta). Dostęp został uruchomiony po potwierdzeniu płatności.</p>`
      : `<p>Before paying you gave your express consent to the service (access to digital content) starting before the withdrawal period ends (consent given ${escapeHtml(formatDateTime(input.waiverAt, "en"))}). You were informed that once performance has begun you lose your right to withdraw from the contract (art. 38 point 13 of the Polish Consumer Rights Act). Access was activated once the payment was confirmed.</p>`
    : pl
      ? "<p>Nie odnotowaliśmy Twojej zgody na natychmiastowe rozpoczęcie świadczenia, więc przysługuje Ci prawo odstąpienia od umowy w ciągu 14 dni od jej zawarcia. Aby z niego skorzystać, odpowiedz na tę wiadomość.</p>"
      : "<p>We have no record of your consent to immediate performance, so you keep the right to withdraw from the contract within 14 days of concluding it. To use it, reply to this message.</p>";

  const html =
    test +
    `<p><strong>${pl ? "Dziękujemy za zakup. Potwierdzamy zawarcie umowy." : "Thank you for your purchase. We confirm that the contract has been concluded."}</strong></p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px">` +
    row(pl ? "Numer zamówienia" : "Order number", input.orderNumber) +
    row(pl ? "Usługa" : "Service", input.serviceName) +
    row(pl ? "Cena" : "Price", `${price} (${vat})`) +
    row(pl ? "Data płatności" : "Payment date", formatDateTime(input.paidAt, input.language)) +
    row(pl ? "Sprzedawca" : "Seller", input.sellerName) +
    `</table>` +
    `<p><strong>${pl ? "Natychmiastowe świadczenie i prawo odstąpienia" : "Immediate performance and the right of withdrawal"}</strong></p>` +
    consent +
    `<p>${pl ? "Regulamin Premium" : "Premium terms"}: ${link(termsUrl)}<br>${pl ? "Regulamin serwisu" : "Terms of Service"}: ${link(siteTermsUrl)}</p>` +
    `<p style="color:#666666">${pl ? "To potwierdzenie zachowaj. W razie pytań odpowiedz na tę wiadomość i podaj numer zamówienia." : "Please keep this confirmation. If you have questions, reply to this message and quote the order number."}</p>`;

  return { subject, html };
}

export async function sendPurchaseConfirmationEmail(
  input: PurchaseConfirmationEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, html } = buildPurchaseConfirmationEmail(input);
  const res = await sendEmail({
    to: input.to,
    subject: oneLine(subject),
    html,
    language: input.language,
    kind: "purchase-confirmation",
    // Resend deduplicates a repeat of the same send for 24 h (a crash between sending and recording it).
    idempotencyKey: `purchase-confirmation-${input.orderNumber}`,
  });
  if (!res.ok) {
    logger.error("[email] purchase confirmation mail failed", { name: res.error.name, statusCode: res.error.statusCode });
    return { ok: false, error: res.error.message };
  }
  return { ok: true };
}
