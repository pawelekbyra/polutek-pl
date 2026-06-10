# Phase Gates

## 0. Purpose

This file defines entry gates, exit gates, certification gates, blockers, and forbidden work for each Post-R phase of Polutek.pl.

It exists to prevent:

```txt
starting phases too early
marking work done without validation
treating target architecture as current implementation
skipping reconciliation
mixing unrelated domains
letting agents implement future blueprint work without an active ticket
```

Related files:

```txt
README.md
AGENTS.md
docs/roadmap/Active-Execution-Roadmap.md
docs/roadmap/Parallel-Work-Matrix.md
docs/roadmap/lanes/**
docs/tickets/**
docs/reports/certification/**
docs/reports/reconciliation/**
docs/architecture/Product-Architecture-Blueprint.md
```

---

## 1. Gate vocabulary

Use these terms consistently.

### Entry Gate

The conditions required before a phase may start.

### Exit Gate

The conditions required before a phase may be considered done.

### Certification Gate

The stricter conditions required before a phase may be marked `CERTIFIED`.

### Hard Blocker

A condition that prevents the phase from starting or continuing.

### Soft Blocker

A risk or unknown that does not fully block work but must be documented.

### Deferred Work

Work intentionally postponed to a later phase.

### Forbidden Work

Work that must not happen in the phase unless a human-approved override exists.

---

## 2. Status vocabulary

Valid phase statuses:

```txt
DRAFT
READY
ACTIVE
BLOCKED
REVIEW
MERGED
RECONCILED
CERTIFIED
DEFERRED
REJECTED
```

Do not use `[x]` unless the phase is actually certified or the roadmap explicitly defines `[x]` as a weaker status.

Preferred status format:

```txt
Status: ACTIVE
Certification: NOT CERTIFIED
```

---

## 3. Universal gate rules

These rules apply to all phases.

### 3.1 No certification without validation

A phase cannot be certified unless validation is run or a human-approved exception is documented.

Default validation:

```bash
npm run quality
```

Lower-level validation may include:

```bash
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
npm run db:validate
npm run env:validate
```

### 3.2 No future work without active ticket

Agents must not implement future blueprint work unless there is an active ticket.

Correct:

```txt
Implement ticket X2-ACCESS-003.
```

Forbidden:

```txt
Implement the Access/Patron blueprint.
```

### 3.3 No phase completion from PR body alone

A PR body is a report, not source of truth.

A phase is not done until:

```txt
code is merged to main
validation is checked
docs/audit are reconciled if needed
tickets are updated
known blockers are documented
certification report exists if marking certified
```

### 3.4 No global docs drift

If a phase changes current implementation, source-of-truth docs must be reconciled.

Current-state docs include:

```txt
README.md
docs/roadmap/Active-Execution-Roadmap.md
docs/audit/**
docs/reports/reconciliation/**
```

Target docs include:

```txt
docs/architecture/Product-Architecture-Blueprint.md
docs/roadmap/lanes/**
```

Do not make current-state docs more optimistic than the actual code.

### 3.5 Guards must not lie

If a guard allowlist contains a stale violation, it must be removed or documented as a blocker.

If a new allowlist is added, it must include:

```txt
reason
owner lane
phase
planned removal condition
```

### 3.6 Builder agents do not certify phases

Builder agents may complete tickets.

Certifier agents certify phases.

Integrator agents reconcile docs.

Human owner merges.

---

## 4. Universal Definition of Done

A phase may be marked `DONE` or `RECONCILED` only when:

```txt
all required tickets are merged or explicitly deferred
no known hard blockers remain
validation is run or exception documented
current-state docs are reconciled
tickets are moved to done/blocked/deferred
follow-up tickets are created for remaining work
```

---

## 5. Universal Definition of Certified

A phase may be marked `CERTIFIED` only when:

```txt
Definition of Done is satisfied
Certifier reviewed merged main
validation is acceptable
architecture guards pass or documented exception exists
docs/audit reflect actual main
no stale allowlists hide removed violations
known deferred work is explicit
certification report exists in docs/reports/certification/
human owner accepts certification status
```

Certification report file naming:

```txt
docs/reports/certification/<phase-id>-certification.md
```

