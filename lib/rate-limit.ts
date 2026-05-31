type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

import { Redis } from '@upstash/redis';

/**
 * Rate limiter store adapter.
 */
interface RateLimitStore {
    get(key: string): Promise<{ count: number; resetAt: number } | null>;
    set(key: string, value: { count: number; resetAt: number }): Promise<void>;
    increment(key: string): Promise<{ count: number; resetAt: number }>;
}

class RedisStore implements RateLimitStore {
    private redis: Redis;

    constructor() {
        this.redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }

    async get(key: string) {
        return await this.redis.get<{ count: number; resetAt: number }>(`ratelimit:${key}`);
    }

    async set(key: string, value: { count: number; resetAt: number }) {
        // Set with expiry based on resetAt
        const px = Math.max(0, value.resetAt - Date.now());
        await this.redis.set(`ratelimit:${key}`, value, { px });
    }

    async increment(key: string) {
        // Use a more robust approach: fetch and update, but handle missing record gracefully.
        // For true atomicity with Upstash/Redis, a Lua script or INCR would be better,
        // but given the existing interface, we'll ensure it doesn't throw.
        const record = await this.get(key);
        if (!record) {
            // This shouldn't happen if called correctly by rateLimit(), but let's be safe.
            const newRecord = { count: 1, resetAt: Date.now() + 60000 }; // Fallback 1m
            await this.set(key, newRecord);
            return newRecord;
        }

        record.count += 1;
        const px = Math.max(0, record.resetAt - Date.now());
        if (px > 0) {
            await this.redis.set(`ratelimit:${key}`, record, { px });
        }

        return record;
    }
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

// Use RedisStore in production, MemoryStore in development/fallback
const isRedisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const store: RateLimitStore = isRedisConfigured ? new RedisStore() : new MemoryStore();

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
