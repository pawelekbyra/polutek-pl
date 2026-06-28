#!/usr/bin/env node

const env = process.env;

function hasValue(name) {
  return typeof env[name] === 'string' && env[name].trim().length > 0;
}

function hasAll(names) {
  return names.every(hasValue);
}

function hasAny(names) {
  return names.some(hasValue);
}

function hasPair(pairs) {
  return pairs.some((pair) => hasAll(pair));
}

const checks = [
  {
    name: 'Clerk',
    ok: () => hasAll([
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'CLERK_WEBHOOK_SECRET',
    ]),
  },
  {
    name: 'Stripe',
    ok: () => hasAll([
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
    ]),
  },
  {
    name: 'Resend/email',
    ok: () => hasAll([
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'RESEND_WEBHOOK_SECRET',
    ]),
  },
  {
    name: 'Cloudflare Stream',
    ok: () => hasAll([
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_WEBHOOK_SECRET',
    ]),
  },
  {
    name: 'database',
    ok: () => hasAll([
      'DATABASE_URL',
      'DATABASE_URL_UNPOOLED',
    ]),
  },
  {
    name: 'app/base URL/public URL',
    ok: () => hasAll([
      'NEXT_PUBLIC_APP_URL',
    ]),
  },
  {
    name: 'webhook secrets',
    ok: () => hasAll([
      'CLERK_WEBHOOK_SECRET',
      'STRIPE_WEBHOOK_SECRET',
      'RESEND_WEBHOOK_SECRET',
      'CLOUDFLARE_WEBHOOK_SECRET',
    ]),
  },
  {
    name: 'launch policy/admin',
    ok: () => hasAll([
      'ADMIN_CLERK_USER_IDS',
      'MAIN_CREATOR_SLUG',
      'PATRON_MIN_TIP_AMOUNT',
      'PATRON_MIN_TIP_CURRENCY',
      'REFERRAL_PATRON_THRESHOLD',
      'HEALTHCHECK_TOKEN',
    ]),
  },
  {
    name: 'rate limiting',
    ok: () => hasPair([
      ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
      ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ]),
  },
  {
    name: 'Mux',
    ok: () => hasAll([
      'MUX_TOKEN_ID',
      'MUX_TOKEN_SECRET',
      'MUX_WEBHOOK_SECRET',
      'MUX_SIGNING_KEY_ID',
      'MUX_SIGNING_PRIVATE_KEY',
    ]),
  },
  {
    name: 'media host allowlist',
    ok: () => hasAny([
      'MEDIA_BUCKET_HOST',
      'NEXT_PUBLIC_R2_PUBLIC_HOST',
      'NEXT_PUBLIC_BLOB_PUBLIC_HOST',
      'ALLOWED_MEDIA_HOSTS',
    ]),
  },
];

const present = [];
const missing = [];

for (const check of checks) {
  if (check.ok()) {
    present.push(check.name);
  } else {
    missing.push(check.name);
  }
}

console.log('Vercel production env presence validation (non-secret)');
console.log('This script prints category names only. It never prints env values.');
console.log(`Present groups: ${present.length > 0 ? present.join(', ') : 'none'}`);
console.log(`Missing groups: ${missing.length > 0 ? missing.join(', ') : 'none'}`);

if (missing.length > 0) {
  process.exit(1);
}
