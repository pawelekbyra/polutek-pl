# LAUNCH-OPS-001 — Production Env and Smoke-Test Inventory

## Status

Merge recommendation: **MERGE** for this docs-only / ops-inventory PR.

Ticket/task: `LAUNCH-OPS-001-production-env-and-smoke-test-inventory`.

## Intent

Turn the remaining production setup, environment, webhook, and manual smoke-test work into small executable tickets that future agents can run from repository files instead of chat memory.

This report is intentionally **docs-only**. It does not certify production readiness and does not claim target architecture is already implemented in runtime.

## Scope confirmation

Allowed paths touched by this task:

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**`
- `docs/tickets/blocked/**`

No runtime files were changed.

Forbidden paths for this task remain untouched:

- `lib/**`
- `app/**`
- `components/**`
- `tests/**`
- `prisma/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `scripts/**`
- `docs/roadmap/**`
- `docs/strategy/**`

## Sources inspected

Read-only documentation inspection only:

- `docs/reports/reconciliation/X1-READY-001-PAYMENT-PATRON-CURRENT-STATE-INVENTORY.md`
- `docs/reports/reconciliation/X2-READY-001-ACCESS-TRUTH-INVENTORY.md`
- `docs/reports/reconciliation/X3-READY-001-VIDEO-PROVIDER-FOUNDATION-INVENTORY.md`
- `docs/reports/reconciliation/X3-FIX-001-CLOUDFLARE-STREAM-VIDEO-ASSET-FOUNDATION.md`
- `docs/reports/reconciliation/X3-FIX-002-PLAYBACK-PLAN-PROVIDER-GATING-CONTRACT.md`
- `docs/reports/reconciliation/X3-FIX-003-ADMIN-CLOUDFLARE-UPLOAD-AND-ASSET-STATUS.md`
- `docs/reports/reconciliation/X3-FIX-004-PROVIDER-WEBHOOK-ASSET-STATE.md`
- `docs/reports/reconciliation/X3-FIX-005-VIDEO-PROVIDER-DENIED-PLAYBACK-NEGATIVE-TESTS.md`
- `docs/reports/reconciliation/X3-FIX-006-LEGACY-STORAGE-MIGRATION-PLAN.md`
- `docs/reports/reconciliation/X3-FIX-007-LEGACY-VIDEO-INVENTORY-ADMIN-DIAGNOSTICS.md`
- `docs/reports/reconciliation/X4-READY-001-COMMENTS-PUBLIC-READ-PATRON-WRITE-INVENTORY.md`
- `docs/reports/reconciliation/X4-FIX-001-COMMENT-READ-PRODUCT-CONTRACT.md`
- `docs/reports/reconciliation/X4-FIX-003-COMMENT-BADGE-TRUTH-HARDENING.md`
- `docs/reports/reconciliation/X4-FIX-004-COMMENT-ACCESS-TRUTH-NEGATIVE-TESTS.md`
- `docs/tickets/ready/**` index and relevant X3/X4 launch-adjacent tickets
- `docs/tickets/blocked/**` index
- `AGENTS.md` for active rules/context only; not edited

## Current launch-readiness summary

Polutek.pl appears close to a technical beta state, but this ops inventory treats public launch as **not yet certified**. Recent documentation reports indicate that several launch-critical foundations exist or were recently hardened:

- Patron access truth has moved toward `PatronGrant` rather than `User.isPatron` shortcuts.
- Cloudflare Stream is the selected first video provider, with asset foundation, admin upload/status workflow, and provider webhook handling represented in reconciliation reports.
- Denied playback negative tests are expected to prove that locked users do not receive a playable URL/token and do not trigger provider playback source calls.
- Legacy video migration diagnostics exist so remaining non-Cloudflare assets can be identified before launch.
- Comments have been aligned toward public read with patron/admin write behavior and PatronGrant-backed write truth.

Remaining readiness work is primarily operational and evidentiary:

1. Production environment variables/secrets must be configured and verified in the actual deployment target.
2. Webhook endpoints must be reachable from production providers and must use production webhook secrets.
3. Manual smoke tests must prove the production integration path from payment to access to video playback.
4. Smoke tests must explicitly confirm negative security outcomes: non-patrons and guests cannot obtain private playback sources/tokens.
5. Owner decisions for legal/privacy copy and Cloudflare cost/retention policy should be resolved before public launch.

## Production env/secrets checklist

Future launch verification should confirm each item in the production deployment provider, not only in local `.env` files.

- [ ] Production deployment has a documented env owner and rotation owner.
- [ ] Production env is separate from preview/staging env.
- [ ] No production secret is committed to the repository.
- [ ] Required server-only secrets are configured as server-only deployment variables.
- [ ] Required public variables have the expected `NEXT_PUBLIC_*` exposure only when safe.
- [ ] Preview/staging provider keys are not accidentally used in production.
- [ ] Production domain is configured and all provider dashboard callback/webhook URLs use that domain.
- [ ] Deployment logs are checked after env rollout for missing-env or provider-auth failures.
- [ ] A rollback plan exists for replacing a bad secret without changing code.
- [ ] Manual smoke tester has a list of safe test accounts/cards and knows which provider modes are live vs test.

## Cloudflare Stream env checklist

Cloudflare Stream is the first active private video provider for patron playback. Future tickets should verify the following against production deployment and the Cloudflare dashboard:

- [ ] Cloudflare account id is configured in production.
- [ ] Cloudflare API token is configured in production as a server-only secret.
- [ ] Cloudflare API token is scoped narrowly enough for Stream upload/import/status operations.
- [ ] Cloudflare Stream webhook secret is configured in production as a server-only secret.
- [ ] Cloudflare webhook URL points at the production deployment webhook route.
- [ ] Cloudflare webhook URL uses HTTPS and the canonical production domain.
- [ ] Cloudflare dashboard events are configured for asset lifecycle events needed by the app.
- [ ] Upload capability works from admin workflow for a small test asset.
- [ ] Import/link capability assumptions are verified for migration from legacy video URLs.
- [ ] Provider asset status transitions from processing to ready are reflected in the app.
- [ ] Failed processing is visible to admins and does not expose a broken playback source.
- [ ] Signed/private playback assumptions are verified for patron-only videos.
- [ ] Denied viewers do not trigger Cloudflare playback-token/source creation.

### Cloudflare upload/import capability assumptions

The launch smoke-test path should verify both of these assumptions separately:

1. **New upload path:** admin can create/attach a Cloudflare Stream asset from a new upload and observe processing/ready status.
2. **Migration/import path:** admin can attach/import an existing legacy source into Cloudflare Stream without treating R2/S3/Vercel Blob as the long-term private playback provider.

If import is not implemented or not production-ready yet, public launch can still proceed only if launch content uses validated Cloudflare Stream assets and legacy private playback is not relied on for patron content.

## Stripe/payment env checklist

Patronage is a reward for qualifying one-time support/donation, not a recurring subscription. Future tickets should verify:

- [ ] Stripe secret key for the intended production/test mode is configured in production.
- [ ] Stripe publishable key for the matching mode is configured where needed.
- [ ] Stripe webhook secret is configured in production as a server-only secret.
- [ ] Stripe webhook URL points at the production webhook route on the canonical domain.
- [ ] Stripe webhook sends payment success events needed to record `Payment` and evaluate eligibility.
- [ ] Stripe webhook sends refund events needed to revoke a linked grant after full refund.
- [ ] Stripe webhook sends dispute opened/won/lost events needed to suspend/reactivate/revoke linked grants.
- [ ] Minimum qualifying amounts are production-confirmed for PLN, USD, EUR, and CHF.
- [ ] Checkout/payment flow refuses below-threshold amounts server-side.
- [ ] Successful qualifying payment creates or preserves the expected `PatronGrant` truth.
- [ ] Non-qualifying payment, if possible, does not create patron access.
- [ ] Duplicate webhook delivery is idempotent and does not create duplicate grants or duplicate financial facts.
- [ ] Production provider dashboards clearly distinguish live/test payments used during launch verification.

### Refund/dispute handling assumptions

Launch smoke testing may not safely execute live chargebacks. At minimum, before public launch the team should verify from existing tests/reports and provider test mode that:

- full refund revokes the linked grant only;
- dispute opened suspends the linked grant;
- dispute won reactivates the linked grant when policy allows;
- dispute lost/chargeback revokes the linked grant;
- every manual access-impacting action requires reason/audit as required by `AGENTS.md`.

## Clerk/auth env checklist

- [ ] Clerk publishable key is configured for the production instance.
- [ ] Clerk secret key is configured as a server-only production secret.
- [ ] Clerk production domain/callback URLs are configured.
- [ ] Admin user identity/role source is documented and verified in production.
- [ ] Patron access is not derived from Clerk metadata.
- [ ] Signed-out guest behavior is smoke-tested separately from signed-in non-patron behavior.
- [ ] Test accounts exist for admin, patron, non-patron, and guest flows.
- [ ] Clerk webhooks, if used in production, are configured with production endpoint/secrets and do not grant patron access directly.

## Email/Resend env checklist

- [ ] Resend API key is configured as a server-only production secret.
- [ ] Sending domain is verified in Resend/DNS.
- [ ] From/reply-to addresses are production-approved.
- [ ] Transactional emails are separated from marketing consent.
- [ ] Newsletter/subscription consent does not create patron access.
- [ ] Unsubscribe flow does not remove or alter `PatronGrant`.
- [ ] Bounce and complaint suppression is configured or has a launch-critical follow-up.
- [ ] Test-send/preview path is verified before any broadcast.

## Vercel deployment checklist

- [ ] Production project is connected to the intended Git branch.
- [ ] Production domain and HTTPS are configured.
- [ ] Production env vars are configured and scoped correctly.
- [ ] Preview env vars are not accidentally promoted into production.
- [ ] Build succeeds in the production environment.
- [ ] Runtime logs are checked after deployment for missing env, provider auth, database, webhook, or route errors.
- [ ] Webhook routes are not blocked by deployment protection, auth middleware, or preview-only settings.
- [ ] Provider dashboards use the production deployment URL, not a preview URL.
- [ ] Admin route access is verified after deployment.
- [ ] Rollback/redeploy procedure is documented for launch day.

## Required manual smoke tests

The following smoke tests are intentionally manual/evidence-oriented. Future agents should capture exact account, video, payment, provider event, and deployment identifiers in their PR reports without exposing secrets.

### Video access smoke tests

- [ ] Guest opens a public video and can view the playable public experience.
- [ ] Guest opens a patron-only video and sees locked/denied UI rather than a mounted real private player.
- [ ] Non-patron signed-in user opens a patron-only video and cannot access video source/token.
- [ ] Patron opens a patron-only video and can play the allowed Cloudflare-backed video.
- [ ] READY Cloudflare video becomes playable only for an allowed viewer.
- [ ] Denied viewer does not receive `playbackUrl`, `playbackToken`, or equivalent provider source in network responses.
- [ ] Denied viewer does not cause a Cloudflare/Mux playback source/token call, as far as logs/evidence can prove.

### Payment/access smoke tests

- [ ] Qualifying patron payment creates a `Payment` fact.
- [ ] Qualifying patron payment creates an active `PatronGrant` or preserves existing active grant according to policy.
- [ ] Access module/admin diagnostics show patron access from `PatronGrant`, not Clerk metadata or `User.isPatron`.
- [ ] A non-patron account remains denied after login until it has an active grant.
- [ ] Refund/dispute assumptions are verified through test-mode event simulation or existing automated evidence before public launch.

### Comments smoke tests

- [ ] Comments are readable publicly on published public video.
- [ ] Comments are readable publicly on published patron-only video.
- [ ] Guest cannot write comments, react, or report.
- [ ] Signed-in non-patron cannot write/react/report on patron-only video.
- [ ] Patron can write/react/report where policy allows.
- [ ] Admin can write/moderate where policy allows.

### Admin/Cloudflare smoke tests

- [ ] Admin uploads a new Cloudflare Stream asset.
- [ ] Admin imports or attaches a Cloudflare Stream asset for migration if that workflow is launch-scoped.
- [ ] Admin can see processing status.
- [ ] Cloudflare webhook marks asset `READY` in the app.
- [ ] Admin sees failed state if Cloudflare reports failure.
- [ ] READY Cloudflare asset can become the primary playable source without exposing legacy private URL fallback to denied viewers.

## Known blockers

### Technical/evidence blockers

- Production env variables and webhook endpoints are not certified by this docs-only task.
- End-to-end production smoke evidence is not captured in this docs-only task.
- Cloudflare Stream upload/import behavior must be proven against the production provider environment.
- Stripe webhook payment-to-PatronGrant behavior must be proven in the deployed environment.
- Denied playback must be checked in production-like browser/network logs for source/token leakage.
- Comments public-read/patron-write behavior must be verified manually after deployment.

### Owner-decision blockers

- Public launch needs owner-approved legal/privacy/terms/cookie/support copy.
- Cloudflare Stream cost, retention, and legacy-original preservation policy needs owner approval.

## Risks

- **Secret drift:** staging/test keys may be configured in production or production keys may be missing.
- **Webhook drift:** provider dashboards may point to preview URLs or obsolete route paths.
- **False readiness:** automated tests can pass while production env/webhooks are not configured.
- **Token/source leakage:** a denied viewer could still receive a source/token if production config bypasses expected gating.
- **Legacy fallback risk:** legacy R2/S3/Vercel Blob URLs may remain present for migration but must not be treated as the active safe private provider.
- **Payment/access mismatch:** `Payment` success alone must not be treated as access; active `PatronGrant` remains the source of truth.
- **Operational ambiguity:** without owner decisions, launch-day support, privacy/legal posture, and Cloudflare retention costs remain unclear.

## Owner decisions

Owner decisions already active from `AGENTS.md` and applied here:

- Patronage is not a recurring subscription.
- Patronage is a reward for qualifying one-time support/donation.
- Patron access is lifetime/no-expiry by default unless suspended or revoked by policy.
- Launch thresholds are configurable per currency with launch defaults of 10 PLN, 10 USD, 10 EUR, and 10 CHF.
- Cloudflare Stream is the first video provider.
- R2/S3/Vercel Blob are legacy/migration paths, not active safe private patron playback providers without a future architecture decision.
- Comments under patron-only videos are visible to everyone; writing/reacting requires patron or admin.
- Launch is public, not private beta.

Owner decisions still needed before public launch:

1. Approve legal/privacy/terms/cookie/support copy and where it must appear in production.
2. Approve Cloudflare Stream budget, retention policy, and how long original legacy files are preserved after migration.

## Tickets created

Ready tickets:

1. `docs/tickets/ready/LAUNCH-FIX-001-vercel-production-env-validation.md`
2. `docs/tickets/ready/LAUNCH-FIX-002-cloudflare-webhook-production-check.md`
3. `docs/tickets/ready/LAUNCH-FIX-003-payment-to-patrongrant-smoke-test.md`
4. `docs/tickets/ready/LAUNCH-FIX-004-video-access-and-token-leak-smoke-test.md`
5. `docs/tickets/ready/LAUNCH-FIX-005-comments-public-read-patron-write-smoke-test.md`
6. `docs/tickets/ready/LAUNCH-FIX-006-admin-cloudflare-upload-import-smoke-test.md`

Blocked owner-decision tickets:

1. `docs/tickets/blocked/LAUNCH-BLOCKED-001-owner-legal-privacy-terms-copy.md`
2. `docs/tickets/blocked/LAUNCH-BLOCKED-002-owner-cloudflare-stream-cost-and-retention-policy.md`

## Recommended next execution order

1. `LAUNCH-FIX-001-vercel-production-env-validation` — production env/deployment must be known before provider-specific smoke tests.
2. `LAUNCH-FIX-002-cloudflare-webhook-production-check` — confirms video provider callbacks reach production.
3. `LAUNCH-FIX-006-admin-cloudflare-upload-import-smoke-test` — proves admin can create/attach launch-ready assets.
4. `LAUNCH-FIX-003-payment-to-patrongrant-smoke-test` — proves payment creates access truth.
5. `LAUNCH-FIX-004-video-access-and-token-leak-smoke-test` — proves allowed/denied playback security after assets and patrons exist.
6. `LAUNCH-FIX-005-comments-public-read-patron-write-smoke-test` — verifies public read / gated write contract in production.
7. Resolve blocked owner tickets before public launch announcement.

## Validation required for this PR

- `git diff --check`
- Confirm no forbidden files changed.
- No runtime validation required.

## Merge recommendation

**MERGE** if the diff is limited to the allowed docs paths and validation passes.
