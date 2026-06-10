# Active Execution Roadmap

## 0. Purpose

This file is the active execution roadmap for Polutek.pl.

It answers:

```txt
What is active now?
What is next?
What is blocked?
Which lanes exist?
Which work can be parallelized?
Which work must be serial?
Which tickets should agents pick from?
```

This file is not the full product blueprint.

Target architecture lives in:

```txt
docs/architecture/Product-Architecture-Blueprint.md
```

Permanent agent rules live in:

```txt
AGENTS.md
```

Atomic agent tasks live in:

```txt
docs/tickets/
```

Parallel safety rules live in:

```txt
docs/roadmap/Parallel-Work-Matrix.md
```

Phase entry/exit rules live in:

```txt
docs/roadmap/Phase-Gates.md
```

---

## 1. Operating principle

This roadmap is designed for multiple AI agents working safely in parallel.

The core rule:

```txt
Global docs are not working files.
Global docs are reconciled after merges.
```

Builder agents do not update this file unless explicitly assigned an Integrator ticket.

Builder agents work from ticket files.

Integrator agents update this roadmap after a batch of merged PRs.

---

## 2. Source of truth order

When information conflicts, use this order:

```txt
1. actual code on current main
2. README.md
3. this file
4. docs/tickets/**
5. docs/audit/**
6. docs/roadmap/lanes/**
7. docs/architecture/Product-Architecture-Blueprint.md
8. PR body / old agent report
```

Important:

```txt
Target architecture != current implementation.
```

The blueprint defines direction.
This roadmap defines current execution.

---

## 3. Current activation status

Status:

```txt
DRAFT UNTIL R-PHASE HANDOFF IS CERTIFIED
```

This roadmap becomes active only after an Integrator verifies:

```txt
R-phase README has been replaced or slimmed down
R10/R11 final state is documented
docs/audit reflects current main
architecture guards reflect current main
AGENTS.md exists
Product-Architecture-Blueprint.md exists
Parallel-Work-Matrix.md exists
Phase-Gates.md exists
ticket folders exist
```

Until then, this file is a migration draft.

---

## 4. Roadmap status vocabulary

Use these statuses consistently.

```txt
DRAFT       planned but not active
READY       ticket/lane can be picked up
ACTIVE      currently being worked on
BLOCKED     cannot proceed until dependency is resolved
REVIEW      PR exists and needs review
MERGED      PR merged, but not reconciled/certified
RECONCILED  docs/guards/tickets updated after merge
CERTIFIED   validation and source-of-truth reconciliation complete
DEFERRED    intentionally postponed
REJECTED    abandoned or replaced
```

Do not use `[x]` loosely.

A lane or phase is not certified just because one PR was merged.

---

## 5. Global work lanes

Post-R work is split into lanes so multiple agents can work without collisions.

| Lane                           | File                                             | Primary owner        | Parallel safety          |
| ------------------------------ | ------------------------------------------------ | -------------------- | ------------------------ |
| Cleanup Legacy                 | `docs/roadmap/lanes/LANE-cleanup-legacy.md`      | Integrator / Builder | Medium                   |
| Payments / Patron              | `docs/roadmap/lanes/LANE-payments-patron.md`     | Builder              | Medium                   |
| Access                         | `docs/roadmap/lanes/LANE-access.md`              | Builder              | Low / Serial near schema |
| Video Provider                 | `docs/roadmap/lanes/LANE-video-provider.md`      | Builder              | Medium                   |
| Playback / Player              | `docs/roadmap/lanes/LANE-playback-player.md`     | Builder              | Medium                   |
| Admin Cockpit                  | `docs/roadmap/lanes/LANE-admin-cockpit.md`       | Builder              | Medium                   |
| Comments                       | `docs/roadmap/lanes/LANE-comments.md`            | Builder              | Medium                   |
| Email / Subscriptions          | `docs/roadmap/lanes/LANE-email-subscriptions.md` | Builder              | High                     |
| Documentation / Reconciliation | this file + reports                              | Integrator           | Serial                   |
| Guard / Certification          | `scripts/check-architecture.ts`, reports         | Certifier            | Serial                   |

Parallel safety is only a default hint.
The ticket and `Parallel-Work-Matrix.md` decide final safety.

---

## 6. Execution phases

The post-R execution phases are:

```txt
X0 — Control Plane & Truth Reconciliation
X1 — Payments / Patron Safety
X2 — Access / Patron Hard Reset
X3 — Video Provider Foundation
X4 — PlaybackPlan / Player Simplification
X5 — Admin Cockpit Foundation
X6 — Product Excellence Passes
```

