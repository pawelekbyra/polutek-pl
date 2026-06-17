# ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001 — Repair Cloudflare-first admin video creation and publishing

Status: PARTIAL_IMPLEMENTATION_MERGED_IN_PR_926 / PROVIDER_RUNTIME_NOT_VERIFIED / CORRECTIVE_WORK_REQUIRED / POSTMERGE_VERIFICATION_MISSING / HISTORICAL_UMBRELLA_SPEC
Ticket ID: ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001
Role: Builder / Historical umbrella specification
Priority: URGENT
Launch status: NO_GO

## Current-state reconciliation

This ticket is no longer described as planned future work. PR #926 merged a partial Cloudflare-first admin video flow, but provider runtime behavior was not verified and corrective work is required. The detailed requirements below are preserved as historical umbrella specification evidence and must not be weakened. Current bounded follow-up work is split into `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`, `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`, `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`, `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`, and `ADMIN-VIDEO-POSTMERGE-VERIFY-001` after `CI-SIGNAL-RESTORATION-001`.

## Tracked findings

`VIDEO-CF-001` through `VIDEO-CF-012`, `VIDEO-PUBLISH-001`, `VIDEO-HERO-001`, `VIDEO-STATE-001`, `VIDEO-ADMIN-001` through `VIDEO-ADMIN-005`, `VIDEO-PLAYBACK-001`, `VIDEO-PLAYBACK-002`, and `VIDEO-VERIFY-001` are tracked in `docs/reports/reconciliation/POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`.

## Historical umbrella specification

## Purpose

Repair the complete administrator workflow for creating a new video, uploading it directly from the browser to Cloudflare Stream, observing processing state, validating publication readiness and publishing it safely.

The final supported primary workflow must be:

```txt
admin clicks New Film
→ enters metadata
→ saves a safe DRAFT
→ selects a local video file
→ uploads directly and resumably to Cloudflare Stream
→ sees real upload progress
→ sees PENDING / UPLOADING / PROCESSING / READY / FAILED
→ fixes any validation problems
→ explicitly publishes only after the source is ready
→ public or patron playback uses the verified primary Cloudflare asset
```

The administrator must not need to invent or provide a legacy `videoUrl` to create a new Cloudflare-backed film.

Legacy URL import must remain available only as an explicitly labelled migration workflow.

## Confirmed defects that must be repaired

Current-main defects to verify before modifying code:

```txt
new video creation requires videoUrl even though it is marked Legacy / Migracja
Video.videoUrl is currently a non-null legacy schema field
new records default to PUBLISHED
new records default to showInSidebar=true
the create form is not a native form and required fields do not reliably block submission
client diagnostics display errors but do not block saving
the create backend validates only the video source URL
create/update persistence spreads broad request data into Prisma
server-controlled fields are not strictly allowlisted
the create path does not enforce Hero invariants
the create path does not clear other Hero records
Cloudflare direct upload is available only after a video record exists
the UI opens the one-time upload URL in a new tab instead of uploading the selected file
there is no file picker or drag-and-drop upload
there is no upload progress, pause, retry, cancel or resume UX
the generated direct-upload asset is stored with isPrimary=false
the Cloudflare webhook does not promote a READY asset to isPrimary=true
READY playback rejects a non-primary asset
attach-asset reads request JSON twice
manual UID attachment defaults to READY without validating the real provider state
publishing can occur before Cloudflare reaches READY
sourceKind and needsAttention filters are exposed but not correctly enforced by repository filtering
the fetch callback omits migrationStatusFilter from its dependency list
```

The Builder must verify all of these against then-current `main` before modifying code.

## Required discovery

Inspect at minimum:

```txt
app/admin/videos/page.tsx
app/admin/videos/components/VideoForm.tsx
app/admin/videos/components/VideoFilters.tsx
app/admin/videos/components/VideoTableWrapper.tsx
app/admin/videos/[id]/page.tsx

app/api/admin/videos/route.ts
app/api/admin/videos/[id]/route.ts
app/api/admin/videos/[id]/actions/route.ts
app/api/webhooks/cloudflare-stream/route.ts

lib/modules/video/application/create-admin-video.use-case.ts
lib/modules/video/application/update-admin-video.use-case.ts
lib/modules/video/application/get-cloudflare-upload-url.use-case.ts
lib/modules/video/application/attach-cloudflare-asset.use-case.ts
lib/modules/video/application/import-legacy-video-to-cloudflare.use-case.ts
lib/modules/video/application/handle-cloudflare-webhook.use-case.ts
lib/modules/video/application/get-admin-video-diagnostics.use-case.ts
lib/modules/video/infrastructure/video.repository.ts
lib/modules/video/infrastructure/cloudflare-stream.client.ts
lib/modules/video/domain/video.dto.ts
lib/modules/video/domain/video.policy.ts
lib/modules/media/domain/media.policy.ts
lib/services/playback/playback.service.ts
lib/services/playback/legacy-private-fallback.policy.ts

prisma/schema.prisma
prisma/migrations/**
package.json
package-lock.json

all focused video, media, upload, playback and Cloudflare tests
```

