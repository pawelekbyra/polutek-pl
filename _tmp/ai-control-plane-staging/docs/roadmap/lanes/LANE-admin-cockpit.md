# LANE-admin-cockpit

## 0. Purpose

This lane owns the Admin Cockpit foundation for Polutek.pl.

It exists to make sure that admin can understand and operate the system without manually inspecting the database, Clerk, Stripe, logs, or raw provider state.

Primary goal:

```txt
Access Diagnostics first.
Generic dashboard second.
```

Admin Cockpit should answer real operational questions:

```txt
Why can this user watch this video?
Why can this user not watch this video?
Why does the user think they are a patron?
Did a payment create PatronGrant?
Was a grant suspended, revoked, or expired?
Is Clerk metadata out of sync with DB truth?
Is the video asset ready?
Did provider processing fail?
Can this user comment here?
What audit events explain this state?
```

This lane consumes truth from other lanes.

It must not invent truth locally.

---

## 1. Lane identity

Lane ID:

```txt
admin-cockpit
```

Primary phase:

```txt
X5 — Admin Cockpit Foundation
```

Depends on:

```txt
X1 — Payments / Patron Safety
X2 — Access / Patron Hard Reset
```

Partly depends on:

```txt
X3 — Video Provider Foundation
X4 — PlaybackPlan / Player Simplification
```

Supports:

```txt
X6 — Product Excellence
ongoing support operations
ongoing audit/reconciliation
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
CAUTION
```

Reason:

```txt
Admin Cockpit touches many domains: access, patron grants, payments, refunds, disputes, subscriptions, comments, video provider health, audit logs, and system health.
```

Default rule:

```txt
Build admin features as read-only diagnostics first. Add corrective actions only after domain use cases and audit are safe.
```

---

## 2. Product rule

Admin cockpit is not random CRUD.

It is a control room.

Priority order:

```txt
1. Access Diagnostics
2. Patron/payment diagnostics
3. Video/media/provider health
4. Comments moderation
5. Subscribers/emails
6. Audit log
7. System health
8. Generic dashboard metrics
```

Do not start with a generic dashboard if Access Diagnostics does not exist.

---

## 3. Admin principles

### 3.1 Admin reads domain truth

Admin must read from domain modules/use cases.

Admin must not:

```txt
query Prisma directly from route/page
mutate access state directly
set User.isPatron as fix
edit Clerk metadata as access fix
grant patron outside Patron module
change payment state outside Payments module
hide errors with UI-only status
```

### 3.2 Every manual access-affecting action is auditable

Actions requiring reason/audit:

```txt
manual PatronGrant
suspend PatronGrant
reactivate PatronGrant
revoke PatronGrant
video tier change
minimum donation change
refund/dispute corrective action
manual access repair
comment hide/delete/pin
email broadcast send
provider asset corrective action if applicable
```

### 3.3 Diagnostics before repair

First build read-only diagnostics.

Then add corrective actions.

Correct order:

```txt
1. show truth
2. explain truth
3. show mismatch
4. suggest safe action
5. add audited action
```

Wrong order:

```txt
1. add admin button
2. mutate DB
3. hope it fixes support issue
```

### 3.4 Admin must not bypass modules

Admin UI/routes should call public module APIs.

Allowed:

```ts
import { getAccessDiagnostics } from "@/lib/modules/access";
```

Forbidden:

```ts
import { prisma } from "@/lib/prisma";
```

Forbidden:

```ts
import { AccessDiagnosticsUseCase } from "@/lib/modules/access/application/access-diagnostics.use-case";
```

Routes/pages should not import module internals.

---

## 4. Core admin sections

### 4.1 Access Diagnostics

This is the most important admin feature.

Admin should be able to search by:

```txt
user id
email
Clerk id
video id
video slug
payment id
PatronGrant id
```

Diagnostics should show:

```txt
user id/email
Clerk id
role/admin state
video id/title/slug/tier/status
final access decision
reason for allow/deny
can play video
can comment on video
PatronGrant history
active/suspended/revoked/expired grants
grant source
payment-linked grants
admin grants
referral grants
mailing subscription status
recent payments
refund/dispute status
Clerk metadata/cache snapshot
legacy User.isPatron value during migration
DB vs Clerk mismatch
video asset readiness
provider status
recent audit events
```

Support questions it should answer:

```txt
"Zapłaciłem, ale nie widzę filmu."
"Jestem patronem, ale mam locked."
"Dlaczego ten user ma patron access?"
"Dlaczego UI/Clerk pokazuje coś innego niż backend?"
"Dlaczego nie mogę komentować pod tym filmem?"
"Dlaczego video jest unavailable?"
```

