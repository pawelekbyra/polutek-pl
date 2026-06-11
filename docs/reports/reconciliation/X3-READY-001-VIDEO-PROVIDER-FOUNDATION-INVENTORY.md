# X3-READY-001 — Video Provider Foundation Inventory

## Status

MERGE recommendation: **MERGE** for this docs-only inventory.

Ticket: `X3-READY-001-video-provider-foundation-inventory` / existing ready ticket `X3-READY-001-video-provider-current-state-inventory.md`.

## Intent

Inventory the current video/provider/playback implementation before X3 runtime work. This report is intentionally docs-only and does not claim target architecture is implemented.

Owner decisions applied:

- Cloudflare Stream is the first video provider.
- Mux may be supported per `VideoAsset` only as a thin optional design.
- R2/S3/Vercel Blob are legacy/migration storage paths, not active safe private patron playback providers without a future architecture decision.
- Denied access must not call a provider, fetch stream/token, mount a real player, count playback/view events, or leak playback URLs/tokens.

## Scope confirmation

Changed files are limited to allowed docs paths:

- `docs/reports/reconciliation/X3-READY-001-VIDEO-PROVIDER-FOUNDATION-INVENTORY.md`
- `docs/tickets/ready/X3-FIX-001-cloudflare-stream-video-asset-foundation.md`
- `docs/tickets/ready/X3-FIX-002-playback-plan-provider-gating-contract.md`
- `docs/tickets/ready/X3-FIX-003-admin-cloudflare-upload-and-asset-status.md`
- `docs/tickets/ready/X3-FIX-004-provider-webhook-asset-state.md`
- `docs/tickets/ready/X3-FIX-005-video-provider-denied-playback-tests.md`
- `docs/tickets/ready/X3-FIX-006-legacy-storage-migration-plan.md`

No runtime files were changed.

## Files inspected

### Runtime/schema read-only inspection

- `prisma/schema.prisma`
- `app/api/media-source/[videoId]/route.ts`
- `app/api/media/[...path]/route.ts`
- `app/api/videos/[id]/playback-event/route.ts`
- `app/api/admin/videos/route.ts`
- `app/api/admin/videos/[id]/route.ts`
- `app/admin/videos/page.tsx`
- `app/admin/videos/[id]/page.tsx`
- `app/admin/videos/components/VideoForm.tsx`
- `app/admin/videos/components/VideoDetailsPanel.tsx`
- `app/components/PremiumWrapper.tsx`
- `app/components/VideoPlayer.tsx`
- `app/types/video.ts`
- `lib/media/video-source.ts`
- `lib/blob.ts`
- `lib/env/validation.ts`
- `lib/data/initial-content.ts`
- `lib/services/playback/playback.dto.ts`
- `lib/services/playback/playback.service.ts`
- `lib/services/storage/storage.service.ts`
- `lib/services/content/video.service.ts`
- `lib/modules/media/**`
- `lib/modules/video/**`
- `lib/modules/access/application/check-video-access.use-case.ts`
- `lib/access/access-policy.ts`

### Tests read-only inspection

- `tests/unit/media-source-safety.test.ts`
- `tests/unit/api/media-source-route.test.ts`
- `tests/unit/api/media-proxy-route.test.ts`
- `tests/unit/api/playback-event-route.test.ts`
- `tests/unit/modules/media/get-gated-media.test.ts`
- `tests/unit/modules/media/media-certification.test.ts`
- `tests/unit/modules/media/media-safety-hardening.test.ts`
- `tests/unit/modules/media.test.ts`
- `tests/unit/modules/video/create-admin-video.use-case.test.ts`
- `tests/unit/modules/video/update-admin-video.use-case.test.ts`
- `tests/unit/modules/video/get-admin-video-details.test.ts`
- `tests/unit/modules/video/record-playback-event.use-case.test.ts`
- `tests/unit/modules/video/video-dto.test.ts`
- `tests/unit/modules/video/video-repository-safety.test.ts`
- `tests/unit/modules/video/video.policy.test.ts`
- `tests/unit/thumbnail-media-source.test.ts`

### Docs read-only inspection

- `docs/specs/VIDEO-PROVIDER-SPEC.md`
- `docs/specs/PLAYBACKPLAN-PLAYER-SPEC.md`
- `docs/specs/ACCESS-PATRON-SPEC.md`
- `docs/specs/OBSERVABILITY-SUPPORT-SPEC.md`
- `docs/architecture/Product-Architecture-Blueprint.md`
- `docs/architecture/Architecture-Decision-Records.md`