Example:

```txt
docs/reports/certification/X1-payments-patron-certification.md
```

---

## 6. X0 — Control Plane & Truth Reconciliation

### Status

```txt
DRAFT / ACTIVE
```

### Purpose

Prepare the repo for safe multi-agent work after the R-phase refactor.

X0 creates the operating system for AI delivery:

```txt
README control panel
AGENTS.md
Product Architecture Blueprint
Active Execution Roadmap
Parallel Work Matrix
Phase Gates
lane roadmap files
ticket system
report system
templates
operations docs
```

### Entry Gate

X0 may start when:

```txt
human owner decides the R-phase roadmap is close enough to handoff
current repo has a stable main branch
no emergency production issue requires immediate runtime work
```

X0 can begin before final R certification if it is treated as docs/control-plane preparation.

### Allowed Work

```txt
README replacement/slim-down
AGENTS.md
roadmap docs
lane docs
ticket folders
report folders
templates
operations docs
moving/copying notatka into architecture blueprint
```

### Forbidden Work

```txt
runtime behavior changes
Prisma schema changes
payment behavior changes
access behavior changes
player behavior changes
video provider implementation
admin cockpit implementation
package-lock changes
```

### Hard Blockers

```txt
two agents editing global docs at once
unclear source-of-truth hierarchy
notatka treated as current implementation
README claiming future phases are already implemented
```

### Exit Gate

X0 is done when:

```txt
README is a control panel
AGENTS.md exists
Product-Architecture-Blueprint.md exists
Active-Execution-Roadmap.md exists
Parallel-Work-Matrix.md exists
Phase-Gates.md exists
lane roadmap files exist
ticket folders exist
report folders exist
templates exist
operations docs exist
first ready ticket batch exists
```

### Certification Gate

X0 is certified when:

```txt
Certifier confirms all control-plane files are consistent
Builder agents are forbidden from editing global docs
ticket lifecycle is clear
parallel safety rules are clear
README links to correct files
blueprint is clearly target-only
Active Roadmap is clearly execution-only
no file presents Post-R target work as already implemented
```

### Certification Report

```txt
docs/reports/certification/X0-control-plane-certification.md
```

---

## 7. X1 — Payments / Patron Safety

### Status

```txt
DRAFT
```

### Purpose

Make the payment-to-patron lifecycle safe before hard-resetting access.

Core invariant:

```txt
Payment is money.
PatronGrant is access.
Stripe does not grant access directly.
```

### Entry Gate

X1 may start when:

```txt
X0 is certified or explicitly waived by human owner
payments-patron lane exists
tickets exist for inventory before runtime changes
current Stripe webhook behavior is inspected
current PatronGrant model/status is inspected
current payment/refund/dispute behavior is inventoried
```

### Allowed Work

```txt
payments/patron inventory
Stripe webhook safety
idempotency
PatronGrant creation use cases
minimum donation eligibility
refund/dispute lifecycle
payment/patron unit tests
payment/patron audit events
```

### Forbidden Work

```txt
full Access/Patron hard reset
User.isPatron schema removal
player rewrite
video provider implementation
generic admin dashboard
comments visibility changes
mailing subscription treated as patron access
```

### Hard Blockers

```txt
webhook signature/raw body behavior unknown
duplicate webhook behavior unknown
PatronGrant model/status unclear
payment success directly sets User.isPatron
refund/dispute behavior ambiguous
no tests around payment fulfillment
```

### Exit Gate

X1 is done when:

```txt
eligible successful payment creates PatronGrant through explicit domain path
pending payment creates no PatronGrant
below-minimum payment creates no PatronGrant
duplicate webhook does not duplicate PatronGrant
full refund revokes related grant or documented equivalent exists
dispute suspends related grant or documented equivalent exists
dispute resolution behavior is deterministic
fulfillment failure behavior is documented and safe
tests cover critical payment/patron lifecycle
```

### Certification Gate

X1 is certified when:

```txt
payment/patron tests pass
Stripe does not directly grant access
PatronGrant lifecycle is explicit
refund/dispute lifecycle is explicit
docs and lane roadmap reflect actual behavior
known deferred payment work is documented
Certifier report exists
```