### 4.2 Patron management

Admin should be able to:

```txt
view PatronGrant history
create manual PatronGrant with reason
suspend grant with reason
reactivate suspended grant with reason
revoke grant with reason
see payment/referral/admin source
see audit trail
```

Rules:

```txt
REVOKED grant is not reanimated.
If access must return after revoke, create a new PatronGrant.
```

### 4.3 Payments diagnostics

Admin should see:

```txt
payment status
amount/currency
provider/payment id
webhook events
fulfillment status
PatronGrant linked to payment
refund state
partial refund state
dispute state
chargeback state
idempotency/duplicate webhook information if available
```

Admin should not manually set financial facts without Payments module use case.

### 4.4 Video/media/provider health

Admin should see:

```txt
VideoAsset status
provider
provider asset id
provider playback id if safe/admin-only
processing status
upload session state
primary asset readiness
last webhook event
provider error
whether playback source can be created
why playback source cannot be created
```

Admin must not see or expose raw private playback URLs in public UI.

### 4.5 Comments moderation

Admin should be able to:

```txt
list reported comments
hide comment
delete comment
restore comment if policy allows
pin/unpin comment
see moderation audit trail
see video/comment context
```

Admin moderation must use comments module use cases.

### 4.6 Subscribers and emails

Admin should distinguish:

```txt
subscribers = mailing/follow consent
patrons = active PatronGrant
users = identity/account
```

Email segments:

```txt
SUBSCRIBERS
PATRONS
ALL_USERS if legally/product-wise allowed
MANUAL
```

Email module sends messages.

Email module does not grant access.

### 4.7 Audit log

Audit should show:

```txt
actor
target
action
reason
timestamp
metadata
related payment/grant/video/comment/email/provider event
```

Audit does not decide policy.

Audit records what happened.

### 4.8 System health

System health may include:

```txt
provider webhook status
email provider status
Stripe webhook health
failed jobs/events
stale processing assets
environment/config warnings
database checks
migration status
```

---

## 5. Owned paths

This lane may own or edit these paths when the ticket explicitly allows them.

### Admin app/pages/components

```txt
app/admin/**
components/admin/**
app/(admin)/**
```

Use actual current repo structure.

### Admin API routes

```txt
app/api/admin/**
```

Only routes listed in ticket.

### Admin modules/use cases

```txt
lib/modules/admin/**
lib/modules/audit/**
```

Use actual current module structure.

### Cross-domain module reads

Only when ticket explicitly involves diagnostics:

```txt
lib/modules/access/**
lib/modules/patron/**
lib/modules/patrons/**
lib/modules/payments/**
lib/modules/comments/**
lib/modules/subscriptions/**
lib/modules/email/**
lib/modules/media/**
lib/modules/video/**
```

Admin should consume public APIs from these modules.

### Tests

```txt
tests/unit/modules/admin/**
tests/unit/modules/access/**
tests/unit/modules/payments/**
tests/unit/modules/patron/**
tests/unit/*admin*.test.ts
tests/unit/*diagnostic*.test.ts
```

