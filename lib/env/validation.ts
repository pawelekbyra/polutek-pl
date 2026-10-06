import { z } from 'zod';
import { resolveRateLimitRedisConfig } from '@/lib/rate-limit';
import { isUnknownEmailProvider, resolveEmailProvider } from '@/lib/email-config';

export type EnvValidationMode = 'development' | 'test' | 'production';

export type EnvValidationResult = {
  success: boolean;
  mode: EnvValidationMode;
  errors: string[];
  warnings: string[];
};

type EnvRecord = Record<string, string | undefined>;

const requiredRuntimeVars = [] as const;

const requiredProductionVars = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'NEXT_PUBLIC_APP_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EMAIL_FROM',
  'MAIN_CREATOR_SLUG',
  'REFERRAL_PATRON_THRESHOLD',
  'HEALTHCHECK_TOKEN',
  'EMAIL_UNSUBSCRIBE_SIGNING_SECRET',
  'HLS_TOKEN_SECRET',
] as const;

const optionalButRecommendedProductionVars = [
  'DISPLAY_EUR_TO_PLN_RATE',
  'DISPLAY_USD_TO_PLN_RATE',
] as const;

const urlSchema = z.string().url();
const positiveIntegerString = z.string().regex(/^\d+$/, 'must be an integer string').refine((value) => Number(value) > 0, 'must be greater than zero');
const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter uppercase currency code');

function hasValue(env: EnvRecord, key: string) {
  return typeof env[key] === 'string' && env[key]!.trim().length > 0;
}

function validateUrl(errors: string[], env: EnvRecord, key: string) {
  if (!hasValue(env, key)) return;
  const result = urlSchema.safeParse(env[key]);
  if (!result.success) errors.push(`${key} must be a valid URL.`);
}

function validatePositiveInteger(errors: string[], env: EnvRecord, key: string) {
  if (!hasValue(env, key)) return;
  const result = positiveIntegerString.safeParse(env[key]);
  if (!result.success) errors.push(`${key} ${result.error.issues[0]?.message || 'must be a positive integer string'}.`);
}

function validateCurrency(errors: string[], env: EnvRecord, key: string) {
  if (!hasValue(env, key)) return;
  const result = currencySchema.safeParse(env[key]);
  if (!result.success) errors.push(`${key} ${result.error.issues[0]?.message || 'must be a valid currency code'}.`);
}

function hasAnyMediaHost(env: EnvRecord) {
  return ['MEDIA_BUCKET_HOST', 'NEXT_PUBLIC_R2_PUBLIC_HOST', 'NEXT_PUBLIC_BLOB_PUBLIC_HOST', 'ALLOWED_MEDIA_HOSTS']
    .some((key) => hasValue(env, key));
}

function hasWritableRateLimitStore(env: EnvRecord) {
  const { restUrl, token } = resolveRateLimitRedisConfig(env);
  return Boolean(restUrl && token);
}

