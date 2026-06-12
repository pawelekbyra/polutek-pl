# LAUNCH-FIX-001 — Vercel production environment validation

## 1. Executive summary

`LAUNCH-FIX-001` was executed as a docs-only operational evidence task in `Mode B — Vercel/operator access unavailable`.

The repository-required production environment inventory, operator checklist, safe evidence template, current code variable discovery, previous build-blocker reconciliation, and exact owner actions are now documented. Actual Vercel project settings, actual environment scopes, actual deployment logs, provider dashboard endpoints, deployment protection settings, and production/preview separation could not be verified from this container.

No runtime code, tests, scripts, build configuration, schema, packages, environment files, global roadmap, strategy docs, email docs, or active `LAUNCH-SECURITY-002` files were modified.

Verdict: `BLOCKED_OPERATOR_ACCESS`.

## 2. Baseline main SHA

Baseline commands requested by the ticket were captured before edits:

```txt
git status --short
# clean

git branch --show-current
# work

git rev-parse HEAD
# 2b2d2ea335dff8555ac9db2ba16f3a948ed570fc

git log --oneline -15
# 2b2d2ea Merge pull request #883 from pawelekbyra/codex/create-email-consent-audit-documentation
# 081b173 Add email consent readiness pack
# 01f6c6a Merge pull request #882 from pawelekbyra/codex/execute-security-boundary-audit-ticket
# e27c0f3 test: add launch security boundary audit pack
# 8123d90 Merge pull request #881 from pawelekbyra/codex/create-deterministic-vercel-build-recovery-ticket
# 8f315d1 fix: stabilize vercel build without google fonts
# b0ad1dc Merge pull request #880 from pawelekbyra/codex/create-legal/privacy-terms-readiness-pack
# 0918011 Add legal privacy terms readiness pack
# cd6e9f9 Merge pull request #879 from pawelekbyra/launch-ops-002-db-backup-drill-18057823859520263300
# f89365b I have completed the implementation of the database backup and recovery drill pack for LAUNCH-OPS-002. Here is a summary of my work:
# 3d5afb7 Merge pull request #878 from pawelekbyra/codex/create-launch-candidate-rehearsal-ticket
# 2511f8f test: add launch candidate critical path rehearsal
# 7ae657b Merge pull request #877 from pawelekbyra/codex/implement-playback-plan-state-messaging
# 8a509b7 X6-FU-002 playback state messaging
# 3635b6e Merge pull request #876 from pawelekbyra/codex/implement-confirmation-workflow-for-patron-access
```

Attempted latest-main synchronization:

```txt
git fetch origin main
# fatal: 'origin' does not appear to be a git repository
```

The container has no configured `origin` remote. Work proceeded from the current local main-equivalent branch at `2b2d2ea335dff8555ac9db2ba16f3a948ed570fc`, then a local ticket branch was created: `launch-fix-001-vercel-production-env-validation`.

## 3. Execution mode

`Mode B — Vercel/operator access unavailable`.

Evidence for this mode:

- No configured Git remote: `git remote -v` returned no remotes.
- No Vercel CLI: `command -v vercel` returned no path.
- No GitHub CLI: `gh auth status` failed because `gh` is not installed.
- Public route checks to `https://polutek.pl` and `https://www.polutek.pl` could not reach the application from this container because curl failed with `CONNECT tunnel failed, response 403` before an HTTP response from the app.

This report therefore does not guess actual Vercel variable presence, values, scopes, project mappings, provider endpoints, deployment logs, or production/preview separation.

## 4. Vercel project and branch mapping

| Item | Evidence | Status |
| --- | --- | --- |
| Vercel project name | Not available without Vercel/operator access. | `BLOCKED_OPERATOR_ACCESS` |
| GitHub repository mapping | Not available from local git because no remote is configured. | `BLOCKED_OPERATOR_ACCESS` |
| Production branch | Not available without Vercel/operator access. | `BLOCKED_OPERATOR_ACCESS` |
| Preview branch behavior | Not available without Vercel/operator access. | `BLOCKED_OPERATOR_ACCESS` |
| Latest deployment SHA | Not available without Vercel/operator access or deployment status from GitHub. | `BLOCKED_OPERATOR_ACCESS` |
| Production deployment target | Not available without Vercel/operator access. | `BLOCKED_OPERATOR_ACCESS` |
| Source branch | Not available for the actual latest Vercel deployment. Local baseline branch was `work`. | `BLOCKED_OPERATOR_ACCESS` |
| Deployment timestamp | Not available without Vercel/operator access. | `BLOCKED_OPERATOR_ACCESS` |
| Old fork/project check | Cannot verify without Vercel project mapping. | `BLOCKED_OPERATOR_ACCESS` |
| Deployment protection | Cannot verify from this container because public route checks were blocked before reaching the app. | `BLOCKED_OPERATOR_ACCESS` |

