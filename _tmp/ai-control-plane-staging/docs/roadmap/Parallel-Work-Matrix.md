# Parallel Work Matrix

## 0. Purpose

This file defines which Polutek.pl workstreams can run in parallel and which must be serialized.

It exists to prevent:

```txt
README conflicts
roadmap conflicts
Prisma schema conflicts
package-lock conflicts
guard conflicts
multiple agents editing the same route/module
multiple agents changing the same product rule
agents accidentally implementing future blueprint work
```

This file must be checked before starting more than one Builder agent.

Related files:

```txt
README.md
AGENTS.md
docs/roadmap/Active-Execution-Roadmap.md
docs/roadmap/Phase-Gates.md
docs/roadmap/lanes/**
docs/tickets/**
```

---

## 1. Core rule

Default rule:

```txt
If two tasks may touch the same file family, do not run them in parallel.
```

File family means:

```txt
same route group
same module
same Prisma model
same test suite area
same global doc
same architecture guard
same package/dependency file
same migration path
```

When uncertain, treat work as serial.

---

## 2. Parallel safety levels

Use these labels in tickets.

### SAFE

Can usually run in parallel with unrelated lanes.

Requirements:

```txt
different domain
different files
no schema changes
no package-lock changes
no global docs
no architecture guard changes
no shared tests
```

### CAUTION

May run in parallel only after checking allowed/forbidden paths.

Risk factors:

```txt
shared module boundary
shared use-case
shared route contract
shared tests
shared docs/audit
possible product-policy interaction
```

### SERIAL

Must not run in parallel with related work.

Serial work includes:

```txt
README updates
global roadmap updates
AGENTS.md updates
Prisma schema changes
architecture guard changes
package-lock changes
phase certification
large reconciliation
access policy changes
payment fulfillment changes
provider playback security changes
```

### BLOCKED

Cannot start until a dependency is complete.

Blocked work must state:

```txt
blocked by
why blocked
unblock condition
safe next step
```

---

## 3. Single-writer files

These files must be edited by only one agent at a time.

Builder agents must not edit them unless the ticket explicitly allows it.

| File / path                                           | Default owner          |    Parallel mode | Reason                           |
| ----------------------------------------------------- | ---------------------- | ---------------: | -------------------------------- |
| `README.md`                                           | Integrator             |           SERIAL | global control panel             |
| `AGENTS.md`                                           | Integrator / Architect |           SERIAL | global agent contract            |
| `docs/roadmap/Active-Execution-Roadmap.md`            | Planner / Integrator   |           SERIAL | active source of execution truth |
| `docs/roadmap/Parallel-Work-Matrix.md`                | Planner / Integrator   |           SERIAL | controls parallel work           |
| `docs/roadmap/Phase-Gates.md`                         | Planner / Certifier    |           SERIAL | controls phase certification     |
| `docs/architecture/Product-Architecture-Blueprint.md` | Architect / Integrator |           SERIAL | target architecture source       |
| `docs/audit/**`                                       | Integrator / Certifier | CAUTION / SERIAL | current-state inventory          |
| `scripts/check-architecture.ts`                       | Guard task / Certifier |           SERIAL | architecture boundary gate       |
| `prisma/schema.prisma`                                | Schema-locked task     |           SERIAL | DB contract                      |
| `prisma/migrations/**`                                | Schema-locked task     |           SERIAL | DB migration history             |
| `package.json`                                        | Dependency/CI task     |           SERIAL | dependency contract              |
| `package-lock.json`                                   | Dependency/CI task     |           SERIAL | CI/install stability             |
| `.env*` examples / validation docs                    | Env task               |           SERIAL | deployment safety                |

Rule:

```txt
If a task needs a single-writer file but the ticket does not explicitly allow it, stop and report BLOCKED.
```

---

## 4. Lane overview

Post-R work is divided into lanes.

