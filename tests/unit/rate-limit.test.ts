import { describe, expect, it } from 'vitest';
import { getRateLimitRedisKey, resolveRateLimitRedisConfig, resolveRateLimitStoreKind } from '@/lib/rate-limit';

describe('rate limit store config', () => {
  it('allows memory fallback outside production when Upstash envs are missing', () => {
    expect(resolveRateLimitStoreKind({ NODE_ENV: 'development' })).toBe('memory');
    expect(resolveRateLimitStoreKind({ NODE_ENV: 'test' })).toBe('memory');
  });

  it('throws in production when both writable Redis env pairs are missing', () => {
    expect(() => resolveRateLimitStoreKind({ NODE_ENV: 'production' })).toThrow(
      'Missing Redis env vars: set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.',
    );
  });

  it('selects Upstash when both Upstash envs are configured', () => {
    expect(resolveRateLimitStoreKind({
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    })).toBe('upstash');
  });

  it('falls back to writable Vercel KV REST envs', () => {
    const env = {
      NODE_ENV: 'production',
      KV_REST_API_URL: 'https://example-kv.upstash.io',
      KV_REST_API_TOKEN: 'kv-token',
      KV_REST_API_READ_ONLY_TOKEN: 'read-only-token',
    };

    expect(resolveRateLimitStoreKind(env)).toBe('upstash');
    expect(resolveRateLimitRedisConfig(env)).toEqual({
      restUrl: 'https://example-kv.upstash.io',
      token: 'kv-token',
    });
  });

  it('does not use the KV read-only token for rate limiting', () => {
    expect(resolveRateLimitRedisConfig({
      KV_REST_API_URL: 'https://example-kv.upstash.io',
      KV_REST_API_READ_ONLY_TOKEN: 'read-only-token',
    })).toEqual({
      restUrl: 'https://example-kv.upstash.io',
      token: undefined,
    });
  });

  it('keeps Redis key format stable', () => {
    expect(getRateLimitRedisKey('comments:user_123')).toBe('rate-limit:comments:user_123');
  });
});