Operator action: open Vercel project settings and latest Production deployment, then record the redacted project reference, repo mapping, production branch, preview rules, deployment id/reference, deployment SHA, target, source branch, timestamp, domain assignment, and protection state.

## 5. Canonical domain and HTTPS

Repository/product context points to Polutek.pl, and the likely canonical production origin is `https://polutek.pl`, but this task could not verify owner-approved canonical-domain configuration in Vercel.

Container route-check result:

| URL | Result | Status |
| --- | --- | --- |
| `https://polutek.pl/` | `curl: (56) CONNECT tunnel failed, response 403`; no app status code. | `BLOCKED_OPERATOR_ACCESS` |
| `https://www.polutek.pl/` | `curl: (56) CONNECT tunnel failed, response 403`; no app status code. | `BLOCKED_OPERATOR_ACCESS` |

`www`/apex redirects, HTTPS certificate state, deployment protection, and `NEXT_PUBLIC_APP_URL` alignment remain operator-only.

## 6. Current deployment evidence

| Field | Evidence | Status |
| --- | --- | --- |
| Latest Vercel deployment identifier/reference | Not available. | `BLOCKED_OPERATOR_ACCESS` |
| Deployment state | Not available. | `BLOCKED_OPERATOR_ACCESS` |
| Deployment target | Not available. | `BLOCKED_OPERATOR_ACCESS` |
| Production domain | Not verified; likely candidate `https://polutek.pl` requires owner/operator confirmation. | `BLOCKED_OPERATOR_ACCESS` |
| Source branch | Not available for Vercel deployment. | `BLOCKED_OPERATOR_ACCESS` |
| Deployment timestamp | Not available. | `BLOCKED_OPERATOR_ACCESS` |
| Deployment logs | Not available. | `BLOCKED_OPERATOR_ACCESS` |

## 7. Environment variable matrix

The variable names below were derived from the current code and validation contract only. Actual Vercel presence and scopes were not inspected.

