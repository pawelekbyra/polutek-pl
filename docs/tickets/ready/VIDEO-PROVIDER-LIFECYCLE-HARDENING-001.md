# VIDEO-PROVIDER-LIFECYCLE-HARDENING-001 — Cloudflare admin media lifecycle hardening

Status: REPAIR_REQUIRED
Role: Builder
Priority: Launch-critical
Launch status: NO_GO
Type: Runtime implementation + focused tests


## Verification note — PR #986 cleanup attempt

Status: `REPAIR_REQUIRED` (not DONE).

PR #986 implementation was inspected after merge and one accidental build/deploy leftover was removed in the cleanup PR: unused `scripts/vercel-build.js`. `package.json` keeps `vercel-build` as `npm run db:generate && next build`; no documented requirement was found to run migrations inside the Vercel build command.

Validation blockers found during cleanup verification:

- Targeted lifecycle suite including `tests/unit/modules/video/cloudflare-lifecycle.test.ts` failed when run with attach/import lifecycle tests because older attach/import test mocks do not provide `videoAsset.findFirst`, and one missing-legacy-URL assertion now receives `CLOUDFLARE_ASSET_ALREADY_EXISTS` before `LEGACY_VIDEO_URL_REQUIRED`.
- `npm run build` compiles successfully but cannot finish prerendering in this workspace because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not set.

Passing evidence collected in the same cleanup pass:

- `git diff --check` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test -- --run tests/unit/modules/video/cloudflare-lifecycle.test.ts` passed.
- `npm test -- --run tests/unit/video-upload-flow.test.ts` passed.

Do not mark this ticket DONE until the failing targeted attach/import lifecycle tests are repaired or explicitly superseded with equivalent passing coverage. Public launch remains `NO_GO`.

## Product decision

This ticket replaces the old split between `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `X3-FIX-008`, and the stale parts of `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`.

Do not revert to containment-by-disabling as the main strategy. Current main already has a Cloudflare-first create/upload/attach flow, backend `publishAfterAssetReady`, a Cloudflare import use case, webhook/sync asset reconciliation, and PR #985 polish that made backend publish-after-ready the UI source of truth in the create flow.

The right next step is to make the remaining provider lifecycle coherent, observable, idempotent, and truthful in admin details/media UI.

## Current-main evidence to respect

- One-step admin create flow exists and can request publish-after-ready.
- `Video.publishAfterAssetReady*` fields exist and backend webhook/sync can publish through `attemptPublishAfterAssetReady`.
- PR #985 removed the redundant frontend publish-after-ready call and added admin list badges for pending/completed/failed auto-publish states.
- `importLegacyVideoToCloudflare` exists and creates a non-primary `PENDING` Cloudflare asset from legacy `videoUrl`.
- `app/api/admin/videos/[id]/actions/route.ts` already exposes `import-legacy-to-cloudflare`.
- Admin video details/media UI still needs to expose the legacy import action clearly, and the media copy still needs to match the backend-owned publish-after-ready contract.

## Goal

Make admin media lifecycle truthful and production-safe for three source paths:

1. new direct Cloudflare upload,
2. attach existing Cloudflare Stream UID/address,
3. import existing legacy `Video.videoUrl` into Cloudflare Stream.

All three paths must converge on the same provider-backed lifecycle: asset `PENDING/PROCESSING -> READY/FAILED`, optional backend-owned publish-after-ready, safe sync/webhook reconciliation, and clear admin diagnostics.

## Required implementation

### A. Admin media details UI

- Add a clear `Import legacy URL to Cloudflare` action in `app/admin/videos/[id]/page.tsx` or an extracted media panel component.
- Show it only when:
  - video has a valid legacy `videoUrl`,
  - no Cloudflare Stream asset already exists,
  - the video belongs to the main channel/admin scope.
- Route it through existing `POST /api/admin/videos/[id]/actions` with `action: "import-legacy-to-cloudflare"`.
- Show details-page states for:
  - no asset,
  - upload available,
  - legacy import available,
  - asset pending/processing,
  - asset ready primary/non-primary,
  - asset failed,
  - publish-after-ready pending/completed/error.
- Keep the PR #985 list badges; do not reimplement them unless tests require a small adjustment.
- Fix stale media copy. It must not say “admin still clicks Publish” when `publishAfterAssetReady` is set and backend can publish after READY.

### B. Lifecycle semantics

- Direct upload, attach existing UID, and import legacy URL must use consistent VideoAsset semantics:
  - `CLOUDFLARE_STREAM`,
  - provider UID stored once,
  - no fake READY,
  - `isPrimary` only after provider READY evidence from sync/webhook,
  - failure state preserved with admin-readable reason.
- Repeated attach/import/upload-url attempts must be idempotent or safely rejected with stable error codes.
- Late webhook/sync events must be accepted if they match an existing asset and must not create duplicate assets.
- Backend-owned `publishAfterAssetReady` must remain source of truth for automatic publication after provider READY.
- Preserve PR #985 behavior that avoids redundant publish-after-ready audit noise on repeated identical failures.

### C. Upload/import attempt hardening

- Decide whether current code needs a durable upload/import attempt record. If yes, add an explicit schema/migration in this ticket.
- At minimum, record enough metadata/audit to diagnose duplicate attempts, stale uploads, provider UID mismatches, and failed imports.
- Do not store secrets or raw provider response payloads containing sensitive data.

### D. Admin diagnostics

- Expose in AdminVideo DTO/UI where not already present:
  - provider asset UID,
  - processing state,
  - primary flag,
  - last sync time,
  - publish-after-ready status,
  - last publish-after-ready error,
  - recommended admin action.
- Add warning/error badges to details/media/diagnostics tabs when admin action is required.

## Non-goals

- Do not change public playback behavior in this ticket except for safe DTO/diagnostic display in admin.
- Do not implement bulk legacy migration.
- Do not claim production Cloudflare dashboard evidence.
- Do not weaken access or publication guards.
- Do not publish without a primary Cloudflare Stream asset in READY state.
- Do not redo comments polish from PR #984 or video/comments polish from PR #985.

## Allowed paths

- `app/admin/videos/**`
- `app/api/admin/videos/**`
- `lib/modules/video/**`
- `lib/services/playback/**` only for admin-safe diagnostics needed by media lifecycle, not public playback behavior changes
- `prisma/schema.prisma` and `prisma/migrations/**` only if durable attempt state is required
- `tests/unit/**video**`
- `tests/unit/api/**` for admin action route tests
- `docs/reports/reconciliation/**` for implementation report
- `docs/tickets/ready/**` only for ticket status updates

## Forbidden paths

- Public payment/patron code
- Public comments code
- Legal/email docs
- Package/dependency files unless explicitly justified by implementation
- Broad architecture guard changes

## Acceptance criteria

- Admin can upload, attach existing UID/address, or import legacy URL into Cloudflare from coherent media details UI.
- All three paths create or reuse a Cloudflare asset without faking readiness.
- Duplicate or repeated attempts are safe and have stable errors.
- Provider sync/webhook reconciles asset state and can complete publish-after-ready.
- Admin UI truthfully shows pending/completed/failed states in both list and details/media context.
- Focused tests cover upload/attach/import/sync/webhook/publish-after-ready interactions.

## Validation

- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- `npm test -- video-upload-flow`
- targeted unit tests for video import/attach/upload lifecycle
- targeted route tests for admin video actions
- `npx prisma validate` and `npx prisma generate` if schema changes are made
- `npm run build`

## Expected PR report

Include summary, code decisions, changed files, migrations if any, tests run, skipped/out-of-scope items, known risks, and confirmation that public launch remains `NO_GO`.
