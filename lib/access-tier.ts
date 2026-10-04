/**
 * Video access levels (owner decision 2026-10-04): two, PUBLIC (everyone) and LOGGED_IN (any
 * signed-in account). The database enum `AccessTier` still has the old `PATRON` value until a
 * cleanup migration drops it; migration 20261004230000 moved every video off it. Code reads a tier
 * only through these helpers, so a stray PATRON row behaves exactly like LOGGED_IN. Pure and
 * client-safe.
 */
export const VIDEO_ACCESS_TIERS = ["PUBLIC", "LOGGED_IN"] as const;
export type VideoAccessTier = (typeof VIDEO_ACCESS_TIERS)[number];

/** The effective level of a stored tier: PUBLIC stays PUBLIC, anything else needs sign-in (fail closed). */
export function toVideoAccessTier(tier: unknown): VideoAccessTier {
  return tier === "PUBLIC" ? "PUBLIC" : "LOGGED_IN";
}

/** A tier sent by the admin: a current level, the legacy PATRON mapped to LOGGED_IN, otherwise null. */
export function parseVideoAccessTier(value: unknown): VideoAccessTier | null {
  if (value === "PUBLIC" || value === "LOGGED_IN") return value;
  if (value === "PATRON") return "LOGGED_IN";
  return null;
}

/**
 * Prisma `tier` condition for an admin list filter ("PUBLIC", "LOGGED_IN"; anything else = no
 * filter). LOGGED_IN matches every non-public row, so a leftover PATRON row is listed with it.
 */
export function accessTierWhere(value: unknown): "PUBLIC" | { not: "PUBLIC" } | undefined {
  const tier = parseVideoAccessTier(value);
  if (tier === "PUBLIC") return "PUBLIC";
  if (tier === "LOGGED_IN") return { not: "PUBLIC" };
  return undefined;
}
