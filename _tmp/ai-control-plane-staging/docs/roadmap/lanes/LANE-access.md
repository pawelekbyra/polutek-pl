# LANE-access

## 0. Purpose

This lane owns backend access decisions for Polutek.pl.

It exists to make sure that:

```txt
access is decided server-side
patron access comes from active PatronGrant
Subscription never grants video access
Clerk metadata is never backend access truth
User.isPatron is ignored by target access decisions
comments permission goes through Access
playback permission goes through Access
admin diagnostics can explain access decisions
```

This lane is the bridge between:

```txt
payments/patron safety
comments permissions
video playback
locked player states
admin access diagnostics
```

Core invariant:

```txt
Patron access = exists ACTIVE PatronGrant.
```

---

## 1. Lane identity

Lane ID:

```txt
access
```

Primary phase:

```txt
X2 — Access / Patron Hard Reset
```

Depends on:

```txt
X1 — Payments / Patron Safety
```

Supports later phases:

```txt
X3 — Video Provider Foundation
X4 — PlaybackPlan / Player Simplification
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
SERIAL / CAUTION
```

Reason:

```txt
Access affects video playback, comments, admin diagnostics, patron status, media source generation, and security.
```

Default rule:

```txt
Run only one core access-policy Builder at a time.
```

---

## 2. Product and security invariants

### 2.1 Access is backend truth

Backend decides access.

Do not trust:

```txt
frontend state
hidden buttons
CSS overlays
Clerk metadata
Subscription
Payment alone
Stripe state alone
User.isPatron
raw media URL obscurity
```

### 2.2 Patron access comes from PatronGrant

Target rule:

```txt
User has patron access if at least one PatronGrant is ACTIVE and not expired.
```

If a user has several PatronGrants:

```txt
access remains true while at least one grant is ACTIVE
```

If one grant is revoked/suspended:

```txt
do not remove access if another ACTIVE grant exists
```

### 2.3 Subscription is not access

```txt
Subscription != Patron
```

Subscription gives mailing/follow eligibility only.

It must never grant:

```txt
PATRON video playback
PATRON comment permission
Patron badge
Patron admin status
```

### 2.4 Clerk metadata is cache/UI hint only

Clerk metadata may be used as:

```txt
display hint
cache
sync target
debug signal
diagnostic comparison
```

Clerk metadata must not be used as:

```txt
backend source of truth
reason to allow playback
reason to generate signed playback source
reason to allow PATRON comments
reason to skip DB/PatronGrant check
```

### 2.5 User.isPatron is target-deprecated

`User.isPatron` may exist during migration.

Target rule:

```txt
Backend access decisions ignore User.isPatron.
```

Do not remove the field until:

```txt
Access no longer uses it
tests prove backend access ignores it
writes are removed or bridged safely
admin diagnostics can show legacy mismatch
migration/reconciliation plan exists
```

---

## 3. Access decisions owned by this lane

This lane owns policy/use-case decisions for:

```txt
can view video metadata
can play video
can request PlaybackPlan
can request signed playback source
can comment on video
can moderate comment
can access admin diagnostics
can bypass patron restrictions as admin
```

This lane does not own:

```txt
recording financial facts
creating PatronGrants from payment
provider-specific playback source generation
rendering UI placeholders
sending emails
comment persistence
video upload implementation
```

But other lanes must consume Access decisions.

---

## 4. Target public API

The final names may differ based on current code, but the target public API should look like:

```txt
canViewVideo(ctx, { userId, videoId })
canPlayVideo(ctx, { userId, videoId })
canCommentOnVideo(ctx, { userId, videoId })
getViewerAccess(ctx, { userId })
getVideoAccessDecision(ctx, { userId, videoId })
getVideoPlaybackPlan(ctx, { userId, videoId })
requireVideoAccess(ctx, { userId, videoId })
explainAccess(ctx, { userId, videoId })
```

Routes and other modules should import from public module index:

```ts
import { getVideoAccessDecision } from "@/lib/modules/access";
```

Forbidden:

```ts
import { GetVideoAccessDecisionUseCase } from "@/lib/modules/access/application/get-video-access-decision.use-case";
```

---

## 5. Access decision inputs

Access may use:

```txt
viewer identity
login state
admin role
video tier
video publication/status
active PatronGrant/effective patron status
video asset readiness when deciding playback
comment policy
```

Access must not use as truth:

```txt
Subscription
Clerk metadata
User.isPatron
Payment alone
Stripe state alone
frontend state
```

---

## 6. Access matrix

### 6.1 Video playback

