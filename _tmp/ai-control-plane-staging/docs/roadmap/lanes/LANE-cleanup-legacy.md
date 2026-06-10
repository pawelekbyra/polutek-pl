# LANE-cleanup-legacy

## 0. Purpose

This lane owns legacy cleanup after the R-phase refactor.

It exists to remove or reconcile:

```txt
direct Prisma imports in routes
route-local business logic
legacy lib/services/** usage from routes
stale allowlists
stale audit inventories
dead service candidates
README/docs drift
guard drift
old R-phase leftovers
```

This lane is not a product-feature lane.

It prepares the system so later lanes can safely build:

```txt
payments/patron safety
access hard reset
video provider foundation
PlaybackPlan/player simplification
admin cockpit
product excellence
```

Core rule:

```txt
Do not build premium VOD on top of legacy glue.
```

---

## 1. Lane identity

Lane ID:

```txt
cleanup-legacy
```

Primary phase:

```txt
X0 — Control Plane & Truth Reconciliation
```

Also supports:

```txt
X1-X6 as needed for cleanup and reconciliation
```

Primary owner roles:

```txt
Integrator
Certifier
Builder for small scoped cleanup tickets
```

Parallel safety:

```txt
CAUTION
```

Reason:

```txt
Legacy cleanup may touch files used by many lanes.
Dead-service deletion can break active runtime work.
Guard/audit updates are global.
```

---

## 2. Source of truth

Use this order:

```txt
1. actual code on current main
2. README.md
3. docs/audit/**
4. scripts/check-architecture.ts
5. docs/roadmap/Active-Execution-Roadmap.md
6. this lane file
7. Product-Architecture-Blueprint.md
```

This lane must never assume a service is dead because a blueprint says so.

A service is dead only after:

```txt
inventory
usage search
tests
runtime migration or proof of no runtime usage
safe deletion PR
post-merge validation
```

---

## 3. Current handoff assumptions

This lane assumes the R-phase refactor has reduced most direct route/database coupling.

Expected current state near handoff:

```txt
most R0-R9 foundations are complete or certified
R10 direct Prisma inventory is near zero
some allowlists may still be stale
some legacy services may remain
some admin/comment/media leftovers may remain
README may need reconciliation
notatka/blueprint may need to be moved into docs/architecture
```

Do not trust these assumptions blindly.

The first cleanup tickets must verify current main.

---

## 4. Lane goals

### Goal 1 — Zero direct Prisma imports in routes

Target:

```txt
app/api/**/route.ts should not import @/lib/prisma directly.
```

Allowed exception:

```txt
Only temporary documented allowlist entries with owner, reason, phase, and removal condition.
```

Final target:

```txt
PRISMA_ROUTES_ALLOWLIST is empty or contains only explicitly accepted temporary blockers.
```

### Goal 2 — No legacy services in routes

Target:

```txt
app/api/**/route.ts should not import @/lib/services/** directly.
```

Routes should call public module APIs.

### Goal 3 — Thin routes

Target:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Routes may:

```txt
authenticate
parse input
create AppContext
call module API
map result to HTTP
```

Routes must not:

```txt
perform business decisions
query database directly
own access/patron/payment/media/comment rules
import module internals
```

### Goal 4 — Honest guards

Architecture guards must reflect current main.

Do not keep allowlists for violations that no longer exist.

Do not add broad allowlists to make CI green.

### Goal 5 — Honest docs

Docs must not claim cleanup is complete unless code and guards prove it.

Current-state docs must be conservative.

### Goal 6 — Dead service cleanup

Legacy services may be deleted only after usage is proven absent or runtime has been migrated.

Do not delete legacy services first.

Correct sequence:

```txt
inventory -> migrate runtime -> tests -> delete -> guard/audit reconciliation
```

---

## 5. Owned paths

This lane may own or edit these paths when the ticket explicitly allows them.

### Audit and reports

```txt
docs/audit/**
docs/reports/reconciliation/**
docs/reports/certification/**
```

### Guard files

```txt
scripts/check-architecture.ts
```

Guard files are single-writer.

Only guard-specific tickets may edit them.

### Legacy services

```txt
lib/services/**
```

Deletion or modification requires inventory.

### Route cleanup targets

```txt
app/api/**
```

Only route files listed in a ticket may be edited.

### Module migration targets

```txt
lib/modules/**
```

Only module files listed in a ticket may be edited.

### Test targets

```txt
tests/unit/**
tests/integration/**
```