| Lane                | Main file                     | Default parallel safety | Notes                                           |
| ------------------- | ----------------------------- | ----------------------: | ----------------------------------------------- |
| cleanup-legacy      | `LANE-cleanup-legacy.md`      |                 CAUTION | touches old services and route cleanup          |
| payments-patron     | `LANE-payments-patron.md`     |                 CAUTION | high product/security impact                    |
| access              | `LANE-access.md`              |        SERIAL / CAUTION | central dependency for patron, player, comments |
| video-provider      | `LANE-video-provider.md`      |                 CAUTION | touches media, provider, assets                 |
| playback-player     | `LANE-playback-player.md`     |                 CAUTION | depends on access/provider contracts            |
| admin-cockpit       | `LANE-admin-cockpit.md`       |                 CAUTION | depends on access/payment/comments              |
| comments            | `LANE-comments.md`            |                 CAUTION | shares access permission rules                  |
| email-subscriptions | `LANE-email-subscriptions.md` |          SAFE / CAUTION | safest when separated from patron access        |
| docs-reconciliation | roadmap/audit/report files    |                  SERIAL | global truth                                    |
| guard-certification | guards/reports                |                  SERIAL | gates and allowlists                            |

---

## 5. Lane compatibility matrix

Legend:

```txt
✅ SAFE
⚠️ CAUTION
⛔ SERIAL / DO NOT PARALLELIZE
🔒 BLOCKED UNTIL DEPENDENCY
```

| Lane A \ Lane B     | cleanup | payments | access | video | player | admin | comments | email |
| ------------------- | ------: | -------: | -----: | ----: | -----: | ----: | -------: | ----: |
| cleanup-legacy      |       ⛔ |       ⚠️ |     ⚠️ |    ⚠️ |      ✅ |    ⚠️ |       ⚠️ |     ✅ |
| payments-patron     |      ⚠️ |        ⛔ |      ⛔ |     ✅ |      ✅ |    ⚠️ |        ✅ |    ⚠️ |
| access              |      ⚠️ |        ⛔ |      ⛔ |    ⚠️ |      ⛔ |    ⚠️ |        ⛔ |    ⚠️ |
| video-provider      |      ⚠️ |        ✅ |     ⚠️ |     ⛔ |      ⛔ |    ⚠️ |        ✅ |     ✅ |
| playback-player     |       ✅ |        ✅ |      ⛔ |     ⛔ |      ⛔ |    ⚠️ |       ⚠️ |     ✅ |
| admin-cockpit       |      ⚠️ |       ⚠️ |     ⚠️ |    ⚠️ |     ⚠️ |     ⛔ |       ⚠️ |    ⚠️ |
| comments            |      ⚠️ |        ✅ |      ⛔ |     ✅ |     ⚠️ |    ⚠️ |        ⛔ |     ✅ |
| email-subscriptions |       ✅ |       ⚠️ |     ⚠️ |     ✅ |      ✅ |    ⚠️ |        ✅ |     ⛔ |

This matrix is a default guide.

The actual ticket paths override this table.

If two tickets touch the same files, they are serial even if this matrix says SAFE.

---

## 6. Safe parallel examples

These can often run in parallel.

### Example A

```txt
Agent 1:
  Lane: email-subscriptions
  Task: email template UI copy cleanup
  Files: lib/modules/email/**, app/api/admin/emails/**

Agent 2:
  Lane: cleanup-legacy
  Task: dead service inventory only
  Files: docs/audit/** or docs/reports/**

Parallel verdict:
  SAFE if no shared docs/global files
```

### Example B

```txt
Agent 1:
  Lane: comments
  Task: admin comment hide route modularization
  Files: app/api/admin/comments/[commentId]/hide/**, lib/modules/comments/**

Agent 2:
  Lane: video-provider
  Task: provider interface docs/spec only
  Files: docs/roadmap/lanes/LANE-video-provider.md or docs/tickets/**

Parallel verdict:
  SAFE/CAUTION if Agent 2 is docs-only and not editing global docs
```

### Example C