### Reports

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
granting patron by setting User.isPatron
fixing access by editing Clerk metadata
letting admin bypass Patron module
letting admin bypass Payments module
letting admin bypass Access module
generic dashboard before diagnostics
raw private media URL exposure
manual DB-like admin hacks
changing access/payment/comment policy for UI convenience
```

---

## 7. Parallel safety

Default mode:

```txt
CAUTION
```

### Conflicts with

This lane conflicts with:

```txt
access lane when diagnostics consume access decision shape
payments-patron lane when payment/grant lifecycle shape changes
video-provider lane when provider/VideoAsset status shape changes
playback-player lane when PlaybackPlan/debug shape changes
comments lane when moderation use cases change
email-subscriptions lane when subscriber/email segment definitions change
Prisma schema tasks
guard tasks
global docs tasks
```

### Can run with

This lane may run in parallel with:

```txt
email-subscriptions docs-only work
comments docs-only inventory
video-provider docs-only inventory
playback-player UX docs-only work
cleanup-legacy inventory-only reports
```

only if paths do not overlap.

### Serial-only examples

```txt
Access Diagnostics consumes getAccessDecision DTO
+
Access lane changes getAccessDecision DTO
```

Verdict:

```txt
SERIAL unless DTO contract is frozen
```

```txt
Admin displays refund/dispute lifecycle
+
Payments lane changes refund/dispute lifecycle model
```

Verdict:

```txt
SERIAL
```

```txt
Admin provider health panel
+
VideoProvider lane changes VideoAsset status shape
```

Verdict:

```txt
SERIAL unless status contract is frozen
```

---

## 8. Work sequence

This lane must run in order.

Do not start with generic dashboard.

### AD-0 — Current admin inventory

Goal:

```txt
Understand current admin routes, pages, modules, dashboards, user/payment/comment/video tools, and diagnostics gaps.
```

Inventory must answer:

```txt
What admin pages exist?
What admin API routes exist?
Which routes import Prisma directly?
Which routes import legacy services?
Where are admin stats computed?
Where can admin view users?
Where can admin view payments?
Where can admin view patrons?
Where can admin moderate comments?
Where can admin view subscribers/emails?
Where can admin diagnose access?
What tests already exist?
What current support questions cannot be answered?
```

Output:

```txt
docs/reports/reconciliation/AD-0-current-admin-inventory.md
follow-up tickets
```

### AD-1 — Access Diagnostics spec

Goal:

```txt
Define the Access Diagnostics product/API shape before implementation.
```

Spec must define:

```txt
search inputs
diagnostic response shape
access decision fields
PatronGrant fields
payment fields
subscription fields
Clerk metadata/cache snapshot fields
User.isPatron legacy field
video/asset/provider fields
comment permission fields
audit event fields
security/redaction rules
```

Forbidden:

```txt
runtime implementation before spec
generic dashboard
manual fix buttons
```

### AD-2 — Access Diagnostics backend use case

Goal:

```txt
Add backend use case that gathers access explanation from domain modules.
```

Required behavior:

```txt
calls Access module for final decision
calls Patron module for grants
calls Payments module for relevant payments
calls Subscriptions module for mailing status
calls Video/Media module for asset readiness
calls Audit module for recent events
does not query Prisma directly from route
does not decide access locally
```

### AD-3 — Access Diagnostics admin UI

Goal:

```txt
Create admin UI for diagnostics.
```

Should show:

```txt
search form
summary result
final allow/deny
reason
PatronGrant history
payment/refund/dispute status
subscription status
Clerk mismatch
video/asset status
comment permission
audit timeline
```

### AD-4 — Patron management foundation

Goal:

```txt
Allow admin to manage PatronGrants through audited domain use cases.
```

Actions:

```txt
manual grant with reason
suspend with reason
reactivate suspended with reason
revoke with reason
view history
```

Forbidden:

```txt
set User.isPatron directly
edit Clerk metadata as access fix
reactivate REVOKED grant
```

### AD-5 — Payments diagnostics

Goal:

```txt
Show payment/refund/dispute state relevant to patron access.
```

Admin should see:

```txt
payment status
PatronGrant linked to payment
refund state
dispute state
webhook/fulfillment state where available
audit events
```

### AD-6 — Comments moderation

Goal:

```txt
Admin comments moderation through comments module.
```

Actions:

```txt
reports list
hide
delete
restore if policy allows
pin/unpin
audit trail
```

### AD-7 — Subscribers / email operations

Goal:

```txt
Admin can distinguish subscribers, patrons, users, and email segments.
```

Must preserve:

```txt
Subscription != Patron
Email sends messages.
Email does not grant access.
```

### AD-8 — Video provider health

Goal:

```txt
Admin can see VideoAsset/provider status.
```

Show:

```txt
primary asset readiness
processing/error state
provider
last webhook event
upload session status
provider health warnings
```

### AD-9 — Audit log foundation

Goal:

```txt
Expose audit events useful for access/payment/comment/video operations.
```

Audit should be filterable by:

```txt
user
video
payment
PatronGrant
comment
admin actor
action type
time range
```

### AD-10 — System health foundation

Goal:

```txt
Show operational health without mixing product logic.
```

May include:

```txt
Stripe webhook health
email provider health
video provider webhook health
stale processing assets
failed events
environment/config warnings
```

### AD-11 — Admin Cockpit certification

Goal:

```txt
Certify Admin Cockpit Foundation.
```

Output:

```txt
docs/reports/certification/X5-admin-cockpit-certification.md
```

---

## 9. Suggested tickets

Tickets should be created under:

```txt
docs/tickets/ready/
```

### AD-001 — Current admin inventory

```txt
ID: AD-001
Lane: admin-cockpit
Type: inventory
Parallel safety: CAUTION
Goal: Inventory current admin pages, routes, modules, direct Prisma/services usage, and diagnostics gaps.
```

Allowed output:

```txt
docs/reports/reconciliation/AD-001-current-admin-inventory.md
```

Forbidden:

```txt
runtime changes
schema changes
README changes
roadmap changes
```

### AD-002 — Access Diagnostics spec

```txt
ID: AD-002
Lane: admin-cockpit
Type: spec
Parallel safety: CAUTION / SERIAL with access
Goal: Define Access Diagnostics response shape, UI sections, redaction, and domain dependencies.
```

### AD-003 — Access Diagnostics backend

```txt
ID: AD-003
Lane: admin-cockpit
Type: runtime/test
Parallel safety: SERIAL with access/payments/video/comments if contracts not frozen
Goal: Implement backend use case/API for Access Diagnostics using public module APIs.
```

### AD-004 — Access Diagnostics UI

```txt
ID: AD-004
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION
Goal: Implement admin UI for Access Diagnostics.
```

### AD-005 — Patron management admin actions

```txt
ID: AD-005
Lane: admin-cockpit
Type: runtime/test
Parallel safety: SERIAL with payments-patron
Goal: Add audited admin PatronGrant management actions.
```

### AD-006 — Payments diagnostics panel

```txt
ID: AD-006
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION / SERIAL with payments-patron
Goal: Show payment/refund/dispute state relevant to patron access.
```

### AD-007 — Comments moderation panel

```txt
ID: AD-007
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION / SERIAL with comments
Goal: Build comments moderation panel through comments module use cases.
```

### AD-008 — Subscribers/email admin panel

```txt
ID: AD-008
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION with email-subscriptions
Goal: Show subscribers/email segments without confusing Subscription and Patron.
```

### AD-009 — Video provider health panel

```txt
ID: AD-009
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION / SERIAL with video-provider
Goal: Show VideoAsset/provider health and processing status.
```

### AD-010 — Audit log panel

```txt
ID: AD-010
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION
Goal: Expose useful audit events for admin operations.
```

### AD-011 — System health panel

```txt
ID: AD-011
Lane: admin-cockpit
Type: runtime/UI/test
Parallel safety: CAUTION
Goal: Expose operational system health.
```

### AD-012 — Admin Cockpit Foundation certification

```txt
ID: AD-012
Lane: admin-cockpit
Type: certification
Parallel safety: SERIAL
Goal: Certify X5 Admin Cockpit Foundation.
```

Output:

```txt
docs/reports/certification/X5-admin-cockpit-certification.md
```

---

## 10. Validation

Inventory/spec-only minimum:

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

If admin UI changes, include relevant UI/component tests where available.

If admin actions affect access, tests must cover:

```txt
reason required
audit created
domain module used
no direct User.isPatron mutation
no Clerk metadata as access fix
```

Agents must report exact commands.

---

## 11. Done criteria

This lane is done when:

```txt
current admin inventory exists
Access Diagnostics spec exists
Access Diagnostics backend exists or is explicitly deferred
Access Diagnostics UI exists or is explicitly deferred
admin can see PatronGrant/payment/subscription/Clerk/access mismatch state
manual PatronGrant actions are audited or deferred with tickets
payments diagnostics exist or deferred with tickets
comments moderation exists or deferred with tickets
subscriber/email distinction is preserved
video provider health exists or deferred with tickets
audit/system health exists or deferred with tickets
docs reflect current implementation
```

---

## 12. Certified criteria

This lane is certified when:

```txt
Certifier reviewed current main
admin diagnostics can answer common access support questions
admin does not need direct database access for normal support diagnosis
admin does not bypass Access/Patron/Payments modules
manual access-affecting actions require reason/audit
Subscription and Patron are not confused
private media/provider secrets are not leaked
tests pass
all remaining blockers have tickets
certification report exists
human owner accepts certification
```

Certification report:

```txt
docs/reports/certification/X5-admin-cockpit-certification.md
```

---

## 13. Review checklist

Reviewer must check:

```txt
Does PR prioritize diagnostics over generic dashboard?
Does PR consume public module APIs?
Does PR avoid direct Prisma in admin routes?
Does PR avoid direct User.isPatron mutation?
Does PR avoid Clerk metadata as access fix?
Does PR require reason/audit for access-affecting admin actions?
Does PR avoid raw private media URL leaks?
Does PR keep Subscription and Patron separate?
Does PR avoid changing domain policy for UI convenience?
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
build dashboard before diagnostics
make admin a direct DB editor
set User.isPatron from admin UI
fix access by editing Clerk metadata
grant patron outside Patron module
change payment state outside Payments module
let admin bypass Access policy
show raw private video URLs
hide domain errors behind green UI
mix admin UI polish with access/payment policy changes
```

---

## 15. Final lane rule

This lane is successful when admin can answer:

```txt
What does the system believe?
Why does it believe it?
What changed it?
Who changed it?
What safe audited action can fix it?
```

without guessing, without database access, and without bypassing domain modules.
