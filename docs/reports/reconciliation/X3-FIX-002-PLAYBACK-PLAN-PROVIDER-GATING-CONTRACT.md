# X3-FIX-002 — PlaybackPlan Provider-Gating Contract

## Summary

Implemented a backend PlaybackPlan contract that can represent access-denied plans, non-ready provider assets, ready provider-backed asset metadata, and legacy URL playback without performing Cloudflare/Mux playback resolution.

## Intent

Build on the X3-FIX-001 `VideoAsset` foundation while preserving the invariant that denied and non-playable plans do not call providers, fetch streams/tokens, create playback sessions, count events, or leak raw URLs/tokens.

## Changed files

- `lib/services/playback/playback.dto.ts`
- `lib/services/playback/playback.service.ts`
- `app/api/media-source/[videoId]/route.ts`
- `tests/unit/media-source-safety.test.ts`
- `tests/unit/api/media-source-route.test.ts`
- `docs/reports/reconciliation/X3-FIX-002-PLAYBACK-PLAN-PROVIDER-GATING-CONTRACT.md`

## PlaybackPlan contract changes

- Added explicit `PlaybackPlanStatus` states: `READY`, `LOGIN_REQUIRED`, `PATRON_REQUIRED`, `VIDEO_NOT_READY`, `NO_PRIMARY_ASSET`, `PROCESSING`, `UNAVAILABLE`, and `ERROR`.
- Added safe `PlaybackAssetContract` metadata for provider-backed assets.
- Added diagnostics fields for provider-gating evidence:
  - `providerResolutionAllowed`
  - `providerResolutionAttempted`
  - `sourceMode`
  - safe asset metadata
- Kept legacy source compatibility through the existing `source`, `player`, and `tracking` fields.
- Made `source.playbackUrl` optional so provider-backed READY assets can expose metadata without manufacturing or leaking a raw provider playback URL/token.

## Provider-gating ordering

`PlaybackService.createPlaybackPlanWithContext` now makes the runtime ordering explicit:

1. Load safe video metadata with the current asset relation.
2. Check backend access through the modular access service.
3. If access is denied, return a denied plan with no source, no provider resolution, and no playback session.
4. Only after allowed access, inspect asset processing state.
5. If the primary/current asset is missing, processing, pending, uploading, failed, or otherwise not ready, return a non-playable plan with no source, no provider call, and no session.
6. If the asset is READY and provider-backed (`CLOUDFLARE_STREAM`/`MUX`), expose only safe metadata and mark provider resolution as allowed-but-not-attempted.
7. Legacy URL/object-storage compatibility remains in the legacy path, including existing safe redaction and session creation only for concrete playable legacy/embed plans.

## Denied/not-ready provider-gating evidence

Focused tests prove that:

- Denied patron plans have no source, no playback URL/token, no session, and no provider call.
- Allowed Cloudflare `PROCESSING` assets return a processing plan with no source/session/provider call.
- Allowed Cloudflare `FAILED` assets return an unavailable plan with no source/session/provider call.
- Allowed videos with no primary/current asset return a no-primary plan with no source/session/provider call.
- Allowed READY Cloudflare assets expose only safe provider metadata and do not expose raw object keys, playback URLs, tokens, sessions, or provider-resolution attempts.
- `media-source` denied responses remain HTTP 403 and do not include a source, top-level playback URL, or embed URL.

## What did not change

- Did not implement Cloudflare upload runtime.
- Did not implement Cloudflare signed token generation.
- Did not implement Cloudflare/Mux playback API calls.
- Did not implement provider webhook handling.
- Did not change admin upload/status UI.
- Did not remove `Video.videoUrl`.
- Did not remove legacy R2/S3/Vercel Blob compatibility.
- Did not change payment, patron, comment, or admin-user behavior.
- Did not change schema, migrations, packages, architecture guard, roadmap, strategy docs, README, or AGENTS.

## Legacy compatibility notes

Legacy URL playback is intentionally preserved for existing supported URLs and safe external embeds. The legacy path continues to redact raw storage URLs to `/api/media/:videoId` and creates playback sessions only for concrete playable legacy/embed plans.

READY provider-backed assets currently return a safe placeholder metadata contract rather than a playable provider source. This keeps the future Cloudflare playback seam explicit without adding provider runtime in this ticket.

## Validation commands

- `npm run db:generate` — passed; needed to refresh the generated Prisma client for the already-present X3-FIX-001 `VideoAsset` schema fields before typecheck.
- `git diff --check` — passed.
- `npm run quality:architecture-boundaries` — passed.
- `npm run typecheck` — passed after `npm run db:generate`.
- `npm test -- --run tests/unit/media-source-safety.test.ts tests/unit/api/media-source-route.test.ts tests/unit/modules/media tests/unit/modules/video` — passed.
- `npm test -- --run` — passed.

## Remaining risks

- The frontend player does not yet render a bespoke provider-processing/ready-provider-placeholder state. READY Cloudflare assets therefore remain intentionally non-playable until the future provider-runtime/player ticket.
- The current schema has a single `Video.asset` relation, so “primary/current” is represented by the current related asset and its `isPrimary` flag rather than a multi-asset selection model.

## Next recommended ticket

X3-FIX-003 should implement the Cloudflare Stream playback-resolution seam behind the backend allowed + READY provider-gating contract, including signed playback/token behavior if approved by owner decisions.

## Ticket status

Implemented and ready for review.

## Merge recommendation

MERGE
