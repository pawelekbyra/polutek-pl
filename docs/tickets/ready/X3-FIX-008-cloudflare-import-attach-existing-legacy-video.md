# X3-FIX-008 — Cloudflare import and attach existing legacy video

Ticket ID: X3-FIX-008
Status: READY_FOR_BUILDER
Launch status: NO_GO
Lane: video-provider / admin
Type: Runtime admin workflow
Priority: Launch-critical for existing legacy content

## Goal

Allow admins to trigger a Cloudflare Stream import for an existing legacy `Video.videoUrl` and record the returned Cloudflare UID as a non-ready `VideoAsset` so provider status can be synced through the X3-FIX-003 workflow.

## Context

X3-FIX-006 identifies Cloudflare Stream import/link by URL as the preferred migration path for existing legacy content because it minimizes local bandwidth usage and keeps the operator workflow inside Cloudflare. This ticket implements the narrow admin runtime import/attach path for one existing video at a time.

This is not a public playback launch ticket. Importing an asset must not mark the asset `READY`, must not publish the video, and must not create a public playback path.

## Allowed paths

- `lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts`
- `lib/modules/video/infrastructure/cloudflare-stream.client.ts`
- `app/api/admin/videos/[id]/actions/route.ts`
- `app/admin/videos/[id]/page.tsx`
- `tests/unit/modules/video/**`
- `tests/unit/api/**` for admin action route tests if needed
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden paths

- `prisma/schema.prisma`
- `lib/modules/access/**`
- Public playback routes/components
- Homepage/channel/sidebar/hero publication contracts
- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless explicitly amended
- `package.json`
- `package-lock.json`
- Patron/user mutation files owned by X2 work

## Required changes

- Add `importLegacyVideoToCloudflare` use case.
- Accept a `videoId` and fetch the video from the main channel.
- Require a valid existing legacy `videoUrl`.
- Reject if the video already has a Cloudflare Stream asset or any active import/asset that would make the action non-idempotent.
- Call Cloudflare Stream API import/link with `{ url: legacyUrl }` using the existing Cloudflare client pattern.
- Create or upsert a `VideoAsset` with:
  - provider `CLOUDFLARE_STREAM`
  - provider asset UID returned by Cloudflare
  - processing state `PENDING`
  - `isPrimary: false`
  - provider sync/import timestamps as appropriate
  - no fake `READY`
- Add an admin action button on the video detail/media panel: `Importuj do Cloudflare z Legacy URL`.
- Show the action only when a valid legacy `videoUrl` exists and no Cloudflare Stream asset is present.
- Route the action through `app/api/admin/videos/[id]/actions/route.ts` without adding a new public endpoint.
- Preserve existing upload URL, attach UID, and sync status behavior.

## Non-goals

- Do not implement bulk migration.
- Do not implement TUS resume/cancel/retry lifecycle.
- Do not disable legacy private playback fallback in this ticket.
- Do not change public playback behavior.
- Do not mark assets `READY` without provider sync/webhook evidence.
- Do not alter publication/hero/sidebar/channel visibility.
- Do not resolve `npm audit/security`.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- `npm run quality:strict-escapes`
- targeted unit tests for the import use case
- targeted route/UI tests if available
- `npm run typecheck`

If `npm audit/security` remains red, report it as pre-existing/out of scope.

## Definition of done

- Admin can trigger Cloudflare import from a legacy `videoUrl` for one existing video.
- Import creates a non-primary `PENDING` Cloudflare asset and does not fake readiness.
- Repeated import attempts are rejected/idempotent when an asset/import already exists.
- Admin can continue using sync status from X3-FIX-003 after import starts.
- No public playback behavior is changed.
- Public launch remains `NO_GO`.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Do not run in parallel with TUS lifecycle work, public playback/provider contract changes, publication/hero work, or legacy private playback fallback retirement.