| Category | Variable | Required/optional | Production | Preview | Development | Format verified | Cross-variable alignment | Evidence | Status |
| -------- | -------- | ----------------- | ---------- | ------- | ----------- | --------------- | ------------------------ | -------- | ------ |
| Core/runtime | `NEXT_PUBLIC_APP_URL` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var; URL validator exists. | `BLOCKED_OPERATOR_ACCESS` |
| Core/runtime | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required runtime | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required runtime var. | `BLOCKED_OPERATOR_ACCESS` |
| Core/runtime | `DATABASE_URL` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var. | `BLOCKED_OPERATOR_ACCESS` |
| Core/runtime | `DATABASE_URL_UNPOOLED` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and health env boolean. | `BLOCKED_OPERATOR_ACCESS` |
| Core/runtime | `MAIN_CREATOR_SLUG` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var. | `BLOCKED_OPERATOR_ACCESS` |
| Core/runtime | `ADMIN_CLERK_USER_IDS` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var. | `BLOCKED_OPERATOR_ACCESS` |
| Core/runtime | `HEALTHCHECK_TOKEN` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and health token guard. | `BLOCKED_OPERATOR_ACCESS` |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required runtime | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Public Clerk key used by app/provider. | `BLOCKED_OPERATOR_ACCESS` |
| Clerk | `CLERK_SECRET_KEY` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and health env boolean. | `BLOCKED_OPERATOR_ACCESS` |
| Clerk | `CLERK_WEBHOOK_SECRET` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Clerk webhook route requires it. | `BLOCKED_OPERATOR_ACCESS` |
| Stripe | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var; client loads Stripe only when set. | `BLOCKED_OPERATOR_ACCESS` |
| Stripe | `STRIPE_SECRET_KEY` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and health env boolean. | `BLOCKED_OPERATOR_ACCESS` |
| Stripe | `STRIPE_WEBHOOK_SECRET` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and health env boolean. | `BLOCKED_OPERATOR_ACCESS` |
| Database | `DATABASE_URL` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and Prisma runtime dependency. | `BLOCKED_OPERATOR_ACCESS` |
| Database | `DATABASE_URL_UNPOOLED` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and health env boolean. | `BLOCKED_OPERATOR_ACCESS` |
| Resend/email | `RESEND_API_KEY` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var and legacy email provider dependency. | `BLOCKED_OPERATOR_ACCESS` |
| Resend/email | `EMAIL_FROM` | Required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var. | `BLOCKED_OPERATOR_ACCESS` |
| Resend/email | `RESEND_AUDIENCE_ID` | Optional/feature-dependent | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Admin email page displays this variable when present. | `BLOCKED_OPERATOR_ACCESS` |
| Resend/email | `RESEND_WEBHOOK_SECRET` | Required for production Resend webhook route | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Resend webhook route requires it in production. | `BLOCKED_OPERATOR_ACCESS` |
| Cloudflare Stream | `CLOUDFLARE_ACCOUNT_ID` | Required for Stream operations | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Cloudflare Stream client reads it. | `BLOCKED_OPERATOR_ACCESS` |
| Cloudflare Stream | `CLOUDFLARE_API_TOKEN` | Required for Stream operations | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Cloudflare Stream client reads it. | `BLOCKED_OPERATOR_ACCESS` |
| Cloudflare Stream | `CLOUDFLARE_WEBHOOK_SECRET` | Required for production Cloudflare webhook route | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Cloudflare webhook route requires it in production. | `BLOCKED_OPERATOR_ACCESS` |
| Rate limiting | `UPSTASH_REDIS_REST_URL` | Required as complete pair unless KV pair used | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Production validator accepts URL+token pair. | `BLOCKED_OPERATOR_ACCESS` |
| Rate limiting | `UPSTASH_REDIS_REST_TOKEN` | Required as complete pair unless KV pair used | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Production validator accepts URL+token pair. | `BLOCKED_OPERATOR_ACCESS` |
| Rate limiting | `KV_REST_API_URL` | Required as complete pair unless Upstash pair used | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Production validator accepts URL+token pair. | `BLOCKED_OPERATOR_ACCESS` |
| Rate limiting | `KV_REST_API_TOKEN` | Required as complete pair unless Upstash pair used | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Production validator accepts URL+token pair. | `BLOCKED_OPERATOR_ACCESS` |
| Media allowlist | `MEDIA_BUCKET_HOST` | One of four media allowlist vars required in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Validator/security allowlist source. | `BLOCKED_OPERATOR_ACCESS` |
| Media allowlist | `NEXT_PUBLIC_R2_PUBLIC_HOST` | Alternative media allowlist var | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Validator/security allowlist source. | `BLOCKED_OPERATOR_ACCESS` |
| Media allowlist | `NEXT_PUBLIC_BLOB_PUBLIC_HOST` | Alternative media allowlist var | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Validator/security allowlist source. | `BLOCKED_OPERATOR_ACCESS` |
| Media allowlist | `ALLOWED_MEDIA_HOSTS` | Alternative media allowlist var | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Validator/security allowlist source. | `BLOCKED_OPERATOR_ACCESS` |
| Product config | `PATRON_MIN_TIP_AMOUNT` | Required in production by current validator | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var; positive integer validator exists. | `BLOCKED_OPERATOR_ACCESS` |
| Product config | `PATRON_MIN_TIP_CURRENCY` | Required in production by current validator | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var; currency validator exists. | `BLOCKED_OPERATOR_ACCESS` |
| Product config | `REFERRAL_PATRON_THRESHOLD` | Required in production by current validator | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Required production var; positive integer validator exists. | `BLOCKED_OPERATOR_ACCESS` |
| Product config | `DISPLAY_EUR_TO_PLN_RATE` | Optional but recommended in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Optional/recommended production var. | `BLOCKED_OPERATOR_ACCESS` |
| Product config | `DISPLAY_USD_TO_PLN_RATE` | Optional but recommended in production | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `BLOCKED_OPERATOR_ACCESS` | `FORMAT_UNVERIFIED` | `VALUE_ALIGNMENT_UNVERIFIED` | Optional/recommended production var. | `BLOCKED_OPERATOR_ACCESS` |

