# LANE-playback-player

## 0. Purpose

This lane owns PlaybackPlan consumption and player rendering behavior.

It exists to make sure that:

```txt
player does not invent access
player receives PlaybackPlan
locked state does not mount a real player
denied PlaybackPlan has no playback source
denied PlaybackPlan has no token
provider/source is not requested for denied access
tracking runs only for real playback
UI clearly explains locked states
```

Core invariant:

```txt
Locked video is not a video with an overlay.
Locked video is a different render state.
```

---

## 1. Lane identity

Lane ID:

```txt
playback-player
```

Primary phase:

```txt
X4 — PlaybackPlan / Player Simplification
```

Depends on:

```txt
X2 — Access / Patron Hard Reset, at least access decision contract
X3 — Video Provider Foundation, at least playback source contract
```

Supports later phases:

```txt
X5 — Admin Cockpit Foundation
X6 — Product Excellence
```

Primary owner roles:

```txt
Builder
Reviewer
Certifier
```

Planner/Integrator may update this file during roadmap reconciliation.

Parallel safety:

```txt
CAUTION / SERIAL around PlaybackPlan contract
```

Reason:

```txt
Player behavior touches access security, provider source requests, analytics, UX, comments context, admin preview, and performance.
```

Default rule:

```txt
Do not run playback-player runtime work in parallel with Access or VideoProvider contract changes unless the PlaybackPlan contract is frozen.
```

---

## 2. Product and security rules

### 2.1 Player does not decide access

Player receives a backend decision.

Correct:

```txt
backend -> PlaybackPlan -> UI render state
```

Forbidden:

```txt
player checks Clerk metadata to unlock
player checks User.isPatron to unlock
player checks Subscription to unlock
player guesses access from UI props
player constructs provider URL itself
player fetches media source before access decision
```

### 2.2 Locked state replaces player

Correct:

```txt
allowed PlaybackPlan -> mount player
denied PlaybackPlan -> render locked placeholder
```

Forbidden:

```txt
mount real player under overlay
hide real video with CSS
load provider SDK for denied content
request playback token for denied content
request media-source for denied content
count locked render as playback
```

### 2.3 Denied PlaybackPlan has no source

For denied states:

```txt
allowed: false
playbackUrl: null
playbackToken: null
providerSource: null
```

Denied states may include:

```txt
LOGIN_REQUIRED
PATRON_REQUIRED
VIDEO_NOT_READY
NO_PRIMARY_ASSET
PROCESSING
UNAVAILABLE
ERROR
```

### 2.4 Tracking only for real playback

Playback tracking must not run for locked placeholders.

Forbidden:

```txt
view counted because component mounted
playback event emitted for locked state
heartbeat emitted without real playback
admin preview counted as normal view unless explicitly allowed
```

Tracking should represent real playback facts.

---

## 3. Target PlaybackPlan

The exact shape may differ by implementation, but the concept should include:

```txt
videoId
tier
allowed
reason
cta
title
description
canComment
commentPermissionReason
streamProvider
playbackUrl
playbackToken
expiresAt
assetStatus
debugInfoForAdmin
```

Rules:

```txt
playbackUrl exists only if allowed=true
playbackToken exists only if allowed=true
provider source exists only if allowed=true
```

Example allowed plan:

```txt
READY:
  allowed: true
  reason: null
  playbackUrl: present
  playbackToken: present or not required by provider
```

Example denied plan:

```txt
PATRON_REQUIRED:
  allowed: false
  reason: PATRON_REQUIRED
  playbackUrl: null
  playbackToken: null
  cta: "Wesprzyj twórcę i zostań patronem"
```

---

## 4. Render states

Player area should render one of these states.

### READY

```txt
allowed=true
real player mounted
playback source available
tracking can start only after real playback starts
```

### LOGIN_REQUIRED

```txt
allowed=false
no player
no source/token
show login CTA
do not request media
```

### PATRON_REQUIRED

```txt
allowed=false
no player
no source/token
show patron CTA
do not request media
```

