# LAUNCH-FIX-001 — Vercel Production Env Validation

## Status

Merge recommendation: **MERGE**.

Ticket/task: `LAUNCH-FIX-001-vercel-production-env-validation`.

## Intent

Create a repeatable, repository-backed launch validation artifact for Vercel production environment readiness so future launch checks do not depend on chat memory, screenshots without context, or unreviewable secret values.

This report is **ops/validation oriented**. It does not configure secrets, does not call provider APIs, does not certify launch readiness by itself, and does not change production runtime behavior.

## Sources inspected

- `AGENTS.md`
- `docs/tickets/ready/LAUNCH-FIX-001-vercel-production-env-validation.md`
- `docs/reports/reconciliation/LAUNCH-OPS-001-PRODUCTION-ENV-AND-SMOKE-TEST-INVENTORY.md`
- `DEPLOY_CHECKLIST.md`
- `vercel.json`
- `package.json` script names, read-only
- `scripts/validate-env.ts`
- `scripts/validate-e2e-env.ts`
- `lib/env/validation.ts`, read-only existing env contract
- `tests/unit/env-validation.test.ts`, read-only existing env validation pattern
- Existing webhook/env references, read-only: Clerk, Stripe, Resend, Cloudflare Stream, health, email, and Cloudflare upload paths

## Files changed

- Added `docs/reports/reconciliation/LAUNCH-FIX-001-VERCEL-PRODUCTION-ENV-VALIDATION.md`
- Added `scripts/validate-vercel-production-env.mjs`

## Scope confirmation

Allowed scope used:

- `docs/reports/reconciliation/**`
- `scripts/**` only for a no-dependency, non-secret, explicitly run validator allowed by the task prompt

Forbidden paths remain unchanged:

- `lib/modules/video/**`
- `app/admin/videos/**`
- `app/api/admin/videos/**`
- `lib/services/playback/**`
- `app/api/media-source/**`
- `app/api/media/**`
- `lib/modules/comments/**`
- `lib/modules/payments/**`
- `lib/modules/patron/**`
- `lib/modules/access/**`
- `lib/modules/users/**`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `docs/strategy/**`

## Secret-safety confirmation

- **Never commit secrets.** Do not paste secret values into commits, PR bodies, issue comments, screenshots, or reconciliation reports.
- This report names required environment variable keys and verification evidence only.
- The validator prints category names only: present groups and missing groups.
- The validator never prints env values and never calls Clerk, Stripe, Resend, Cloudflare, Vercel, or database APIs.
- Any future evidence should redact values as `configured`, `present`, `scoped to Production`, or `last checked at <timestamp>`, never as raw values.

## Required env groups documented

### 1. Clerk

Production presence requirements:

- Public/browser-safe:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Server-only:
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET`

Manual checks:

- Vercel Production env contains all three keys.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is intentionally public and matches the intended production Clerk application.
- `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SECRET` are server-only secrets and must not be exposed through `NEXT_PUBLIC_` names.
- Clerk Dashboard webhook endpoint points to the production URL: `https://<production-domain>/api/webhooks/clerk`.
- Clerk webhook endpoint is not configured to a preview URL, stale deployment URL, or local tunnel.

### 2. Stripe

Production presence requirements:

- Public/browser-safe:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Server-only:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

Manual checks:

- Vercel Production env contains all three keys.
- The public publishable key belongs to the same Stripe mode/account as `STRIPE_SECRET_KEY`.
- `STRIPE_WEBHOOK_SECRET` belongs to the production endpoint URL: `https://<production-domain>/api/webhooks/stripe`.
- Stripe Dashboard webhook endpoint is not configured to a preview URL, stale deployment URL, or local tunnel.
- Do not treat successful payment configuration as patron access by itself; production smoke must still prove `Payment -> PatronGrant -> Access`.

### 3. Resend/email

Production presence requirements:

- Server-only:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `RESEND_WEBHOOK_SECRET`
- Optional/feature-dependent, if audience synchronization is used:
  - `RESEND_AUDIENCE_ID`

Manual checks:

- Vercel Production env contains `RESEND_API_KEY`, `EMAIL_FROM`, and `RESEND_WEBHOOK_SECRET`.
- `EMAIL_FROM` is an approved sender/domain for production mail.
- Resend webhook endpoint points to the production URL: `https://<production-domain>/api/webhooks/resend`.
- Resend webhook is not configured to a preview URL, stale deployment URL, or local tunnel.
- Marketing/broadcast readiness remains separate from patron access; newsletter subscription must not be used as patron access truth.

### 4. Cloudflare Stream

Production presence requirements:

- Server-only:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_WEBHOOK_SECRET`

Manual checks:

- Vercel Production env contains all three keys.
- `CLOUDFLARE_API_TOKEN` has only the Cloudflare Stream permissions needed for upload/status workflows.
- Cloudflare Stream webhook endpoint points to the production URL: `https://<production-domain>/api/webhooks/cloudflare-stream`.
- Cloudflare webhook is not configured to a preview URL, stale deployment URL, or local tunnel.
- Private playback still requires backend access approval; env presence alone is not playback certification.

### 5. Database

