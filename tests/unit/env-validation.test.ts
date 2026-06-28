import { describe, expect, it } from 'vitest';
import { validateAppEnv } from '@/lib/env/validation';

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@example.com:5432/app',
  DATABASE_URL_UNPOOLED: 'postgresql://user:pass@example.com:5432/app',
  NEXT_PUBLIC_APP_URL: 'https://example.com',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_YnVpbGQtdGltZS1vbmx5JGNsZXJrLmFjY291bnRzLmRldiQ',
  CLERK_SECRET_KEY: 'sk_test_example',
  CLERK_WEBHOOK_SECRET: 'whsec_clerk',
  STRIPE_SECRET_KEY: 'sk_test_stripe',
  STRIPE_WEBHOOK_SECRET: 'whsec_stripe',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe',
  RESEND_API_KEY: 're_example',
  EMAIL_FROM: 'notifications@example.com',
  ADMIN_CLERK_USER_IDS: 'user_admin_1',
  MAIN_CREATOR_SLUG: 'creator-slug',
  PATRON_MIN_TIP_AMOUNT: '500',
  PATRON_MIN_TIP_CURRENCY: 'EUR',
  REFERRAL_PATRON_THRESHOLD: '5',
  HEALTHCHECK_TOKEN: 'health-token',
  EMAIL_UNSUBSCRIBE_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
  MEDIA_BUCKET_HOST: 'media.example.com',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'redis-token',
  MUX_TOKEN_ID: 'mux-token-id',
  MUX_TOKEN_SECRET: 'mux-token-secret',
  MUX_WEBHOOK_SECRET: 'mux-webhook-secret',
  MUX_SIGNING_KEY_ID: 'mux-signing-key-id',
  MUX_SIGNING_PRIVATE_KEY: Buffer.from('-----BEGIN RSA PRIVATE KEY-----\nMIIEfake==\n-----END RSA PRIVATE KEY-----').toString('base64'),
};

describe('validateAppEnv', () => {
  it('passes for a complete production env', () => {
    const result = validateAppEnv(productionEnv, 'production');

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires immutable admin Clerk IDs in production', () => {
    const result = validateAppEnv({ ...productionEnv, ADMIN_CLERK_USER_IDS: '' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('ADMIN_CLERK_USER_IDS is required in production.');
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

  it('requires Clerk publishable key in every runtime mode', () => {
    const result = validateAppEnv({ NODE_ENV: 'development' }, 'development');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for application runtime.');
  });

  it('requires MUX_TOKEN_ID in production', () => {
    const result = validateAppEnv({ ...productionEnv, MUX_TOKEN_ID: '' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('MUX_TOKEN_ID is required in production.');
  });

  it('requires MUX_TOKEN_SECRET in production', () => {
    const result = validateAppEnv({ ...productionEnv, MUX_TOKEN_SECRET: '' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('MUX_TOKEN_SECRET is required in production.');
  });

  it('requires MUX_SIGNING_PRIVATE_KEY in production', () => {
    const result = validateAppEnv({ ...productionEnv, MUX_SIGNING_PRIVATE_KEY: '' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('MUX_SIGNING_PRIVATE_KEY is required in production.');
  });

  it('fails validation when MUX_SIGNING_PRIVATE_KEY is not a base64-encoded PEM key', () => {
    const result = validateAppEnv({ ...productionEnv, MUX_SIGNING_PRIVATE_KEY: 'not-valid-base64-pem' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('MUX_SIGNING_PRIVATE_KEY') && e.includes('base64'))).toBe(true);
  });

  it('passes validation when MUX_SIGNING_PRIVATE_KEY is a valid base64-encoded PEM key', () => {
    const result = validateAppEnv(productionEnv, 'production');

    expect(result.success).toBe(true);
    expect(result.errors.some((e) => e.includes('MUX_SIGNING_PRIVATE_KEY'))).toBe(false);
  });

  it('warns but does not fail when MAIN_CREATOR_SLUG is missing outside production', () => {
    const result = validateAppEnv({
      NODE_ENV: 'development',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_YnVpbGQtdGltZS1vbmx5JGNsZXJrLmFjY291bnRzLmRldiQ',
    }, 'development');

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('MAIN_CREATOR_SLUG is not set; non-production single-creator pages will fall back to an approved creator from the database when available.');
  });
});
