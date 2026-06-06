import { logger } from "@/lib/logger";
type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitRecord>;
  setNxEx(key: string, value: string, seconds: number): Promise<boolean>;
}

export class MemoryStore implements RateLimitStore {
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

  async setNxEx(key: string, value: string, seconds: number): Promise<boolean> {
    const now = Date.now();
    const record = this.cache.get(key);
    if (record && now < record.resetAt) return false;
    this.cache.set(key, { count: 1, resetAt: now + (seconds * 1000) });
    return true;
  }
}

export class UpstashRedisStore implements RateLimitStore {
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
    const redisKey = getRateLimitRedisKey(key);
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

  async setNxEx(key: string, value: string, seconds: number): Promise<boolean> {
    const result = await this.command<string>(['SET', key, value, 'NX', 'EX', seconds]);
    return result === 'OK';
  }
}

type RateLimitEnv = Record<string, string | undefined>;

export type RateLimitStoreKind = 'memory' | 'upstash';

export type RateLimitRedisConfig = {
  restUrl?: string;
  token?: string;
};

export const MISSING_REDIS_ENV_MESSAGE = 'Missing Redis env vars: set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.';

export function getRateLimitRedisKey(key: string) {
  return `rate-limit:${key}`;
}

export function resolveRateLimitRedisConfig(env: RateLimitEnv = process.env): RateLimitRedisConfig {
  return {
    restUrl: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN,
  };
}

export function resolveRateLimitStoreKind(env: RateLimitEnv = process.env): RateLimitStoreKind {
  const { restUrl, token } = resolveRateLimitRedisConfig(env);

  if (restUrl && token) {
    return 'upstash';
  }

  if (env.NODE_ENV === 'production') {
    logger.error(`[RateLimit] ${MISSING_REDIS_ENV_MESSAGE}`);
    throw new Error(`[RateLimit] ${MISSING_REDIS_ENV_MESSAGE}`);
  }

  return 'memory';
}

export function createRateLimitStore(env: RateLimitEnv = process.env): RateLimitStore {
  const kind = resolveRateLimitStoreKind(env);

  if (kind === 'upstash') {
    const { restUrl, token } = resolveRateLimitRedisConfig(env);
    return new UpstashRedisStore(restUrl!, token!);
  }

  logger.warn('[RateLimit] Using in-memory rate limit store. This is allowed only outside production.');
  return new MemoryStore();
}

let store: RateLimitStore | null = null;

function getStore() {
  store ??= createRateLimitStore();
  return store;
}

export async function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const record = await getStore().hit(key, windowMs);

  if (record.count > limit) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: Math.max(0, limit - record.count) };
}

export async function setNxEx(key: string, value: string, seconds: number): Promise<boolean> {
  return await getStore().setNxEx(key, value, seconds);
}
