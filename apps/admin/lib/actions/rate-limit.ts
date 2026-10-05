/**
 * In-process rate limit of panel writes, per signed-in admin and action. The panel is one container
 * with a handful of owners, so memory is enough (the same choice as the Better Auth limiter); a restart
 * only resets the counters. Pure over an injectable clock so tests need no timers.
 */
type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 2_000;

export type RateRule = { key: string; max: number; windowMs: number };

/** true = allowed (and counted); false = over the limit. */
export function allowAction(adminId: string, rule: RateRule, now: number = Date.now()): boolean {
  const id = `${adminId}:${rule.key}`;
  const bucket = buckets.get(id) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < rule.windowMs);
  if (bucket.hits.length >= rule.max) {
    buckets.set(id, bucket);
    return false;
  }
  bucket.hits.push(now);
  buckets.set(id, bucket);
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= rule.windowMs)) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}

/** Seconds until the oldest hit leaves the window (for the "try again in N s" message). */
export function retryAfterSeconds(adminId: string, rule: RateRule, now: number = Date.now()): number {
  const bucket = buckets.get(`${adminId}:${rule.key}`);
  const oldest = bucket?.hits[0];
  return oldest === undefined ? 0 : Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000));
}

/** Named rules, so every action says in one place how often it may run. */
export const RATE = {
  settings: { key: "settings", max: 20, windowMs: 60_000 },
  money: { key: "money", max: 10, windowMs: 10 * 60_000 },
  mail: { key: "mail", max: 6, windowMs: 10 * 60_000 },
  template: { key: "template", max: 30, windowMs: 60_000 },
  export: { key: "export", max: 5, windowMs: 10 * 60_000 },
  sync: { key: "sync", max: 20, windowMs: 60_000 },
  security: { key: "security", max: 20, windowMs: 60_000 },
  upload: { key: "upload", max: 10, windowMs: 60_000 },
  ai: { key: "ai", max: 5, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateRule>;

/** Interface used by the community actions (apps/admin/lib/actions/run.ts): same engine and store as `allowAction`. */
export type LimitRule = { bucket: string; max: number; windowMs: number };

export function checkRateLimit(actor: string, rule: LimitRule, now: number = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const r: RateRule = { key: rule.bucket, max: rule.max, windowMs: rule.windowMs };
  if (allowAction(actor, r, now)) return { ok: true };
  return { ok: false, retryAfterSeconds: retryAfterSeconds(actor, r, now) };
}