```txt
PUBLIC + guest:
  can play

PUBLIC + logged-in:
  can play

PUBLIC + patron:
  can play

PUBLIC + admin:
  can play

LOGGED_IN + guest:
  cannot play
  reason: LOGIN_REQUIRED

LOGGED_IN + logged-in:
  can play

LOGGED_IN + patron:
  can play

LOGGED_IN + admin:
  can play

PATRON + guest:
  cannot play
  reason: LOGIN_REQUIRED or PATRON_REQUIRED depending UX decision

PATRON + logged-in non-patron:
  cannot play
  reason: PATRON_REQUIRED

PATRON + patron:
  can play

PATRON + admin:
  can play
```

### 6.2 Comment visibility

Target:

```txt
Comments are visible to everyone.
```

For all video tiers:

```txt
guest can list/read visible comments
logged-in user can list/read visible comments
patron can list/read visible comments
admin can list/read/moderate according to admin role
```

### 6.3 Comment permission

```txt
PUBLIC:
  guest cannot comment
  logged-in user can comment
  patron can comment
  admin can comment/moderate

LOGGED_IN:
  guest cannot comment
  logged-in user can comment
  patron can comment
  admin can comment/moderate

PATRON:
  guest cannot comment
  logged-in non-patron cannot comment
  patron can comment
  admin can comment/moderate
```

Important:

```txt
Comment visibility != comment permission.
```

---

## 7. Owned paths

This lane may own or edit these paths when the ticket explicitly allows them.

### Access module

```txt
lib/modules/access/**
```

### Patron read integration

```txt
lib/modules/patron/**
lib/modules/patrons/**
```

Use actual current module names.
Do not invent duplicate modules.

### Video/media consumers

Only when ticket explicitly involves access integration:

```txt
lib/modules/video/**
lib/modules/media/**
app/api/media/**
app/api/media-source/**
app/api/videos/**
```

### Comments consumers

Only when ticket explicitly involves comment permission:

```txt
lib/modules/comments/**
app/api/comments/**
app/api/admin/comments/**
```

### Admin diagnostics consumers

Only when ticket explicitly involves diagnostics:

```txt
app/admin/**
app/api/admin/**
lib/modules/admin/**
```

### Tests

```txt
tests/unit/modules/access/**
tests/unit/modules/patron/**
tests/unit/modules/comments/**
tests/unit/*access*.test.ts
tests/unit/*patron*.test.ts
tests/unit/*comment*.test.ts
tests/unit/*playback*.test.ts
```

---

## 8. Forbidden by default

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

Builder agents must not edit Prisma schema unless the ticket is schema-locked:

```txt
prisma/schema.prisma
prisma/migrations/**
```

Forbidden product/architecture changes unless explicit:

```txt
turning patron into recurring subscription
making Subscription grant video access
making Clerk metadata grant backend access
using User.isPatron as target source of truth
dropping User.isPatron before safe migration
changing payment fulfillment
changing Stripe webhook behavior
changing provider playback architecture
changing comments visibility
changing player rendering behavior beyond access contract
```

---

## 9. Parallel safety

Default mode:

```txt
SERIAL for core access policy
CAUTION for access consumers
```

### Conflicts with

This lane conflicts with:

```txt
payments-patron when PatronGrant source/truth is changing
comments when comment permission is changing
video-provider when playback source access gating is changing
playback-player when PlaybackPlan/locked behavior is changing
admin-cockpit when diagnostics depend on access decision shape
cleanup-legacy when deleting services/routes used by access
Prisma schema tasks
guard tasks
global docs tasks
```

### Can run with

This lane may run in parallel with:

```txt
email-subscriptions work not touching access/patron segments
video-provider docs-only inventory
comments docs-only inventory
admin-cockpit static UI shell not consuming access
cleanup-legacy inventory-only reports
```

only if paths do not overlap.

### Serial-only examples

```txt
Access reads PatronGrant as source of truth
+
Payment creates PatronGrant
```

Verdict:

```txt
SERIAL unless PatronGrant contract already landed
```

```txt
canCommentOnVideo policy change
+
comments route migration
```

Verdict:

```txt
SERIAL or strict provider/consumer sequence
```

```txt
getVideoPlaybackPlan shape change
+
player consuming PlaybackPlan
```

Verdict:

```txt
SERIAL unless PlaybackPlan contract is frozen
```

---

## 10. Work sequence

This lane must run in order.

Do not remove `User.isPatron` first.

Do not rewrite player first.

Do not change comments behavior before access tests exist.

### AC-0 — Current access inventory

Goal:

```txt
Understand all current backend access decisions.
```

Inventory must answer:

```txt
Where is User.isPatron read?
Where is User.isPatron written?
Where is Clerk metadata read for access?
Where is Subscription used near access?
Where is PatronGrant read?
Where are video playback decisions made?
Where are comments permissions made?
Where are admin bypasses made?
Where are media-source/provider decisions made?
What access tests already exist?
What legacy services are still involved?
```

