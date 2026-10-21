// patron zone (docs/architecture/patron-zone.md)
// The feature switch of the patron zone (the env names are historical and stay: PREMIUM_PASS_EXPERIMENT = off|testers|all).
// Pure: no I/O, safe on the client. Every place that behaves differently for the patron zone asks only
// `premiumPassFor()` / `isPremiumPassVideo()` from here. Money only flows in `PREMIUM_PASS_PAYMENTS=stripe` mode
// (domain/payments-mode.ts); the default `demo` never takes any.

import type { Actor } from "@/lib/modules/shared/actor";
import { isUpcomingPremiere } from "@/lib/premiere";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";

export type PremiumPassMode = "off" | "testers" | "all";

/**
 * The patron zone: a choice of TWO FIXED OPTIONS (owner decision 2026-10-21, replaces pay-what-you-want). The server
 * knows only these product ids and derives the amount from this table: it never takes an amount from the client.
 * A 30-day option adds 30 days (from the current end when still active); the unlimited option is a lifetime grant.
 * Nothing renews by itself (no subscription).
 */
export const PATRON_VAT_RATE_PERCENT = 23;
/** Access can be extended by 30-day payments, but never to more than this many days ahead of now. */
export const PATRON_MAX_AHEAD_DAYS = 365;

/** The currencies the tip gateway supports (lib/constants.ts) are the currencies of the patron checkout. */
export const PATRON_CURRENCIES = SUPPORTED_CURRENCIES;
export type PatronCurrency = SupportedCurrency;
/** The currency of a Polish viewer and the fallback of everything else (the first currency of the product table). */
export const PATRON_CURRENCY: PatronCurrency = "PLN";

export type PatronProductId = "ACCESS_30D" | "ACCESS_LIFETIME";

export type PatronProduct = {
  id: PatronProductId;
  /** Days of access added by one payment; null = lifetime (unlimited). */
  days: number | null;
  /** Shown as a plain "best value" label; never a discount claim. */
  bestValue?: true;
};

export const PATRON_PRODUCTS: readonly PatronProduct[] = [
  { id: "ACCESS_30D", days: 30 },
  { id: "ACCESS_LIFETIME", days: null, bestValue: true },
] as const;

/**
 * THE price table: product x currency, gross amounts in minor units (VAT 23% included), one honest price each (no
 * strikethrough, no "was" price). PLN is the owner's price; the other currencies are round-ish retail prices at roughly
 * the PLN price at 2026-10 rates (1 PLN ~ 0.24 EUR / 0.27 USD / 0.20 GBP / 0.22 CHF), all above Stripe's minimum charge.
 * The owner edits the numbers here; the server derives every amount from this table and the fulfilment verifies
 * amount and currency against it. The browser only names a product and a currency.
 */
export const PATRON_PRICES: Readonly<Record<PatronProductId, Readonly<Record<PatronCurrency, number>>>> = {
  ACCESS_30D: { PLN: 1499, EUR: 399, USD: 449, GBP: 349, CHF: 399 },
  ACCESS_LIFETIME: { PLN: 2999, EUR: 799, USD: 899, GBP: 699, CHF: 799 },
};

/** The price of a product in a currency, or null for an unknown product or currency (nothing is ever guessed). */
export function patronPrice(productId: unknown, currency: unknown): number | null {
  if (typeof productId !== "string" || typeof currency !== "string") return null;
  const row = (PATRON_PRICES as Record<string, Record<string, number> | undefined>)[productId];
  const amount = row?.[currency.toUpperCase()];
  return typeof amount === "number" ? amount : null;
}

export function isPatronCurrency(value: unknown): value is PatronCurrency {
  return typeof value === "string" && (PATRON_CURRENCIES as readonly string[]).includes(value);
}

/**
 * The currency a page without a browser (the offer page, rendered on the server) shows: Polish gets PLN, German, French,
 * Italian, Spanish and Portuguese get EUR, the rest USD. The checkout itself starts from the tip gateway's own
 * `detectDefaultCurrency` and lets the viewer change it.
 */
export function patronCurrencyForLanguage(language: string): PatronCurrency {
  if (language === "pl") return "PLN";
  return ["de", "fr", "it", "es", "pt"].includes(language) ? "EUR" : "USD";
}

export const PATRON_DEFAULT_PRODUCT_ID: PatronProductId = "ACCESS_LIFETIME";

