# LANE-comments

## 0. Purpose

This lane owns comments, comment permissions, comment moderation, comment reports, comment reactions, and comment-related audit behavior.

It exists to make sure that:

```txt
comments are visible according to product rules
comment writing permission goes through Access
PATRON video comments require patron/admin when writing
admin moderation is explicit and auditable
legacy comment services are removed or migrated safely
routes stay thin
comment reports and moderation do not bypass modules
```

Core invariant:

```txt
Comment visibility is not the same thing as comment permission.
```

---

## 1. Lane identity

Lane ID:

```txt
comments
```

Primary phase:

```txt
X2 / X5 support lane
```

Main dependencies:

```txt
X2 — Access / Patron Hard Reset
X5 — Admin Cockpit Foundation
```

Supports:

```txt
X4 — PlaybackPlan / Player Simplification
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
CAUTION
```

Reason:

```txt
Comments touch access permissions, admin moderation, reports, audit logs, user identity, video context, and legacy service cleanup.
```

Default rule:

```txt
Do not change comment permission rules in parallel with Access policy changes.
```

---

## 2. Product rules

### 2.1 Comments visibility

Target rule:

```txt
Comments are visible to everyone unless moderation/status rules hide them.
```

Visibility should not be confused with permission to write.

Guests may be able to read comments on public pages.

### 2.2 Comment writing permission

Target writing rules:

```txt
PUBLIC video:
  guest cannot comment
  logged-in user can comment
  patron can comment
  admin can comment/moderate

LOGGED_IN video:
  guest cannot comment
  logged-in user can comment
  patron can comment
  admin can comment/moderate

PATRON video:
  guest cannot comment
  logged-in non-patron cannot comment
  patron can comment
  admin can comment/moderate
```

### 2.3 Access owns permission

Comments must ask Access for permission.

Correct:

```txt
Comments module -> Access canCommentOnVideo
```

Forbidden:

```txt
comments route checks User.isPatron directly
comments route checks Clerk metadata directly
comments route checks Subscription directly
comments route checks Payment directly
comments UI decides permission alone
```

### 2.4 Admin moderation is not normal commenting

Admin moderation may include:

```txt
hide
delete
restore
pin
unpin
resolve report
dismiss report
```

Moderation must be auditable.

### 2.5 Hidden/deleted comments

Comment state should be explicit.

Possible statuses:

```txt
VISIBLE
HIDDEN
DELETED
PENDING_REVIEW
```

Final names should match current code.

Do not invent a new status model without inventory.

---

## 3. Domain concepts

### Comment

A user-created text item attached to a video or content entity.

May include:

```txt
id
videoId
authorId
body
status
createdAt
updatedAt
deletedAt
hiddenAt
pinnedAt
```

### CommentReport

A report submitted by a user or admin.

May include:

```txt
id
commentId
reporterId
reason
status
createdAt
resolvedAt
resolvedById
resolutionNote
```

### CommentModerationAction

An auditable action performed by admin/moderator.

May include:

```txt
action
actorId
commentId
reason
metadata
createdAt
```

### CommentPermission

A decision object returned by Access or Comments module.

May include:

```txt
canRead
canWrite
canModerate
reason
requiredAction
```

---

## 4. Owned paths

This lane may own or edit these paths when the ticket explicitly allows them.

### Comments module

```txt
lib/modules/comments/**
```

### Access integration

Only when ticket explicitly involves comment permission:

```txt
lib/modules/access/**
```

### Comment routes

```txt
app/api/comments/**
app/api/videos/[videoId]/comments/**
app/api/admin/comments/**
```

Use actual current route structure.

### Comment UI

```txt
components/comments/**
app/**/comments/**
app/videos/**
```

Only when ticket explicitly involves UI.

### Admin moderation

```txt
app/admin/comments/**
components/admin/comments/**
app/api/admin/comments/**
```

### Tests

```txt
tests/unit/modules/comments/**
tests/unit/modules/access/**
tests/unit/*comment*.test.ts
tests/unit/*moderation*.test.ts
tests/unit/*report*.test.ts
```

### Reports

```txt
docs/reports/reconciliation/**
docs/reports/certification/**
docs/audit/**
```

Only if ticket explicitly allows docs/report updates.

---

