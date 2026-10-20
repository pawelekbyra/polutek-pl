// experiment: premium-pass (docs/experiments/premium-pass.md): shared labels and formatting of the demo pass UI.
import type { Tx } from "@/lib/i18n/ui";
import { intlLocale } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { formatPassPrice } from "@/lib/modules/experiment-premium-pass/domain/offer";
import type { PassProductId } from "@/lib/modules/experiment-premium-pass/domain/config";
import type { PassMethod } from "@/lib/modules/experiment-premium-pass/domain/pass-state";

/** Owner decision 2026-10-20: the seller shown in the demo checkout and receipt. */
export function sellerName(tx: Tx): string {
  return tx("POLUTEK Sp. z o.o. (dane demo)", "POLUTEK Sp. z o.o. (demo data)");
}

export function sellerLine(tx: Tx): string {
  return tx("Sprzedawca: {0}", "Seller: {0}", sellerName(tx));
}

export function vatLine(tx: Tx, rate: number): string {
  return tx("cena brutto, zawiera {0}% VAT", "gross price, includes {0}% VAT", rate);
}

export function passName(tx: Tx, id: PassProductId | string): string {
  return id === "PASS_7D" ? tx("Wejściówka 7 dni", "7-day pass") : tx("Wejściówka 30 dni", "30-day pass");
}

export function methodLabel(tx: Tx, method: PassMethod | string): string {
  switch (method) {
    case "blik":
      return "BLIK";
    case "card":
      return tx("Karta", "Card");
    case "apple_pay":
      return "Apple Pay";
    case "google_pay":
      return "Google Pay";
    default:
      return "Przelewy24";
  }
}

export function price(language: Locale, minor: number): string {
  return formatPassPrice(minor, intlLocale(language));
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
