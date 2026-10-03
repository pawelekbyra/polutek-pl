/**
 * Limits (per minute, per admin user and per IP):
 *   GET/HEAD default 120, mutations default 120 (bulk comment moderation fires
 *   up to 50 POSTs at once), refund 5, dispute-sync 5, emails/broadcast 3, emails/broadcast/test 5,
 *   notifications/broadcast 3, users/[userId]/patron 10, payment-settings 10, video upload start/complete/abort 20.
 *
 * Central rate limiting for /api/admin, enforced from middleware.ts.
 *
 * Keyed by admin user id (when the session is known) AND by IP, so both
 * a stolen session and a single host are bounded. Fail-open: if the store is
 * unavailable (e.g. missing Redis env in production, Upstash outage) we log and
 * let the request through (same for a store call slower than
 * ADMIN_RATE_LIMIT_TIMEOUT_MS) - the admin routes are already auth-gated, and
 * locking the only admin out on an infra hiccup is worse than a missed limit.
 */
import { getClientIp } from "@/lib/api/client-ip";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const ADMIN_RATE_WINDOW_MS = 60_000;
export const ADMIN_DEFAULT_GET_LIMIT = 120;
export const ADMIN_DEFAULT_MUTATION_LIMIT = 120;
// Hard cap on the store round-trip; on timeout we fail open.
export const ADMIN_RATE_LIMIT_TIMEOUT_MS = 700;

type StrictRule = { name: string; pattern: RegExp; limit: number; mutationsOnly?: boolean };

// First match wins. Patterns match the pathname only.
export const ADMIN_STRICT_RULES: StrictRule[] = [
  { name: "payments-refund", pattern: /^\/api\/admin\/payments\/[^/]+\/refund\/?$/, limit: 5 },
  { name: "payments-dispute-sync", pattern: /^\/api\/admin\/payments\/[^/]+\/dispute-sync\/?$/, limit: 5 },
  { name: "emails-broadcast", pattern: /^\/api\/admin\/emails\/broadcast\/?$/, limit: 3, mutationsOnly: true },
  { name: "emails-broadcast-test", pattern: /^\/api\/admin\/emails\/broadcast\/test\/?$/, limit: 5, mutationsOnly: true },
  { name: "notifications-broadcast", pattern: /^\/api\/admin\/notifications\/broadcast\/?$/, limit: 3, mutationsOnly: true },
  { name: "users-patron", pattern: /^\/api\/admin\/users\/[^/]+\/patron\/?$/, limit: 10, mutationsOnly: true },
  { name: "payment-settings", pattern: /^\/api\/admin\/payment-settings\/?$/, limit: 10, mutationsOnly: true },
  { name: "video-upload", pattern: /^\/api\/admin\/videos\/[^/]+\/original-upload\/multipart(\/complete)?\/?$/, limit: 20, mutationsOnly: true },
];

export type AdminRateBucket = { bucket: string; limit: number };

export function resolveAdminRateBucket(pathname: string, method: string): AdminRateBucket {
  const m = method.toUpperCase();
  const isMutation = m !== "GET" && m !== "HEAD";
  for (const rule of ADMIN_STRICT_RULES) {
    if (rule.pattern.test(pathname) && (isMutation || !rule.mutationsOnly)) {
      return { bucket: rule.name, limit: rule.limit };
    }
  }
  return isMutation
    ? { bucket: "mutation", limit: ADMIN_DEFAULT_MUTATION_LIMIT }
    : { bucket: "read", limit: ADMIN_DEFAULT_GET_LIMIT };
}

export function getAdminClientIp(headers: Headers) {
  return getClientIp(headers);
}

export type AdminRateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number; bucket: string };

export async function checkAdminRateLimit(input: {
  pathname: string;
  method: string;
  userId: string | null;
  ip: string;
  limiter?: typeof rateLimit;
}): Promise<AdminRateLimitResult> {
  const { bucket, limit } = resolveAdminRateBucket(input.pathname, input.method);
  const limiter = input.limiter ?? rateLimit;
  const keys = [`admin:${bucket}:ip:${input.ip}`];
  if (input.userId) keys.unshift(`admin:${bucket}:user:${input.userId}`);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const checks = Promise.all(
      keys.map((key) => limiter({ key, limit, windowMs: ADMIN_RATE_WINDOW_MS })),
    );
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), ADMIN_RATE_LIMIT_TIMEOUT_MS);
    });
    // Avoid an unhandled rejection if the store fails after the timeout won.
    checks.catch(() => undefined);
    const outcome = await Promise.race([checks, timeout]);
    if (outcome === "timeout") {
      logger.warn("[AdminRateLimit] Store timed out, failing open", { bucket });
      return { limited: false };
    }
    if (outcome.some((r) => !r.success)) {
      return { limited: true, retryAfterSeconds: Math.ceil(ADMIN_RATE_WINDOW_MS / 1000), bucket };
    }
  } catch (error) {
    logger.warn("[AdminRateLimit] Store unavailable, failing open", error);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return { limited: false };
}