## Current implementation summary

The current runtime has a legacy URL-first media model with partial safety hardening:

- `Video.videoUrl` is still the primary playback source field.
- `VideoAsset` exists, but only supports `R2`, `S3`, and `VERCEL_BLOB` storage providers; it has no Cloudflare Stream/Mux provider identity, provider asset IDs, primary flag, or processing state.
- `PlaybackService.createPlaybackPlanWithContext` checks access before creating a source and before signing a `VideoAsset` object.
- Direct media URL leakage is mitigated by redacting raw media URLs to `/api/media/{videoId}` in the playback plan and media-source route.
- The media proxy checks access before fetching the upstream URL, but it is still a legacy Blob/S3/R2-style proxy path.
- There is no Cloudflare Stream provider foundation, no Mux runtime support, no provider webhook route, and no provider upload/runtime state machine.

## Video/provider inventory map

| Component/path | Current behavior | Provider involved | Access dependency | Classification |
| --- | --- | --- | --- | --- |
| `prisma/schema.prisma` — `Video.videoUrl` | Stores the legacy source URL directly on `Video`. Used by playback and admin forms. | Generic URL; YouTube/Vimeo/direct media/R2-like URLs by allowlist. | Access is not represented in schema. Runtime must gate before use. | **LEGACY** |
| `prisma/schema.prisma` — `StorageProvider` | Enum supports only `R2`, `S3`, `VERCEL_BLOB`. | R2/S3/Vercel Blob only. No Cloudflare Stream/Mux. | None in schema. | **LEGACY** |
| `prisma/schema.prisma` — `VideoAsset` | One optional asset per video with provider, object key, bucket, mime type, size. No provider asset ID, state, primary selection, failure reason, playback UID, or webhook fields. | R2/S3/Vercel Blob object storage. | None in schema. | **LEGACY** |
| `lib/services/storage/storage.service.ts` | Creates S3-compatible clients and presigned GET URLs. R2 maps to Cloudflare R2 endpoint, not Cloudflare Stream. | R2/S3. | Called from playback only after allow in current flow. | **LEGACY** |
| `lib/services/playback/playback.service.ts` | Builds playback plan. Calls `checkVideoAccess` first; denied returns no source/session. Allowed path reads `Video.videoUrl`, optionally signs `VideoAsset`, redacts raw URLs to `/api/media/{videoId}`, and creates a playback session. | URL parser; R2/S3 presign via `VideoAsset`; YouTube/Vimeo embeds; direct/HLS/DASH. | Strong local dependency: access check happens before source/signing/session. | **SAFE**, but provider model is **LEGACY** |
| `lib/services/playback/playback.dto.ts` | Playback DTO has `canPlay`, `access`, optional `source`, `player`, `diagnostics`, `tracking`; no explicit target state enum like `READY`, `PROCESSING`, `NO_PRIMARY_ASSET`, etc. | Generic `source.provider` string currently maps to source kind. | DTO can carry denied state without source. | **UNKNOWN** for target compatibility |
| `app/api/media-source/[videoId]/route.ts` | Calls playback service and returns plan. Redacts raw `source.playbackUrl` if service returns one. Returns `403` for denied. Adds legacy top-level `playbackUrl`/`embedUrl`. | Whatever playback service resolves. | Depends on playback service access decision. | **SAFE** for denial/source redaction; **LEGACY** response compatibility |
| `app/api/media/[...path]/route.ts` | Resolves gated media metadata, then calls `getGatedBlobResponse` to stream/proxy the file. | Legacy direct URL/blob/S3/R2-like proxy. | Route delegates to `getGatedMedia` and proxy re-checks access before fetch. | **LEGACY** |
| `lib/modules/media/application/get-gated-media.use-case.ts` | Resolves `Video.videoUrl` and calls access check. Currently returns `{ id, videoUrl }` even when access is denied unless reason is `NOT_FOUND`; the downstream proxy must deny before fetch. | Legacy direct URL. | Access is checked but denied is not final here. | **UNKNOWN** / fragile legacy boundary |
| `lib/blob.ts` — `getGatedBlobResponse` | Performs access check; denies before host validation, private Vercel Blob resolution, or upstream fetch. Allows configured hosts and validates range. | Vercel Blob, external allowed media hosts, S3/R2-like public/private URLs. | Access check happens before provider/upstream call. | **SAFE** for current denial invariant; **LEGACY** provider strategy |
| `lib/media/video-source.ts` | Classifies URL as YouTube, Vimeo, HLS, DASH, direct, unknown; direct files listed as R2/S3/Vercel Blob or allowed hosts. | YouTube/Vimeo/direct/HLS/DASH. | No access logic; expects caller to gate before returning. | **LEGACY** |
| `lib/modules/media/domain/media.policy.ts` | Host allowlist, private host blocking, raw media URL detection, DTO redaction helpers. | Generic media hosts, R2/BLOB envs, YouTube/Vimeo. | No access decision; policy helpers support safe DTO/proxy boundaries. | **SAFE** support code, **LEGACY** host model |
| `lib/env/validation.ts` | Production requires at least one media host allowlist env among media/R2/blob/allowed hosts. | Media bucket/R2/blob/allowed hosts. | None. | **LEGACY** |
| `lib/data/initial-content.ts` | Demo fallback videos use `pub-...r2.dev` direct URLs, including patron-tier sample. | Cloudflare R2 public dev domain. | Demo fallback is gated by playback/access flow, but URL is legacy. | **LEGACY** / launch risk if demo fallbacks active in production |
| `app/components/PremiumWrapper.tsx` | Fetches `/api/media-source/{videoId}`; mounts children only when access/plan succeeds. For unauthenticated non-public content, returns locked state without fetching media-source. | Playback plan endpoint only. | Client consumes backend plan; not source of truth. | **SAFE** for denied player mounting |
| `app/components/VideoPlayer.tsx` | Reads source/tracking from `PlaybackPlan`; mounts Vidstack only after wrapper provides a plan. Sends playback events only when a session ID exists. Supports embeds and direct/HLS/DASH/blob-ish kinds. | Vidstack with URL/embed source from plan. | Depends on wrapper/plan. | **SAFE** for current access boundary; **LEGACY** source kinds |
| `app/admin/videos/components/VideoForm.tsx` | Admin enters raw `videoUrl` and thumbnail URL manually. Preview uses `PremiumWrapper` + `VideoPlayer`. No Cloudflare direct upload/create asset flow. | Raw URL, YouTube/Vimeo/direct allowed hosts. | Preview still goes through playback wrapper. | **LEGACY** |
| `app/api/admin/videos/route.ts` + create/update use-cases | Admin create/update accepts `videoUrl`, validates allowlist, writes `Video` metadata. No upload, provider asset lifecycle, or Cloudflare/Mux abstraction. | Raw URL/direct/YouTube/Vimeo/allowed hosts. | Admin-only route; no playback access concern. | **LEGACY** |
| `lib/modules/video/application/get-admin-video-diagnostics.use-case.ts` | Checks basic metadata, URL allowlist, hero/tier/status logic, duplicate slug. Does not surface provider processing state or Cloudflare health. | Raw URL allowlist. | Admin-only diagnostics. | **LEGACY** |
| `lib/modules/video/application/record-playback-event.use-case.ts` | Validates event type, re-checks access, blocks playback events on denial except `ACCESS_ERROR`, verifies session ownership/fingerprint, sanitizes metadata, counts views after WATCHED_10_SECONDS. | Provider/source only as client-provided metadata fields. | Access checked before event write/view count. | **SAFE** |
| Provider webhook routes | No Cloudflare Stream or Mux webhook handling found. | None. | None. | **UNKNOWN** / missing |
| Upload routes | No video upload/create direct-upload/TUS route found. | None. | None. | **UNKNOWN** / missing |
| Tests: media-source/playback safety | Cover denied playback has no source, raw URL redaction, media-source 403 on denied, proxy route delegation, playback event denial. | Mostly S3/blob/direct URL examples. | Access mocks verify denied boundaries partially. | **SAFE** coverage for current legacy implementation |
| Tests: provider-specific behavior | No Cloudflare/Mux provider foundation tests, no provider webhook tests, no denied-provider-call tests with mocked Cloudflare/Mux clients. | None. | Missing. | **UNKNOWN** / missing |
| `docs/specs/VIDEO-PROVIDER-SPEC.md` | Target says Cloudflare first, Mux optional, provider stored per `VideoAsset`, provider webhooks update processing state, primary READY asset drives playback. | Target Cloudflare/Mux. | Provider call only after access allow. | **DOCS_ONLY** |
| `docs/specs/PLAYBACKPLAN-PLAYER-SPEC.md` | Target says denied plan has no token/source and no stream fetch/provider call; states include READY/LOGIN_REQUIRED/PATRON_REQUIRED/VIDEO_NOT_READY/NO_PRIMARY_ASSET/PROCESSING/UNAVAILABLE/ERROR. | Target provider-neutral plan. | Access is backend-driven. | **DOCS_ONLY** |
| `docs/architecture/Architecture-Decision-Records.md` ADR-0003/0005 | Target confirms Cloudflare Stream first, Mux later per VideoAsset, no active R2/S3/Vercel Blob private fallback, no provider call on denial. | Target Cloudflare/Mux; legacy storage excluded as active private fallback. | Backend access before provider. | **DOCS_ONLY** |