Output:

```txt
docs/reports/reconciliation/AC-0-current-access-inventory.md
follow-up tickets
```

### AC-1 — Access contract and test matrix

Goal:

```txt
Define and test the access matrix before changing behavior broadly.
```

Required tests:

```txt
PUBLIC guest/logged-in/patron/admin playback
LOGGED_IN guest/logged-in/patron/admin playback
PATRON guest/logged-in non-patron/patron/admin playback
comment visibility for all tiers
comment permission for all tiers
Subscription does not grant patron access
Clerk metadata does not grant backend access
User.isPatron does not grant backend access target behavior
```

### AC-2 — PatronGrant as patron source of truth

Goal:

```txt
Make Access read active PatronGrant/effective patron status as truth.
```

Required behavior:

```txt
ACTIVE grant -> patron access
SUSPENDED grant -> no access unless another ACTIVE grant exists
REVOKED grant -> no access unless another ACTIVE grant exists
EXPIRED grant -> no access unless another ACTIVE grant exists
multiple grants -> access true while at least one ACTIVE
```

### AC-3 — Remove Subscription from access decisions

Goal:

```txt
Ensure mailing subscription does not influence backend access.
```

Required behavior:

```txt
Subscription can affect mailing eligibility only
Subscription cannot unlock PATRON video
Subscription cannot unlock PATRON comments
unsubscribe cannot revoke patron access
```

### AC-4 — Remove Clerk metadata from backend access truth

Goal:

```txt
Ensure Clerk metadata is not used to grant backend access.
```

Allowed role for Clerk metadata:

```txt
UI hint
cache
diagnostics comparison
sync target
```

Forbidden role:

```txt
backend access source of truth
```

### AC-5 — Ignore User.isPatron in backend access

Goal:

```txt
Make backend access decisions ignore User.isPatron.
```

Do not delete the field yet.

Required behavior:

```txt
User.isPatron=true but no ACTIVE PatronGrant -> no patron access
User.isPatron=false but ACTIVE PatronGrant exists -> patron access
```

### AC-6 — Comments permission through Access

Goal:

```txt
Make comments ask Access for canCommentOnVideo.
```

Required behavior:

```txt
comments visible to everyone
PUBLIC commenting requires login
LOGGED_IN commenting requires login
PATRON commenting requires patron/admin
admin can moderate according to admin role
```

### AC-7 — PlaybackPlan access integration

Goal:

```txt
Make playback/source decisions consume Access decision.
```

Required behavior:

```txt
allowed=false -> no playback source
allowed=false -> no provider call
allowed=false -> no token
allowed=true -> source may be requested through provider/media flow
```

This may be completed partly in playback-player or video-provider lanes, but Access owns the decision.

### AC-8 — Admin diagnostics foundation

Goal:

```txt
Expose enough access explanation for admin diagnostics.
```

Diagnostic should explain:

```txt
user identity
video tier
active/suspended/revoked/expired PatronGrants
Subscription status
Clerk metadata/cache snapshot
legacy User.isPatron value during migration
final access decision
reason for allow/deny
mismatch warnings
```

### AC-9 — User.isPatron migration/removal plan

Goal:

```txt
Prepare safe removal after runtime no longer uses User.isPatron.
```

Safe order:

```txt
1. Access ignores User.isPatron
2. Tests prove target behavior
3. Runtime writes are removed or bridged safely
4. Admin diagnostics exposes mismatch
5. Data migration/reconciliation is planned
6. Prisma field removal ticket is created
7. Docs/guards updated
```

Do not remove schema field inside AC-5 unless ticket is explicitly schema-locked and all prior conditions are met.

### AC-10 — Certification

Goal:

```txt
Certify Access / Patron Hard Reset.
```

Output:

```txt
docs/reports/certification/X2-access-patron-certification.md
```

---

## 11. Suggested tickets

Tickets should be created under:

```txt
docs/tickets/ready/
```

### AC-001 — Current access inventory

```txt
ID: AC-001
Lane: access
Type: inventory
Parallel safety: CAUTION
Goal: Inventory current User.isPatron, Clerk metadata, Subscription, PatronGrant, playback, comment, and admin access decision usage.
```

Allowed output:

```txt
docs/reports/reconciliation/AC-001-current-access-inventory.md
```

Forbidden:

```txt
runtime changes
schema changes
README changes
roadmap changes
```

### AC-002 — Access matrix tests

```txt
ID: AC-002
Lane: access
Type: test
Parallel safety: SERIAL with access policy work
Goal: Add/verify tests for PUBLIC / LOGGED_IN / PATRON access and comment permission matrix.
```