Do not jump to a later phase unless its gate allows it.

---

## 7. NOW / NEXT / LATER / BLOCKED

### NOW

Current focus:

```txt
X0 — Control Plane & Truth Reconciliation
```

Goal:

```txt
Prepare the repository for safe multi-agent work after the R-phase refactor.
```

Current objective:

```txt
Create the AI Delivery Control Plane:
- slim README
- AGENTS.md
- Active-Execution-Roadmap.md
- Parallel-Work-Matrix.md
- Phase-Gates.md
- lane roadmap files
- ticket folders
- report folders
- templates
```

This is mostly docs/control-plane work.

Runtime changes are forbidden unless explicitly assigned.

### NEXT

After X0 control plane exists:

```txt
X0-BATCH-2 — R-phase final reconciliation
X0-BATCH-3 — first ready ticket batch
```

Expected next batches:

```txt
1. R10/R11 handoff verification
2. stale README/docs/audit cleanup
3. stale architecture allowlist check
4. remaining cleanup tickets creation
5. first parallel-safe ticket batch
```

### LATER

After X0 certification:

```txt
X1 — Payments / Patron Safety
X2 — Access / Patron Hard Reset
X3 — Video Provider Foundation
X4 — PlaybackPlan / Player Simplification
X5 — Admin Cockpit Foundation
X6 — Product Excellence
```

### BLOCKED

Blocked until X0 is certified:

```txt
large Access/Patron reset
User.isPatron removal
VideoAsset/provider schema work
Mux/Cloudflare implementation
PlaybackPlan full migration
Admin cockpit full implementation
Product Excellence passes
```

---

## 8. X0 — Control Plane & Truth Reconciliation

Status:

```txt
ACTIVE / DRAFT
```

Purpose:

```txt
Make the repo ready for many AI agents without README conflicts, roadmap drift, or scope chaos.
```

Allowed changes:

```txt
README.md
AGENTS.md
docs/architecture/**
docs/roadmap/**
docs/tickets/**
docs/reports/**
docs/templates/**
docs/operations/**
```

Forbidden changes unless explicitly approved:

```txt
runtime code
Prisma schema
package.json
package-lock.json
payment logic
access logic
video provider logic
player behavior
admin UI behavior
```

### X0 tasks

| ID     | Status  | Description                                                                   | Owner role          |
| ------ | ------- | ----------------------------------------------------------------------------- | ------------------- |
| X0-001 | READY   | Replace README with control-panel README                                      | Integrator          |
| X0-002 | READY   | Add `AGENTS.md`                                                               | Integrator          |
| X0-003 | READY   | Add this Active Execution Roadmap                                             | Integrator          |
| X0-004 | READY   | Add `Parallel-Work-Matrix.md`                                                 | Planner             |
| X0-005 | READY   | Add `Phase-Gates.md`                                                          | Planner / Certifier |
| X0-006 | READY   | Move/copy `notatka` to `docs/architecture/Product-Architecture-Blueprint.md`  | Integrator          |
| X0-007 | READY   | Add lane roadmap files                                                        | Planner             |
| X0-008 | READY   | Add ticket folders and ticket README                                          | Planner             |
| X0-009 | READY   | Add report folders and report README                                          | Integrator          |
| X0-010 | READY   | Add templates for tickets, PR reports, reviews, certification, reconciliation | Planner             |
| X0-011 | READY   | Add operations docs for multi-agent workflow and merge protocol               | Planner             |
| X0-012 | BLOCKED | Certify X0 control plane                                                      | Certifier           |

X0-012 is blocked until X0-001 through X0-011 exist.

### X0 Definition of Done

X0 is done when:

```txt
README is a short control panel
AGENTS.md exists and defines agent rules
Product-Architecture-Blueprint.md exists
Active-Execution-Roadmap.md exists
Parallel-Work-Matrix.md exists
Phase-Gates.md exists
lane files exist
ticket folders exist
report folders exist
templates exist
operations docs exist
first ready ticket batch exists
human owner can run Builder/Reviewer/Integrator workflow without editing README by hand
```

X0 is certified when:

```txt
Certifier confirms docs are consistent
Builder agents are forbidden from editing global docs
parallel rules are clear
ticket lifecycle is clear
README points to the right files
no future target is presented as current implementation
```

---

## 9. X1 — Payments / Patron Safety

Status:

```txt
DRAFT
```

Purpose:

```txt
Make money/access fulfillment safe before the Access/Patron hard reset.
```