Production presence requirements:

- Server-only:
  - `DATABASE_URL`
  - `DATABASE_URL_UNPOOLED`

Manual checks:

- Both URLs point to the intended production database, not staging/preview/dev.
- The pooled/unpooled split matches the database provider recommendation for Vercel/Prisma.
- `npm run vercel-build` uses `npm run db:generate && next build` from `vercel.json`; production migrations must be handled by the agreed production migration/predeploy process before or during release operations.
- Production logs after deploy contain no Prisma missing-env, migration, or missing-column errors.

### 6. App/base URL/public URL

Production presence requirements:

- Public/browser-safe:
  - `NEXT_PUBLIC_APP_URL`
- Server-only/ops/content launch dependencies:
  - `MAIN_CREATOR_SLUG`
  - `ADMIN_CLERK_USER_IDS`
  - `HEALTHCHECK_TOKEN`

Manual checks:

- `NEXT_PUBLIC_APP_URL` uses the canonical HTTPS production origin, for example `https://polutek.pl` if that is the owner-approved launch domain.
- No production env points to `localhost`, a Vercel preview deployment, or a staging domain unless explicitly intended for Preview/Staging only.
- `MAIN_CREATOR_SLUG` points to the official single Polutek channel.
- `ADMIN_CLERK_USER_IDS` contains the immutable production admin Clerk user IDs.
- `HEALTHCHECK_TOKEN` is present and kept server-only.

### 7. Webhook secrets

Production presence requirements:

- `CLERK_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_WEBHOOK_SECRET`
- `CLOUDFLARE_WEBHOOK_SECRET`

Manual checks:

- Every provider dashboard endpoint uses the same canonical production base URL.
- Every provider dashboard secret is the secret copied into the Vercel **Production** environment for that same endpoint.
- Webhook URLs are reachable without Vercel Deployment Protection, password protection, or preview-only auth blocking provider calls.
- A future webhook smoke PR must attach provider dashboard evidence showing endpoint URL, delivery attempt status, timestamp, event ID, and redacted secret status.

### 8. Additional production readiness envs already represented by existing repo checks

These are not provider groups from the goal, but they are launch-relevant because existing validation and checklists require them:

- Patron policy/config:
  - `PATRON_MIN_TIP_AMOUNT`
  - `PATRON_MIN_TIP_CURRENCY`
  - `REFERRAL_PATRON_THRESHOLD`
- Rate limiting, one complete pair:
  - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
- Media host allowlist, at least one exact allowlist source:
  - `MEDIA_BUCKET_HOST`, or
  - `NEXT_PUBLIC_R2_PUBLIC_HOST`, or
  - `NEXT_PUBLIC_BLOB_PUBLIC_HOST`, or
  - `ALLOWED_MEDIA_HOSTS`

## Server-only vs public env distinction

Public variables are bundled into browser/client code because they use the `NEXT_PUBLIC_` prefix. Treat them as non-secret identifiers only:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_R2_PUBLIC_HOST` and `NEXT_PUBLIC_BLOB_PUBLIC_HOST`, if used as public host allowlist inputs

Server-only variables must not be renamed with `NEXT_PUBLIC_`, exposed in screenshots, or printed by scripts:

- Database URLs
- Secret/API keys
- Webhook secrets
- Healthcheck token
- Admin Clerk user IDs
- Rate-limit tokens
- Cloudflare API token/account operational config
- Resend API key/audience operational config

## Production vs Preview/Staging distinction

Vercel env scoping must be explicit:

- Production envs are for the canonical public launch domain only.
- Preview/Staging envs may use test-mode or staging provider projects, but must not be confused with production launch evidence.
- Provider dashboard webhooks for production must point to the canonical production origin, not a branch preview or staging URL.
- Provider dashboard webhooks for Preview/Staging should remain separate and use their own test/staging secrets.
- A passing preview deploy is not evidence that Production envs are present.
- A production deployment built before env changes may need a redeploy so the current env set is applied.

## Exact manual verification steps for Vercel dashboard

1. Open Vercel Dashboard.
2. Select the Polutek.pl project.
3. Go to **Settings → Environment Variables**.
4. Filter or visually inspect variables scoped to **Production**.
5. For each group above, confirm the variable names exist in Production scope.
6. Do not reveal values. Record only `present`, `missing`, or `wrong scope`.
7. Confirm public variables are limited to expected `NEXT_PUBLIC_` values.
8. Confirm server-only secrets do not use `NEXT_PUBLIC_` names.
9. Confirm Preview/Staging variables are separately scoped and do not substitute for Production evidence.
10. Go to **Settings → Domains** and confirm the canonical production domain is assigned to the project.
11. Confirm HTTPS is active for the canonical production domain.
12. Go to **Settings → Git** and confirm the production deployment branch mapping is the expected launch branch.
13. Go to **Deployments**, open the latest Production deployment, and confirm it was created after the relevant env changes.
14. Open deployment logs and search for missing-env, provider-auth, Prisma, Clerk, Stripe, Resend, Cloudflare, and webhook configuration errors.
15. Confirm deployment protection does not block provider webhook POSTs to production webhook routes.
16. If any value is missing or wrong-scoped, stop and record a blocker; do not paste the secret value into the PR.

## Exact deployment/build verification steps

Run these only in an environment with the intended production env loaded, or use Vercel's deployment logs where Vercel injects Production envs.

1. Confirm the Vercel build command:
   ```bash
   cat vercel.json
   ```
   Expected evidence: `buildCommand` is `npm run vercel-build`.

2. Run the non-secret production env presence validator against a securely loaded env:
   ```bash
   node scripts/validate-vercel-production-env.mjs
   ```
   Expected evidence: output lists only present/missing category names. No values appear.

   Optional with a local Vercel-pulled env file on Node versions supporting `--env-file`:
   ```bash
   node --env-file=.env.vercel.production.local scripts/validate-vercel-production-env.mjs
   ```
   The env file must remain local, untracked, and secret-safe.

3. Run the existing application env validator when production envs are securely loaded:
   ```bash
   npm run env:validate:prod
   ```
   Expected evidence: validation passes or reports only variable names/errors, not values.

4. Confirm build/deploy path from Vercel Production logs:
   ```bash
   npm run vercel-build
   ```
   Expected evidence: Vercel logs show the configured command and no missing-env/provider-auth failures.

5. After deployment, verify production URLs manually:
   - `https://<production-domain>/`
   - `https://<production-domain>/channel/<MAIN_CREATOR_SLUG>`
   - Auth login entry points
   - Admin route as admin only
   - Webhook route reachability by provider dashboard delivery/test-event tools, not by unauthenticated browser GETs