### AC-003 — PatronGrant source of truth

```txt
ID: AC-003
Lane: access
Type: runtime/test
Parallel safety: SERIAL
Goal: Make Access use active PatronGrant/effective patron status as backend truth.
```

### AC-004 — Subscription is not access

```txt
ID: AC-004
Lane: access
Type: runtime/test
Parallel safety: SERIAL
Goal: Prove and enforce that Subscription never grants video/comment patron access.
```

### AC-005 — Clerk metadata is not backend access truth

```txt
ID: AC-005
Lane: access
Type: runtime/test
Parallel safety: SERIAL
Goal: Prove and enforce that Clerk metadata cannot grant backend patron access.
```

### AC-006 — User.isPatron ignored by backend access

```txt
ID: AC-006
Lane: access
Type: runtime/test
Parallel safety: SERIAL
Goal: Make backend access ignore User.isPatron while keeping field until migration/removal is safe.
```

### AC-007 — Comments permission through Access

```txt
ID: AC-007
Lane: access
Type: runtime/test
Parallel safety: SERIAL with comments lane
Goal: Make comments permission flow through Access canCommentOnVideo.
```

### AC-008 — Playback access decision contract

```txt
ID: AC-008
Lane: access
Type: runtime/test
Parallel safety: SERIAL with video-provider/playback-player
Goal: Provide access decision contract used by PlaybackPlan/provider/media source.
```

### AC-009 — Access diagnostics explanation

```txt
ID: AC-009
Lane: access
Type: runtime/test
Parallel safety: CAUTION / SERIAL with admin-cockpit
Goal: Expose access explanation data for Admin Access Diagnostics.
```

### AC-010 — User.isPatron migration/removal plan

```txt
ID: AC-010
Lane: access
Type: migration-plan
Parallel safety: SERIAL
Goal: Create safe migration/removal plan for User.isPatron after Access ignores it.
```

### AC-011 — Access/Patron hard reset certification

```txt
ID: AC-011
Lane: access
Type: certification
Parallel safety: SERIAL
Goal: Certify X2 Access / Patron Hard Reset.
```

Output:

```txt
docs/reports/certification/X2-access-patron-certification.md
```

---

## 12. Validation

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

If schema is changed:

```bash
npm run db:validate
npm run prisma:generate
npm run typecheck
npm test -- --run
```

Agents must report exact commands.

Do not claim access safety without tests.

---

## 13. Done criteria

This lane is done when:

```txt
access inventory exists
access matrix tests exist
backend access uses PatronGrant/effective patron truth
Subscription does not grant access
Clerk metadata does not grant backend access
User.isPatron is ignored by backend access
comments permission flows through Access or deferred with ticket
playback/source access contract exists
admin diagnostics can explain access or deferred with ticket
User.isPatron migration/removal plan exists
docs reflect current implementation
```

---

## 14. Certified criteria

This lane is certified when:

```txt
Certifier reviewed current main
access tests pass
backend access ignores User.isPatron
Clerk metadata is not backend access truth
Subscription is not access
PatronGrant ACTIVE status decides patron access
PUBLIC / LOGGED_IN / PATRON matrix is covered
comments permission matrix is covered or explicitly deferred
playback denied-source behavior is covered or handed to X4 with clear contract
all remaining blockers have tickets
certification report exists
human owner accepts certification
```

Certification report:

```txt
docs/reports/certification/X2-access-patron-certification.md
```

---

## 15. Review checklist

Reviewer must check:

```txt
Does PR keep access server-side?
Does PR use PatronGrant/effective patron status as truth?
Does PR avoid Subscription as access?
Does PR avoid Clerk metadata as backend access truth?
Does PR avoid User.isPatron as target source of truth?
Does PR avoid removing User.isPatron too early?
Does PR preserve PUBLIC / LOGGED_IN / PATRON rules?
Does PR preserve comment visibility vs permission?
Does PR avoid provider/player changes outside ticket?
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

## 16. Anti-patterns

Do not:

```txt
let frontend decide backend access
use Clerk metadata to allow playback
use Subscription to allow patron video
use User.isPatron as final target truth
remove User.isPatron before migration proof
let comments decide patron permission locally
let player request source before backend access allow
let provider decide application access
mix access hard reset with player rewrite
mix access hard reset with payment lifecycle rewrite
```

---

## 17. Final lane rule

This lane is successful when every consumer can ask Access:

```txt
Can this user do this thing?
```

and Access can answer from server-side facts:

```txt
identity
role
video tier
active PatronGrant
policy
```

without trusting:

```txt
Subscription
Clerk metadata
User.isPatron
frontend state
Stripe state alone
```