## SAFE / LEGACY / UNSAFE / UNKNOWN classification summary

### SAFE

- Denied `PlaybackService` plan returns no `source` and creates no playback session.
- `/api/media-source/{videoId}` returns `403` for denied plans and redacts raw playback URLs.
- `getGatedBlobResponse` re-checks access before private blob resolution or upstream fetch.
- `PremiumWrapper` separates locked state from the player render tree for denied users.
- `VideoPlayer` requires a playback plan/session before mounting real source playback and sending events.
- Playback event recording re-checks backend access and blocks view counting when access is denied.

### LEGACY

- `Video.videoUrl` is still the primary media source.
- `VideoAsset` is object-storage oriented and does not model Cloudflare Stream or Mux.
- R2/S3/Vercel Blob paths exist in schema, storage service, env allowlists, media proxy, demo content, and source classification.
- Admin video management is raw URL based, not provider upload/asset based.
- Media proxy is a legacy direct file proxy, not a Cloudflare Stream playback provider.

### UNSAFE

No confirmed runtime path was found that obviously fetches provider media, signs a storage object, mounts a real player, or records a view after an explicit access denial. However, the current legacy storage model is **not safe as the launch private patron playback architecture** under the owner decision because R2/S3/Vercel Blob must not be treated as active safe private playback fallback without explicit architecture approval.

