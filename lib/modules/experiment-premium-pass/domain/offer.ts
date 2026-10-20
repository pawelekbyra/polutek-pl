// experiment: premium-pass (docs/experiments/premium-pass.md)
// The offer the browser gets inside a PASS_REQUIRED playback plan and from /api/user/premium-pass. Offer data, never
// access data: it carries no source, token or session. Pure, safe on the client.
import { PASS_CURRENCY, PASS_PRODUCTS, PASS_VAT_RATE_PERCENT, type PassProductId } from "./config";

export type PassOfferProduct = { id: PassProductId; days: number; priceMinor: number; bestValue?: true };

export type PremiumPassOffer = {
  demo: true;
  currency: typeof PASS_CURRENCY;
  vatRatePercent: number;
  products: PassOfferProduct[];
  /** Number of videos behind the pass (for "All Premium videos (2)"). */
  premiumCount: number;
  signedIn: boolean;
  /** The viewer's own pass ended on this date (ISO): shows the "expired" banner. */
  expiredAt?: string;
};

export function buildPremiumPassOffer(args: { signedIn: boolean; premiumCount: number; expiredAt?: string | null }): PremiumPassOffer {
  return {
    demo: true,
    currency: PASS_CURRENCY,
    vatRatePercent: PASS_VAT_RATE_PERCENT,
    products: PASS_PRODUCTS.map((p) => ({ id: p.id, days: p.days, priceMinor: p.priceMinor, ...(p.bestValue ? { bestValue: true as const } : {}) })),
    premiumCount: args.premiumCount,
    signedIn: args.signedIn,
    ...(args.expiredAt ? { expiredAt: args.expiredAt } : {}),
  };
}

/** Only well-formed offers reach the UI (a plan is parsed defensively, like every plan field). */
export function readPremiumPassOffer(value: unknown): PremiumPassOffer | null {
  if (!value || typeof value !== "object") return null;
  const offer = value as Partial<PremiumPassOffer>;
  if (offer.demo !== true || !Array.isArray(offer.products) || offer.products.length === 0) return null;
  const products = offer.products.filter(
    (p): p is PassOfferProduct => !!p && typeof p.id === "string" && Number.isInteger(p.days) && Number.isInteger(p.priceMinor),
  );
  if (products.length === 0) return null;
  return {
    demo: true,
    currency: PASS_CURRENCY,
    vatRatePercent: typeof offer.vatRatePercent === "number" ? offer.vatRatePercent : PASS_VAT_RATE_PERCENT,
    products,
    premiumCount: typeof offer.premiumCount === "number" ? offer.premiumCount : 0,
    signedIn: offer.signedIn === true,
    ...(typeof offer.expiredAt === "string" ? { expiredAt: offer.expiredAt } : {}),
  };
}

/** `14,99 zł` (pl), `PLN 14.99` (en), local format elsewhere. `intlLocale` comes from lib/i18n/ui. */
export function formatPassPrice(priceMinor: number, locale: string, currency: string = PASS_CURRENCY): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(priceMinor / 100);
}

export function cheapestProduct(offer: Pick<PremiumPassOffer, "products">): PassOfferProduct {
  return offer.products.reduce((min, p) => (p.priceMinor < min.priceMinor ? p : min), offer.products[0]!);
}

export function defaultProduct(offer: Pick<PremiumPassOffer, "products">): PassOfferProduct {
  return offer.products.find((p) => p.bestValue) ?? offer.products[0]!;
}
