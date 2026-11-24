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

  it('rejects mixed Stripe test and live keys and a webhook secret that is not a signing secret', () => {
    const mixed = validateAppEnv({ ...productionEnv, STRIPE_SECRET_KEY: 'sk_live_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x' }, 'production');
    expect(mixed.errors.join(' ')).toMatch(/same mode/);
    const restricted = validateAppEnv({ ...productionEnv, STRIPE_SECRET_KEY: 'rk_live_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_x' }, 'production');
    expect(restricted.errors.join(' ')).not.toMatch(/Stripe|STRIPE/);
    const badSecret = validateAppEnv({ ...productionEnv, STRIPE_WEBHOOK_SECRET: 'sk_live_oops' }, 'production');
    expect(badSecret.errors.join(' ')).toMatch(/whsec_/);
  });

  it('applies the same Stripe rules to the optional patron-zone key set', () => {
    const premium = { PREMIUM_PASS_STRIPE_SECRET_KEY: 'sk_test_p', NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: 'pk_test_p', PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: 'whsec_p' };
    // live STRIPE_* next to a test premium set is the intended trial set-up
    expect(validateAppEnv({ ...productionEnv, STRIPE_SECRET_KEY: 'sk_live_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_x', ...premium }, 'production').errors).toEqual([]);
    const mixed = validateAppEnv({ ...productionEnv, ...premium, NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: 'pk_live_p' }, 'production');
    expect(mixed.errors.join(' ')).toMatch(/PREMIUM_PASS_STRIPE_SECRET_KEY.*same mode/);
    const badSecret = validateAppEnv({ ...productionEnv, ...premium, PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: 'sk_test_oops' }, 'production');
    expect(badSecret.errors.join(' ')).toMatch(/PREMIUM_PASS_STRIPE_WEBHOOK_SECRET.*whsec_/);
  });

  it('does not require the retired MAIN_CREATOR_SLUG (the main channel is the main_channel_id setting)', () => {
    const result = validateAppEnv(productionEnv, 'production');

    expect(result.success).toBe(true);
    expect(result.errors.join(' ')).not.toContain('MAIN_CREATOR_SLUG');
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

  it('warns when R2 is configured without an explicit HLS bucket and rejects the worker test endpoint (U10/U6)', () => {
    const withR2 = { ...productionEnv, CLOUDFLARE_R2_ACCESS_KEY_ID: 'r2-key' };
    const missing = validateAppEnv(withR2, 'production');
    expect(missing.success).toBe(true);
    expect(missing.warnings.join(' ')).toContain('CLOUDFLARE_R2_BUCKET_HLS');

    const explicit = validateAppEnv({ ...withR2, CLOUDFLARE_R2_BUCKET_HLS: 'polutek-hls' }, 'production');
    expect(explicit.warnings.join(' ')).not.toContain('CLOUDFLARE_R2_BUCKET_HLS');

    const hooked = validateAppEnv({ ...productionEnv, VIDEO_WORKER_TEST_S3_ENDPOINT: 'http://127.0.0.1:9000' }, 'production');
    expect(hooked.success).toBe(false);
    expect(hooked.errors.join(' ')).toContain('VIDEO_WORKER_TEST_S3_ENDPOINT');
    expect(validateAppEnv({ ...productionEnv, VIDEO_WORKER_TEST_S3_ENDPOINT: '' }, 'production').success).toBe(true);
  });

  it('no longer asks for any Mux or Cloudflare Stream variable', () => {
    const result = validateAppEnv(productionEnv, 'production');

    expect(result.success).toBe(true);
    expect(result.errors.some((e) => /MUX|CLOUDFLARE_(ACCOUNT|API|WEBHOOK)/.test(e))).toBe(false);
  });

  it('does not warn about MAIN_CREATOR_SLUG outside production any more', () => {
    const result = validateAppEnv({
      NODE_ENV: 'development',
    }, 'development');

    expect(result.success).toBe(true);
    expect(result.warnings.join(' ')).not.toContain('MAIN_CREATOR_SLUG');
  });
});

// Zod 4 (stricter string formats, new default messages): a production-like set of variables with fake values of the
// real shapes must still pass, and the errors for bad values keep the same `KEY message.` wording as with Zod 3.
describe('validateAppEnv under Zod 4', () => {
  const serverLikeEnv = {
    ...productionEnv,
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://app:secret@db:5432/polutek?schema=public',
    DATABASE_URL_UNPOOLED: 'postgresql://app:secret@db:5432/polutek?schema=public',
    NEXT_PUBLIC_APP_URL: 'https://www.example.com',
    BETTER_AUTH_TRUSTED_ORIGINS: 'https://www.example.com,https://example.com',
    STRIPE_SECRET_KEY: 'sk_live_fake',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake',
    PREMIUM_PASS_STRIPE_SECRET_KEY: 'sk_test_fake',
    NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY: 'pk_test_fake',
    PREMIUM_PASS_STRIPE_WEBHOOK_SECRET: 'whsec_fake_premium',
    KV_REST_API_URL: 'http://srh:80',
    KV_REST_API_TOKEN: 'kv-token',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
    NEXT_PUBLIC_R2_PUBLIC_HOST: 'pub-0123456789abcdef.r2.dev',
    MEDIA_BUCKET_HOST: '',
    HLS_DELIVERY_BASE_URL: 'https://hls.example.com',
    TELEMETRY_COLLECTOR_URL: 'http://collector:8080/b',
    TRUST_CF_CONNECTING_IP: 'true',
    ADMIN_EMAILS: 'owner@example.com',
    REFERRAL_PATRON_THRESHOLD: '3',
  };

  it('passes for a production-like set of variables (internal http host, Upstash-compatible KV)', () => {
    const result = validateAppEnv(serverLikeEnv, 'production');

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('keeps the error wording for invalid URLs and integers', () => {
    const result = validateAppEnv({ ...serverLikeEnv, NEXT_PUBLIC_APP_URL: 'not a url', KV_REST_API_URL: 'srh 80', REFERRAL_PATRON_THRESHOLD: 'abc' }, 'production');

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'NEXT_PUBLIC_APP_URL must be a valid URL.',
      'KV_REST_API_URL must be a valid URL.',
      'REFERRAL_PATRON_THRESHOLD must be an integer string.',
    ]));
  });

  it('keeps the error wording for a zero threshold', () => {
    const result = validateAppEnv({ ...serverLikeEnv, REFERRAL_PATRON_THRESHOLD: '0' }, 'production');

    expect(result.errors).toContain('REFERRAL_PATRON_THRESHOLD must be greater than zero.');
  });
});