Also search for every write to:

```txt
Video.videoUrl
Video.thumbnailUrl
Video.status
Video.publishedAt
Video.isMainFeatured
VideoAsset.isPrimary
VideoAsset.processingState
VideoAsset.providerAssetId
VideoAsset.providerPlaybackId
```

## Required product workflow

### A. Safe creation

A newly created video must default to:

```txt
status: DRAFT
showInSidebar: false
isMainFeatured: false
publishedAt: null
```

Creating a draft must not require:

```txt
legacy videoUrl
Cloudflare UID
completed upload
published thumbnail
manual statistics
```

Required draft fields:

```txt
title
slug
tier
```

A supplied title, slug, URL or thumbnail must be normalized and validated. The server must use an explicit allowlist DTO/schema and must not pass an untrusted request object directly into Prisma with broad object spreading.

The create endpoint must ignore or reject attempts to set server-controlled fields such as:

```txt
id
creatorId
createdAt
updatedAt
publishedAt
views
likesCount
dislikesCount
asset
playbackSessions
audit relations
```

Statistics must not be part of normal new-video creation.

### B. Schema authorization

A focused schema and migration change is authorized.

The Builder may make legacy `Video.videoUrl` optional or otherwise introduce a repository-compatible representation that permits a Cloudflare-first draft without a legacy URL.

The solution must:

```txt
preserve all existing legacy records
preserve legacy YouTube/Vimeo/import support
not break public DTO safety
not expose raw patron media URLs
not replace VideoAsset as the primary provider-backed source
```

`thumbnailUrl` may remain a non-null database field with an empty draft value if that is safer for compatibility, but publication must require an approved usable thumbnail.

Do not perform an unrelated video schema redesign.

### C. Real browser upload

The admin UI must include:

```txt
video file picker
drag-and-drop area
selected filename and size
upload progress percentage
bytes uploaded / total
cancel action
retry action
resumable upload support
clear success and failure states
processing-state display
```

The browser must upload directly to Cloudflare Stream without exposing:

```txt
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
webhook secret
signed playback tokens
```

Use Cloudflare-supported direct creator uploads. The implementation must support large and unreliable uploads through the tus protocol. Using a maintained tus upload client is authorized. If the repository does not already contain an appropriate client, adding exactly one maintained tus/Uppy upload dependency and corresponding lockfile changes is authorized.

Do not add a custom upload protocol. Do not proxy the complete video file through the Next.js application server.

### D. Upload provisioning

Create a dedicated admin-authorized backend boundary for provisioning the upload.

It must:

```txt
verify admin access
verify video belongs to the main channel
accept the selected file size
accept only minimal safe metadata
request the Cloudflare tus/direct upload location
retain the provider UID
create or update the VideoAsset as CLOUDFLARE_STREAM
set a truthful initial processing state
record an audit event
return only the minimum data required by the upload client
```

Do not return provider API credentials. Do not log upload URLs, secrets or full provider responses.

Only one active Cloudflare upload may exist for a video. A retry may replace a FAILED or clearly abandoned incomplete upload, but it must not silently replace a READY asset.

### E. Asset lifecycle

Required lifecycle:

```txt
PENDING
→ UPLOADING
→ PROCESSING
→ READY

or

PENDING / UPLOADING / PROCESSING
→ FAILED
```

When Cloudflare confirms `READY`, the application must atomically:

```txt
set processingState=READY
set providerPlaybackId when available
set isPrimary=true
clear stale failureReason
set providerSyncedAt
set processingEndedAt
record an audit event
```

When Cloudflare confirms failure:

```txt
set processingState=FAILED
set isPrimary=false
store a privacy-safe failure reason
set processingEndedAt
```

A READY primary asset must not be downgraded by stale or reordered provider events.

### F. Status synchronization fallback

Do not rely exclusively on a webhook for administrator UX.

Use the existing provider-details capability or a focused equivalent to provide:

```txt
manual Refresh Cloudflare Status action
safe background polling while state is PENDING / UPLOADING / PROCESSING
automatic UI refresh after upload
clear stale/pending messaging
```

Polling must stop on:

```txt
READY
FAILED
component unmount
timeout
```

Do not poll indefinitely.

### G. Manual UID attachment

Repair manual Cloudflare UID attachment. The route must parse the JSON body exactly once.

Before attachment:

```txt
validate UID shape
query Cloudflare for the actual asset
reject unknown or inaccessible UID
derive the real processing state
derive playback identity safely
do not default blindly to READY
do not set isPrimary=true unless the provider asset is actually READY
```

Return stable, non-sensitive errors. Do not expose provider response bodies.

### H. Legacy migration

Keep:

```txt
Importuj do Cloudflare z legacy URL
```

as an explicitly labelled migration-only action.

It must:

```txt
preserve legacy videoUrl for audit/migration traceability
prevent duplicate imports
use truthful processing states
never mark an unfinished import READY
not replace a READY Cloudflare asset
```

Legacy URL entry must be moved out of the primary new-video workflow into an advanced or migration section.

### I. Real server-side publication gate

Publishing must use a dedicated server-side policy/use case. Do not allow generic update payloads to set `status=PUBLISHED` without validation.

Publication requires:

```txt
non-empty validated title
unique validated slug
approved thumbnail
a playable source
no ERROR diagnostics
```

For Cloudflare-backed video:

```txt
provider=CLOUDFLARE_STREAM
processingState=READY
isPrimary=true
providerAssetId or providerPlaybackId present
```

For `PATRON` video:

```txt
READY primary provider-backed playback is mandatory
legacy fallback is forbidden
```

For public or logged-in external video:

```txt
only explicitly supported and allowlisted YouTube/Vimeo or approved legacy source is permitted
the source mode must be clearly marked as external/legacy
```

Publishing must never happen automatically after draft creation or after upload completion. The administrator must explicitly press Publish.

### J. `publishedAt` correctness

Required transition behavior:

```txt
DRAFT/UNLISTED → PUBLISHED:
set publishedAt once for the transition

PUBLISHED metadata edit:
preserve existing publishedAt

PUBLISHED → DRAFT/UNLISTED/ARCHIVED:
apply one documented consistent policy

republish:
apply one documented consistent policy
```

Do not reset `publishedAt` on every ordinary edit of an already-published film.

### K. Hero invariants

Create and update paths must enforce the same rules:

```txt
Hero must be PUBLIC
Hero must be PUBLISHED
Hero must have a playable source
only one current main-channel Hero may exist
```

Setting a new Hero must clear the previous Hero in the same transaction. A draft must not become Hero through the create payload.

### L. Admin form correctness

Use a real semantic `<form>`.

Required behavior:

```txt
Enter/submit works predictably
client validation blocks obvious errors
server validation remains authoritative
field-level errors are displayed
generic connection errors remain separate
double submit is prevented
cancel during active upload requires confirmation
unsaved changes require confirmation
```

After creating a new draft, route the administrator directly to its media/upload workflow. The administrator must not need to search the list for the record that was just created.

### M. Source-mode UX

Show explicit source modes:

```txt
1. Upload file to Cloudflare Stream — recommended/default
2. Attach existing Cloudflare UID — advanced
3. Import legacy URL to Cloudflare — migration
4. External YouTube/Vimeo source — legacy/external
```

Do not present a legacy URL as the required primary field for a new film. Do not claim a film is ready merely because a URL or UID was entered.

### N. Admin filters

No visible filter may be inert.

For:

```txt
sourceKind
needsAttention
migrationStatus
```

either implement correct server-side filtering with correct pagination and counts or remove the unsupported control from the UI.

Prefer a simplified truthful source filter:

```txt
Cloudflare
External / Legacy
Missing source
```

Fix stale callback dependencies, including `migrationStatusFilter`.

### O. Error and audit behavior

Required audit events include at least:

```txt
VIDEO_CREATED_AS_DRAFT
VIDEO_UPLOAD_PROVISIONED
VIDEO_UPLOAD_RETRIED
VIDEO_ASSET_STATUS_UPDATED
VIDEO_ASSET_ATTACHED
VIDEO_PUBLISHED
VIDEO_PUBLICATION_REJECTED
```

Audit metadata must be privacy-safe and must not contain:

```txt
Cloudflare API token
upload URL
signed playback token
full provider response
local file path
```

### P. Replacement and retry safety

The administrator must have a safe way to retry after:

```txt
upload cancelled
upload network failure
Cloudflare processing failure
stale pending upload
```

