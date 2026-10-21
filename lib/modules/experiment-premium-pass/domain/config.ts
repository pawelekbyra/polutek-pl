// experiment: premium-pass (docs/experiments/premium-pass.md)
// The one switch of the demo "backstage pass" experiment. Pure: no I/O, safe on the client. Every place that
// behaves differently during the experiment asks only `premiumPassFor()` / `isPremiumPassVideo()` from here.
// Money only flows in `PREMIUM_PASS_PAYMENTS=stripe` mode (domain/payments-mode.ts); the default `demo` never takes any.

import type { Actor } from "@/lib/modules/shared/actor";
import { isUpcomingPremiere } from "@/lib/premiere";

export const PREMIUM_PASS_EXPERIMENT_ID = "premium-pass";

export type PremiumPassMode = "off" | "testers" | "all";

/**
 * The patron zone: pay what you want (a suggested amount or your own), every payment grants the same access time.
 * Decisions (docs/experiments/premium-pass.md, "Strefa patrona"): the amount does not change the length of access,
 * a payment while access is active extends it, and nothing renews by itself (no subscription).
 */
export const PATRON_CURRENCY = "PLN";
export const PATRON_VAT_RATE_PERCENT = 23;
/** Days of patron-zone access one successful payment grants (added to the current end when still active). */
export const PATRON_ACCESS_DAYS = 30;
/** Access can be extended by paying again, but never to more than this many days ahead of now. */
export const PATRON_MAX_AHEAD_DAYS = 365;
/** Gross amounts in minor units (grosze). The minimum is also above Stripe's own floor for PLN (2 zł). */
export const PATRON_MIN_MINOR = 2000;
export const PATRON_MAX_MINOR = 100_000;
export const PATRON_SUGGESTED_MINOR: readonly number[] = [];
export const PATRON_DEFAULT_MINOR = 2000;

/** The one place that decides whether an amount may be charged: integer minor units within [min, max]. */
export function validatePatronAmount(amountMinor: unknown): "INTEGER" | "TOO_LOW" | "TOO_HIGH" | null {
  if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor)) return "INTEGER";
  if (amountMinor < PATRON_MIN_MINOR) return "TOO_LOW";
  if (amountMinor > PATRON_MAX_MINOR) return "TOO_HIGH";
  return null;
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