## 8. Production/preview separation

Actual separation could not be verified without Vercel/operator and provider dashboard access.

| Area | Result | Status |
| --- | --- | --- |
| Database | Cannot verify production vs preview credentials or logical database separation. | `BLOCKED_OPERATOR_ACCESS` |
| Clerk | Cannot verify production instance, preview instance, callback URLs, or webhook secret separation. | `BLOCKED_OPERATOR_ACCESS` |
| Stripe | Cannot verify live/test mode, production/preview keys, or webhook endpoint separation. | `BLOCKED_OPERATOR_ACCESS` |
| Cloudflare | Cannot verify account/token/webhook-secret separation. | `BLOCKED_OPERATOR_ACCESS` |
| Resend | Cannot verify sender/domain/audience/webhook-secret separation. | `BLOCKED_OPERATOR_ACCESS` |
| Rate limiting | Cannot verify persistent production store or preview isolation. | `BLOCKED_OPERATOR_ACCESS` |
| Canonical app URL | Cannot verify production `NEXT_PUBLIC_APP_URL` value or preview URL isolation. | `BLOCKED_OPERATOR_ACCESS` |
| Webhook endpoints | Cannot verify provider dashboards use canonical production endpoints. | `BLOCKED_OPERATOR_ACCESS` |

## 9. Clerk alignment

Current code requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for runtime, `CLERK_SECRET_KEY` for server-side Clerk access, and `CLERK_WEBHOOK_SECRET` for Clerk webhook verification.

Actual Vercel scopes, production instance alignment, callback URL alignment, and webhook endpoint alignment were not available. No key prefixes or values were inspected, copied, or inferred.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 10. Stripe alignment

Current code requires `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. The Stripe webhook route rejects requests missing `stripe-signature` with `400`, which is an expected safe network-reachability response if the route is reachable without sending a valid event.

Actual key mode, publishable/secret alignment, webhook endpoint URL, and webhook-secret scope were not available. No payment was created and no webhook event was sent.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 11. Database alignment

Current code requires both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in production. The privileged health path reports only booleans and a coarse database status when a valid health token is supplied.

Actual database URLs, pooled/direct role alignment, same-logical-production-database alignment, and preview isolation were not available. No database connection or migration was attempted.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 12. Cloudflare alignment

Current-main Cloudflare Stream variable names discovered from code:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_WEBHOOK_SECRET`

The API token and webhook signing secret are distinct variable names. Actual Vercel presence/scope, token permissions, account alignment, and production webhook URL could not be verified. No Cloudflare provider API was called. Cloudflare webhook signature semantics were not certified because `LAUNCH-SECURITY-002` may change that route contract.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 13. Resend/email alignment

Current-main Resend/email variable names discovered from code:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `RESEND_AUDIENCE_ID`
- `RESEND_WEBHOOK_SECRET`

`RESEND_API_KEY` and `EMAIL_FROM` are required by the production validator. `RESEND_AUDIENCE_ID` is feature-dependent/currently used by the admin email surface. `RESEND_WEBHOOK_SECRET` is required by the production webhook route. Actual sender-domain alignment, audience status, webhook endpoint, and production/preview isolation could not be verified.

No email was sent. Email/subscription remains separate from PatronGrant access.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 14. Rate-limit persistence

Current production validation accepts one complete writable pair:

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`; or
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`.

Current code resolves URL and token independently from those pairs, and production throws rather than falling back to the in-memory store when no complete pair exists. Actual Vercel values/scopes and production persistence could not be verified.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 15. Media-host allowlist assessment

Current production validator requires at least one of:

- `MEDIA_BUCKET_HOST`
- `NEXT_PUBLIC_R2_PUBLIC_HOST`
- `NEXT_PUBLIC_BLOB_PUBLIC_HOST`
- `ALLOWED_MEDIA_HOSTS`

Current security utilities also include these variables in media/connect allowlists. Given the owner decision that Cloudflare Stream is the first video provider and R2/S3/Vercel Blob are legacy/migration unless future architecture changes, this requirement is classified as: **legacy but still required by current code**.

Follow-up need: reassess whether the production validator should keep public-media allowlist requirements under Cloudflare-first private playback architecture, without changing that validator in this ticket.

Status: `BLOCKED_OPERATOR_ACCESS` for actual variable presence; assessment completed from code.

## 16. Product configuration assessment