### Certification Report

```txt
docs/reports/certification/X1-payments-patron-certification.md
```

---

## 8. X2 — Access / Patron Hard Reset

### Status

```txt
DRAFT
```

### Purpose

Make Access module the only backend source of access decisions.

Core invariant:

```txt
Patron access = exists ACTIVE PatronGrant.
```

Not:

```txt
User.isPatron
Clerk metadata
Subscription
Payment alone
frontend state
```

### Entry Gate

X2 may start when:

```txt
X1 is certified or explicitly waived for a narrow access inventory task
access lane exists
User.isPatron usage inventory exists or is first ticket
Clerk metadata access usage inventory exists or is first ticket
current access policy tests are known
comments permission dependency is documented
player dependency is documented
```

### Allowed Work

```txt
access inventory
User.isPatron read/write inventory
Clerk metadata backend access inventory
AccessPolicy tests
PatronGrant-based access decisions
PUBLIC / LOGGED_IN / PATRON matrix tests
comments permission through Access module
admin mismatch diagnostics foundation
migration plan for User.isPatron removal
```

### Forbidden Work

```txt
dropping User.isPatron from Prisma schema before migration proof
large player rewrite
video provider implementation
generic admin dashboard
payment lifecycle rewrite outside integration points
changing comments visibility without explicit ticket
```

### Hard Blockers

```txt
X1 payment/patron source of truth is unsafe
User.isPatron usage unknown
Clerk metadata backend access usage unknown
no access matrix tests
comments permission behavior unclear
PatronGrant status semantics unclear
```

### Exit Gate

X2 is done when:

```txt
backend access reads PatronGrant as source of truth
backend access ignores User.isPatron
Clerk metadata is not backend access truth
Subscription does not grant video access
PUBLIC / LOGGED_IN / PATRON tests exist and pass
comments permission matrix exists and passes
admin diagnostics can expose access mismatch or follow-up is created
User.isPatron removal plan exists
```

### Certification Gate

X2 is certified when:

```txt
Access/Patron behavior is validated
tests prove User.isPatron is ignored by backend access
tests prove Clerk metadata does not grant backend access
tests prove Subscription does not grant access
docs/audit and lane docs reflect current behavior
known deferred migration work is explicit
Certifier report exists
```

### Certification Report

```txt
docs/reports/certification/X2-access-patron-certification.md
```

---

## 9. X3 — Video Provider Foundation

### Status

```txt
DRAFT
```

### Purpose

Create a thin provider-agnostic video foundation without building a giant multi-provider framework.

Core invariant:

```txt
Access decision belongs to the application, not the video provider.
```

### Entry Gate

X3 may start when:

```txt
X2 access behavior is stable enough for provider gating
video-provider lane exists
current video/media inventory exists
legacy R2/S3 role is documented
PlaybackPlan dependency is identified
VideoAsset/provider schema needs are known before schema change
```

### Allowed Work

```txt
video/media inventory
thin VideoProvider interface
Mux/Cloudflare candidate strategy
VideoAsset model/migration plan
direct upload session foundation
resumable upload strategy
provider webhook foundation
primary READY asset selection
provider call after access allowed
```

### Forbidden Work

```txt
giant provider framework
multi-creator provider configuration
active R2/S3 playback fallback
provider call before access check
player rewrite beyond contract integration
payment/patron behavior changes
```

### Hard Blockers

```txt
access decision contract unstable
VideoAsset model unclear
provider-specific IDs stored in wrong place
legacy media route still bypasses access in unsafe way
provider playback source can be created for denied users
```

### Exit Gate

X3 is done when:

```txt
thin provider abstraction exists or is specified
provider-specific IDs belong to VideoAsset or equivalent
upload session flow is modular
provider webhook handling is modular
primary READY asset is used for playback source selection
denied access does not call provider for playback
legacy R2/S3 role is documented
```

### Certification Gate

X3 is certified when:

```txt
tests or guards prove provider is not called for denied access where applicable
provider abstraction is thin
no active R2/S3 fallback was introduced
docs reflect actual provider state
known deferred provider work is explicit
Certifier report exists
```

### Certification Report

```txt
docs/reports/certification/X3-video-provider-certification.md
```

