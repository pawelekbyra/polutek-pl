// experiment: premium-pass (docs/experiments/premium-pass.md)
// The offer the browser gets inside a PASS_REQUIRED playback plan and from /api/user/premium-pass. Offer data, never
// access data: it carries no source, token or session. Pure, safe on the client.
import { PATRON_CURRENCY, PATRON_DEFAULT_PRODUCT_ID, PATRON_PRODUCTS, PATRON_VAT_RATE_PERCENT, patronProduct, type PatronProductId } from "./config";
import { readPremiumPaymentsDto, type PremiumPaymentsDto } from "./payments-mode";

export type PatronOfferProduct = { id: PatronProductId; days: number | null; priceMinor: number; bestValue?: true };

export type PremiumPassOffer = {
  currency: typeof PATRON_CURRENCY;
  vatRatePercent: number;
  /** The two options, in display order. The server derives every amount from its own table, not from this copy. */
  products: PatronOfferProduct[];
  defaultProductId: PatronProductId;
  /** Number of videos in the patron zone (for "All patron zone videos (2)"). */
  premiumCount: number;
  signedIn: boolean;
  /** The viewer's own access ended on this date (ISO): shows the "expired" banner. */
  expiredAt?: string;
  /** Demo or Stripe (and the "Tryb testowy" flag); the server decides, the browser only displays it. */
  payments: PremiumPaymentsDto;
};

export function buildPremiumPassOffer(args: {
  signedIn: boolean;
  premiumCount: number;
  expiredAt?: string | null;
  payments?: PremiumPaymentsDto;
}): PremiumPassOffer {
  return {
    currency: PATRON_CURRENCY,
    vatRatePercent: PATRON_VAT_RATE_PERCENT,
    products: PATRON_PRODUCTS.map((p) => ({ id: p.id, days: p.days, priceMinor: p.priceMinor, ...(p.bestValue ? { bestValue: true as const } : {}) })),
    defaultProductId: PATRON_DEFAULT_PRODUCT_ID,
    premiumCount: args.premiumCount,
    signedIn: args.signedIn,
    ...(args.expiredAt ? { expiredAt: args.expiredAt } : {}),
    payments: args.payments ?? { mode: "demo" },
  };
}

/** Only well-formed offers reach the UI (a plan is parsed defensively, like every plan field). */
export function readPremiumPassOffer(value: unknown): PremiumPassOffer | null {
  if (!value || typeof value !== "object") return null;
  const offer = value as Partial<PremiumPassOffer>;
  if (!offer.payments || typeof offer.payments !== "object" || !Array.isArray(offer.products)) return null;
  const products = offer.products.filter(
    (p): p is PatronOfferProduct => !!p && patronProduct(p.id) !== null && Number.isInteger(p.priceMinor) && (p.days === null || Number.isInteger(p.days)),
  );
  if (products.length === 0) return null;
  const base = buildPremiumPassOffer({ signedIn: offer.signedIn === true, premiumCount: typeof offer.premiumCount === "number" ? offer.premiumCount : 0 });
  return {
    ...base,
    vatRatePercent: typeof offer.vatRatePercent === "number" ? offer.vatRatePercent : base.vatRatePercent,
    products,
    defaultProductId: products.some((p) => p.id === offer.defaultProductId) ? (offer.defaultProductId as PatronProductId) : products[0]!.id,
    ...(typeof offer.expiredAt === "string" ? { expiredAt: offer.expiredAt } : {}),
    payments: readPremiumPaymentsDto(offer.payments),
  };
}

/** `29,99 zł` (pl), `PLN 29.99` (en), local format elsewhere. `intlLocale` comes from lib/i18n/ui. */
export function formatPassPrice(priceMinor: number, locale: string, currency: string = PATRON_CURRENCY): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(priceMinor / 100);
}

export function cheapestProduct(offer: Pick<PremiumPassOffer, "products">): PatronOfferProduct {
  return offer.products.reduce((min, p) => (p.priceMinor < min.priceMinor ? p : min), offer.products[0]!);
}

export function defaultProduct(offer: Pick<PremiumPassOffer, "products" | "defaultProductId">): PatronOfferProduct {
  return offer.products.find((p) => p.id === offer.defaultProductId) ?? offer.products[0]!;
}