Current production validator requires:

- `PATRON_MIN_TIP_AMOUNT`
- `PATRON_MIN_TIP_CURRENCY`
- `REFERRAL_PATRON_THRESHOLD`

It recommends:

- `DISPLAY_EUR_TO_PLN_RATE`
- `DISPLAY_USD_TO_PLN_RATE`

Format rules discovered from code are positive integer strings for `PATRON_MIN_TIP_AMOUNT` and `REFERRAL_PATRON_THRESHOLD`, and a three-letter uppercase currency code for `PATRON_MIN_TIP_CURRENCY`.

Current code also has DB-backed payment settings for per-currency minimums, so this task does not infer that legacy/default environment variables override database-configured thresholds. Precedence remains ambiguous for launch operations until an owner/operator confirms intended runtime behavior with current production data.

Status: `BLOCKED_OPERATOR_ACCESS` for actual production values; format contract documented from code.

## 17. Route reachability

Safe route checks were attempted against the likely canonical origin from the container:

| Route | Command shape | Result | Status |
| --- | --- | --- | --- |
| Home | `curl -L https://polutek.pl/` | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| `www` apex behavior | `curl -L https://www.polutek.pl/` | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| Privacy policy | `curl -L https://polutek.pl/polityka-prywatnosci` | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| Terms | `curl -L https://polutek.pl/regulamin` | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| Health | `curl -L https://polutek.pl/api/health` | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |

No destructive route was called.

## 18. Webhook reachability

Webhook network reachability was attempted without valid signatures and without event payloads:

| Route | Command shape | Expected safe app response if reachable | Actual result | Status |
| --- | --- | --- | --- | --- |
| Stripe | `curl -X POST https://polutek.pl/api/webhooks/stripe` | `400` for missing `stripe-signature` | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| Clerk | `curl -X POST https://polutek.pl/api/webhooks/clerk` | `400` or similar for missing Svix headers | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| Cloudflare Stream | `curl -X POST https://polutek.pl/api/webhooks/cloudflare-stream` | `401` for missing/invalid signature or `400` for invalid payload, depending active route contract | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |
| Resend | `curl -X POST https://polutek.pl/api/webhooks/resend` | `401` for missing Svix/legacy signature or `500` if secret missing in production | `CONNECT tunnel failed, response 403`; no app response. | `BLOCKED_OPERATOR_ACCESS` |

No valid webhook signatures, mutation payloads, customer data, payment events, Cloudflare status events, Clerk account events, or Resend delivery events were sent.

## 19. Health verification

Current route contract from code:

- `GET /api/health` reads the `x-health-token` header.
- Missing/invalid token returns `{ ok: true }` without privileged database/env/content details.
- Valid token enables a database check and returns coarse booleans/statuses, not secret values.

Live deployed health behavior could not be verified because public route checks were blocked before reaching the app.

Status: `BLOCKED_OPERATOR_ACCESS`.

## 20. Production log review

Production logs were not available from this container.

Required operator log review:

| Category | Query/filter | Window | Evidence | Status |
| --- | --- | --- | --- | --- |
| Missing environment variable | `missing env`, `required in production`, exact variable-name searches | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Database connection failure | Prisma/database connection errors | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Clerk initialization failure | Clerk init/auth errors | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Stripe initialization failure | Stripe key/webhook construction errors | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Cloudflare authentication failure | Cloudflare credentials/API auth errors | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Resend configuration failure | Resend API/from/webhook-secret errors | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Rate-limit store fallback/failure | Redis/KV missing/failing, memory fallback | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Sitemap/static-generation error | sitemap/page-data/static-generation errors | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |
| Healthcheck failure | health endpoint failures | Narrow post-deployment window | Redacted count/presence only | `BLOCKED_OPERATOR_ACCESS` |

Do not commit raw logs.

## 21. Resolved previous build blockers

Read report: `docs/reports/reconciliation/STABILIZE-LAUNCH-BUILD-002-CURRENT-MAIN-VERCEL-BUILD-RECOVERY.md`.

Previous report conclusions:

- Remote Google Fonts build blocker was resolved by code changes in that prior task.
- Final local build blocker was `BLOCKED_OPERATOR_ENV` for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `DATABASE_URL`.
- The previous report explicitly warned not to infer production readiness from local code or a green deployment without actual env evidence.

Current reconciliation:

| Previous item | Current status | Reason |
| --- | --- | --- |
| Remote Google Fonts dependency | Resolved in previous build-fix report. | This ticket did not re-run build by instruction. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `BLOCKED_OPERATOR_ACCESS` | Actual Vercel production env presence/scope not available. Cannot move to `PRESENT_VERIFIED`. |
| `DATABASE_URL` | `BLOCKED_OPERATOR_ACCESS` | Actual Vercel production env presence/scope not available. Cannot move to `PRESENT_VERIFIED`. |
| Successful current deployment | Not verifiable | No Vercel/GitHub deployment status access in this container. |

## 22. Missing/unverified items

Everything below remains unverified due to operator access constraints:

- Vercel project name.
- GitHub repository mapping.
- Production branch and preview branch behavior.
- Latest deployment id/reference, SHA, state, target, source branch, and timestamp.
- Canonical production domain, HTTPS, and `www` redirect behavior.
- Deployment protection state for public routes and webhook callbacks.
- Every actual Vercel production/preview/development variable presence and scope.
- Production/preview/development separation for database, Clerk, Stripe, Cloudflare, Resend, rate limiting, app URL, and webhooks.
- Provider dashboard endpoint URL alignment.
- Safe route reachability and webhook network reachability from outside this restricted container.
- Production log review.
- Privileged health-token behavior on the deployed app.

No variable was confirmed missing; the status is access-blocked, not `MISSING`.

## 23. Operator actions required

1. In Vercel, record the redacted project identity, repo mapping, production branch, preview behavior, latest Production deployment id/reference, deployment SHA, deployment state, deployment target, source branch, and deployment timestamp.
2. In Vercel, complete the environment matrix in `docs/operations/vercel-production-environment-checklist.md` using only statuses/evidence references, never values.
3. In provider dashboards, verify Clerk, Stripe, Cloudflare Stream, and Resend endpoints use the canonical production domain and that webhook secrets are scoped intentionally.
4. Verify Production/Preview/Development separation for database, Clerk, Stripe, Cloudflare, Resend, rate limiting, app URL, and webhook endpoints.
5. From an unrestricted operator network, run the safe route and webhook reachability checks from the checklist without valid signatures or event payloads.
6. Review a narrow post-deployment Vercel log window for the listed failure categories and record only counts/presence with redacted evidence references.
7. Use the health token only from authorized operator access to verify privileged health behavior; do not publish the token or response details containing sensitive identifiers.

## 24. Files changed

- `docs/operations/vercel-production-environment-checklist.md`
- `docs/reports/reconciliation/LAUNCH-FIX-001-VERCEL-PRODUCTION-ENV-VALIDATION.md`
- `docs/tickets/ready/LAUNCH-FIX-001-vercel-production-env-validation.md`

## 25. What did not change

- No runtime code changed.
- No build configuration changed.
- No scripts changed.
- No tests changed.
- No schema or migrations changed.
- No packages changed.
- No environment files changed.
- No Vercel settings or environment values changed.
- No provider dashboard settings changed.
- No email-specific docs/tickets/reports changed.
- No `LAUNCH-SECURITY-002` route, tests, ticket, or reconciliation report changed.
- No global README, roadmap, strategy, architecture, or spec files changed.

## 26. Risks

- Public launch-candidate smoke tests remain blocked until an owner/operator completes the Vercel and provider checks.
- A green Vercel deployment, if one exists, still would not prove runtime integration alignment, production/preview isolation, webhook reachability, or clean logs without the evidence requested here.
- The likely canonical domain could be wrong or mapped to a different project until Vercel confirms project/domain ownership.
- Preview and production may share sensitive resources unless explicitly verified otherwise.
- Media allowlist requirements may reflect legacy public-media compatibility rather than the Cloudflare-first target architecture, but they remain required by current code.

## 27. Exactly one next recommendation

Owner/operator should complete `docs/operations/vercel-production-environment-checklist.md` in Vercel and provider dashboards, then return the redacted completed matrix/evidence references so `LAUNCH-FIX-001` can be updated from `BLOCKED_OPERATOR_ACCESS` to a verified or specific-blocker verdict.

## 28. Verdict

`BLOCKED_OPERATOR_ACCESS`

This ticket produced the docs-only checklist/report and reconciled current code requirements, but actual production environment validation cannot be completed without Vercel/operator access.
