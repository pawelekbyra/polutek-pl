type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

/**
 * Basic in-memory rate limiter for development.
 * TODO: Use Upstash Redis or similar for production.
 */
const cache = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const record = cache.get(key);

  if (!record || now > record.resetAt) {
    cache.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count };
}
