# Vercel production environment checklist — LAUNCH-FIX-001

## Purpose

This checklist is the secret-safe operator runbook for validating whether the actual Vercel Production deployment is configured sufficiently for launch-candidate smoke tests.

It records variable names, scopes, presence, alignment, and redacted evidence references only. It must never include secret values, full environment dumps, database hosts, provider account IDs, webhook signing secrets, API tokens, signed playback URLs, or customer information.

## Execution mode used for this ticket

`Mode B — Vercel/operator access unavailable`

Repository-only evidence was collected. The local container had no configured Git remote, no Vercel CLI, and no GitHub CLI. Public HTTPS route checks to the likely canonical domain were attempted from the container, but the network path failed before reaching the application with `CONNECT tunnel failed, response 403`.

Because Vercel/operator access was unavailable, every actual Vercel environment value, scope, deployment log, provider dashboard endpoint, and project setting remains `BLOCKED_OPERATOR_ACCESS` until an owner/operator completes this checklist.

## Baseline captured

```txt
git status --short: clean
git branch --show-current: work
git rev-parse HEAD: 2b2d2ea335dff8555ac9db2ba16f3a948ed570fc
git log --oneline -15: PR #883 through PR #876 merge history visible locally
```

The branch was then created locally as `launch-fix-001-vercel-production-env-validation` from the current local main-equivalent branch. No remote `origin` was configured in the container, so a fresh `git fetch origin main` could not be performed from this environment.

## Operator checklist

### 1. Vercel project identity

Record the following without changing settings:

| Check | Evidence to record | Status |
| --- | --- | --- |
| Vercel project name | Project name or redacted project reference | `BLOCKED_OPERATOR_ACCESS` |
| GitHub repository mapping | Owner/repo mapping, redacted if needed | `BLOCKED_OPERATOR_ACCESS` |
| Production branch | Branch configured as Production | `BLOCKED_OPERATOR_ACCESS` |
| Preview behavior | Branch/PR preview rules and whether previews are isolated | `BLOCKED_OPERATOR_ACCESS` |
| Latest deployment | Redacted deployment id/reference, deployment SHA, target, state, timestamp | `BLOCKED_OPERATOR_ACCESS` |
| Production domain | Canonical production origin and aliases | `BLOCKED_OPERATOR_ACCESS` |
| HTTPS | HTTPS certificate active for canonical origin | `BLOCKED_OPERATOR_ACCESS` |
| `www` behavior | Redirect direction between `www` and apex | `BLOCKED_OPERATOR_ACCESS` |
| Deployment protection | Public app routes and provider callback routes are not blocked by Vercel protection/login wall | `BLOCKED_OPERATOR_ACCESS` |
| Fork/project safety | Production deployment is from the intended repo/project, not an old fork | `BLOCKED_OPERATOR_ACCESS` |

### 2. Environment variable inventory rules

For each variable below, record only:

- variable name;
- environment scope: Production, Preview, Development;
- present/missing;
- encrypted/sensitive flag where the dashboard exposes it;
- whether Production, Preview, and Development intentionally differ;
- redacted evidence reference, for example `Vercel dashboard Settings > Environment Variables checked by <operator> at <UTC timestamp>`.

Never record the value.

Allowed statuses are:

- `PRESENT_VERIFIED`
- `MISSING`
- `SCOPE_MISMATCH`
- `FORMAT_UNVERIFIED`
- `VALUE_ALIGNMENT_UNVERIFIED`
- `NOT_APPLICABLE`
- `BLOCKED_OPERATOR_ACCESS`

### 3. Environment variable matrix template