### VIDEO_NOT_READY / PROCESSING

```txt
allowed=false or unavailable
no player unless safe preview explicitly exists
show processing / not-ready state
do not request playback source
```

### NO_PRIMARY_ASSET

```txt
allowed=false or unavailable
no player
show unavailable/admin-debug state
```

### UNAVAILABLE / ERROR

```txt
no unsafe source retry loop
show error or retry state
do not bypass access
```

---

## 5. Owned paths

This lane may own or edit these paths when the ticket explicitly allows them.

### Player UI

```txt
components/player/**
components/video/**
app/**/video/**
app/videos/**
```

Use actual current paths from repo.

### Playback modules

```txt
lib/modules/playback/**
lib/modules/media/**
lib/modules/video/**
lib/modules/access/**
```

Only when ticket explicitly involves PlaybackPlan or player integration.

### Playback routes

```txt
app/api/media-source/**
app/api/media/**
app/api/videos/**
```

Only when ticket explicitly involves PlaybackPlan/source integration.

### Tracking / analytics

```txt
lib/modules/analytics/**
lib/modules/playback/**
app/api/videos/[id]/playback-event/**
```

Only when ticket explicitly involves tracking.

### Tests

```txt
tests/unit/modules/playback/**
tests/unit/modules/media/**
tests/unit/modules/access/**
tests/unit/*player*.test.ts
tests/unit/*playback*.test.ts
tests/unit/*media-source*.test.ts
tests/unit/*video*.test.ts
```

### Reports and docs

```txt
docs/reports/reconciliation/**
docs/reports/certification/**
```

Only if ticket explicitly allows docs/report updates.

---

## 6. Forbidden by default

Builder agents in this lane must not edit:

```txt
README.md
AGENTS.md
docs/roadmap/Active-Execution-Roadmap.md
docs/roadmap/Parallel-Work-Matrix.md
docs/roadmap/Phase-Gates.md
docs/architecture/Product-Architecture-Blueprint.md
package.json
package-lock.json
```

Builder agents must not edit Prisma schema unless ticket is schema-locked:

```txt
prisma/schema.prisma
prisma/migrations/**
```

Forbidden product/architecture changes unless explicit:

```txt
changing patron/payment lifecycle
changing Access source of truth
changing Subscription meaning
changing comments visibility
changing provider architecture
introducing active R2/S3 fallback playback
generating token for denied access
mounting player for locked state
using overlay as security
```

---

## 7. Parallel safety

Default mode:

```txt
CAUTION / SERIAL
```

### Conflicts with

This lane conflicts with:

```txt
access lane when access decision/PlaybackPlan shape changes
video-provider lane when provider source contract changes
cleanup-legacy lane when media-source/media routes are being cleaned
admin-cockpit lane when admin preview/debug behavior changes
comments lane when canComment/commentPermissionReason changes
Prisma schema tasks involving Video/VideoAsset/playback events
guard tasks
global docs tasks
```

### Can run with

This lane may run in parallel with:

```txt
email-subscriptions work
payments-patron work unrelated to access/player
comments docs-only work
admin static UI work not consuming PlaybackPlan
video-provider docs-only inventory
cleanup-legacy inventory-only reports
```

only if paths do not overlap.

### Serial-only examples

```txt
Access changes getVideoPlaybackPlan shape
+
Player consumes PlaybackPlan
```

Verdict:

```txt
SERIAL unless contract already landed
```

```txt
VideoProvider changes playback source DTO
+
Player updates provider source rendering
```

Verdict:

```txt
SERIAL unless provider DTO is frozen
```

```txt
Tracking semantics change
+
Player render state change
```

Verdict:

```txt
SERIAL or carefully sequenced
```

---

## 8. Work sequence

This lane must run in order.

Do not start with visual polish.

Do not mount player for locked states.

Do not change provider behavior before Access/Provider contracts are stable.

### PL-0 — Current playback/player inventory

Goal:

```txt
Understand current player, media-source, playback event, locked UI, access, and provider-source behavior.
```

Inventory must answer:

