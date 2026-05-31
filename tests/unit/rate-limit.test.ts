import { describe, expect, it } from 'vitest';
import { getRateLimitRedisKey, resolveRateLimitStoreKind } from '@/lib/rate-limit';

describe('rate limit store config', () => {
  it('allows memory fallback outside production when Upstash envs are missing', () => {
    expect(resolveRateLimitStoreKind({ NODE_ENV: 'development' })).toBe('memory');
    expect(resolveRateLimitStoreKind({ NODE_ENV: 'test' })).toBe('memory');
  });

  it('throws in production when Upstash envs are missing', () => {
    expect(() => resolveRateLimitStoreKind({ NODE_ENV: 'production' })).toThrow(
      'Production requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
    );
  });

  it('selects Upstash when both envs are configured', () => {
    expect(resolveRateLimitStoreKind({
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    })).toBe('upstash');
  });

  it('keeps Redis key format stable', () => {
    expect(getRateLimitRedisKey('comments:user_123')).toBe('rate-limit:comments:user_123');
  });
});
