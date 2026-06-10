# Polutek.pl

## 0. Purpose of this README

This README is the **operational control panel** for Polutek.pl.

It is not the full product blueprint.
It is not the full architecture document.
It is not a place for every agent to update after every PR.
It is not a scratchpad.

This file answers only:

```txt
What is this product?
What is the current operating mode?
Where is the source of truth?
Which AI agent may do what?
What is the next safe unit of work?
How do we avoid chaos when many agents work in parallel?
```

The detailed target architecture lives in:

```txt
docs/architecture/Product-Architecture-Blueprint.md
```

The active execution plan lives in:

```txt
docs/roadmap/Active-Execution-Roadmap.md
```

The rules for coding agents live in:

```txt
AGENTS.md
```

The atomic tasks for agents live in:

```txt
docs/tickets/
```

---

## 1. Product identity

Polutek.pl is a **single-creator VOD / patron-content platform**.

It is:

```txt
one creator
one official channel
one video catalog
one patron/access system
one community
one mailing system
one admin cockpit
one simple product
```

It is not:

```txt
a marketplace
a multi-creator SaaS
a mini-Patreon for many creators
a white-label CMS
a tenant platform
a public multi-channel social network
a project for endless feature creep
```

The most important product sentence:

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

---

## 2. Core product invariants

These are product invariants. Do not change them without an explicit architecture/product decision.

### 2.1 Single creator

```txt
One creator.
One official channel.
One catalog.
```

The historical `Creator` model may exist in the database, but it is treated as a technical representation of the main channel.

Do not redesign the system toward multi-creator SaaS.

Do not rename `Creator -> Channel` in Prisma without a separate certified migration plan.

### 2.2 Video access tiers

Every video has exactly one access tier:

```txt
PUBLIC
LOGGED_IN
PATRON
```

Rules:

```txt
PUBLIC:
  everyone can watch
  everyone can read comments
  logged-in users can comment

LOGGED_IN:
  guests can see that the video exists
  guests cannot play
  logged-in users can play
  logged-in users can comment

PATRON:
  everyone can see that the video exists
  everyone can read comments
  only patron/admin can play
  only patron/admin can comment
```

Important:

```txt
Comment visibility != comment permission.
```

### 2.3 Subscription is not Patron

```txt
Subscription != Patron
```

Subscription means:

```txt
mailing / follow / notifications / interest in content
```

Subscription does not mean:

```txt
patron access
payment
premium access
video access
donation
active paid subscription
```

Unsubscribing from mailing must never remove patron access.

### 2.4 Patron access source of truth

Target invariant:

```txt
Patron access = exists ACTIVE PatronGrant.
```

Not:

```txt
User.isPatron
Clerk metadata
Subscription
Payment alone
Stripe state alone
frontend state
```

Payments, referrals, admin actions, migrations, or system processes may create PatronGrants only through explicit domain use cases.

### 2.5 Payment is money, PatronGrant is access

```txt
Payment is money.
PatronGrant is access.
```

Stripe never grants patron access directly.

Correct model:

```txt
Stripe webhook
  -> Payments module records financial fact
  -> Patron eligibility policy evaluates it
  -> Patron module creates PatronGrant
  -> Access module reads active PatronGrant
```

Wrong model:

```txt
Stripe webhook
  -> user.isPatron = true
```

### 2.6 Locked video rendering

Locked video is not a video with an overlay.

Correct model:

```txt
allowed PlaybackPlan -> player
denied PlaybackPlan -> locked placeholder
```

For locked states:

```txt
do not mount real player
do not fetch stream
do not request playback token
do not call provider for playback source
do not count playback/view events
```

---

## 3. Architecture direction

The active architecture is a **modular monolith**.

Target flow:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Routes may:

```txt
authenticate
parse input
create AppContext
call public module API
map result to HTTP response
```

Routes must not:

```txt
import @/lib/prisma directly
import @/lib/services/** directly
import module internals instead of module index
contain business logic
decide patron/payment/access locally
perform large DTO mapping locally
```

Allowed route import style:

```ts
import { handleStripeWebhook } from "@/lib/modules/payments";
```

Forbidden route import style:

```ts
import { HandleStripeWebhookUseCase } from "@/lib/modules/payments/application/handle-stripe-webhook.use-case";
```