```txt
Where is player mounted?
Where is media source requested?
Where is access checked before player/source?
Where are locked states rendered?
Is a real player mounted under overlay?
Where are playback events emitted?
Are locked states counted as playback?
Where is provider source/token created?
What tests already exist?
What current UI states exist?
```

Output:

```txt
docs/reports/reconciliation/PL-0-current-playback-player-inventory.md
follow-up tickets
```

### PL-1 — PlaybackPlan contract

Goal:

```txt
Define or adopt a stable PlaybackPlan shape.
```

Required decisions:

```txt
allowed flag
reason enum
source/token fields
asset status
comment permission fields
CTA/copy fields
admin debug fields
provider/source fields
error handling
```

Forbidden:

```txt
visual player rewrite
provider implementation
access policy rewrite
```

### PL-2 — Denied plan safety tests

Goal:

```txt
Prove denied plans contain no source/token and do not request provider/media source.
```

Required tests:

```txt
LOGIN_REQUIRED has no source/token
PATRON_REQUIRED has no source/token
PROCESSING has no source/token
NO_PRIMARY_ASSET has no source/token
provider createPlaybackSource not called for denied access
media-source not requested by locked UI
```

### PL-3 — Locked placeholders replace player

Goal:

```txt
Render locked placeholders instead of mounting real player.
```

Required behavior:

```txt
allowed=true -> player component mounted
allowed=false -> placeholder component mounted
locked placeholder does not include real video element/source
locked placeholder does not load provider SDK
locked placeholder has correct CTA
```

### PL-4 — Player consumes PlaybackPlan

Goal:

```txt
Make player area render from PlaybackPlan, not local access guesses.
```

Forbidden:

```txt
player checks Clerk metadata
player checks User.isPatron
player checks Subscription as access
player constructs provider URL
```

### PL-5 — Tracking separation

Goal:

```txt
Ensure playback events represent real playback only.
```

Required behavior:

```txt
no play event for locked placeholder
no heartbeat for locked placeholder
no counted view just because player area mounted
admin preview behavior explicit
tracking hook/service separated from UI rendering
```

### PL-6 — Admin/debug handoff

Goal:

```txt
Expose safe debug information for admin without leaking private source.
```

May include:

```txt
access reason
asset status
provider
source created yes/no
token issued yes/no
last playback error
admin-only diagnostics
```

Forbidden:

```txt
raw private URLs in public UI
token leak
provider secret leak
```

### PL-7 — UX polish after safety

Goal:

```txt
Improve locked state copy, responsive layout, retry states, and CTA after safety is proven.
```

Only after:

```txt
locked state does not mount player
denied plan has no source/token
tracking separation is safe
```

### PL-8 — Certification

Goal:

```txt
Certify PlaybackPlan / Player Simplification.
```

Output:

```txt
docs/reports/certification/X4-playback-player-certification.md
```

---

## 9. Suggested tickets

Tickets should be created under:

```txt
docs/tickets/ready/
```

### PL-001 — Current playback/player inventory

```txt
ID: PL-001
Lane: playback-player
Type: inventory
Parallel safety: CAUTION
Goal: Inventory current player mounting, media-source requests, locked UI, access gating, provider source, and playback tracking.
```

Allowed output:

```txt
docs/reports/reconciliation/PL-001-current-playback-player-inventory.md
```

Forbidden:

```txt
runtime changes
schema changes
README changes
roadmap changes
```

### PL-002 — PlaybackPlan contract

```txt
ID: PL-002
Lane: playback-player
Type: contract/spec
Parallel safety: SERIAL with access/video-provider
Goal: Define/adopt stable PlaybackPlan shape and reason states.
```

### PL-003 — Denied PlaybackPlan safety tests

```txt
ID: PL-003
Lane: playback-player
Type: test
Parallel safety: SERIAL with access/video-provider
Goal: Test that denied PlaybackPlan has no source/token and does not call provider/media source.
```

### PL-004 — Locked placeholders replace player

