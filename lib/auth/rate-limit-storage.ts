import { createRateLimitStore, type RateLimitStore } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

let store: RateLimitStore | null = null;

function getStore() {
  store ??= createRateLimitStore();
  return store;
}

/** Test hook: replace the store (null = build it again from the environment on next use). */
export function setAuthRateLimitStoreForTests(next: RateLimitStore | null) {
  store = next;
}

/**
 * Deliberate failure policy (audit AUTH-12): when the Redis gateway is down or slow (every command
 * has a timeout, see REDIS_COMMAND_TIMEOUT_MS), auth counters FAIL OPEN and log an error, so sign-in,
 * sign-up, 2FA and sign-out keep working instead of hanging or answering 500 for everybody.
 *
 * What still protects the auth endpoints while the counters are blind:
 * - Cloudflare Turnstile on sign-up / sign-in / password reset / resend (one solved check per request);
 * - TOTP has its own attempt counter in the database (Better Auth two-factor plugin);
 * - change e-mail and account deletion require the password (or a fresh Google sign-in).
 * The failed-sign-in lockout is the one counter where failing open lowers protection (password
 * guessing is then bounded only by Turnstile). Failing closed there would lock every user out of
 * password sign-in during a Redis outage, which is the worse trade for a single-server site; the
 * error log makes the outage visible.
 */
function reportStoreFailure(operation: string, error: unknown) {
  logger.error(
    `[auth-rate-limit] ${operation} failed, failing open`,
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Better Auth rate-limit storage on the app's own Redis REST store (Upstash-compatible).
 * `consume` records one request atomically (Lua INCR + PEXPIRE) so concurrent requests cannot
 * pass the same stale counter. Outside production without Redis it falls back to memory.
 */
export const authRateLimitStorage = {
  async consume(key: string, rule: { window: number; max: number }) {
    try {
      const record = await getStore().hit(`ba:${key}`, rule.window * 1000);
      if (record.count > rule.max) {
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((record.resetAt - Date.now()) / 1000)) };
      }
    } catch (error) {
      reportStoreFailure("consume", error);
    }
    return { allowed: true, retryAfter: null };
  },
};

/** Counts one attempt for an arbitrary key; returns the new count, or 0 when the store is unavailable. */
export async function hitAuthCounter(key: string, windowSeconds: number): Promise<number> {
  try {
    const record = await getStore().hit(`ba:${key}`, windowSeconds * 1000);
    return record.count;
  } catch (error) {
    reportStoreFailure("hit", error);
    return 0;
  }
}

/** Reads an arbitrary counter without counting (see `hitAuthCounter`); 0 when the store is unavailable. */
export async function peekAuthCounter(key: string): Promise<number> {
  try {
    return await getStore().peek(`ba:${key}`);
  } catch (error) {
    reportStoreFailure("peek", error);
    return 0;
  }
}