```txt
Agent 1:
  Lane: payments-patron
  Task: inventory payment side effects
  Files: docs/reports/pr-reports/**

Agent 2:
  Lane: playback-player
  Task: player locked-state UI inventory
  Files: docs/reports/pr-reports/** with separate report file

Parallel verdict:
  SAFE if each writes a separate report file
```

---

## 7. Dangerous parallel examples

Do not run these in parallel.

### Example A — Access + comments permission

```txt
Agent 1:
  Lane: access
  Task: change canCommentOnVideo policy

Agent 2:
  Lane: comments
  Task: migrate comments route permission checks

Parallel verdict:
  SERIAL
```

Reason:

```txt
Both depend on the same permission contract.
Merge order matters.
Tests may become invalid mid-flight.
```

### Example B — Payments + patron access

```txt
Agent 1:
  Lane: payments-patron
  Task: payment creates PatronGrant

Agent 2:
  Lane: access
  Task: Access reads PatronGrant

Parallel verdict:
  SERIAL or carefully sequenced with explicit contracts
```

Reason:

```txt
Both define patron source of truth.
Bad merge order can create false access behavior.
```

### Example C — Video provider + player

```txt
Agent 1:
  Lane: video-provider
  Task: provider createPlaybackSource API

Agent 2:
  Lane: playback-player
  Task: PlaybackPlan consumes playback source

Parallel verdict:
  SERIAL unless interface contract is already frozen
```

Reason:

```txt
Player and provider share PlaybackPlan/source contract.
```

### Example D — Two docs agents editing roadmap

```txt
Agent 1:
  edits Active-Execution-Roadmap.md

Agent 2:
  edits Active-Execution-Roadmap.md

Parallel verdict:
  SERIAL
```

Reason:

```txt
Guaranteed merge conflict / source-of-truth drift.
```

### Example E — Prisma schema + any runtime work

```txt
Agent 1:
  edits prisma/schema.prisma

Agent 2:
  edits repositories/tests using affected models

Parallel verdict:
  SERIAL
```

Reason:

```txt
Generated types, DB contract, tests, and runtime behavior are unstable until schema task lands.
```

---

## 8. Work type matrix

| Work type                      |  Parallel mode | Notes                                    |
| ------------------------------ | -------------: | ---------------------------------------- |
| docs-only, separate file       |           SAFE | if not global source-of-truth file       |
| docs-only, global roadmap      |         SERIAL | one Integrator only                      |
| ticket file creation           | SAFE / CAUTION | safe if separate ticket files            |
| lane file update               |        CAUTION | one agent per lane                       |
| route modularization           |        CAUTION | serial if same module/route family       |
| use-case extraction            |        CAUTION | serial within same module                |
| repository extraction          |        CAUTION | serial within same module/model          |
| policy change                  |         SERIAL | especially access/payment/comment policy |
| unit tests for isolated module | SAFE / CAUTION | avoid shared test files                  |
| architecture guard update      |         SERIAL | affects whole repo                       |
| Prisma schema change           |         SERIAL | always schema-locked                     |
| package update                 |         SERIAL | dependency-locked                        |
| package-lock fix               |         SERIAL | CI/install-locked                        |
| README update                  |         SERIAL | Integrator only                          |
| certification                  |         SERIAL | Certifier only                           |
| reconciliation                 |         SERIAL | Integrator only                          |

---

## 9. File-family rules

### 9.1 Route family

Routes under the same feature should be treated as one family.

Examples:

```txt
app/api/admin/comments/**
app/api/comments/**
app/api/webhooks/stripe/**
app/api/admin/payments/**
app/api/media/**
app/api/media-source/**
app/api/videos/**
```

Two agents should not edit the same route family in parallel.

### 9.2 Module family

Modules are file families.

Examples:

```txt
lib/modules/access/**
lib/modules/payments/**
lib/modules/patron/**
lib/modules/comments/**
lib/modules/media/**
lib/modules/video/**
lib/modules/email/**
lib/modules/subscriptions/**
```