### UNKNOWN

- `getGatedMedia` returns `videoUrl` to the downstream proxy even for denied access; the proxy currently re-checks and denies before fetch, but this split boundary is fragile and should not become the X3 provider contract.
- There is no asset processing state model, so `READY`/`PROCESSING`/`FAILED` behavior cannot be validated.
- There is no Cloudflare/Mux client, so provider-call-before-access tests cannot yet mock the real provider boundary.
- There is no provider webhook implementation.
- There is no direct upload/TUS implementation.

### DOCS_ONLY

- Video Provider Spec, PlaybackPlan/Player Spec, Access/Patron Spec, Product Architecture Blueprint, and ADRs define target behavior but are not runtime evidence.

## Launch-critical X3 gaps

1. **Missing Cloudflare Stream provider foundation**
   - No `CLOUDFLARE_STREAM` provider enum/value.
   - No Cloudflare Stream asset ID, playback UID, signed token/key policy, upload URL, or provider client abstraction.

2. **`VideoAsset` is not target-ready**
   - Missing provider asset ID fields.
   - Missing primary/active asset selection.
   - Missing asset lifecycle state (`UPLOADING`, `PROCESSING`, `READY`, `FAILED`, etc.).
   - Missing provider diagnostics/failure reason/webhook timestamp fields.

3. **Legacy direct playback URL remains central**
   - `Video.videoUrl` drives admin create/update, playback planning, media proxy, and demo content.
   - Raw URL redaction exists, but launch target should be provider asset driven for patron playback.

4. **No signed/private Cloudflare playback plan**
   - Playback plan has generic `playbackUrl`, but no Cloudflare Stream token/private playback contract.
   - Current source provider string maps to source kind (`hls`, `direct`, `youtube`) rather than actual provider (`cloudflare_stream`, `mux`, etc.).

5. **No provider webhook handling**
   - No route/use-case to process Cloudflare Stream ready/error events.
   - No idempotency/audit around provider events.

6. **No admin provider upload path**
   - Admin manages raw `videoUrl`; no direct upload/TUS/create-upload flow.
   - No provider status/processing UI except general URL diagnostics.

7. **No READY/PROCESSING/FAILED asset state handling**
   - Playback cannot distinguish `NO_PRIMARY_ASSET`, `PROCESSING`, `VIDEO_NOT_READY`, `UNAVAILABLE`, or provider `ERROR` in target terms.