| Category | Variable | Required/optional | Production | Preview | Development | Format verified | Cross-variable alignment | Evidence | Status |
| -------- | -------- | ----------------- | ---------- | ------- | ----------- | --------------- | ------------------------ | -------- | ------ |
| Core/runtime | `NEXT_PUBLIC_APP_URL` | Required in production |  |  |  | HTTPS URL; canonical origin | Must match canonical production origin and provider dashboard endpoints |  |  |
| Core/runtime | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required runtime |  |  |  | Publishable Clerk key only; no secret value | Must align with production Clerk instance |  |  |
| Core/runtime | `DATABASE_URL` | Required in production |  |  |  | Database URL format; value redacted | Must align with `DATABASE_URL_UNPOOLED` logical production DB |  |  |
| Core/runtime | `DATABASE_URL_UNPOOLED` | Required in production |  |  |  | Database URL format; value redacted | Must align with `DATABASE_URL`; pooled/direct roles not reversed |  |  |
| Core/runtime | `MAIN_CREATOR_SLUG` | Required in production |  |  |  | Non-empty slug | Must point to intended single official creator/channel |  |  |
| Core/runtime | `ADMIN_CLERK_USER_IDS` | Required in production |  |  |  | Non-empty comma-separated Clerk user IDs; values redacted | Must align with intended production admins |  |  |
| Core/runtime | `HEALTHCHECK_TOKEN` | Required in production |  |  |  | Secret token present; value redacted | Required for privileged health details only |  |  |
| Clerk | `CLERK_SECRET_KEY` | Required in production |  |  |  | Server secret only | Same production Clerk instance as publishable key |  |  |
| Clerk | `CLERK_WEBHOOK_SECRET` | Required in production |  |  |  | Webhook signing secret present; value redacted | Clerk dashboard endpoint must use canonical production domain |  |  |
| Stripe | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Required in production |  |  |  | Publishable key only | Same intended mode as `STRIPE_SECRET_KEY` |  |  |
| Stripe | `STRIPE_SECRET_KEY` | Required in production |  |  |  | Server secret only; value redacted | Same intended mode/account as publishable key |  |  |
| Stripe | `STRIPE_WEBHOOK_SECRET` | Required in production |  |  |  | Webhook signing secret present; value redacted | Stripe endpoint must target canonical production domain |  |  |
| Database | `DATABASE_URL` | Required in production |  |  |  | Value redacted; pooled role checked | Same logical production DB as unpooled URL |  |  |
| Database | `DATABASE_URL_UNPOOLED` | Required in production |  |  |  | Value redacted; direct role checked | Same logical production DB as pooled URL |  |  |
| Resend/email | `RESEND_API_KEY` | Required in production |  |  |  | Server secret only; value redacted | Production sender/domain alignment checked |  |  |
| Resend/email | `EMAIL_FROM` | Required in production |  |  |  | Approved sender address/domain; safe domain only if public | Must align with verified Resend sender domain |  |  |
| Resend/email | `RESEND_AUDIENCE_ID` | Optional/feature-dependent in current code |  |  |  | Identifier redacted if sensitive | Needed only if audience sync/broadcast requires it |  |  |
| Resend/email | `RESEND_WEBHOOK_SECRET` | Required for production Resend webhook route |  |  |  | Webhook signing secret present; value redacted | Resend endpoint must target canonical production domain |  |  |
| Cloudflare Stream | `CLOUDFLARE_ACCOUNT_ID` | Required for Stream operations |  |  |  | Identifier redacted if sensitive | Must align with Stream account used for production assets |  |  |
| Cloudflare Stream | `CLOUDFLARE_API_TOKEN` | Required for Stream operations |  |  |  | Server token only; value redacted | Must be distinct from webhook signing secret |  |  |
| Cloudflare Stream | `CLOUDFLARE_WEBHOOK_SECRET` | Required for production Cloudflare webhook route |  |  |  | Webhook signing secret present; value redacted | Cloudflare endpoint must target canonical production domain |  |  |
| Rate limiting | `UPSTASH_REDIS_REST_URL` | Required as part of complete Upstash pair, unless KV pair used |  |  |  | URL format; value redacted | Must pair with `UPSTASH_REDIS_REST_TOKEN` in same scope |  |  |
| Rate limiting | `UPSTASH_REDIS_REST_TOKEN` | Required as part of complete Upstash pair, unless KV pair used |  |  |  | Server token only; value redacted | Must pair with `UPSTASH_REDIS_REST_URL` in same scope |  |  |
| Rate limiting | `KV_REST_API_URL` | Required as part of complete KV pair, unless Upstash pair used |  |  |  | URL format; value redacted | Must pair with `KV_REST_API_TOKEN` in same scope |  |  |
| Rate limiting | `KV_REST_API_TOKEN` | Required as part of complete KV pair, unless Upstash pair used |  |  |  | Server token only; value redacted | Must pair with `KV_REST_API_URL` in same scope |  |  |
| Media allowlist | `MEDIA_BUCKET_HOST` | One of the media allowlist variables is required by current validator |  |  |  | Host only; no protocol or secret | Legacy/public media compatibility; reassess for Cloudflare-first architecture |  |  |
| Media allowlist | `NEXT_PUBLIC_R2_PUBLIC_HOST` | Alternative media allowlist variable |  |  |  | Public host only | Legacy/public R2 compatibility |  |  |
| Media allowlist | `NEXT_PUBLIC_BLOB_PUBLIC_HOST` | Alternative media allowlist variable |  |  |  | Public host only | Legacy/public Blob compatibility |  |  |
| Media allowlist | `ALLOWED_MEDIA_HOSTS` | Alternative media allowlist variable |  |  |  | Comma-separated exact hosts | Legacy/public media compatibility |  |  |
| Product config | `PATRON_MIN_TIP_AMOUNT` | Required in production by current validator |  |  |  | Positive integer string | Precedence with DB-configured per-currency settings must be confirmed before relying on it |  |  |
| Product config | `PATRON_MIN_TIP_CURRENCY` | Required in production by current validator |  |  |  | Three-letter uppercase currency code | Precedence with DB-configured per-currency settings must be confirmed before relying on it |  |  |
| Product config | `REFERRAL_PATRON_THRESHOLD` | Required in production by current validator |  |  |  | Positive integer string | Must align with intended referral policy |  |  |
| Product config | `DISPLAY_EUR_TO_PLN_RATE` | Optional but recommended in production |  |  |  | Numeric display rate | Display/totals only; not patron access truth |  |  |
| Product config | `DISPLAY_USD_TO_PLN_RATE` | Optional but recommended in production |  |  |  | Numeric display rate | Display/totals only; not patron access truth |  |  |

