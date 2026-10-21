// experiment: premium-pass (docs/experiments/premium-pass.md): shared labels and formatting of the patron-zone UI.
import type { Tx } from "@/lib/i18n/ui";
import { intlLocale } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { formatPassPrice } from "@/lib/modules/experiment-premium-pass/domain/offer";
import { describeTipMethod } from "../support/tip-flow-config";

/** Owner decision 2026-10-20: the seller shown in the checkout and the receipt (the company does not exist yet). */
export function sellerName(tx: Tx): string {
  return tx("POLUTEK Sp. z o.o. (dane demo)", "POLUTEK Sp. z o.o. (demo data)");
}

export function sellerLine(tx: Tx): string {
  return tx("Sprzedawca: {0}", "Seller: {0}", sellerName(tx));
}

export function vatLine(tx: Tx, rate: number): string {
  return tx("kwota brutto, zawiera {0}% VAT", "gross amount, includes {0}% VAT", rate);
}

/** Stripe method ids and the demo ids share one label (the tip gateway's own tile copy). */
export function methodLabel(tx: Tx, method: string): string {
  return describeTipMethod(method, tx).title;
}

export function price(language: Locale, minor: number): string {
  return formatPassPrice(minor, intlLocale(language));
}

/** `zł` (pl), `PLN` (en): the currency sign next to the amount field. */
export function currencySymbol(language: Locale): string {
  const part = new Intl.NumberFormat(intlLocale(language), { style: "currency", currency: "PLN" }).formatToParts(0).find((p) => p.type === "currency");
  return part?.value ?? "PLN";
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

/**
 * The amount field: "25", "25,5" or "25.50" in the site currency; at most two decimals. Returns minor units, or null
 * for anything that is not a plain positive amount. The server validates again (integer, min, max).
 */
export function parseAmountInput(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;
  const minor = Math.round(Number(text) * 100);
  return Number.isFinite(minor) && minor > 0 ? minor : null;
}