## 5. Forbidden by default

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
making Subscription grant comment access
using Clerk metadata as backend permission truth
using User.isPatron as target permission truth
changing video tier semantics
changing player locked-state behavior
changing provider playback behavior
generic admin dashboard work
```

---

## 6. Parallel safety

Default mode:

```txt
CAUTION
```

### Conflicts with

This lane conflicts with:

```txt
access lane when canCommentOnVideo or access matrix changes
admin-cockpit lane when comment moderation UI/actions change
cleanup-legacy lane when legacy comment services are being migrated/deleted
playback-player lane when comment permission is included in PlaybackPlan
Prisma schema tasks involving comments/reports/reactions
guard tasks
global docs tasks
```

### Can run with

This lane may run in parallel with:

```txt
email-subscriptions work unrelated to comments
video-provider inventory/spec work unrelated to comment permissions
payments-patron work unrelated to access/comment permission
admin-cockpit docs-only work not changing moderation/actions
cleanup-legacy inventory-only reports
```

only if paths do not overlap.

### Serial-only examples

```txt
Access changes canCommentOnVideo
+
Comments route migrates permission checks
```

Verdict:

```txt
SERIAL unless canCommentOnVideo contract is frozen
```

```txt
Admin comments moderation actions
+
Comments module moderation use cases
```

Verdict:

```txt
SERIAL or strict provider/consumer sequence
```

```txt
Cleanup deletes legacy comment service
+
Comments lane migrates route still importing it
```

Verdict:

```txt
SERIAL
```

---

## 7. Work sequence

This lane must run in order.

Do not start with UI polish.

Do not change permission rules before inventory and tests.

### CM-0 — Current comments inventory

Goal:

```txt
Understand current comments routes, services, modules, permissions, moderation, reports, reactions, and tests.
```

Inventory must answer:

```txt
Where are comments listed?
Where are comments created?
Where are comments hidden/deleted/pinned?
Where are reports created/resolved?
Where are reactions handled?
Where is comment permission checked?
Is User.isPatron used?
Is Clerk metadata used?
Is Subscription used?
Are comments visible to everyone?
Are PATRON comments write-locked?
Which admin routes import legacy services?
Which routes import Prisma directly?
What tests already exist?
```

Output:

```txt
docs/reports/reconciliation/CM-0-current-comments-inventory.md
follow-up tickets
```

### CM-1 — Comment permission contract

Goal:

```txt
Define/adopt permission contract between Comments and Access.
```

Required behavior:

```txt
comments ask Access canCommentOnVideo
PUBLIC requires login to write
LOGGED_IN requires login to write
PATRON requires patron/admin to write
admin can moderate according to admin role
visibility remains separate from write permission
```

### CM-2 — Comment permission tests

Goal:

```txt
Add/verify tests for comment visibility and writing permission matrix.
```

Required tests:

```txt
guest can read visible comments
logged-in user can read visible comments
patron can read visible comments
guest cannot write
logged-in user can write on PUBLIC/LOGGED_IN
logged-in non-patron cannot write on PATRON
patron can write on PATRON
admin can moderate
Subscription does not grant PATRON comment permission
Clerk metadata does not grant backend comment permission
User.isPatron does not grant target backend permission
```

### CM-3 — Route modularization

Goal:

```txt
Ensure comment routes are thin and use public module APIs.
```

Allowed route responsibilities:

```txt
authenticate
parse input
create context
call comments module public API
map result to HTTP response
```

Forbidden route responsibilities:

```txt
query Prisma directly
import legacy comment services
decide patron/comment permission locally
import module internals
```

### CM-4 — Legacy comment services migration

Goal:

```txt
Migrate or delete legacy comment services safely.
```

Correct sequence:

```txt
usage inventory
route/module migration
tests
delete one service at a time
guard/audit reconciliation
```

Known candidate service families may include:

```txt
comment.service
comment-report.service
comment-moderation.service
comment-reaction.service
comment-audit.service
comment-access.service
```

These are candidates, not automatic deletion targets.

### CM-5 — Reports and moderation

Goal:

```txt
Make comment reports and admin moderation explicit and auditable.
```

Required behavior:

```txt
report comment
list reports
resolve report
dismiss report
hide comment
delete comment
restore comment if policy allows
pin/unpin comment if supported
reason required for moderation where appropriate
audit event created
```

### CM-6 — Comment reactions

Goal:

```txt
Clarify and modularize comment reaction behavior if reactions exist.
```

Rules:

```txt
reaction requires login
one reaction per user/comment/type unless product says otherwise
reaction does not grant access
reaction does not affect patron status
hidden/deleted comments cannot be reacted to unless policy allows
```

### CM-7 — Comments UI safety and UX

Goal:

```txt
Make UI reflect backend permission without inventing permission.
```

Required behavior:

```txt
visible comments render for allowed visibility
write box shown/hidden based on backend permission
PATRON write-locked state explains why
login CTA for guests
patron CTA for logged-in non-patrons on PATRON content
moderation UI admin-only
```

Forbidden:

```txt
UI-only permission enforcement
frontend grants permission
misleading patron/subscription copy
```

### CM-8 — Admin cockpit handoff

Goal:

```txt
Expose comments data needed by Admin Cockpit.
```

May include:

```txt
reported comments count
pending reports
moderation action history
comment author/video context
permission reason
recent comment audit events
```

### CM-9 — Certification

Goal:

```txt
Certify comments lane.
```

Output:

```txt
docs/reports/certification/LANE-comments-certification.md
```

---

## 8. Suggested tickets

Tickets should be created under:

```txt
docs/tickets/ready/
```

### CM-001 — Current comments inventory

```txt
ID: CM-001
Lane: comments
Type: inventory
Parallel safety: CAUTION
Goal: Inventory current comments routes, services, permissions, moderation, reports, reactions, and tests.
```

Allowed output:

```txt
docs/reports/reconciliation/CM-001-current-comments-inventory.md
```

Forbidden:

```txt
runtime changes
schema changes
README changes
roadmap changes
```

### CM-002 — Comment permission contract

```txt
ID: CM-002
Lane: comments
Type: contract/test
Parallel safety: SERIAL with access
Goal: Define/adopt canCommentOnVideo contract and comment visibility/write matrix.
```

### CM-003 — Comment permission matrix tests

```txt
ID: CM-003
Lane: comments
Type: test
Parallel safety: SERIAL with access/comments permission work
Goal: Add tests for comment visibility and write permission matrix.
```

### CM-004 — Public comment route modularization

```txt
ID: CM-004
Lane: comments
Type: runtime/test
Parallel safety: CAUTION / SERIAL within comments routes
Goal: Ensure public comment routes are thin and use comments module public APIs.
```

### CM-005 — Admin comments route modularization

```txt
ID: CM-005
Lane: comments
Type: runtime/test
Parallel safety: SERIAL with admin-cockpit/cleanup-legacy
Goal: Ensure admin comments routes are thin and use comments module public APIs.
```

### CM-006 — Legacy comment services cleanup

```txt
ID: CM-006
Lane: comments
Type: cleanup/test
Parallel safety: SERIAL with cleanup-legacy
Goal: Migrate/delete legacy comment services one at a time after usage inventory.
```

### CM-007 — Comment reports and moderation audit

```txt
ID: CM-007
Lane: comments
Type: runtime/test
Parallel safety: CAUTION / SERIAL with admin-cockpit
Goal: Make report resolution and moderation actions explicit and auditable.
```

### CM-008 — Comment reactions cleanup

```txt
ID: CM-008
Lane: comments
Type: runtime/test
Parallel safety: CAUTION
Goal: Clarify and modularize comment reaction behavior if reactions exist.
```

### CM-009 — Comments UI permission states

```txt
ID: CM-009
Lane: comments
Type: UI/test
Parallel safety: CAUTION
Goal: Make comments UI reflect backend permission and show correct login/patron/admin states.
```

### CM-010 — Admin Cockpit comments handoff

```txt
ID: CM-010
Lane: comments
Type: runtime/spec
Parallel safety: CAUTION with admin-cockpit
Goal: Expose comments moderation/reporting data needed by Admin Cockpit.
```

### CM-011 — Comments lane certification

```txt
ID: CM-011
Lane: comments
Type: certification
Parallel safety: SERIAL
Goal: Certify comments lane.
```

Output:

```txt
docs/reports/certification/LANE-comments-certification.md
```

---

## 9. Validation

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

If moderation/audit behavior changes, tests should cover:

```txt
reason required where appropriate
audit event created
admin-only moderation
no direct Prisma in route
no legacy service route import
```

If permission behavior changes, tests should cover:

```txt
PUBLIC / LOGGED_IN / PATRON comment matrix
Subscription is not access
Clerk metadata is not backend permission truth
User.isPatron is not target permission truth
```

Agents must report exact commands.

---

## 10. Done criteria

This lane is done when:

```txt
current comments inventory exists
comment visibility vs permission is explicit
comments ask Access for write permission
comment permission matrix tests exist
routes are thin or remaining blockers have tickets
legacy comment services are migrated/deleted or documented with tickets
moderation/reporting is explicit and auditable
UI reflects backend permission without inventing it
admin cockpit handoff exists or is explicitly deferred
docs reflect current implementation
```

---

## 11. Certified criteria

This lane is certified when:

```txt
Certifier reviewed current main
tests cover comment visibility/write matrix
comments do not use Subscription as patron access
comments do not use Clerk metadata as backend permission truth
comments do not use User.isPatron as target permission truth
routes use public module APIs
admin moderation is auditable or explicitly deferred
legacy services are cleaned or documented with tickets
all remaining blockers have tickets
certification report exists
human owner accepts certification
```

Certification report:

```txt
docs/reports/certification/LANE-comments-certification.md
```

---

## 12. Review checklist

Reviewer must check:

```txt
Does PR keep visibility separate from write permission?
Does PR route comment write permission through Access?
Does PR avoid Subscription as comment access?
Does PR avoid Clerk metadata as backend permission truth?
Does PR avoid User.isPatron as target permission truth?
Does PR keep routes thin?
Does PR avoid legacy service imports from routes?
Does PR require/audit moderation actions where appropriate?
Does PR avoid changing video/player/payment behavior?
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

## 13. Anti-patterns

Do not:

```txt
hide comments just because video is patron-only
treat comment visibility as comment permission
let UI decide write permission
let comments route check User.isPatron
let comments route check Clerk metadata
let Subscription unlock PATRON comments
moderate without audit where audit is required
delete legacy services before usage inventory
mix comments cleanup with player/provider/payment rewrites
```

---

## 14. Final lane rule

This lane is successful when Comments can say:

```txt
I show what should be visible.
I ask Access whether the viewer can write.
I use module use cases.
I audit moderation.
I do not decide patron truth myself.
```