Modules must expose public API through:

```txt
lib/modules/<module>/index.ts
```

---

## 4. Source of truth hierarchy

When files disagree, agents must use this order:

```txt
1. actual code on current main
2. README.md current control state
3. docs/roadmap/Active-Execution-Roadmap.md
4. docs/audit/**
5. docs/roadmap/lanes/**
6. docs/architecture/Product-Architecture-Blueprint.md
7. PR body / agent report
```

The architecture blueprint is target direction, not proof that runtime is already migrated.

Important:

```txt
Target architecture != current implementation.
```

Agents must never implement a future blueprint section unless the active ticket explicitly asks for it.

---

## 5. Operating mode after Fazes R

This README is designed for the **Post-R AI Delivery Control Plane**.

Activation condition:

```txt
Use this README after the R-phase foundation has been reconciled and the repo is ready to move from sequential roadmap execution to lane-based AI delivery.
```

If R10/R11 are not fully certified yet, use this README only as a migration draft.

Current operating assumption after activation:

```txt
README = control panel
AGENTS.md = permanent agent rules
docs/architecture/Product-Architecture-Blueprint.md = target product/architecture
docs/roadmap/Active-Execution-Roadmap.md = active execution queue
docs/roadmap/lanes/** = domain mini-roadmaps
docs/tickets/** = atomic tasks for builders
docs/reports/** = PR/review/certification reports
```

---

## 6. AI delivery model

Polutek.pl is built by several AI roles under human merge authority.

### 6.1 Human owner

The human owner:

```txt
chooses priorities
accepts product decisions
approves risk
merges PRs
rejects unclear work
does not need to watch agents code line by line
```

### 6.2 Planner AI

Planner AI:

```txt
reads current state
chooses next ticket or batch
splits work into small independent tasks
updates tickets or lane plans when asked
does not code
does not merge
does not rewrite README without explicit task
```

### 6.3 Builder AI

Builder AI:

```txt
implements exactly one ticket
works on a branch
keeps diff minimal
does not expand scope
does not edit README
does not edit global roadmap files unless ticket explicitly allows it
reports changed files and validation output
```

### 6.4 Reviewer AI

Reviewer AI:

```txt
reviews PR diff
checks scope creep
checks architecture rules
checks tests and validation
checks forbidden files
returns MERGE / FIX / REJECT
does not rewrite the PR
```

### 6.5 Integrator AI

Integrator AI:

```txt
runs reconciliation after one or more merged PRs
updates README only when explicitly assigned
updates Active-Execution-Roadmap
moves tickets between ready/active/done/blocked
updates docs/audit when needed
prepares certification reports
```

### 6.6 Certifier AI

Certifier AI:

```txt
verifies a phase or lane
checks code vs docs
checks guards
checks tests
checks stale allowlists
writes certification report
recommends whether to mark a phase/lane done
```

---

## 7. Global single-writer files

These files are high-conflict files.

Only one agent may edit them at a time, usually Integrator or Certifier.

```txt
README.md
AGENTS.md
docs/roadmap/Active-Execution-Roadmap.md
docs/roadmap/Parallel-Work-Matrix.md
docs/roadmap/Phase-Gates.md
scripts/check-architecture.ts
prisma/schema.prisma
package.json
package-lock.json
```

Builder agents must not edit these files unless the ticket explicitly says so.

If a ticket touches `prisma/schema.prisma`, it is a **schema-locked task**.

Schema-locked tasks must not run in parallel with other tasks that touch database models, repositories, payments, access, video assets, or tests depending on changed schema.

---

## 8. Parallel work model

Polutek.pl uses lane-based parallel work.

Each lane owns a domain.

Example lanes:

```txt
cleanup-legacy
payments-patron
access
video-provider
playback-player
admin-cockpit
comments
email-subscriptions
```

A builder may work only inside the lane assigned by the ticket.

Agents must check:

```txt
docs/roadmap/Parallel-Work-Matrix.md
```

before assuming a task is safe to run in parallel.

Default rule:

```txt
If two tasks touch the same route, module, Prisma model, guard file, global doc, or test suite, do not run them in parallel.
```

Safe parallel work usually means different lanes and no shared files.

Serial-only work includes:

```txt
README updates
global roadmap updates
architecture guard updates
Prisma schema changes
package-lock changes
final certification
large reconcile passes
```

