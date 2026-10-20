// experiment: premium-pass (docs/experiments/premium-pass.md)
// The one switch of the demo "backstage pass" experiment. Pure: no I/O, safe on the client. Every place that
// behaves differently during the experiment asks only `premiumPassFor()` / `isPremiumPassVideo()` from here.
// The experiment never takes money: there is no payment provider behind it (see checkout-demo.use-case.ts).

import type { Actor } from "@/lib/modules/shared/actor";
import { isUpcomingPremiere } from "@/lib/premiere";

export const PREMIUM_PASS_EXPERIMENT_ID = "premium-pass";

export type PremiumPassMode = "off" | "testers" | "all";

export type PassProductId = "PASS_7D" | "PASS_30D";

export type PassProduct = {
  id: PassProductId;
  days: number;
  /** Gross price in minor units (grosze), VAT included. One honest price: no strikethrough, no "was" price. */
  priceMinor: number;
  /** Shown as a plain "best value" label; never a discount claim. */
  bestValue?: true;
};

/** Owner decision 2026-10-20: two passes, fixed prices (gross, 23% VAT included). */
export const PASS_PRODUCTS: readonly PassProduct[] = [
  { id: "PASS_7D", days: 7, priceMinor: 1499 },
  { id: "PASS_30D", days: 30, priceMinor: 2900, bestValue: true },
] as const;

export const PASS_CURRENCY = "PLN";
export const PASS_VAT_RATE_PERCENT = 23;
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

/** The experiment configuration, or null when it is off. Read at request time (app.env, no rebuild). */
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
 * The configuration when the experiment is visible to this viewer, else null (the site behaves exactly as without
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

export function passProduct(id: string | null | undefined): PassProduct | null {
  return PASS_PRODUCTS.find((product) => product.id === id) ?? null;
}