A retry must not:

```txt
create multiple active primary assets
overwrite a READY asset without explicit confirmation
publish the video automatically
delete the legacy migration source unexpectedly
```

A full asset-replacement workflow for already-published READY videos may remain outside this ticket, but the UI must clearly block or explain it rather than silently replacing production media.

## Required tests

Add or update focused tests for at least:

```txt
new video defaults to DRAFT
new video defaults to showInSidebar=false
new draft can be created without videoUrl
create payload is allowlisted
server-controlled statistics cannot be injected
invalid title is rejected
invalid slug is rejected
duplicate slug returns stable conflict
invalid thumbnail is rejected for publication
create path cannot create invalid Hero
only one Hero remains after setting another

upload provisioning requires admin
upload provisioning is scoped to main channel
upload provisioning stores provider UID safely
provider credentials are never returned
duplicate active upload is rejected
failed/stale upload can be retried safely
READY asset cannot be silently replaced

browser upload uses tus/direct provider upload
progress state updates
cancel and retry work
upload errors are shown
successful upload enters processing state

Cloudflare READY webhook promotes asset to primary
Cloudflare FAILED webhook keeps asset non-primary
stale webhook cannot downgrade READY
status refresh maps provider state correctly
polling stops on terminal state

attach UID parses request body once
unknown UID is rejected
non-ready UID is not marked READY
READY verified UID becomes primary

publish without source is rejected
publish with processing asset is rejected
publish with failed asset is rejected
Patron publish without READY provider asset is rejected
valid READY Cloudflare video can be published
legacy external public video can be published only when allowlisted
publishedAt is not reset by normal metadata edit

visible filters are either correct or absent
legacy import still works
PatronGrant and payment logic are untouched
public DTO never exposes raw private media fields
```

## Required integration evidence

If schema changes are made, add PostgreSQL integration evidence for:

```txt
migration applies successfully
existing legacy rows remain valid
new Cloudflare-first draft without videoUrl can be inserted
READY asset lifecycle persists correctly
single-asset uniqueness remains enforced
transaction rollback preserves consistency
```

## Required end-to-end acceptance scenario

Provide an automated or independently reproducible mocked-provider scenario proving:

```txt
admin opens New Film
admin creates draft without legacy URL
application returns the new video ID
admin selects a local file
application provisions a Cloudflare tus upload
upload progresses to completion
provider webhook or status sync marks asset READY
asset becomes primary
administrator explicitly publishes
video appears in the correct public/sidebar scope
playback plan resolves the Cloudflare source
no raw private URL or provider secret is exposed
```

Also prove the negative scenario:

```txt
admin creates draft
upload is incomplete or fails
publish is rejected
video remains non-public
sidebar does not expose it
```

## Minimum validation commands for the future implementation PR

Record these in the ticket:

```bash
npx vitest run tests/unit/modules/video/create-admin-video.use-case.test.ts
npx vitest run tests/unit/modules/video/attach-cloudflare-asset.use-case.test.ts
npx vitest run tests/unit/modules/video/import-legacy-video-to-cloudflare.use-case.test.ts
npx vitest run tests/unit/modules/video
npx vitest run tests/unit/modules/media
npx vitest run tests/unit/media-source-safety.test.ts
npx vitest run tests/integration/launch-candidate-critical-path.test.ts

node scripts/check-control-plane-docs.mjs
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
npm run build
git diff --check
```

The Builder must add more focused route/UI/upload tests rather than relying only on the existing files above.

Known unrelated baselines remain:

```txt
quality:strict-escapes
npm audit high
```

## Allowed future implementation scope

The future Builder PR may modify:

```txt
admin video UI
admin video API routes
video application/domain/infrastructure modules
Cloudflare Stream client
Cloudflare webhook handling
playback readiness policy
focused video/media tests
prisma schema and one focused migration
package.json and package-lock.json only for one justified upload client dependency
```

## Forbidden future implementation scope

Do not modify:

```txt
payments
Stripe
PatronGrant semantics
email tickets
subscriptions
Clerk authentication policy
legal copy
public launch status
Cloudflare production credentials
unrelated admin modules
```

Do not weaken:

```txt
admin authorization
private playback access checks
raw URL redaction
signed playback behavior
Cloudflare webhook authentication
```

## Completion contract

The future implementation PR must end with:

```txt
implementation complete
verification pending
public launch NO_GO
```

It must require an independent post-merge verification ticket covering:

```txt
real creation flow
real upload lifecycle
publication gate
public playback
patron playback
legacy compatibility
security and secret exposure
```