export function validateAppEnv(env: EnvRecord = process.env, mode: EnvValidationMode = resolveEnvValidationMode(env)): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of requiredRuntimeVars) {
    if (!hasValue(env, key)) errors.push(`${key} is required for application runtime.`);
  }

  if (mode === 'production') {
    for (const key of requiredProductionVars) {
      if (!hasValue(env, key)) errors.push(`${key} is required in production.`);
    }

    // Provider-specific mail credentials: only the active provider's variables are required.
    const providerVars = resolveEmailProvider(env) === 'ses' ? (['SES_SMTP_USER', 'SES_SMTP_PASS'] as const) : (['RESEND_API_KEY'] as const);
    for (const key of providerVars) {
      if (!hasValue(env, key)) errors.push(`${key} is required in production when EMAIL_PROVIDER=${resolveEmailProvider(env)}.`);
    }

    for (const key of optionalButRecommendedProductionVars) {
      if (!hasValue(env, key)) warnings.push(`${key} is recommended in production.`);
    }

    if (!hasAnyMediaHost(env)) {
      errors.push('At least one exact media host allowlist env is required in production: MEDIA_BUCKET_HOST, NEXT_PUBLIC_R2_PUBLIC_HOST, NEXT_PUBLIC_BLOB_PUBLIC_HOST, or ALLOWED_MEDIA_HOSTS.');
    }

    if (!hasWritableRateLimitStore(env)) {
      errors.push('Writable Redis/KV REST credentials are required in production for rate limiting: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.');
    }
  } else if (!hasValue(env, 'MAIN_CREATOR_SLUG')) {
    warnings.push('MAIN_CREATOR_SLUG is not set; non-production single-creator pages will fall back to an approved creator from the database when available.');
  }

  // Stripe test and live objects never mix: a secret key of one mode with a publishable key of the other
  // makes every payment fail at the browser; a webhook secret that is not a signing secret rejects every event.
  const stripeMode = (key: string | undefined) => (/^(sk|rk|pk)_live_/.test(key ?? '') ? 'live' : /^(sk|rk|pk)_test_/.test(key ?? '') ? 'test' : null);
  const secretMode = stripeMode(env.STRIPE_SECRET_KEY);
  const publishableMode = stripeMode(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  if (secretMode && publishableMode && secretMode !== publishableMode) {
    errors.push(`STRIPE_SECRET_KEY is a ${secretMode} key but NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a ${publishableMode} key; both must be the same mode.`);
  }
  if (hasValue(env, 'STRIPE_WEBHOOK_SECRET') && !env.STRIPE_WEBHOOK_SECRET!.trim().startsWith('whsec_')) {
    errors.push('STRIPE_WEBHOOK_SECRET must be an endpoint signing secret (starts with whsec_).');
  }

  validateUrl(errors, env, 'NEXT_PUBLIC_APP_URL');
  validateUrl(errors, env, 'UPSTASH_REDIS_REST_URL');
  validateUrl(errors, env, 'KV_REST_API_URL');
  validatePositiveInteger(errors, env, 'REFERRAL_PATRON_THRESHOLD');

  if (isUnknownEmailProvider(env)) {
    errors.push('EMAIL_PROVIDER must be "resend" or "ses".');
  }
  validatePositiveInteger(errors, env, 'EMAIL_DAILY_LIMIT');
  validatePositiveInteger(errors, env, 'EMAIL_MONTHLY_LIMIT');

  if (hasValue(env, 'EMAIL_UNSUBSCRIBE_SIGNING_SECRET') && env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET!.trim().length < 32) {
    errors.push('EMAIL_UNSUBSCRIBE_SIGNING_SECRET must be at least 32 characters.');
  }

  if (hasValue(env, 'BETTER_AUTH_SECRET') && env.BETTER_AUTH_SECRET!.trim().length < 32) {
    errors.push('BETTER_AUTH_SECRET must be at least 32 characters.');
  }

  if (hasValue(env, 'HLS_TOKEN_SECRET') && env.HLS_TOKEN_SECRET!.trim().length < 32) {
    errors.push('HLS_TOKEN_SECRET must be at least 32 characters.');
  }

  // Optional: without it the key for client IP/user-agent hashes is derived from BETTER_AUTH_SECRET.
  if (hasValue(env, 'IP_HASH_SECRET') && env.IP_HASH_SECRET!.trim().length < 32) {
    errors.push('IP_HASH_SECRET must be at least 32 characters.');
  }

  return {
    success: errors.length === 0,
    mode,
    errors,
    warnings,
  };
}

export function resolveEnvValidationMode(env: EnvRecord = process.env): EnvValidationMode {
  const rawMode = env.APP_ENV || env.NODE_ENV || 'development';
  if (rawMode === 'production' || rawMode === 'test' || rawMode === 'development') return rawMode;
  return 'development';
}