Only relevant tests may be edited.

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
prisma/schema.prisma
package.json
package-lock.json
```

unless the ticket explicitly allows it.

This lane must not change product behavior while doing cleanup.

Forbidden unless explicit:

```txt
changing patron access rules
changing payment fulfillment
changing comments visibility
changing video access tiers
changing player locked-state behavior
changing admin permissions
changing provider strategy
```

---

## 7. Parallel safety

Default mode:

```txt
CAUTION
```

This lane can run in parallel with another lane only if:

```txt
it is docs/report-only in separate files
it touches no shared route/module/service
it does not edit guards
it does not edit global docs
it does not delete shared legacy services
```

### Safe-ish parallel examples

```txt
cleanup-legacy inventory report
+
email-subscriptions runtime task
```

Safe only if inventory writes a separate report file and does not edit global docs.

```txt
dead service usage search
+
video-provider docs-only spec
```

Safe only if neither edits shared files.

### Unsafe parallel examples

```txt
cleanup agent deletes lib/services/comments/comment.service.ts
+
comments agent migrates route still importing that service
```

Verdict:

```txt
SERIAL
```

```txt
cleanup agent edits scripts/check-architecture.ts
+
access agent edits scripts/check-architecture.ts
```

Verdict:

```txt
SERIAL
```

```txt
cleanup agent updates README
+
integrator updates README
```

Verdict:

```txt
SERIAL
```

---

## 8. Work types

### 8.1 Inventory

Purpose:

```txt
Find actual current usage before changing code.
```

Allowed:

```txt
search code
write report
suggest tickets
```

Forbidden:

```txt
runtime changes
deleting files
marking cleanup done
```

### 8.2 Route cleanup

Purpose:

```txt
Move a route from direct Prisma/services/business logic to module API.
```

Allowed:

```txt
edit one route family
add/update use case
add/update repository
add/update module index export
add/update focused tests
```

Forbidden:

```txt
touch unrelated routes
change product policy
delete broad services
edit global docs unless ticket allows it
```

### 8.3 Service deletion

Purpose:

```txt
Remove legacy service after it is no longer used.
```

Allowed:

```txt
delete specific service
delete tests that only cover deleted dead service if replaced
update imports/tests
update inventory
```

Forbidden:

```txt
delete multiple unrelated services in one PR
delete service with active imports
delete service because blueprint says it is legacy
```

### 8.4 Guard update

Purpose:

```txt
Make architecture guard match desired current rules.
```

Allowed:

```txt
remove stale allowlist
add specific check
tighten violation detection
update guard tests if they exist
```

Forbidden:

```txt
weaken guard to pass current bad code
add broad allowlist without removal condition
mix guard update with unrelated runtime cleanup
```

### 8.5 Reconciliation

Purpose:

```txt
Make docs/audit/roadmap reflect current main after merged PRs.
```

Allowed:

```txt
docs/audit/**
docs/reports/reconciliation/**
ticket status updates
lane status updates
```

Forbidden:

```txt
runtime changes
schema changes
product changes
```

---

## 9. Initial cleanup sequence

After R-phase handoff, run cleanup in this order.

### CL-0 — Current-state verification

Goal:

```txt
Verify actual main before trusting old README or old audit docs.
```

Checks:

```txt
direct @/lib/prisma imports in app/api/**/route.ts
@/lib/services/** imports in app/api/**/route.ts
internal module imports from routes
known allowlists in scripts/check-architecture.ts
legacy service usage
docs/audit vs code
README vs code
```

Output:

```txt
docs/reports/reconciliation/CL-0-current-state-verification.md
follow-up tickets
```

### CL-1 — Direct Prisma route cleanup

Goal:

```txt
Remove remaining direct Prisma route imports.
```

Known likely target near handoff:

```txt
app/api/media/[...path]/route.ts
```

Do not assume this is still the only target. Verify current main.

Done when:

```txt
no app/api route imports @/lib/prisma directly
PRISMA_ROUTES_ALLOWLIST is empty or only documented temporary blocker remains
quality:architecture-boundaries passes
```

### CL-2 — Admin comments leftovers

Goal:

```txt
Remove admin comments route dependency on legacy comment services.
```

Known likely route family:

```txt
app/api/admin/comments/**
```

Known likely legacy services:

```txt
lib/services/comments/comment.service.ts
lib/services/comments/comment-report.service.ts
lib/services/comments/comment-moderation.service.ts
```

Do not delete services before usage inventory and route migration.

### CL-3 — Dead service candidates

Goal:

```txt
Verify and remove legacy services with no runtime usage.
```

Candidate examples from previous cleanup planning:

```txt
lib/services/user.service.ts
lib/services/patron.service.ts
lib/services/content.visibility.ts
lib/services/user/admin.service.ts
lib/services/user/subscription.service.ts
lib/services/payments/refund.service.ts
lib/services/admin/payments-admin.service.ts
lib/services/comments/comment-reaction.service.ts
lib/services/comments/comment-audit.service.ts
lib/services/comments/comment-access.service.ts
```

These are candidates, not deletion instructions.

Each service needs:

```txt
usage inventory
replacement confirmation
test coverage
single focused deletion ticket
```

### CL-4 — Stale allowlist cleanup

Goal:

```txt
Reduce allowlists after runtime cleanup.
```

Targets:

```txt
PRISMA_ROUTES_ALLOWLIST
KNOWN_ROUTE_VIOLATIONS_ALLOWLIST
other temporary compatibility allowlists
```

Done when:

```txt
allowlists reflect only real current blockers
stale entries are removed
guard passes
docs/audit updated
```

### CL-5 — R-phase final certification

Goal:

```txt
Close the old R-phase cleanup and hand over to Post-R lanes.
```

Output:

```txt
docs/reports/certification/R-phase-final-cleanup-certification.md
```

---

## 10. Suggested first tickets

These tickets should be created under:

```txt
docs/tickets/ready/
```

### CL-001 — Current cleanup inventory

```txt
ID: CL-001
Lane: cleanup-legacy
Type: inventory
Parallel safety: CAUTION
Goal: Verify current main for direct Prisma, services imports, internal module imports, stale allowlists, and legacy service usage.
```

Allowed paths:

```txt
docs/reports/reconciliation/**
```

Read-only inspection:

```txt
app/api/**
lib/services/**
lib/modules/**
scripts/check-architecture.ts
docs/audit/**
README.md
```

Forbidden:

```txt
runtime edits
README edits
guard edits
service deletion
```

### CL-002 — Media route direct Prisma cleanup

```txt
ID: CL-002
Lane: cleanup-legacy
Type: runtime
Parallel safety: SERIAL with video-provider/playback-player
Goal: Remove direct Prisma usage from app/api/media/[...path]/route.ts through public module API.
```

Allowed paths:

```txt
app/api/media/[...path]/route.ts
lib/modules/media/**
lib/modules/video/**
lib/modules/access/**
tests/unit/modules/media/**
tests/unit/api-media*.test.ts
docs/audit/R10-Direct-Prisma-Inventory.md only if ticket allows docs update
```

Forbidden:

```txt
README.md
global roadmap files
provider architecture implementation beyond what is required
player rewrite
payment/access policy changes outside media delivery need
```

### CL-003 — Admin comments leftover inventory

```txt
ID: CL-003
Lane: cleanup-legacy
Type: inventory
Parallel safety: CAUTION with comments lane
Goal: Inventory admin comments routes and legacy comment services before migration/deletion.
```

Allowed output:

```txt
docs/reports/reconciliation/CL-003-admin-comments-leftovers.md
```

### CL-004 — Admin comments route migration

```txt
ID: CL-004
Lane: cleanup-legacy
Type: runtime
Parallel safety: SERIAL with comments lane
Goal: Migrate one admin comments route family away from legacy services into comments module public API.
```

This should be split further if route family is large.

### CL-005 — Dead service inventory

```txt
ID: CL-005
Lane: cleanup-legacy
Type: inventory
Parallel safety: SAFE/CAUTION
Goal: Verify which legacy services are still used and which can become deletion tickets.
```

Forbidden:

```txt
deleting services in inventory PR
```

### CL-006 — Stale allowlist cleanup

```txt
ID: CL-006
Lane: cleanup-legacy
Type: guard
Parallel safety: SERIAL
Goal: Remove stale allowlist entries after current-state verification.
```

Allowed paths:

```txt
scripts/check-architecture.ts
docs/audit/**
docs/reports/reconciliation/**
```

### CL-007 — R-phase final cleanup certification

```txt
ID: CL-007
Lane: cleanup-legacy
Type: certification
Parallel safety: SERIAL
Goal: Certify cleanup state after CL-001 through CL-006.
```

Output:

```txt
docs/reports/certification/R-phase-final-cleanup-certification.md
```

---

## 11. Validation

Default validation for runtime cleanup:

```bash
npm run quality
```

Minimum validation for docs/inventory-only work:

```bash
npm run quality:architecture-boundaries
```

If runtime files changed, expected validation:

```bash
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
```

If service deletion happened, also consider:

```bash
npm test -- --run
```

Agents must report exact commands.

Do not claim route cleanup is complete without architecture-boundaries passing or an explicit documented exception.

---

## 12. Done criteria

This lane is done when:

```txt
direct Prisma route imports are zero or explicitly documented temporary blockers
routes do not import legacy services directly
known stale allowlists are removed
legacy service candidates are either deleted or documented as still used
docs/audit reflect current main
README/Active Roadmap do not claim false state
guard passes
R-phase final cleanup certification exists
```

---

## 13. Certified criteria

This lane is certified when:

```txt
Certifier reviewed current main
npm run quality passed or exception documented
architecture guard is honest
docs/audit are current
dead services are not guessed
all remaining blockers have tickets
no Builder is editing global docs
human owner accepts cleanup handoff
```

Certification report:

```txt
docs/reports/certification/LANE-cleanup-legacy-certification.md
```

or, if closing old R-phase cleanup:

```txt
docs/reports/certification/R-phase-final-cleanup-certification.md
```

---

## 14. Anti-patterns

Do not:

```txt
delete services because they look old
delete services because blueprint says target module exists
mark allowlists clean without running guard
update README optimistically
mix service deletion with unrelated route migration
change product behavior during cleanup
run cleanup in parallel with same-domain Builder work
hide remaining blockers
```

---

## 15. Final lane rule

Cleanup work is successful when later agents do not need to understand legacy glue.

The lane should leave behind:

```txt
thin routes
module APIs
honest guards
current inventories
small follow-up tickets
no fake completion
```
