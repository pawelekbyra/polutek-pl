/**
 * Central rate limiting for /api/admin, enforced from middleware.ts.
 *
 * Keyed by admin user id (when the Clerk session is known) AND by IP, so both
 * a stolen session and a single host are bounded. Fail-open: if the store is
 * unavailable (e.g. missing Redis env in production, Upstash outage) we log and
 * let the request through - the admin routes are already auth-gated, and
 * locking the only admin out on an infra hiccup is worse than a missed limit.
 */
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const ADMIN_RATE_WINDOW_MS = 60_000;
export const ADMIN_DEFAULT_GET_LIMIT = 120;
export const ADMIN_DEFAULT_MUTATION_LIMIT = 40;

type StrictRule = { name: string; pattern: RegExp; limit: number; mutationsOnly?: boolean };

// First match wins. Patterns match the pathname only.
export const ADMIN_STRICT_RULES: StrictRule[] = [
  { name: "payments-refund", pattern: /^\/api\/admin\/payments\/[^/]+\/refund\/?$/, limit: 5 },
  { name: "payments-dispute-sync", pattern: /^\/api\/admin\/payments\/[^/]+\/dispute-sync\/?$/, limit: 5 },
  { name: "emails-broadcast", pattern: /^\/api\/admin\/emails\/broadcast\/?$/, limit: 3, mutationsOnly: true },
  { name: "notifications-broadcast", pattern: /^\/api\/admin\/notifications\/broadcast\/?$/, limit: 3, mutationsOnly: true },
  { name: "users-patron", pattern: /^\/api\/admin\/users\/[^/]+\/patron\/?$/, limit: 10, mutationsOnly: true },
  { name: "payment-settings", pattern: /^\/api\/admin\/payment-settings\/?$/, limit: 10, mutationsOnly: true },
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
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return forwarded?.[forwarded.length - 1] || headers.get("x-real-ip")?.trim() || "unknown";
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

  try {
    for (const key of keys) {
      const result = await limiter({ key, limit, windowMs: ADMIN_RATE_WINDOW_MS });
      if (!result.success) {
        return { limited: true, retryAfterSeconds: Math.ceil(ADMIN_RATE_WINDOW_MS / 1000), bucket };
      }
    }
  } catch (error) {
    logger.warn("[AdminRateLimit] Store unavailable, failing open", error);
  }
  return { limited: false };
}
