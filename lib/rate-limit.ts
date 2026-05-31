type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitRecord>;
}

class MemoryStore implements RateLimitStore {
  private cache = new Map<string, RateLimitRecord>();

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    const record = this.cache.get(key);

    if (!record || now > record.resetAt) {
      const next = { count: 1, resetAt: now + windowMs };
      this.cache.set(key, next);
      return next;
    }

    record.count += 1;
    return record;
  }
}

class UpstashRedisStore implements RateLimitStore {
  constructor(
    private readonly restUrl: string,
    private readonly token: string,
  ) {}

  private async command<T>(command: unknown[]) {
    const response = await fetch(this.restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Upstash rate limit command failed: ${response.status}`);
    }

    const data = await response.json() as { result?: T; error?: string };
    if (data.error) {
      throw new Error(`Upstash rate limit command failed: ${data.error}`);
    }

    return data.result as T;
  }

  async hit(key: string, windowMs: number) {
    const redisKey = `rate-limit:${key}`;
    const count = Number(await this.command<number>(['INCR', redisKey]));

    if (count === 1) {
      await this.command(['PEXPIRE', redisKey, windowMs]);
    }

    const ttl = Number(await this.command<number>(['PTTL', redisKey]));
    return {
      count,
      resetAt: Date.now() + Math.max(ttl, 0),
    };
  }
}

function createStore(): RateLimitStore {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (restUrl && token) {
    return new UpstashRedisStore(restUrl, token);
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[RateLimit] UPSTASH_REDIS_REST_URL/TOKEN missing; falling back to per-instance memory rate limiting.');
  }

  return new MemoryStore();
}

const store: RateLimitStore = createStore();

export async function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const record = await store.hit(key, windowMs);

  if (record.count > limit) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: Math.max(0, limit - record.count) };
}