---

## 9. Ticket system

Agents do not take work directly from the blueprint.

Agents take work from:

```txt
docs/tickets/ready/
```

A ticket must define:

```txt
ID
Status
Lane
Type
Goal
Scope
Allowed paths
Forbidden paths
Required changes
Validation
Definition of done
Expected PR report
Parallel safety
```

Ticket lifecycle:

```txt
ready -> active -> done
ready -> active -> blocked
blocked -> ready
```

Builder agents may create follow-up ticket suggestions in PR body, but they must not silently create broad new work.

Only Planner or Integrator may promote follow-up suggestions into real ticket files.

---

## 10. PR protocol

Every builder PR must include:

```txt
Summary
Ticket ID
Lane
Changed files
What changed
What did not change
Validation run
Validation not run, if any
Risk level
Follow-up suggestions
Merge recommendation
```

A PR should be rejected or sent back for fix if:

```txt
it changes files outside the ticket scope
it updates README without permission
it edits global roadmap files without permission
it mixes docs and runtime without permission
it touches unrelated domains
it changes product policy without explicit approval
it weakens guards
it hides failing tests
it treats blueprint target as current implementation
```

---

## 11. Validation commands

Default validation:

```bash
npm run quality
```

This includes:

```txt
architecture boundaries
typecheck
unit test run
```

Useful lower-level commands:

```bash
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
npm run db:validate
npm run env:validate
```

Agents must report exactly which validation commands were run.

If validation is not run, the PR body must say:

```txt
Validation: NOT RUN
Reason: <reason>
Risk: <impact>
```

Do not claim certification without validation.

---

## 12. Current R-phase handoff state

This section must be updated by an Integrator after R-phase completion.

Expected handoff shape:

```txt
R0-R9: certified or foundation-complete according to final R-phase docs
R10: final cleanup/certification completed or explicitly listed as remaining
R11: completed, deferred, or split into Post-R admin cockpit lane
Post-R control plane: active
```

Before activating the Post-R roadmap, the Integrator must verify:

```txt
README reflects current main
docs/audit reflects current main
architecture guards reflect current main
stale allowlists are removed or documented
notatka has been moved or copied into Product-Architecture-Blueprint.md
Active-Execution-Roadmap exists
Parallel-Work-Matrix exists
Phase-Gates exists
AGENTS.md exists
ticket folders exist
```

Do not mark this README as active if the old R-phase README is still the operational source of truth.

---

## 13. Post-R strategic roadmap

The detailed roadmap is in:

```txt
docs/roadmap/Active-Execution-Roadmap.md
```

The expected post-R order is:

```txt
X0 — Truth Reconciliation
X1 — Payments / Patron Safety
X2 — Access / Patron Hard Reset
X3 — Video Provider Foundation
X4 — PlaybackPlan / Player Simplification
X5 — Admin Cockpit Foundation
X6 — Product Excellence Passes
```

This README does not contain the full task list.

The active task list must live in ticket files.

---

## 14. Post-R phase definitions

### X0 — Truth Reconciliation

Goal:

```txt
Make code, docs, guards, roadmap, and blueprint agree.
```

Allowed:

```txt
docs
inventories
guard checks
ticket creation
roadmap setup
```

Forbidden unless explicit:

```txt
runtime behavior changes
schema changes
player changes
payments behavior changes
access behavior changes
```

Done when:

```txt
README is truthful
blueprint is clearly target-only
active roadmap exists
parallel matrix exists
phase gates exist
ticket system exists
guards do not lie
```

### X1 — Payments / Patron Safety

Goal:

```txt
Make payments safe before deeper access reset.
```

Core rules:

```txt
Payment is money.
PatronGrant is access.
Stripe does not directly grant patron status.
Webhook processing is idempotent.
Refund/dispute affects related grants.
```

Done when:

```txt
eligible successful payment creates PatronGrant through domain use case
below-minimum payment creates no grant
duplicate webhook creates no duplicate grant
full refund revokes related grant
dispute suspends related grant
dispute resolution updates related grant
tests cover the lifecycle
```

### X2 — Access / Patron Hard Reset

Goal:

```txt
Make Access module the only backend source of access decisions.
```

Core rules:

```txt
Access reads active PatronGrant.
Backend ignores User.isPatron for access decisions.
Clerk metadata is UI/cache only.
Subscriptions never grant access.
```

Done when:

```txt
PUBLIC / LOGGED_IN / PATRON access tests pass
comments permission tests pass
backend access ignores User.isPatron
migration plan for removing User.isPatron exists
admin diagnostics exposes mismatches
```

### X3 — Video Provider Foundation

Goal:

```txt
Prepare provider-agnostic video without building a giant provider framework.
```

Core rules:

```txt
thin VideoProvider interface
Mux and Cloudflare are candidates
R2/S3 are legacy/migration only
provider is called only after access is allowed
VideoAsset owns provider-specific IDs
```

Done when:

```txt
VideoAsset model and provider strategy are clear
upload session flow exists
provider webhook handling is modular
primary READY asset is the playback source
no active R2/S3 fallback is introduced
```

### X4 — PlaybackPlan / Player Simplification

Goal:

```txt
Make player render backend PlaybackPlan instead of inventing access.
```

Core rules:

```txt
allowed PlaybackPlan renders player
denied PlaybackPlan renders placeholder
denied PlaybackPlan has no token
denied PlaybackPlan has no playback URL
locked state does not mount player
```

Done when:

```txt
player uses PlaybackPlan
locked login/patron/processing/error states exist
tracking runs only for real playback
tests prove denied plan does not mount/request source
```

### X5 — Admin Cockpit Foundation

Goal:

```txt
Build admin cockpit around real operational needs.
```

Priority:

```txt
Access Diagnostics first.
Generic dashboard second.
```

Admin should see:

```txt
user identity
PatronGrant history
payment/refund/dispute lifecycle
mailing subscription status
DB vs Clerk mismatch
final access decision
why user can/cannot access video
recent audit events
```

Done when:

```txt
admin can diagnose access problems without database access
patron/payment/access state is visible
corrective actions are auditable
```

### X6 — Product Excellence Passes

Goal:

```txt
Improve UX, performance, accessibility, and admin quality after core safety is done.
```

Allowed only after:

```txt
access is safe
payments are safe
player is simplified
admin diagnostics exists
```

---

## 15. Do not do

Do not:

```txt
turn Polutek.pl into multi-creator SaaS
mix Subscription with Patron
call patron support a recurring subscription unless product decision changes
grant access from Clerk metadata
grant access from User.isPatron
grant access directly from Stripe
mount player for locked content
generate playback token for locked content
call provider for denied access
use R2/S3 as active playback fallback
build a giant multi-provider framework
make one huge mega-refactor PR
mix unrelated lanes
let builders update README
let many agents edit global roadmap files
trust stale allowlists
believe a module folder means runtime migration is complete
```

---

## 16. How to start a new agent task

Use this process:

```txt
1. Pick a ticket from docs/tickets/ready/
2. Confirm no active conflicting ticket exists
3. Confirm lane in Parallel-Work-Matrix
4. Give the ticket file to Builder AI
5. Builder opens PR
6. Reviewer AI reviews PR
7. Human merges only if verdict is MERGE
8. Integrator updates roadmap/docs after batch
```

Do not ask an agent:

```txt
Improve the project.
Continue the roadmap.
Implement the blueprint.
Clean up everything.
```

Ask:

```txt
Start from current main.

Implement ticket:
docs/tickets/ready/<ticket-id>.md

Follow AGENTS.md.

Do not modify files outside allowed paths.

Return PR with required report.
```

---

## 17. Merge rule

The human owner is the merge authority.

AI may recommend:

```txt
MERGE
FIX
REJECT
BLOCKED
```

Only the human merges.

No PR is considered complete just because it exists.

No phase is considered complete just because a PR body says so.

Completion requires:

```txt
merged code
passing validation or documented exception
updated source-of-truth docs when needed
no stale guard/allowlist lies
post-merge sanity where appropriate
```

---

## 18. Final rule

Polutek.pl should be built like a calm engineering system, not like a chaotic AI experiment.

The desired flow is:

```txt
Planner creates small tickets.
Builders implement isolated PRs.
Reviewers check them.
Integrator reconciles truth.
Certifier closes phases.
Human merges.
```

The project should become boring in the best way:

```txt
small tickets
small diffs
clear reports
few conflicts
safe parallel work
fast merges
no guessing
```