## Expected evidence to include in future PRs

Future launch PRs should include evidence in this shape:

- Vercel project name: redacted if needed, but identify the project unambiguously.
- Production domain: canonical URL only, no secrets.
- Env group matrix with `present`, `missing`, or `wrong scope` statuses.
- Deployment ID or URL for the checked Production deployment.
- UTC timestamp of verification.
- Confirmation that deployment happened after env changes.
- Build command observed in Vercel logs.
- Redacted provider webhook dashboard screenshots or textual summaries showing:
  - provider name,
  - endpoint URL,
  - event type,
  - delivery timestamp,
  - delivery status,
  - secret present/redacted.
- Production logs summary with no missing-env/provider-auth errors.
- Explicit list of unresolved blockers and owner actions.

## Lightweight validator added

Added `scripts/validate-vercel-production-env.mjs`.

Properties:

- Uses only Node.js built-ins.
- Adds no package dependencies.
- Does not modify `package.json`.
- Does not run unless explicitly invoked.
- Does not load or fetch secrets on its own.
- Does not call live provider APIs.
- Prints category names only.
- Exits with non-zero status if one or more required categories are incomplete.

Expected output shape when envs are missing:

```txt
Vercel production env presence validation (non-secret)
This script prints category names only. It never prints env values.
Present groups: <category names or none>
Missing groups: <category names or none>
```

## Blockers and owner actions

Current blockers before public launch certification:

1. Owner/operator with Vercel Production access must verify actual env presence and scoping in the Vercel dashboard.
2. Owner/operator with provider dashboard access must verify production webhook URLs and production webhook secrets in Clerk, Stripe, Resend, and Cloudflare.
3. Owner/operator must confirm the canonical production domain and HTTPS state.
4. Owner/operator must confirm the production branch mapping and that the checked deployment was created after env changes.
5. Future smoke-test tickets must prove payment-to-PatronGrant access, Cloudflare playback gating, comments access, and admin upload/import behavior in production-like conditions.

## What did not change

- No runtime application code changed.
- No middleware changed.
- No payment behavior changed.
- No patron/access behavior changed.
- No video/playback behavior changed.
- No comments behavior changed.
- No schema or migration changed.
- No package dependency or package script changed.
- No secrets were configured, printed, or committed.

## Risks

- The validator can confirm presence categories only; it cannot prove values are correct, rotated, scoped to the intended provider project, or authorized.
- Vercel Production env changes may not affect an already-built deployment until redeploy.
- Provider dashboards can still point to stale preview URLs even if Vercel envs are present.
- Production smoke tests remain required; env presence is not launch certification.

## Validation results

- `git diff --check`: passed.
- `node scripts/validate-vercel-production-env.mjs`: ran locally with no production env loaded; exited non-zero as expected and printed only missing/present category names.
- Dummy complete-env validator run: passed with placeholder `present` values and printed only category names.
- Forbidden file check: passed; changed files are limited to this report and `scripts/validate-vercel-production-env.mjs`.

## Remaining blockers

- Actual Vercel dashboard and provider dashboard verification require owner/operator credentials unavailable to this repository-only agent.
- Production env values cannot and must not be committed as proof.
- Launch remains uncertified until the follow-up launch smoke tickets provide production evidence.

## Next recommended ticket

`LAUNCH-FIX-002-cloudflare-webhook-production-check` should verify the Cloudflare Stream production webhook URL, deployment protection state, delivery evidence, and redacted webhook-secret alignment.

## Ticket status

Implemented as focused ops validation artifact with a safe non-secret validator.

Merge recommendation: **MERGE**.
