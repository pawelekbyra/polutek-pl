import { describe, expect, it } from 'vitest';
import { bounceEventsConnected, emailSendLimits, getEmailFrom, getEmailReplyTo, getEmailSupportFrom, getSesSmtpConfig, resolveEmailProvider } from '@/lib/email-config';
import { validateAppEnv } from '@/lib/env/validation';

describe('email config', () => {
  it('defaults to resend until the owner flips the switch', () => {
    expect(resolveEmailProvider({})).toBe('resend');
    expect(resolveEmailProvider({ EMAIL_PROVIDER: 'ses' })).toBe('ses');
    expect(bounceEventsConnected({ EMAIL_PROVIDER: 'ses' })).toBe(false);
    expect(bounceEventsConnected({})).toBe(true);
  });

  it('sender addresses come from one place with sane defaults', () => {
    expect(getEmailFrom({})).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
    expect(getEmailReplyTo({})).toBe('support@pawelperfect.com');
    expect(getEmailSupportFrom({})).toBe('Pawel Perfect <support@pawelperfect.com>');
    expect(getEmailFrom({ EMAIL_FROM: 'X <x@pawelperfect.com>' })).toBe('X <x@pawelperfect.com>');
  });

  it('limits: EMAIL_* wins, RESEND_* still works, defaults per provider', () => {
    expect(emailSendLimits({})).toMatchObject({ perDay: 100, perMonth: 3000, provider: 'resend' });
    expect(emailSendLimits({ RESEND_DAILY_LIMIT: '500' }).perDay).toBe(500);
    expect(emailSendLimits({ RESEND_DAILY_LIMIT: '500', EMAIL_DAILY_LIMIT: '900' }).perDay).toBe(900);
    expect(emailSendLimits({ EMAIL_PROVIDER: 'ses' })).toMatchObject({ perDay: 200, provider: 'ses' });
    expect(emailSendLimits({ EMAIL_DAILY_LIMIT: 'abc' }).perDay).toBe(100);
  });

  it('SES SMTP config needs both credentials', () => {
    expect(getSesSmtpConfig({ SES_SMTP_USER: 'u' })).toBeNull();
    expect(getSesSmtpConfig({ SES_SMTP_USER: 'u', SES_SMTP_PASS: 'p' })).toMatchObject({ host: 'email-smtp.eu-north-1.amazonaws.com', port: 587, region: 'eu-north-1' });
  });
});

describe('env validation per mail provider (production)', () => {
  const base = {
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@h:5432/a', DATABASE_URL_UNPOOLED: 'postgresql://u:p@h:5432/a',
    NEXT_PUBLIC_APP_URL: 'https://example.com', BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef0123',
    GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 'g', TURNSTILE_SITE_KEY: 't', TURNSTILE_SECRET_KEY: 't',
    STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    EMAIL_FROM: 'n@example.com', MAIN_CREATOR_SLUG: 'c', REFERRAL_PATRON_THRESHOLD: '5', HEALTHCHECK_TOKEN: 'h',
    EMAIL_UNSUBSCRIBE_SIGNING_SECRET: '0123456789abcdef0123456789abcdef', MEDIA_BUCKET_HOST: 'm.example.com',
    UPSTASH_REDIS_REST_URL: 'https://r.example.com', UPSTASH_REDIS_REST_TOKEN: 't', HLS_TOKEN_SECRET: 'hls-token-secret-0123456789abcdef0123456789',
  };

  it('resend (default): RESEND_API_KEY required, SES variables not', () => {
    const r = validateAppEnv(base, 'production');
    expect(r.errors.join(' ')).toMatch(/RESEND_API_KEY is required/);
    expect(r.errors.join(' ')).not.toMatch(/SES_SMTP/);
    expect(validateAppEnv({ ...base, RESEND_API_KEY: 're_x' }, 'production').success).toBe(true);
  });

  it('ses: SES_SMTP_USER and SES_SMTP_PASS required, RESEND_API_KEY not', () => {
    const r = validateAppEnv({ ...base, EMAIL_PROVIDER: 'ses' }, 'production');
    expect(r.errors).toEqual(expect.arrayContaining([
      'SES_SMTP_USER is required in production when EMAIL_PROVIDER=ses.',
      'SES_SMTP_PASS is required in production when EMAIL_PROVIDER=ses.',
    ]));
    expect(r.errors.join(' ')).not.toMatch(/RESEND_API_KEY/);
    expect(validateAppEnv({ ...base, EMAIL_PROVIDER: 'ses', SES_SMTP_USER: 'u', SES_SMTP_PASS: 'p' }, 'production').success).toBe(true);
  });

  it('rejects an unknown provider and bad limits', () => {
    const r = validateAppEnv({ ...base, RESEND_API_KEY: 'x', EMAIL_PROVIDER: 'mailgun', EMAIL_DAILY_LIMIT: '-1' }, 'production');
    expect(r.errors.join(' ')).toMatch(/EMAIL_PROVIDER must be/);
    expect(r.errors.join(' ')).toMatch(/EMAIL_DAILY_LIMIT/);
  });
});
