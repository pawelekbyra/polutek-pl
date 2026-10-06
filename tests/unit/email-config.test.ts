import { describe, expect, it } from 'vitest';
import { emailSendLimits, getEmailFrom, getEmailReplyTo, getEmailSupportFrom, getSesSmtpConfig, getSnsConfig } from '@/lib/email-config';
import { validateAppEnv } from '@/lib/env/validation';

describe('email config', () => {
  it('sender addresses come from one place with sane defaults', () => {
    expect(getEmailFrom({})).toBe('Pawel Perfect <no-reply@pawelperfect.com>');
    expect(getEmailReplyTo({})).toBe('support@pawelperfect.com');
    expect(getEmailSupportFrom({})).toBe('Pawel Perfect <support@pawelperfect.com>');
    expect(getEmailFrom({ EMAIL_FROM: 'X <x@pawelperfect.com>' })).toBe('X <x@pawelperfect.com>');
  });

  it('limits: EMAIL_* variables with the SES sandbox as default', () => {
    expect(emailSendLimits({})).toMatchObject({ perDay: 200, perMonth: 6000 });
    expect(emailSendLimits({ EMAIL_DAILY_LIMIT: '900', EMAIL_MONTHLY_LIMIT: '20000' })).toMatchObject({ perDay: 900, perMonth: 20000 });
    expect(emailSendLimits({ EMAIL_DAILY_LIMIT: 'abc' }).perDay).toBe(200);
    expect(emailSendLimits({ RESEND_DAILY_LIMIT: '500' }).perDay).toBe(200); // old Resend names are gone
  });

  it('SNS config: topic allowlist (comma separated), regions default to AWS_REGION', () => {
    expect(getSnsConfig({})).toEqual({ topicArns: [], regions: ['eu-north-1'] });
    expect(getSnsConfig({ SES_SNS_TOPIC_ARN: ' a , b ', AWS_REGION: 'eu-west-1' })).toEqual({ topicArns: ['a', 'b'], regions: ['eu-west-1'] });
    expect(getSnsConfig({ SES_SNS_REGIONS: 'eu-north-1, us-east-1' }).regions).toEqual(['eu-north-1', 'us-east-1']);
  });

  it('SES SMTP config needs both credentials', () => {
    expect(getSesSmtpConfig({ SES_SMTP_USER: 'u' })).toBeNull();
    expect(getSesSmtpConfig({ SES_SMTP_USER: 'u', SES_SMTP_PASS: 'p' })).toMatchObject({ host: 'email-smtp.eu-north-1.amazonaws.com', port: 587, region: 'eu-north-1' });
  });
});

describe('env validation (production)', () => {
  const base = {
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@h:5432/a', DATABASE_URL_UNPOOLED: 'postgresql://u:p@h:5432/a',
    NEXT_PUBLIC_APP_URL: 'https://example.com', BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef0123',
    GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 'g', TURNSTILE_SITE_KEY: 't', TURNSTILE_SECRET_KEY: 't',
    STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    EMAIL_FROM: 'n@example.com', MAIN_CREATOR_SLUG: 'c', REFERRAL_PATRON_THRESHOLD: '5', HEALTHCHECK_TOKEN: 'h',
    EMAIL_UNSUBSCRIBE_SIGNING_SECRET: '0123456789abcdef0123456789abcdef', MEDIA_BUCKET_HOST: 'm.example.com',
    UPSTASH_REDIS_REST_URL: 'https://r.example.com', UPSTASH_REDIS_REST_TOKEN: 't', HLS_TOKEN_SECRET: 'hls-token-secret-0123456789abcdef0123456789',
  };

  it('requires the SES SMTP credentials and nothing about Resend', () => {
    const r = validateAppEnv(base, 'production');
    expect(r.errors).toEqual(expect.arrayContaining(['SES_SMTP_USER is required in production.', 'SES_SMTP_PASS is required in production.']));
    expect(r.errors.join(' ')).not.toMatch(/RESEND/);
    expect(validateAppEnv({ ...base, SES_SMTP_USER: 'u', SES_SMTP_PASS: 'p' }, 'production').success).toBe(true);
  });

  it('rejects bad limits', () => {
    const r = validateAppEnv({ ...base, SES_SMTP_USER: 'u', SES_SMTP_PASS: 'p', EMAIL_DAILY_LIMIT: '-1' }, 'production');
    expect(r.errors.join(' ')).toMatch(/EMAIL_DAILY_LIMIT/);
  });
});
