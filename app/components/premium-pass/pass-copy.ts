// patron zone (docs/architecture/patron-zone.md): shared labels and formatting of the patron-zone UI.
import type { Tx } from "@/lib/i18n/ui";
import { intlLocale } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { formatPassPrice } from "@/lib/modules/patron-zone/domain/offer";
import { describeTipMethod } from "../support/tip-flow-config";

/** Owner decision 2026-10-20: the seller shown in the checkout and the receipt (the company does not exist yet). */
export function sellerName(tx: Tx): string {
  return tx("POLUTEK Sp. z o.o. (dane demo)", "POLUTEK Sp. z o.o. (demo data)");
}

/**
 * The seller shown on the seller card of the checkout (steps 1-3). ONE place to edit once the company exists:
 * `nip` is null until the owner supplies it (the card then shows no tax id at all); never put an invented number here.
 * `registryLine` is the claim "registered in Poland": the owner must confirm it when the company is registered.
 */
export const PATRON_SELLER: { name: string; registryLine: (tx: Tx) => string; nip: string | null } = {
  name: "POLUTEK Sp. z o.o.",
  registryLine: (tx) => tx("Spółka zarejestrowana w Polsce", "Company registered in Poland"),
  nip: null,
};

/** The one contact address of the patron zone (owner decision 2026-10-21). */
export const PATRON_SUPPORT_EMAIL = "support@polutek.com";

export function sellerLine(tx: Tx): string {
  return tx("Sprzedawca: {0}", "Seller: {0}", sellerName(tx));
}

export function vatLine(tx: Tx): string {
  return tx("zawiera VAT", "includes VAT");
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