Core invariant:

```txt
Payment is money.
PatronGrant is access.
Stripe does not grant access directly.
```

Primary lane:

```txt
payments-patron
```

Depends on:

```txt
X0 certified
current payments/patron inventory
current Stripe webhook behavior understood
PatronGrant current model verified
```

Expected work:

```txt
inventory Stripe/payment -> patron effects
webhook signature/raw body verification
idempotency and duplicate webhook no-op
eligible payment creates PatronGrant through domain use case
pending payment creates no grant
below-minimum payment creates no grant
full refund revokes related grant
partial refund policy is explicit
dispute suspends related grant
dispute won reactivates grant
dispute lost/chargeback revokes grant
fulfillment failure does not mark webhook fully processed
tests for the payment/patron lifecycle
```

Forbidden during X1 unless explicit:

```txt
Video provider work
player rewrite
admin cockpit redesign
full User.isPatron removal
large access rewrite outside required integration points
```

Expected first X1 tickets:

```txt
X1-PATRON-001 — Inventory payment/patron side effects
X1-PATRON-002 — Webhook idempotency and duplicate-event safety
X1-PATRON-003 — Eligible payment -> PatronGrant use case
X1-PATRON-004 — Refund/dispute lifecycle matrix
X1-PATRON-005 — Payment/patron certification tests
```

X1 is certified when:

```txt
tests prove payment lifecycle behavior
Stripe does not directly set patron access
PatronGrant is created/updated through explicit use cases
refund/dispute behavior is deterministic
docs and guards reflect actual behavior
```

---

## 10. X2 — Access / Patron Hard Reset

Status:

```txt
DRAFT
```

Purpose:

```txt
Make Access module the only backend source of access decisions.
```

Core invariant:

```txt
User has patron access only if at least one PatronGrant is ACTIVE.
```

Primary lanes:

```txt
access
payments-patron
comments
admin-cockpit
```

Depends on:

```txt
X1 certified
current access inventory
current User.isPatron read/write inventory
current Clerk metadata usage inventory
```

Expected work:

```txt
inventory all User.isPatron reads/writes
inventory Clerk metadata used for access
Access module reads active PatronGrant
backend access ignores User.isPatron
Subscription never affects access
PUBLIC / LOGGED_IN / PATRON matrix tests
comment permission matrix tests
admin diagnostics for DB vs Clerk mismatch
migration plan for User.isPatron removal
remove runtime reads/writes of User.isPatron after safe migration
```

Forbidden during early X2:

```txt
dropping User.isPatron from Prisma schema before migration proof
large player rewrite
video provider abstraction work
generic admin dashboard work
```

Expected first X2 tickets:

```txt
X2-ACCESS-001 — Inventory User.isPatron and Clerk access usage
X2-ACCESS-002 — Access policy test matrix
X2-ACCESS-003 — Access reads PatronGrant as truth
X2-ACCESS-004 — Comments permission through Access module
X2-ACCESS-005 — Admin mismatch diagnostics foundation
X2-ACCESS-006 — User.isPatron migration plan
```

X2 is certified when:

```txt
backend access decisions ignore User.isPatron
Clerk metadata is not backend access truth
Subscription does not grant access
PatronGrant active status decides patron access
tests cover PUBLIC / LOGGED_IN / PATRON
docs and guards reflect actual behavior
```

---

## 11. X3 — Video Provider Foundation

Status:

```txt
DRAFT
```

Purpose:

```txt
Prepare provider-agnostic video without building a giant multi-provider framework.
```

Core invariant:

```txt
The application decides access before any video provider is asked for playback source.
```

Primary lanes:

```txt
video-provider
access
playback-player
```

Depends on:

```txt
X2 access foundation sufficiently stable
current video/media inventory
decision on minimal provider interface
migration plan for legacy R2/S3 media
```

Expected work:

```txt
thin VideoProvider interface
VideoAsset provider/status model
Mux/Cloudflare candidate strategy
direct browser upload session flow
resumable upload support strategy
provider webhook handling
primary READY asset selection
no active R2/S3 playback fallback
provider call only after access allowed
tests for denied access not calling provider
```

Forbidden during X3:

```txt
giant provider framework
multi-creator provider configuration
active R2/S3 fallback playback
player UX redesign beyond integration needs
payment/patron behavior changes
```

Expected first X3 tickets:

```txt
X3-VIDEO-001 — Video/media provider inventory
X3-VIDEO-002 — Thin VideoProvider interface proposal
X3-VIDEO-003 — VideoAsset model/migration plan
X3-VIDEO-004 — Upload session use-case foundation
X3-VIDEO-005 — Provider webhook foundation
```