---

## 10. X4 — PlaybackPlan / Player Simplification

### Status

```txt
DRAFT
```

### Purpose

Make player render backend PlaybackPlan instead of inventing access.

Core invariant:

```txt
Locked video is not a video with an overlay.
Locked video is a different render state.
```

### Entry Gate

X4 may start when:

```txt
Access behavior is stable
PlaybackPlan shape is agreed
provider/playback source contract is stable enough
locked state product rules are confirmed
tracking semantics are inventoried
```

### Allowed Work

```txt
PlaybackPlan shape/use-case
READY / LOGIN_REQUIRED / PATRON_REQUIRED / PROCESSING / ERROR states
denied plan without token/source
locked placeholders
player mounts only for allowed=true
tracking only for real playback
admin debug information
player/access tests
```

### Forbidden Work

```txt
payment/patron lifecycle changes
provider fallback changes
comments visibility changes
generic UI redesign unrelated to playback states
hiding working player under CSS overlay
generating token for denied state
```

### Hard Blockers

```txt
Access contract unstable
PlaybackPlan shape undefined
provider source contract unstable
player currently requires raw source before access decision
tracking counts locked render as playback
```

### Exit Gate

X4 is done when:

```txt
player consumes PlaybackPlan
allowed=true mounts player
denied states render placeholders
denied states have no token/source
locked states do not request media source/provider
tracking runs only for real playback
tests cover denied and allowed states
```

### Certification Gate

X4 is certified when:

```txt
tests prove locked state does not mount/request real playback
denied PlaybackPlan has no token/source
player does not decide access
docs reflect actual behavior
known deferred player polish is explicit
Certifier report exists
```

### Certification Report

```txt
docs/reports/certification/X4-playback-player-certification.md
```

---

## 11. X5 — Admin Cockpit Foundation

### Status

```txt
DRAFT
```

### Purpose

Build admin cockpit around operational truth, starting with Access Diagnostics.

Core priority:

```txt
Access Diagnostics first.
Generic dashboard second.
```

### Entry Gate

X5 may start when:

```txt
X1 payment/patron safety is stable
X2 access truth is stable
audit/logging strategy is good enough
admin-cockpit lane exists
Access Diagnostics spec ticket exists
```

Narrow admin docs/spec work may start earlier if it does not change runtime.

### Allowed Work

```txt
Access Diagnostics spec
user lookup diagnostics
PatronGrant history display
payment/refund/dispute display
mailing subscription status display
DB vs Clerk mismatch display
final access decision explanation
video access diagnostic
comment permission diagnostic
audit event display
auditable corrective actions
comments moderation
subscribers/emails panels
video provider health
system health
```

### Forbidden Work

```txt
generic dashboard before diagnostics
manual DB-like admin hacks
granting patron outside Patron module
changing access policy for UI convenience
changing payment behavior from admin UI directly
```

### Hard Blockers

```txt
Access truth unclear
PatronGrant lifecycle unclear
payment/refund/dispute state unclear
audit trail missing for manual access actions
admin would need database access to diagnose common support issue
```

### Exit Gate

X5 is done when:

```txt
admin can diagnose why user can/cannot access content
admin can see PatronGrant history
admin can see relevant payment/refund/dispute state
admin can see mailing subscription status
admin can see DB vs Clerk mismatch if applicable
final access decision is visible
corrective actions are auditable or explicitly deferred
```

### Certification Gate

X5 is certified when:

```txt
Access Diagnostics solves common support cases
admin does not need database access for normal access diagnosis
manual access-affecting actions require reason/audit
docs reflect actual admin capability
known deferred admin work is explicit
Certifier report exists
```

### Certification Report

```txt
docs/reports/certification/X5-admin-cockpit-certification.md
```

---

## 12. X6 — Product Excellence Passes

### Status

```txt
DRAFT
```

### Purpose

Improve UX, performance, accessibility, copy, mobile, comments, player, emails, and admin after core safety is done.

### Entry Gate

X6 may start when:

```txt
X1 payment/patron safety certified
X2 access truth certified
X4 playback/player safety certified
X5 admin diagnostics foundation certified or explicitly deferred
known security/access blockers are closed
```

