import { createRateLimitStore, type RateLimitStore } from "@/lib/rate-limit";

let store: RateLimitStore | null = null;

function getStore() {
  store ??= createRateLimitStore();
  return store;
}

/**
 * Better Auth rate-limit storage on the app's own Redis REST store (Upstash-compatible).
 * `consume` records one request atomically (Lua INCR + PEXPIRE) so concurrent requests cannot
 * pass the same stale counter. Outside production without Redis it falls back to memory.
 */
export const authRateLimitStorage = {
  async consume(key: string, rule: { window: number; max: number }) {
    const record = await getStore().hit(`ba:${key}`, rule.window * 1000);
    if (record.count > rule.max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((record.resetAt - Date.now()) / 1000)) };
    }
    return { allowed: true, retryAfter: null };
  },
};

/** Counts one attempt for an arbitrary key (per-account sign-in lockout). */
export async function hitAuthCounter(key: string, windowSeconds: number) {
  return getStore().hit(`ba:${key}`, windowSeconds * 1000);
}

/** Reads an arbitrary counter without counting (see `hitAuthCounter`). */
export async function peekAuthCounter(key: string) {
  return getStore().peek(`ba:${key}`);
}
