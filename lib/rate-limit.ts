type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

/**
 * Interface for rate limit stores.
 */
interface RateLimitStore {
    get(key: string): Promise<{ count: number; resetAt: number } | null>;
    set(key: string, value: { count: number; resetAt: number }): Promise<void>;
    increment(key: string): Promise<{ count: number; resetAt: number }>;
}

/**
 * In-memory store for development/testing.
 */
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

/**
 * Redis store using Upstash REST API for production/serverless.
 */
class RedisStore implements RateLimitStore {
    private url = process.env.UPSTASH_REDIS_REST_URL;
    private token = process.env.UPSTASH_REDIS_REST_TOKEN;

    constructor() {
        if (process.env.NODE_ENV === "production" && (!this.url || !this.token)) {
            throw new Error("Production rate limit requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
        }
    }

    async get(key: string) {
        if (!this.url || !this.token) return null;
        try {
            const res = await fetch(`${this.url}/get/${key}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            const { result } = await res.json();
            return result ? JSON.parse(result) : null;
        } catch (e) {
            console.error('[RateLimit] Redis get error', e);
            return null;
        }
    }

    async set(key: string, value: { count: number; resetAt: number }) {
        if (!this.url || !this.token) return;
        try {
            const ttl = Math.ceil((value.resetAt - Date.now()) / 1000);
            if (ttl <= 0) return;
            await fetch(`${this.url}/set/${key}/${JSON.stringify(value)}/EX/${ttl}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
        } catch (e) {
            console.error('[RateLimit] Redis set error', e);
        }
    }

    async increment(key: string) {
        // Fallback to get/set logic if INCR is not directly usable for JSON
        const record = await this.get(key);
        if (!record) throw new Error('Record not found');
        record.count += 1;
        await this.set(key, record);
        return record;
    }
}

const isProduction = process.env.NODE_ENV === 'production';
const useRedis = !!process.env.UPSTASH_REDIS_REST_URL;
const store: RateLimitStore = (isProduction || useRedis) ? new RedisStore() : new MemoryStore();

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