export function patronProduct(id: unknown): PatronProduct | null {
  return PATRON_PRODUCTS.find((product) => product.id === id) ?? null;
}

/** Owner decision 2026-10-20: locked videos when PREMIUM_PASS_VIDEO_SLUGS is not set (config, never a DB tier change). */
export const DEFAULT_PREMIUM_SLUGS: readonly string[] = ["jj", "test-transkodowania"];

export type PremiumPassConfig = {
  mode: Exclude<PremiumPassMode, "off">;
  testerIds: ReadonlySet<string>;
  slugs: ReadonlySet<string>;
};

/** Reads PREMIUM_PASS_EXPERIMENT, PREMIUM_PASS_TESTER_IDS, PREMIUM_PASS_VIDEO_SLUGS (app.env, runtime). */
type PremiumPassEnv = Readonly<Record<string, string | undefined>>;

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Any value other than `testers` or `all` (missing, typo, `on`) is `off`. */
export function parsePremiumPassMode(value: string | undefined): PremiumPassMode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "testers" || normalized === "all" ? normalized : "off";
}

/** The patron zone configuration, or null when it is off. Read at request time (app.env, no rebuild). */
export function readPremiumPassConfig(env: PremiumPassEnv = process.env): PremiumPassConfig | null {
  const mode = parsePremiumPassMode(env.PREMIUM_PASS_EXPERIMENT);
  if (mode === "off") return null;
  const slugs = env.PREMIUM_PASS_VIDEO_SLUGS === undefined ? [...DEFAULT_PREMIUM_SLUGS] : list(env.PREMIUM_PASS_VIDEO_SLUGS);
  return { mode, testerIds: new Set(list(env.PREMIUM_PASS_TESTER_IDS)), slugs: new Set(slugs.map((slug) => slug.toLowerCase())) };
}

function actorUserId(actor: Actor): string | null {
  return actor.type === "user" || actor.type === "admin" ? actor.userId : null;
}

/**
 * The configuration when the patron zone is visible to this viewer, else null (the site behaves exactly as without
 * it). `all`: everyone, guests and ADMIN included (owner decision: the owner sees the paywall on his own account).
 * `testers`: only the listed account ids. `system` actors (workers, crons) never see it.
 */
export function premiumPassFor(actor: Actor, env: PremiumPassEnv = process.env): PremiumPassConfig | null {
  const config = readPremiumPassConfig(env);
  if (!config || actor.type === "system") return null;
  if (config.mode === "all") return config;
  const userId = actorUserId(actor);
  return userId && config.testerIds.has(userId) ? config : null;
}

export type PremiumPassVideoFacts = {
  slug?: string | null;
  status?: string | null;
  isMainFeatured?: boolean | null;
  premiereAt?: Date | string | null;
};

let warnedSlugs: Set<string> | null = null;
function warnIgnoredOnce(slug: string, why: string) {
  warnedSlugs ??= new Set();
  if (warnedSlugs.has(slug)) return;
  warnedSlugs.add(slug);
  console.warn(`[premium-pass] slug "${slug}" ignored: ${why}`);
}

/**
 * Whether a video sits behind the pass. Only listed, live (PUBLISHED or UNLISTED) videos that are neither the hero
 * nor an upcoming premiere: the hero stays the free trailer and a premiere keeps its own cockpit.
 */
export function isPremiumPassVideo(video: PremiumPassVideoFacts, config: PremiumPassConfig, now: Date = new Date()): boolean {
  const slug = video.slug?.toLowerCase();
  if (!slug || !config.slugs.has(slug)) return false;
  if (video.status !== "PUBLISHED" && video.status !== "UNLISTED") {
    warnIgnoredOnce(slug, "not published");
    return false;
  }
  if (video.isMainFeatured) {
    warnIgnoredOnce(slug, "hero video");
    return false;
  }
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, now)) {
    warnIgnoredOnce(slug, "upcoming premiere");
    return false;
  }
  return true;
}

/**
 * Viewer-independent marker for public DTOs, cards, embeds and structured data: true only in mode `all`, where the
 * video is behind the pass for every visitor. In `testers` mode nothing public changes.
 */
export function isPremiumPassVideoForEveryone(video: PremiumPassVideoFacts, env: PremiumPassEnv = process.env, now: Date = new Date()): boolean {
  const config = readPremiumPassConfig(env);
  return config?.mode === "all" && isPremiumPassVideo(video, config, now);
}
