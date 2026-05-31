type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

/**
 * In-memory rate limiter with support for persistent store adapter.
 * For production, consider using a Redis-backed adapter.
 */
interface RateLimitStore {
    get(key: string): Promise<{ count: number; resetAt: number } | null>;
    set(key: string, value: { count: number; resetAt: number }): Promise<void>;
    increment(key: string): Promise<{ count: number; resetAt: number }>;
}

class MemoryStore implements RateLimitStore {
    private cache = new Map<string, { count: number; resetAt: number }>();

    async get(key: string) {
        return this.cache.get(key) || null;
    }

    async set(key: string, value: { count: number; resetAt: number }) {
        this.cache.set(key, value);
    }

    async increment(key: string) {
        const record = this.cache.get(key);
        if (!record) throw new Error('Record not found');
        record.count += 1;
        return record;
    }
}

const store: RateLimitStore = new MemoryStore();

export async function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const record = await store.get(key);

  if (!record || now > record.resetAt) {
    const newRecord = { count: 1, resetAt: now + windowMs };
    await store.set(key, newRecord);
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  const updated = await store.increment(key);
  return { success: true, remaining: limit - updated.count };
}