Two agents should not edit the same module family in parallel unless one is docs-only or test-only and the ticket explicitly allows it.

### 9.3 Legacy service family

Legacy service cleanup is high-collision.

Examples:

```txt
lib/services/**
```

Do not let one agent delete a legacy service while another agent migrates a route that still imports it.

Correct sequence:

```txt
1. inventory usage
2. migrate runtime usage
3. tests
4. delete service
5. guard/audit reconciliation
```

### 9.4 Test family

Test files can conflict even if runtime files do not.

Examples:

```txt
tests/unit/modules/access/**
tests/unit/modules/payments/**
tests/unit/modules/comments/**
tests/unit/api-*.test.ts
tests/unit/*route*.test.ts
```

If two tasks update the same test file, they are serial.

Prefer creating focused new test files when possible.

---

## 10. Phase-specific parallel rules

### X0 — Control Plane & Truth Reconciliation

Default:

```txt
SERIAL for global docs
SAFE for separate lane/ticket/template files
```

Can parallelize:

```txt
one agent writes LANE-payments-patron.md
one agent writes LANE-video-provider.md
one agent writes LANE-comments.md
```

Do not parallelize:

```txt
README.md
AGENTS.md
Active-Execution-Roadmap.md
Parallel-Work-Matrix.md
Phase-Gates.md
Product-Architecture-Blueprint.md
```

### X1 — Payments / Patron Safety

Default:

```txt
CAUTION / SERIAL
```

Can parallelize only with unrelated lanes, e.g.:

```txt
email-subscriptions docs-only
video-provider inventory-only
comments UI inventory-only
```

Do not parallelize within:

```txt
Stripe webhook
Payment model
PatronGrant lifecycle
refund/dispute lifecycle
patron source-of-truth
```

### X2 — Access / Patron Hard Reset

Default:

```txt
SERIAL for core access policy
CAUTION for consumers
```

Do not run in parallel with:

```txt
comments permission migration
player access behavior
admin diagnostics access decisions
payment patron-grant behavior
User.isPatron schema removal
```

unless an explicit contract ticket has landed.

### X3 — Video Provider Foundation

Default:

```txt
CAUTION
```

Can parallelize with:

```txt
email/subscription work
comments moderation work
admin non-video docs/spec work
```

Do not parallelize with:

```txt
player PlaybackPlan consumption
media-source route behavior
provider source creation
VideoAsset schema work
```

### X4 — PlaybackPlan / Player Simplification

Default:

```txt
CAUTION / SERIAL around PlaybackPlan contract
```

Can parallelize with:

```txt
email work
some admin UI shell work
docs-only work
```

Do not parallelize with:

```txt
Access policy changes
provider playback source changes
media-source route changes
tracking semantics changes
```

### X5 — Admin Cockpit Foundation

Default:

```txt
CAUTION
```

Admin cockpit touches many lanes.

Use separate tickets for:

```txt
access diagnostics
patron grants
payments/refunds/disputes
comments moderation
subscribers
emails
video provider health
audit log
system health
```

Do not let two agents edit the same admin page or diagnostic use case.

### X6 — Product Excellence

Default:

```txt
SAFE / CAUTION
```

Can parallelize many UX polish passes if core safety is certified.

Still serial for:

```txt
player access behavior
payment language
patron/subscription terminology
global UX copy rules
```

---

## 11. Conflict prevention checklist

Before starting a Builder agent, answer:

```txt
1. What ticket file is it implementing?
2. What lane owns the ticket?
3. What files are allowed?
4. What files are forbidden?
5. Is any active PR touching the same file family?
6. Does it touch a single-writer file?
7. Does it touch Prisma schema?
8. Does it touch package-lock?
9. Does it change product policy?
10. Does it require a prior interface/contract ticket?
```

If any answer is unclear, do not start Builder.
Run Planner first.

---

## 12. Maximum parallelism

Default maximum:

```txt
2 Builder agents at once
```

Allowed maximum after control plane is stable:

```txt
3 Builder agents at once
```

Use 1 Builder only for:

```txt
payments/patron lifecycle
access hard reset
Prisma schema
provider playback security
player locked-state contract
global docs
guards
certification
```

Suggested safe batch shape:

```txt
1 medium-risk runtime Builder
1 low-risk docs/inventory Builder
1 Reviewer/Integrator
```

Avoid:

```txt
3 runtime Builders in related lanes
```

---

## 13. Merge order rules

When multiple PRs are ready, merge in this order:

```txt
1. contract/spec PRs
2. inventory PRs
3. low-risk isolated runtime PRs
4. tests/guard PRs
5. docs reconciliation PRs
6. certification PRs
```

Do not merge consumers before providers.

Examples:

```txt
Merge Access policy contract before comments permission migration.
Merge VideoProvider interface before player consuming provider source.
Merge PatronGrant creation use-case before Access relies on PatronGrant only.
```

---

## 14. Rebase / conflict rule

If a PR conflicts after another merge:

```txt
Do not manually resolve broadly.
Ask the same Builder to rebase/fix only conflicts.
Then run Reviewer again.
```

If conflict touches global docs:

```txt
Prefer closing/replacing the docs PR with a fresh Integrator reconciliation PR.
```

If conflict touches schema:

```txt
Stop all related runtime work.
Resolve schema branch first.
Regenerate Prisma.
Re-run validation.
Then restart dependent work.
```

---

## 15. Ticket metadata requirement

Every ticket must include:

```txt
Parallel safety: SAFE / CAUTION / SERIAL / BLOCKED
Conflicts with:
Can run with:
Single-writer files touched:
Schema locked: yes/no
Package locked: yes/no
Guard touched: yes/no
```

Example:

```txt
Parallel safety: CAUTION
Conflicts with:
- any access policy task
- any comments permission task

Can run with:
- email-subscriptions docs-only work
- video-provider inventory-only work

Single-writer files touched:
- none

Schema locked: no
Package locked: no
Guard touched: no
```

---

## 16. Reviewer parallel-safety check

Reviewer must check:

```txt
Did the PR touch files outside allowed paths?
Did it touch single-writer files without permission?
Did it create new conflicts with active PRs?
Did it alter shared contracts?
Did it change product policy?
Did it update docs in a way that will conflict with Integrator?
```

If the PR violates parallel-safety rules, Reviewer should return:

```txt
FIX
```

or:

```txt
REJECT
```

depending on severity.

---

## 17. Integrator responsibilities

Integrator must keep the matrix honest.

After a batch, Integrator should update:

```txt
Active-Execution-Roadmap.md
lane files if status changed
tickets ready/active/done/blocked
reports/reconciliation
audit docs if inventory changed
this matrix if a new conflict pattern appears
```

Integrator should not edit runtime code during reconciliation unless explicitly assigned.

---

## 18. Certifier responsibilities

Certifier must verify that a lane or phase is actually safe.

Certifier checks:

```txt
merged code on main
validation output
architecture guards
docs/audit
ticket statuses
known blockers
stale allowlists
parallel-safety assumptions
```

Certification is serial.

Do not certify while related Builder PRs are active.

---

## 19. Emergency stop conditions

Stop parallel work if any of these happen:

```txt
Prisma schema conflict
package-lock conflict
architecture guard disagreement
README/source-of-truth drift
two agents changed access policy differently
payment/patron behavior becomes ambiguous
player/provider source contract changes unexpectedly
tests fail in shared area
security invariant is violated
```

Emergency response:

```txt
1. stop new Builder tasks
2. finish or close conflicting PRs
3. run Integrator reconciliation
4. run Certifier if needed
5. restart from updated tickets
```

---

## 20. Golden rule

Parallel work is allowed only when it reduces total risk.

If parallel work creates confusion, go serial.

The goal is not maximum concurrency.

The goal is:

```txt
safe velocity
small PRs
few conflicts
clear ownership
boring merges
```
