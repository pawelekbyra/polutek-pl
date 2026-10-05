import { describe, expect, it } from 'vitest';
import { validateAppEnv } from '@/lib/env/validation';

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@example.com:5432/app',
  DATABASE_URL_UNPOOLED: 'postgresql://user:pass@example.com:5432/app',
  NEXT_PUBLIC_APP_URL: 'https://example.com',
  BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef0123',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  STRIPE_SECRET_KEY: 'sk_test_stripe',
  STRIPE_WEBHOOK_SECRET: 'whsec_stripe',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe',
  RESEND_API_KEY: 're_example',
  EMAIL_FROM: 'notifications@example.com',
  MAIN_CREATOR_SLUG: 'creator-slug',
  REFERRAL_PATRON_THRESHOLD: '5',
  HEALTHCHECK_TOKEN: 'health-token',
  EMAIL_UNSUBSCRIBE_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
  MEDIA_BUCKET_HOST: 'media.example.com',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token',
  HLS_TOKEN_SECRET: 'hls-token-secret-0123456789abcdef0123456789',
};

describe('validateAppEnv', () => {
  it('passes for a complete production env', () => {
    const result = validateAppEnv(productionEnv, 'production');

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires the main creator slug in production', () => {
    const result = validateAppEnv({ ...productionEnv, MAIN_CREATOR_SLUG: '' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('MAIN_CREATOR_SLUG is required in production.');
  });

  it('requires writable Redis or KV credentials in production', () => {
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ...envWithoutRedis } = productionEnv;

    const result = validateAppEnv(envWithoutRedis, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Writable Redis/KV REST credentials are required in production for rate limiting: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.');
  });

  it('requires the auth secrets in production and a long enough BETTER_AUTH_SECRET', () => {
    const missing = validateAppEnv({ ...productionEnv, BETTER_AUTH_SECRET: '', GOOGLE_CLIENT_ID: '', TURNSTILE_SECRET_KEY: '' }, 'production');
    expect(missing.success).toBe(false);
    expect(missing.errors).toEqual(expect.arrayContaining([
      'BETTER_AUTH_SECRET is required in production.',
      'GOOGLE_CLIENT_ID is required in production.',
      'TURNSTILE_SECRET_KEY is required in production.',
    ]));

    const short = validateAppEnv({ ...productionEnv, BETTER_AUTH_SECRET: 'short' }, 'production');
    expect(short.errors).toContain('BETTER_AUTH_SECRET must be at least 32 characters.');
  });

  it('does not require any auth variable outside production', () => {
    expect(validateAppEnv({ NODE_ENV: 'development' }, 'development').success).toBe(true);
  });

  it('requires HLS_TOKEN_SECRET (our own HLS is the only video source) in production', () => {
    const result = validateAppEnv({ ...productionEnv, HLS_TOKEN_SECRET: '' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('HLS_TOKEN_SECRET is required in production.');
  });

  it('rejects a too short HLS_TOKEN_SECRET', () => {
    const result = validateAppEnv({ ...productionEnv, HLS_TOKEN_SECRET: 'short' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('HLS_TOKEN_SECRET must be at least 32 characters.');
  });

  it('no longer asks for any Mux or Cloudflare Stream variable', () => {
    const result = validateAppEnv(productionEnv, 'production');

    expect(result.success).toBe(true);
    expect(result.errors.some((e) => /MUX|CLOUDFLARE_(ACCOUNT|API|WEBHOOK)/.test(e))).toBe(false);
  });

  it('warns but does not fail when MAIN_CREATOR_SLUG is missing outside production', () => {
    const result = validateAppEnv({
      NODE_ENV: 'development',
    }, 'development');

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('MAIN_CREATOR_SLUG is not set; non-production single-creator pages will fall back to an approved creator from the database when available.');
  });
});
