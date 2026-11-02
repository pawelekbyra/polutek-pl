// patron zone (docs/architecture/patron-zone.md): shared labels and formatting of the patron-zone UI.
import type { Tx } from "@/lib/i18n/ui";
import { intlLocale } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { formatPassPrice } from "@/lib/modules/patron-zone/domain/offer";
import { isVatExempt } from "@/lib/config/vat";
import { describeTipMethod } from "../support/tip-flow-config";

/**
 * The seller name, the ONE place to edit it (owner decision 2026-11-02: just "Paweł Perfect", no legal form). The NBSP
 * keeps the two words together. Used by the seller card (PATRON_SELLER.name) and, with the demo suffix, by sellerName().
 */
export const SELLER_NAME = "Paweł Perfect";

/** The seller shown in the terms and the receipt (the company does not exist yet, hence the demo suffix). */
export function sellerName(tx: Tx): string {
  return tx("{0} (dane demo)", "{0} (demo data)", SELLER_NAME);
}

/**
 * The seller shown on the seller card of the checkout (steps 1-3). ONE place to edit once the company exists:
 * `nip` is null until the owner supplies it (the card then shows no tax id at all); never put an invented number here.
 */
export const PATRON_SELLER: { name: string; nip: string | null } = {
  name: SELLER_NAME,
  nip: null,
};

/** The one contact address of the patron zone (owner decision 2026-10-21). */
export const PATRON_SUPPORT_EMAIL = "support@polutek.com";

export function sellerLine(tx: Tx): string {
  return tx("Sprzedawca: {0}", "Seller: {0}", sellerName(tx));
}

/*
 * VAT wording (lib/config/vat.ts, `VAT_STATUS`). DO UZGODNIENIA z właścicielem/księgowym: sformułowania dla konsumenta w trybie
 * "exempt" (sprzedawca zwolniony podmiotowo z VAT). Podstawa prawna zwolnienia (art. 113 ustawy o VAT) ma być tylko na fakturze,
 * nie w interfejsie. Tryb "active" zachowuje dotychczasowe teksty ("zawiera VAT", ceny brutto). Kwoty płatności są takie same w obu trybach.
 */

/** The short VAT note under the total and on the offer cards. */
export function vatLine(tx: Tx): string {
  return isVatExempt() ? tx("sprzedawca zwolniony z VAT", "seller exempt from VAT") : tx("zawiera VAT", "includes VAT");
}

/** The VAT note in the terms footer (longer than `vatLine`, a full statement). */
export function vatTermsNote(tx: Tx): string {
  return isVatExempt() ? tx("Cena końcowa; sprzedawca jest zwolniony z VAT", "Final price; the seller is exempt from VAT") : tx("zawiera VAT", "includes VAT");
}

/** The label of the total in the order summary. */
export function totalLabel(tx: Tx): string {
  return isVatExempt() ? tx("Razem do zapłaty", "Total to pay") : tx("Razem do zapłaty (brutto)", "Total to pay (incl. VAT)");
}

/** The word after the amount on the receipt ("brutto" while VAT is active; nothing when the seller is exempt: the price is just final). */
export function receiptPriceSuffix(tx: Tx): string {
  return isVatExempt() ? "" : tx("brutto", "gross");
}

/** Stripe method ids and the demo ids share one label (the tip gateway's own tile copy). */
export function methodLabel(tx: Tx, method: string): string {
  return describeTipMethod(method, tx).title;
}

export function price(language: Locale, minor: number, currency: string = "PLN"): string {
  return formatPassPrice(minor, intlLocale(language), currency);
}

export function productName(tx: Tx, id: string): string {
  return id === "ACCESS_LIFETIME" ? tx("Dostęp bez limitu", "Unlimited access") : tx("Dostęp na 30 dni", "30-day access");
}

export function productNote(tx: Tx, product: { days: number | null }): string {
  return product.days === null ? tx("jednorazowo, bez końca", "one-time, no end date") : tx("jednorazowo, {0} dni", "one-time, {0} days", product.days);
}

/** Dates in the site's time zone, so the server and the browser print the same text. */
export function passDate(language: Locale, iso: string, withTime = false): string {
  return new Intl.DateTimeFormat(intlLocale(language), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Warsaw",
  }).format(new Date(iso));
}

/** One random id per checkout attempt (idempotency on the server). */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