8. **Legacy blob/S3/R2 assumptions remain**
   - R2/S3/Vercel Blob still appear as schema providers and as private media proxy strategy.
   - These should be migration/legacy only unless an explicit owner architecture decision changes that.

9. **Denied provider-call tests are incomplete for X3**
   - Existing tests cover no source on denied and raw URL redaction.
   - Missing tests that assert Cloudflare/Mux clients are not called when access is denied, when no primary READY asset exists, or when asset state is processing/failed.

## Proposed X3 backlog

| Ticket | Priority | Goal | Merge shape |
| --- | --- | --- | --- |
| `X3-FIX-001-cloudflare-stream-video-asset-foundation` | Launch-critical | Extend the asset model and domain DTOs for Cloudflare-first provider state without building a heavy framework. | Schema + repository/domain tests, serial-only. |
| `X3-FIX-002-playback-plan-provider-gating-contract` | Launch-critical | Refactor playback planning so provider source/token resolution happens only after backend allow and primary READY asset selection. | Playback service/use-case + tests. |
| `X3-FIX-003-admin-cloudflare-upload-and-asset-status` | Launch-critical | Add admin create-upload/attach/status flow for Cloudflare Stream and show asset/provider status. | Admin API/UI for upload/status, no playback behavior change beyond asset visibility. |
| `X3-FIX-004-provider-webhook-asset-state` | Launch-critical | Handle Cloudflare Stream provider webhooks idempotently and update asset processing state. | Webhook route/use-case + tests. |
| `X3-FIX-005-video-provider-denied-playback-tests` | Launch-critical | Add negative tests proving denied playback never calls provider clients, fetches stream/token, mounts source, or counts views. | Test-only or narrowly-scoped test support. |
| `X3-FIX-006-legacy-storage-migration-plan` | Should-have before launch if legacy content exists | Document/admin inventory and migration plan for existing `videoUrl`/R2/S3/Blob assets to Cloudflare Stream. | Docs + read-only/admin report; runtime migration later. |
| `X3-FIX-007-mux-optional-design-compatibility` | Post-launch | Keep Mux compatible per `VideoAsset` without implementing a heavy provider framework. | Design/doc or tiny interface only after Cloudflare path is stable. |
| `X3-FIX-008-captions-and-text-tracks-foundation` | Should-have | Prepare captions/subtitle fields/asset association if launch requires accessibility/subtitles. | Small schema/domain ticket if owner confirms scope. |

Ready tickets created in this PR: `X3-FIX-001` through `X3-FIX-006`.

## Owner questions

1. Should launch migrate all patron-gated videos to Cloudflare Stream before public launch, or may public/free direct embeds remain as legacy while patron-gated playback is Cloudflare-only?
2. Should YouTube/Vimeo embeds remain allowed for public/free videos after X3, or should the admin cockpit nudge all catalog videos toward Cloudflare Stream?
3. Should Cloudflare signed playback be required for all non-public videos at launch, or for every Cloudflare asset regardless of tier?
4. Should `Video.videoUrl` become admin-only legacy/migration metadata immediately after Cloudflare foundation, or remain as a public-video fallback for a transition period?
5. Does launch require captions/subtitles as part of X3, or can they be a separate should-have ticket after provider foundation?
6. Should R2/S3/Vercel Blob support be actively blocked for `PATRON` tier playback during X3, or only documented as legacy until the migration ticket runs?

## What did not change

- No runtime behavior changed.
- No app, lib, component, Prisma, package, README, AGENTS, architecture guard, or roadmap files were edited.
- No Cloudflare Stream runtime was implemented.
- No upload/playback/provider route was implemented.
- No X2-FIX-003 patron/user mutation files were touched.
- No tests were added or modified; this was a docs-only inventory.

## Validation results

- `git diff --check` — passed.
- `npm run quality:architecture-boundaries` — passed.
- Runtime tests were not required for this docs-only ticket and were not run.

## Risks

- The report is a point-in-time inventory of current main. Any parallel merge touching video/playback/provider files should re-run this inventory or reconcile deltas.
- Existing tests prove important legacy safety properties but do not prove future Cloudflare/Mux provider boundaries.
- The current schema may require a serial migration ticket before provider runtime work can proceed.

## Ticket status

`X3-READY-001`: **DONE** as docs-only inventory.