### 4. Production/preview/development separation checks

Record redacted evidence that Production, Preview, and Development are intentionally separated for:

- database credentials;
- Clerk instances and webhook secrets;
- Stripe mode/account and webhook secrets;
- Cloudflare account/token/webhook secret;
- Resend API key, sender/domain, audience, webhook secret;
- rate-limit Redis/KV store;
- `NEXT_PUBLIC_APP_URL`;
- provider webhook endpoints.

Stop and mark a blocker if any high-risk finding is confirmed:

- Preview uses the production database unintentionally.
- Preview uses production Stripe secrets unintentionally.
- Production uses Stripe test keys unintentionally.
- Preview webhooks mutate production state.
- Production and Preview share webhook secrets without an intentional written policy.
- Preview email can send to real recipients unintentionally.
- `NEXT_PUBLIC_APP_URL` points to a preview URL in Production.

### 5. Safe route reachability checks

Using the canonical production origin, check only non-destructive routes:

```bash
curl -I https://<canonical-domain>/
curl -I https://<canonical-domain>/polityka-prywatnosci
curl -I https://<canonical-domain>/regulamin
curl -i https://<canonical-domain>/api/health
curl -i -X POST https://<canonical-domain>/api/webhooks/stripe
curl -i -X POST https://<canonical-domain>/api/webhooks/clerk
curl -i -X POST https://<canonical-domain>/api/webhooks/cloudflare-stream
curl -i -X POST https://<canonical-domain>/api/webhooks/resend
```

For webhook routes, `400`, `401`, or `405` can prove network reachability when no valid event/signature is sent. Do not send valid signatures, mutation payloads, customer data, payment events, Cloudflare status events, Clerk account events, or Resend delivery events.

Because `LAUNCH-SECURITY-002` may change the Cloudflare webhook contract, record only network reachability for Cloudflare here; do not certify Cloudflare signature semantics in this checklist.

### 6. Production logs checklist

Inspect a narrow post-deployment window. Record only timestamp range, query/filter, count/presence, redacted evidence reference, and result.

Search categories:

- missing environment variable;
- database connection failure;
- Clerk initialization failure;
- Stripe initialization failure;
- Cloudflare authentication failure;
- Resend configuration failure;
- rate-limit store fallback/failure;
- sitemap/static-generation error;
- healthcheck failure.

Do not copy raw logs, emails, user IDs, payment IDs, database hosts, provider account IDs, or stack traces containing secrets.

### 7. Health verification

Check the current route contract:

- missing/invalid `x-health-token` should return a safe public response without sensitive provider details;
- valid `x-health-token` should be checked only by an operator who already has the secret and must not publish it;
- healthy privileged response must avoid secret values and expose only booleans/coarse status.

### 8. Exact owner action required

Owner/operator must complete the Vercel dashboard, provider dashboard, route reachability, health-token, and log-review checks above and paste only redacted statuses/evidence references back into the reconciliation thread or a follow-up PR.