X3 is certified when:

```txt
provider interface is thin
VideoAsset owns provider-specific IDs
upload flow is direct-to-provider
webhooks are modular and idempotent
denied access never calls provider for playback
legacy storage role is documented
```

---

## 12. X4 — PlaybackPlan / Player Simplification

Status:

```txt
DRAFT
```

Purpose:

```txt
Make player render backend PlaybackPlan instead of inventing access.
```

Core invariant:

```txt
Locked video is not a video with an overlay.
Locked video is a different render state.
```

Primary lanes:

```txt
playback-player
access
video-provider
comments
```

Depends on:

```txt
X2 access behavior stable
X3 provider/playback source strategy stable enough
PlaybackPlan shape agreed
```

Expected work:

```txt
PlaybackPlan use case
READY / LOGIN_REQUIRED / PATRON_REQUIRED / PROCESSING / ERROR states
denied plan has no token/source
player only mounts for allowed=true
locked placeholders replace player
tracking only for real playback
admin debug info where useful
tests for denied state not mounting/requesting media
```

Forbidden during X4:

```txt
changing payment/patron lifecycle
introducing provider fallback
changing comments visibility without ticket
generic UI redesign unrelated to player/access states
```

Expected first X4 tickets:

```txt
X4-PLAYER-001 — PlaybackPlan inventory and target shape
X4-PLAYER-002 — Denied plan has no source/token tests
X4-PLAYER-003 — Locked placeholder render states
X4-PLAYER-004 — Player mounts only for allowed plan
X4-PLAYER-005 — Playback tracking separation
```

X4 is certified when:

```txt
player receives PlaybackPlan
denied state does not mount player
denied state does not request stream/token/provider
tracking does not run for locked placeholders
tests cover locked and allowed states
```

---

## 13. X5 — Admin Cockpit Foundation

Status:

```txt
DRAFT
```

Purpose:

```txt
Build admin cockpit around real operational needs, starting with Access Diagnostics.
```

Core priority:

```txt
Access Diagnostics first.
Generic dashboard second.
```

Primary lanes:

```txt
admin-cockpit
access
payments-patron
comments
email-subscriptions
video-provider
```

Depends on:

```txt
X1 payment/patron safety
X2 access truth
enough audit data to explain access decisions
```

Expected work:

```txt
Access Diagnostics page/use-case
user identity lookup
PatronGrant history
payment/refund/dispute lifecycle display
mailing subscription status
DB vs Clerk cache mismatch display
final access decision explanation
video access diagnostic
comment permission diagnostic
recent audit events
corrective actions with audit logs
comments moderation
subscribers
emails
video provider health
system health
```

Forbidden during early X5:

```txt
generic dashboard before Access Diagnostics
manual DB-like admin hacks
granting patron outside Patron module
changing access policy just for UI convenience
```

Expected first X5 tickets:

```txt
X5-ADMIN-001 — Access Diagnostics product/API spec
X5-ADMIN-002 — Access Diagnostics backend use-case
X5-ADMIN-003 — User + PatronGrant diagnostic panel
X5-ADMIN-004 — Payment/refund/dispute diagnostic panel
X5-ADMIN-005 — DB vs Clerk mismatch panel
```

X5 is certified when:

```txt
admin can diagnose why user can/cannot access content
admin sees patron/payment/subscription/Clerk mismatch state
manual access-affecting actions are auditable
admin does not need database access for common support cases
```

---

## 14. X6 — Product Excellence Passes

Status:

```txt
DRAFT
```

Purpose:

```txt
Improve UX, mobile, performance, accessibility, emails, comments, player, and admin after core safety is done.
```

Depends on:

```txt
X1 payment/patron safety certified
X2 access truth certified
X4 player/PlaybackPlan certified
X5 admin diagnostics foundation certified
```

Expected work:

```txt
best player UX
best locked states
best comments UX
best playlist/sidebar
best admin cockpit
best emails/broadcast UX
performance passes
mobile passes
accessibility passes
copy/CTA polish
observability/system health polish
```

Forbidden before dependencies:

```txt
cosmetic polish that hides broken access
player beauty pass before locked state safety
dashboard polish before diagnostics
marketing language that confuses patron with subscription
```

X6 is intentionally later.

---

## 15. Initial post-R batch strategy

Do not start with deep runtime changes.

Start with control-plane docs and inventories.

### Batch A — Control plane

