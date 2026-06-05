import { z } from 'zod';
import { resolveRateLimitRedisConfig } from '@/lib/rate-limit';

export type EnvValidationMode = 'development' | 'test' | 'production';

export type EnvValidationResult = {
  success: boolean;
  mode: EnvValidationMode;
  errors: string[];
  warnings: string[];
};

type EnvRecord = Record<string, string | undefined>;

const requiredRuntimeVars = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
] as const;

const requiredProductionVars = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'NEXT_PUBLIC_APP_URL',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'ADMIN_EMAIL',
  'MAIN_CREATOR_SLUG',
  'PATRON_MIN_TIP_AMOUNT',
  'PATRON_MIN_TIP_CURRENCY',
  'REFERRAL_PATRON_THRESHOLD',
  'HEALTHCHECK_TOKEN',
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

  validateUrl(errors, env, 'NEXT_PUBLIC_APP_URL');
  validateUrl(errors, env, 'UPSTASH_REDIS_REST_URL');
  validateUrl(errors, env, 'KV_REST_API_URL');
  validatePositiveInteger(errors, env, 'PATRON_MIN_TIP_AMOUNT');
  validatePositiveInteger(errors, env, 'REFERRAL_PATRON_THRESHOLD');
  validateCurrency(errors, env, 'PATRON_MIN_TIP_CURRENCY');

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