### Allowed Work

```txt
player UX polish
locked state copy/CTA polish
comments UX polish
playlist/sidebar polish
admin UX polish
email/broadcast UX polish
mobile polish
accessibility polish
performance polish
copy consistency
observability/system health polish
```

### Forbidden Work

```txt
cosmetic polish hiding broken access
player beauty pass before locked safety
dashboard polish before diagnostics
marketing language confusing patron with subscription
security-sensitive behavior changes without tests
```

### Hard Blockers

```txt
unsafe access behavior
unsafe payment/patron lifecycle
locked player still mounts real video
admin cannot diagnose access problems
subscription/patron terminology is confused
```

### Exit Gate

X6 is done when:

```txt
selected UX/performance/accessibility tickets are merged
no safety invariant is weakened
copy does not confuse patron/subscription
performance regressions are not introduced
docs and tickets reflect remaining polish work
```

### Certification Gate

X6 is certified when:

```txt
Certifier confirms product polish did not weaken core invariants
tests pass
manual QA notes exist where appropriate
known deferred polish is explicit
Certifier report exists
```

### Certification Report

```txt
docs/reports/certification/X6-product-excellence-certification.md
```

---

## 13. Cross-phase blockers

These blockers apply globally.

### 13.1 Source-of-truth blocker

```txt
README, Active Roadmap, docs/audit, and actual code disagree in a way that affects current work.
```

Required action:

```txt
Run Integrator reconciliation before runtime work continues.
```

### 13.2 Guard blocker

```txt
Architecture guard allowlist hides stale or unknown violations.
```

Required action:

```txt
Run guard/audit reconciliation.
```

### 13.3 Schema blocker

```txt
Prisma schema changes are needed or active.
```

Required action:

```txt
Pause related runtime work.
Run one schema-locked task.
Regenerate Prisma.
Re-run validation.
```

### 13.4 Access truth blocker

```txt
Backend access source of truth is ambiguous.
```

Required action:

```txt
Pause player/provider/comments/admin work that depends on access.
Run access inventory or access contract ticket.
```

### 13.5 Payment fulfillment blocker

```txt
Payment can grant or revoke patron access through unclear path.
```

Required action:

```txt
Pause Access/Patron hard reset.
Run payment/patron safety ticket.
```

### 13.6 Player security blocker

```txt
Locked state can mount player, fetch stream, request token, or call provider.
```

Required action:

```txt
Pause player polish.
Run PlaybackPlan/player safety ticket.
```

---

## 14. Human override

The human owner may override a gate.

Override must be explicit and documented.

Override format:

```txt
Gate override:
Phase:
Reason:
Risk accepted:
Scope allowed:
Expiration / follow-up:
```

Agents must not assume override.

A vague prompt is not an override.

---

## 15. Phase transition protocol

To move from one phase to the next:

```txt
1. Builder tickets merged
2. Reviewer verdicts resolved
3. Integrator reconciliation run
4. Certifier checks exit gate
5. Certification report written
6. Human owner accepts status
7. Active-Execution-Roadmap updated
8. Next phase tickets promoted to ready
```

Do not skip Integrator.

Do not skip Certifier for high-risk phases.

High-risk phases:

```txt
X1 Payments / Patron Safety
X2 Access / Patron Hard Reset
X3 Video Provider Foundation
X4 PlaybackPlan / Player Simplification
X5 Admin Cockpit Foundation
```

---

## 16. Emergency rollback / pause rule

If a phase introduces unsafe behavior:

```txt
pause new Builder tasks
review merged PRs
identify bad change
revert or patch narrowly
run validation
run reconciliation
update blockers
restart from safe ticket
```

Unsafe behavior includes:

```txt
patron access granted incorrectly
locked content playable by wrong user
Stripe webhook duplicate grants access twice
refund/dispute does not affect expected grant
player requests token for denied user
provider called before access decision
README claims false current state
guard hides real violation
```

---

## 17. Final gate rule

A phase is only complete when it is boring.

Boring means:

```txt
clear source of truth
small merged PRs
passing validation
known blockers documented
docs reconciled
guards honest
tickets closed or deferred
human owner understands the next phase
```
