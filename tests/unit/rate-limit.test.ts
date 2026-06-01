import { describe, expect, it } from 'vitest';
import { getRateLimitRedisKey, resolveRateLimitStoreKind } from '@/lib/rate-limit';

describe('rate limit store config', () => {
  it('allows memory fallback outside production when Upstash envs are missing', () => {
    expect(resolveRateLimitStoreKind({ NODE_ENV: 'development' })).toBe('memory');
    expect(resolveRateLimitStoreKind({ NODE_ENV: 'test' })).toBe('memory');
  });

  it('throws in production when all Redis envs are missing', () => {
    expect(() => resolveRateLimitStoreKind({ NODE_ENV: 'production' })).toThrow(
      'Production rate limit requires Upstash Redis environment variables.'
    );
  });

  it('selects Upstash when direct Upstash envs are configured', () => {
    expect(resolveRateLimitStoreKind({
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    })).toBe('upstash');
  });

  it('selects Upstash when Vercel KV envs are configured', () => {
    expect(
      resolveRateLimitStoreKind({
        NODE_ENV: 'production',
        KV_REST_API_URL: 'https://kv.io',
        KV_REST_API_TOKEN: 'kv-token',
      })
    ).toBe('upstash');
  });

  it('throws in production when only read-only KV token is provided', () => {
    expect(() => resolveRateLimitStoreKind({
      NODE_ENV: 'production',
      KV_REST_API_READ_ONLY_TOKEN: 'readonly'
    })).toThrow(
      'Production rate limit requires Upstash Redis environment variables.'
    );
  });

  it('keeps Redis key format stable', () => {
    expect(getRateLimitRedisKey('comments:user_123')).toBe('rate-limit:comments:user_123');
  });
});