Parallel safety:

```txt
Mostly serial because global docs are involved.
```

Tickets:

```txt
X0-001 README control panel
X0-002 AGENTS.md
X0-003 Active Execution Roadmap
X0-004 Parallel Work Matrix
X0-005 Phase Gates
X0-006 Product Architecture Blueprint move
```

### Batch B — Lane setup

Parallel safety:

```txt
Can be parallel if each agent owns one lane file and no global docs.
```

Tickets:

```txt
X0-LANE-001 cleanup-legacy lane
X0-LANE-002 payments-patron lane
X0-LANE-003 access lane
X0-LANE-004 video-provider lane
X0-LANE-005 playback-player lane
X0-LANE-006 admin-cockpit lane
X0-LANE-007 comments lane
X0-LANE-008 email-subscriptions lane
```

### Batch C — Ticket/report system

Parallel safety:

```txt
Mostly docs-only; avoid two agents editing same template.
```

Tickets:

```txt
X0-SYS-001 tickets README and folders
X0-SYS-002 reports README and folders
X0-SYS-003 ticket template
X0-SYS-004 PR report template
X0-SYS-005 review template
X0-SYS-006 certification template
X0-SYS-007 reconciliation template
```

### Batch D — First runtime-safe inventories

Parallel safety:

```txt
Can run in parallel after matrix exists if lanes do not overlap.
```

Candidate inventory tickets:

```txt
X1-PATRON-001 payment/patron side-effect inventory
X2-ACCESS-001 User.isPatron and Clerk metadata access inventory
X3-VIDEO-001 video/media provider inventory
X5-ADMIN-001 Access Diagnostics spec inventory
X0-CLEANUP-001 stale services inventory
```

---

## 16. How to choose the next ticket

The next ticket should be chosen by this order:

```txt
1. Is there an ACTIVE ticket that needs review/fix?
2. Is there a BLOCKED ticket that can be unblocked?
3. Is the current phase gate incomplete?
4. Is there a READY ticket in the current phase?
5. Is there a parallel-safe ticket in another lane?
6. If none, Planner creates next tickets.
```

Do not pick a later phase just because it is more interesting.

Do not pick a ticket if another active PR touches the same files.

---

## 17. Merge and reconciliation cadence

Recommended cadence:

```txt
1-3 builder PRs
then 1 review pass per PR
then merge safe PRs
then 1 Integrator reconciliation PR if source-of-truth docs changed
then continue
```

For high-risk domains:

```txt
1 builder PR
1 review PR/pass
1 merge
1 reconciliation/certification check
```

High-risk domains include:

```txt
payments
patron
access
Prisma schema
video provider playback security
player locked states
guards
global docs
```

---

## 18. Reconciliation rules

Reconciliation is required after:

```txt
a phase closes
a lane closes
multiple PRs affect same domain
guards are updated
Prisma schema changes
README would otherwise become stale
audit inventory changes
ticket statuses changed
```

Reconciliation must verify:

```txt
code on main
README
this roadmap
lane files
tickets
docs/audit
guards
reports
```

Reconciliation must not invent completion.

---

## 19. Certification rules

Certification requires:

```txt
code merged to main
validation run or explicitly documented exception
guards updated
docs/audit updated
tickets moved to done/blocked
known blockers documented
phase/lane definition of done checked
certification report written
```

Certification report location:

```txt
docs/reports/certification/
```

---

## 20. Current human operating flow

The human owner should work like this:

```txt
1. Ask Planner: what is the next safe batch?
2. Start 1-3 Builder agents with ticket files.
3. Let agents work without watching every step.
4. Give PRs to Reviewer AI.
5. Merge only PRs with MERGE verdict.
6. Run Integrator after batch.
7. Run Certifier at phase/lane gate.
8. Continue.
```

The human should not need to manually maintain README after every builder PR.

---

## 21. Anti-chaos rules

Do not:

```txt
let builders edit README
let many agents edit this roadmap
run two agents in the same lane without checking files
run schema tasks in parallel
run package-lock tasks with runtime tasks
merge PRs that skipped validation without understood risk
treat PR body as source of truth
treat blueprint as current implementation
turn a ticket into a mega-refactor
```

---

## 22. Final rule

This roadmap should make the project boring.

Boring means:

```txt
small tickets
small PRs
clear ownership
few conflicts
parallel work where safe
serial work where necessary
honest reports
easy reviews
human-controlled merges
```

The system is working when the human owner mostly does:

```txt
choose batch
review verdict
merge
play guitar
```