```txt
ID: PL-004
Lane: playback-player
Type: runtime/test
Parallel safety: SERIAL
Goal: Render locked placeholders instead of mounting real player for denied states.
```

### PL-005 — Player consumes PlaybackPlan

```txt
ID: PL-005
Lane: playback-player
Type: runtime/test
Parallel safety: SERIAL
Goal: Make player UI render from PlaybackPlan instead of local access guesses.
```

### PL-006 — Playback tracking separation

```txt
ID: PL-006
Lane: playback-player
Type: runtime/test
Parallel safety: CAUTION / SERIAL
Goal: Ensure tracking events run only for real playback, not locked placeholders.
```

### PL-007 — Admin playback debug handoff

```txt
ID: PL-007
Lane: playback-player
Type: runtime/spec
Parallel safety: CAUTION with admin-cockpit
Goal: Expose safe admin/debug info for playback decisions without leaking private sources.
```

### PL-008 — Locked state UX polish

```txt
ID: PL-008
Lane: playback-player
Type: UX
Parallel safety: SAFE/CAUTION after safety tickets
Goal: Polish login/patron/processing/unavailable/error locked state UX.
```

### PL-009 — PlaybackPlan / Player certification

```txt
ID: PL-009
Lane: playback-player
Type: certification
Parallel safety: SERIAL
Goal: Certify X4 PlaybackPlan / Player Simplification.
```

Output:

```txt
docs/reports/certification/X4-playback-player-certification.md
```

---

## 10. Validation

Inventory-only minimum:

```bash
npm run quality:architecture-boundaries
```

Runtime minimum:

```bash
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
```

Preferred:

```bash
npm run quality
```

Player/UI changes should include relevant component/unit tests where available.

Safety tests should prove:

```txt
denied plan has no playbackUrl
denied plan has no token
locked UI does not mount player
locked UI does not request media source
provider is not called for denied access
tracking does not run for locked placeholders
```

Agents must report exact commands.

---

## 11. Done criteria

This lane is done when:

```txt
current playback/player inventory exists
PlaybackPlan contract exists
denied plan has no source/token
provider/media source is not requested for denied access
locked placeholders replace player
player consumes PlaybackPlan
tracking runs only for real playback
admin/debug handoff exists or is explicitly deferred
UX polish tickets are separated from safety tickets
docs reflect current implementation
```

---

## 12. Certified criteria

This lane is certified when:

```txt
Certifier reviewed current main
tests prove denied state has no source/token
tests prove locked state does not mount player/request source
player does not invent access
tracking does not count locked placeholders as playback
provider is called only after access allow or this is handed to X3 with clear tests
docs reflect actual behavior
all remaining blockers have tickets
certification report exists
human owner accepts certification
```

Certification report:

```txt
docs/reports/certification/X4-playback-player-certification.md
```

---

## 13. Review checklist

Reviewer must check:

```txt
Does PR keep player from deciding access?
Does PR avoid Clerk/User.isPatron/Subscription access checks in UI?
Does PR ensure denied plan has no source/token?
Does PR avoid mounting real player for locked state?
Does PR avoid provider/media-source requests for locked state?
Does PR avoid tracking locked placeholders as playback?
Does PR avoid raw private URL leaks?
Does PR avoid access/provider contract changes unless allowed?
Does PR include focused tests?
Does PR avoid global docs unless allowed?
```

Return:

```txt
MERGE
FIX
REJECT
BLOCKED
```

---

## 14. Anti-patterns

Do not:

```txt
mount video under overlay
hide player with CSS for locked state
let player generate provider URL
let player check Clerk metadata to unlock
let player check User.isPatron to unlock
let player treat Subscription as access
request playback token before access allow
call media-source endpoint from locked placeholder
count placeholder render as view
mix player safety with cosmetic redesign
```

---

## 15. Final lane rule

This lane is successful when the UI can say:

```txt
I do not decide access.
I render the PlaybackPlan.
If allowed, I mount the player.
If denied, I render a placeholder and request nothing sensitive.
```

That is the handoff from PlaybackPlan / Player to Product Excellence.
