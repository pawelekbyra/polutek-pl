# Polutek.pl

## 1. Product mode

Polutek.pl is a strict single-channel creator hub.

Product invariants:

* One official channel.
* One creator.
* One content catalog.
* One patron/access system.
* One community.
* One private media platform for the owner/creator.

This is not:

* a multi-creator marketplace,
* a creator onboarding platform,
* a mini-Patreon for many creators,
* a public multi-channel social network.

Important model mapping:

* `Creator` in the database is a legacy technical representation of `MainChannel`.
* Do not rename `Creator -> Channel` in Prisma until the modular monolith is stable and tested.
* `Subscription != Patron`.
* Subscription/follow means email/newsletter/notification interest.
* Patron access is controlled by DB state, especially `User.isPatron` and future patron/payment modules.
* Clerk metadata is a cache/sync layer, not the source of truth for access.

---

## 2. Current active refactor

The active refactor is a practical Modular Monolith migration.

Target flow:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Routes should be thin.

Use cases should own business logic.

Policies should own business rules.

Repositories should own database access.

DTOs should protect API/UI contracts from raw Prisma models.

Modules must expose public API through `index.ts`.

`README.md` is the active source of truth for the current refactor state, roadmap, rules, known blockers, and next tasks.

---

## 3. Status vocabulary

Status meanings:

```txt
[ ]              not started
[~]              partial / in progress / known blockers remain
[x foundation]   foundation is certified, but full legacy removal is intentionally deferred
[x safety foundation] certified safety layer, but delivery/runtime migration may remain
[x single-channel foundation] strict single-channel invariant certified, but compatibility adapters may remain
[x]              certified complete for current roadmap scope
[!]              blocked / regression / do not proceed
```

Important rule:

```txt
Claimed done != certified done
```

A phase may only be marked as certified when code, tests, guards, validation, README truth, and known blockers are aligned.

A phase can be certified as a foundation without pretending that all legacy runtime paths have been removed.

---

## 4. Current status

| Phase   | Description                                     | Status                        |
| :------ | :---------------------------------------------- | :---------------------------- |
| **R0**  | Rules, infrastructure, project guardrails       | [x]                           |
| **R1**  | Shared, API boundary, errors, Actor, AppContext | [x]                           |
| **R2**  | Audit module                                    | [x foundation]                |
| **R3**  | Media module                                    | [x safety foundation]         |
| **R4**  | Channel module / strict single-channel          | [x single-channel foundation] |
| **R5**  | Users module                                    | [~]                           |
| **R6**  | Video module                                    | [~]                           |
| **R7**  | Patron + Payments modules                       | [ ]                           |
| **R8**  | Comments module                                 | [ ]                           |
| **R9**  | Email module                                    | [ ]                           |
| **R10** | Cleanup deprecated facades                      | [ ]                           |
| **R11** | Admin frontend / operational cockpit            | [ ]                           |

Current project interpretation:

* R0/R1 are certified as the current foundation.
* R2/R3/R4 are certified as foundations, not full removal of all legacy dependencies.
* R5/R6 are active partial migrations and must be completed before R7.
* R7 must not start until R5/R6 blockers are reviewed and either fixed or explicitly accepted.

---

## 5. Current next task

```txt
R5/R6 blocker completion — finish users/admin/webhook/access boundaries and video admin details/access route before R7 readiness review.
```

Do not start R7 Patron + Payments yet.

R7 may start only after:

* R5 Users blockers are reviewed,
* R6 Video blockers are reviewed,
* access route strategy is clear,
* video admin details/resync are either migrated or explicitly accepted as remaining blockers,
* README and architecture guard agree on what remains legacy.

---

## 6. Mandatory agent rules

All agents must follow these rules:

* Do not just move files.
* Do not create folders and call a phase complete.
* Do not mark `[x]` without tests and validation.
* Do not update README to be more optimistic than code.
* Do not start new roadmap phases while known blockers remain in the current phase.
* Do not import module internals from routes.
* Do not mix closed modules with direct Prisma/services in the same route unless explicitly allowlisted with a phase/comment.
* Do not expose raw `videoUrl` to public UI/API.
* Do not treat Clerk metadata as source of truth for patron access.
* Do not reintroduce creator fallbacks such as `polutek` or `demo-creator`.
* Do not run maintenance/repair from normal runtime.
* Do not start Phase X as a separate roadmap before R0–R11 are complete.

Critical refinement:

Phase X must not start as a standalone roadmap before R0–R11 are complete.

However, R7–R11 must include the minimal Phase X concerns that naturally belong to each domain. This prevents Phase X from becoming a second massive refactor.

---

## 7. R0–R11 roadmap

### R0 — Rules and infrastructure

Purpose:

* project rules,
* validation scripts,
* architecture guardrails,
* README as source of truth.

Current status:

```txt
[x]
```

Certified after R0/R1 certification pass.

---

### R1 — Shared, API boundary, errors, ctx

Purpose:

* `Actor`,
* `AppContext`,
* `UseCaseResult`,
* `AppError`,
* `ReadDb`,
* `WriteTx`,
* API helpers,
* response mapping,
* no deprecated `ctx.userId` / `ctx.role`.

Current status:

```txt
[x]
```

Certified foundation.

Remaining polish can happen later, but R1 is good enough as the base for further domain work.

---

### R2 — Audit

Purpose:

* shared audit module,
* actor-based audit events,
* transaction-aware audit logging,
* use by migrated modules.

Current status:

```txt
[x foundation]
```

Certified as foundation.

Meaning:

* `lib/modules/audit/**` exists,
* public API goes through `lib/modules/audit/index.ts`,
* migrated channel/video/users actions can use audit,
* audit uses `AppContext` / `Actor`,
* transaction support exists where needed.

Not yet meaning:

* every legacy comments/payments/email/admin details action is fully migrated to the audit module.

Remaining audit coverage for comments/payments/email/admin details belongs to their domain passes.

---

### R3 — Media

Purpose:

* media safety,
* URL allowlists,
* private host blocking,
* thumbnail/video/avatar/comment image validation,
* HLS/DASH/direct source detection,
* public DTO no-leak guarantees.

Current status:

```txt
[x safety foundation]
```

Certified as media safety foundation.

Meaning:

* MediaPolicy safety layer exists,
* URL safety and private host blocking are tested,
* public video DTO does not expose raw `videoUrl`,
* HLS/DASH detection exists as classification.

Not yet meaning:

* full media delivery/proxy migration is complete,
* manifest rewriting exists,
* segment proxying exists,
* `app/api/media/**`, `app/api/media-source/**`, and `lib/blob.ts` are fully modularized.

Important HLS/DASH caveat:

```txt
HLS/DASH detection exists for validation/classification only.
It does not mean manifest rewriting or segment proxy delivery is implemented.
```

Full media delivery belongs to a future dedicated R3/R6 delivery pass.

---

### R4 — Channel

Purpose:

* strict single-channel invariant,
* `MainChannel`,
* `MAIN_CREATOR_SLUG` as source of truth,
* explicit maintenance,
* admin channel settings,
* no runtime auto-repair.

Current status:

```txt
[x single-channel foundation]
```

Certified as single-channel foundation.

Meaning:

* channel module exists,
* strict single-channel invariant is documented and tested,
* no runtime fallback/guessing should exist,
* maintenance preview/apply is explicit, confirmed, and auditable,
* `/api/admin/channel` uses the channel module,
* `/api/admin/creator` is deprecated/wrapper behavior, not a parallel source of truth.

Not yet meaning:

* every legacy import of `@/lib/channel/main-channel.service` has been removed.

Known compatibility adapter usage remains and is tracked for R5/R6/R7/R10 cleanup.

---

### R5 — Users

Purpose:

* local user,
* Clerk sync,
* profile,
* language,
* soft delete,
* user access profile,
* user merge foundation,
* admin users,
* user/access boundary.

Current status:

```txt
[~]
```

Known remaining work:

* admin users are not fully migrated,
* Clerk webhook completion remains,
* user-access sync boundary remains,
* patron/payment boundary must stay clearly separated,
* legacy user services may still exist,
* guard must keep migrated user routes clean.

R5 is not complete until:

* user profile/sync/language/referrals routes are either migrated or explicitly scoped,
* Clerk webhook imports only public module API,
* admin users are addressed or explicitly deferred,
* `User.isPatron` DB source-of-truth is protected by tests,
* Clerk metadata remains cache only.

---

### R6 — Video

Purpose:

* admin video CRUD,
* reorder,
* archive,
* public list,
* hero,
* visibility predicates,
* DTO safety,
* main-channel scoping,
* video access boundary.

Current status:

```txt
[~]
```

Already improved:

* video module exists,
* admin CRUD/reorder foundation exists,
* `PublicVideoDto` does not expose raw `videoUrl`,
* `AdminVideoDto` may include `videoUrl`,
* public list/hero predicates have been aligned closer to legacy visibility rules,
* resync has at least been identified as a blocker or minimally scoped depending on current code.

Known remaining work:

* `app/api/access/route.ts` uses legacy `AccessPolicy` and deprecated channel adapter,
* admin video details route may still be mixed,
* resync route may still require full use-case migration,
* public frontend still uses legacy DTO/contracts in places,
* media delivery/playback is still not fully modularized,
* all migrated video routes must be guarded.

R6 is not complete until:

* admin details are main-channel scoped,
* resync is main-channel scoped through a use case,
* access route strategy is resolved,
* public list/hero use safe DTOs,
* public UI never receives raw `videoUrl`,
* README and guard agree on remaining legacy.

---

### R7 — Patron + Payments

Purpose:

* patron access,
* Stripe checkout,
* Stripe webhook,
* payment fulfillment,
* refund/revoke,
* patron grants,
* idempotency,
* audit,
* DB source-of-truth.

Current status:

```txt
[ ]
```

Do not start R7 until R5/R6 blockers are reviewed.

R7 must include minimal Phase X concerns from the start:

* idempotency,
* duplicate webhook protection,
* audit,
* refund/revoke scenario tests,
* source-of-truth tests,
* post-commit side effect discipline,
* no Clerk metadata as source of truth,
* checkout must not accept `creatorId` from client.

R7 is expected to be one of the most critical phases.

---

### R8 — Comments

Purpose:

* comment listing,
* create/update/delete,
* reactions,
* reports,
* moderation,
* pin/heart,
* access policy,
* moderation audit.

Current status:

```txt
[ ]
```

R8 must include minimal Phase X concerns:

* access checks,
* access-denied reasons where practical,
* moderation audit,
* scenario tests for patron/public content,
* report/moderation flows.

Do not migrate comments before access/user/video boundaries are stable.

---

### R9 — Email

Purpose:

* Resend integration,
* broadcast,
* queue/batch semantics,
* email webhooks,
* inbound email if needed,
* notifications.

Current status:

```txt
[ ]
```

R9 must include minimal Phase X concerns:

* idempotent webhook handling,
* retry/status semantics,
* broadcast audit,
* basic runbook notes,
* no fire-and-forget admin broadcast as final design.

---

### R10 — Cleanup deprecated facades

Purpose:

* remove deprecated compatibility facades,
* strengthen quality gates,
* block new imports from legacy services,
* remove obsolete adapters after replacement flows are tested.

Current status:

```txt
[ ]
```

Do not start R10 too early.

R10 happens after replacement flows exist.

---

### R11 — Admin frontend / operational cockpit

Purpose:

* admin management UI,
* content management,
* system health,
* operational visibility,
* release readiness.

Current status:

```txt
[ ]
```

R11 should include practical mini-X cockpit pieces:

* recent audit,
* failed webhooks,
* payment/patron status,
* media health,
* broadcast status,
* maintenance panel,
* release readiness checklist.

Do not build a giant cockpit architecture before the underlying domains exist.

---

## 8. Architecture rules

### 8.1 Thin routes

Route handlers should:

* authenticate,
* parse input,
* create context,
* call a use case,
* map result to HTTP.

Route handlers should not contain:

* direct business logic,
* direct `prisma.*`,
* direct `prisma.$transaction`,
* direct access policy logic,
* direct Stripe/Clerk/Resend business logic,
* raw repository calls,
* large DTO mapping.

Legacy exceptions must be allowlisted and documented.

---

### 8.2 Use cases

Each use case should accept:

```txt
input + AppContext
```

Example shape:

```ts
export async function updateSomething(
  input: UpdateSomethingInput,
  ctx: AppContext
): Promise<UseCaseResult<Dto, ErrorType>> {
  ...
}
```

Use cases own:

* business flow,
* predictable domain errors,
* transaction boundary when needed,
* audit calls,
* policy enforcement.

---

### 8.3 Actor

Use `Actor` everywhere instead of loose `userId`, `role`, `currentUser`, `admin`, or session objects.

Actor variants:

```txt
guest
user
admin
system
```

Important:

* `actor.isPatron` from Clerk session is cache only.
* Paywall/access decisions must verify DB state via Users/Patron modules.

---

### 8.4 AppContext

`AppContext` must not expose deprecated shortcut fields such as:

```txt
ctx.userId
ctx.role
```

Use:

```txt
ctx.actor
```

---

### 8.5 Result Pattern and errors

Predictable domain failures should use:

```txt
UseCaseResult
AppError
typed domain errors
```

Do not use plain `throw new Error(string)` for normal domain failures such as:

* not found,
* forbidden,
* user deleted,
* not patron,
* video not on main channel,
* duplicate webhook,
* invalid maintenance confirmation.

Unexpected infrastructure/programmer failures may still throw.

---

### 8.6 Module public API

External code should import modules through root `index.ts`.

Allowed:

```ts
import { getUserProfile } from '@/lib/modules/users';
```

Forbidden from routes:

```ts
import { GetUserProfileUseCase } from '@/lib/modules/users/application/get-user-profile.use-case';
```

Routes must not import module internals.

---

### 8.7 No HTTP/Next in modules

Files under `lib/modules/**` must not import:

* `next/server`,
* `next/navigation`,
* `next/cache`,
* `NextResponse`,
* `app/**`,
* route handlers.

HTTP belongs to `app/**` and `lib/api/**`.

Domain logic belongs to `lib/modules/**`.

---

### 8.8 ReadDb / WriteTx

Repository methods should use explicit DB types:

```txt
ReadDb = PrismaClient | Prisma.TransactionClient
WriteTx = Prisma.TransactionClient
```

Rules:

* read methods may accept `ReadDb`,
* critical writes should prefer `WriteTx`,
* use cases own transaction boundaries,
* repositories should not hide multi-step business transactions.

---

### 8.9 External side effects

Do not call external side effects blindly inside DB transactions.

External side effects include:

* Clerk,
* Stripe,
* Resend,
* storage,
* webhooks.

Preferred pattern:

```txt
1. DB transaction writes source of truth
2. DB transaction writes audit
3. DB transaction writes outbox or returns post-commit work
4. side effect happens after commit or via retryable worker
```

---

## 9. Strict single-channel invariant

Runtime must not:

* create creators,
* rename creators,
* auto-approve creators,
* auto-set `isPrimary`,
* demote other creators,
* guess fallback creator,
* use hardcoded fallback slugs,
* run maintenance from normal page load/API route,
* reassign content ownership outside explicit maintenance.

Important invariants:

* `MAIN_CREATOR_SLUG` is source of truth.
* Public content must belong to `mainChannel.id`.
* Checkout must not accept `creatorId` from client.
* `Subscription != Patron`.
* Maintenance must be explicit, previewable, confirmed, and auditable.
* `Creator` remains legacy technical representation of `MainChannel`.

---

## 10. Domain responsibilities

### shared

Owns:

* `Actor`,
* `AppContext`,
* `UseCaseResult`,
* `AppError`,
* `ReadDb`,
* `WriteTx`,
* shared helpers.

Must not own business logic of specific domains.

---

### api

Owns:

* HTTP boundary,
* auth helpers,
* JSON parsing,
* Zod error mapping,
* use-case result to HTTP response mapping.

May import Next.js.

Modules must not.

---

### audit

Owns:

* audit event recording,
* actor-aware audit,
* transaction-aware audit support.

Current status:

```txt
foundation certified for migrated modules
```

Legacy audit coverage remains for later domain passes.

---

### media

Owns:

* safe media URL validation,
* thumbnail URL validation,
* avatar URL validation,
* comment image URL validation,
* blocked internal/private hosts,
* HLS/DASH/direct classification.

Current status:

```txt
safety foundation certified
```

Delivery/proxy migration remains future work.

---

### channel

Owns:

* main channel access,
* strict single-channel invariant,
* admin channel settings,
* maintenance preview/apply,
* channel policy/errors.

Current status:

```txt
single-channel foundation certified
```

Deprecated compatibility adapter remains until R5/R6/R7/R10 cleanup.

---

### users

Owns:

* local user,
* Clerk sync,
* profile,
* language,
* access profile,
* soft delete,
* user merge foundation.

Current status:

```txt
partial
```

Remaining: admin users, webhook completion, user-access sync boundary.

---

### video

Owns:

* admin video CRUD,
* archive,
* reorder,
* public list,
* hero,
* DTOs,
* video policy,
* main-channel scoping.

Current status:

```txt
partial
```

Remaining: admin details, access route, resync use case, public frontend migration, playback boundary.

---

### patron

Owns:

* patron access,
* patron grants,
* grant/revoke/recompute,
* source-of-truth access state.

Current status:

```txt
not started
```

---

### payments

Owns:

* Stripe checkout,
* Stripe webhook,
* payment fulfillment,
* refund/dispute handling,
* idempotency,
* linking payments to patron grants.

Current status:

```txt
not started
```

---

### comments

Owns:

* comments,
* moderation,
* reports,
* reactions,
* access policy,
* moderation audit.

Current status:

```txt
not started
```

---

### email

Owns:

* email sending,
* broadcasts,
* Resend webhooks,
* retry/status semantics,
* notification jobs.

Current status:

```txt
not started
```

---

## 11. Phase X and how it relates to R0–R11

Phase X is the long-term excellence roadmap.

Phase X must not be started as a standalone roadmap before R0–R11 are complete.

However:

```txt
Every critical R phase must include the minimal X concerns that naturally belong to that domain.
```

This is the strategy that prevents Phase X from becoming a second massive refactor.

---

### 11.1 Phase X masterplan

* **X1**: Access Matrix — central access matrix.
* **X2**: Actor reasons — explicit access denial reasons.
* **X3**: Outbox — post-commit side effects.
* **X4**: Idempotency — duplicate event protection.
* **X5**: Observability — structured logs, domain events, metrics.
* **X6**: Quality gates — automatic architecture enforcement.
* **X7**: Scenario tests — product-language tests.
* **X8**: Admin cockpit — operational control center.
* **X9**: Runbooks — operational instructions.
* **X10**: Release readiness — release evidence and checklist.
* **X11**: Semantic cleanup — final schema naming cleanup.

---

### 11.2 Embedded X concerns in R phases

| R phase                  | Minimal X concerns to include                                                                                                            |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **R7 Patron + Payments** | idempotency, audit, duplicate webhook tests, refund/revoke scenario tests, DB source-of-truth checks, post-commit side effect discipline |
| **R8 Comments**          | access policy, access-denied reasons where practical, moderation audit, report/moderation scenario tests                                 |
| **R9 Email**             | idempotent webhook handling, retry/status semantics, broadcast audit, basic runbook notes                                                |
| **R10 Cleanup**          | stronger quality gates, deprecated import guards, release checklist alignment                                                            |
| **R11 Admin frontend**   | recent audit, failed webhooks/jobs, media health, payment/patron status, broadcast status, release readiness surface                     |

Do not build X1–X11 as standalone modules prematurely.

Each R phase should leave behind the hooks, tests, docs, and guardrails needed so that Phase X becomes polish and operational hardening, not a second refactor.

---

## 12. Quality gates

Validation commands:

```bash
npx prisma validate
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
npm test -- --run --coverage
npm run lint
npm run build
```

If a command cannot run because of missing environment, dependencies, database, Clerk, Stripe, or sandbox limitations, the agent must say so explicitly.

Do not write PASS if a command did not run.

Architecture guard should report:

* routes importing `@/lib/prisma`,
* routes importing `@/lib/services`,
* routes importing internal module paths,
* files importing deprecated channel adapter,
* allowlisted known blockers with phase/reason.

Current guard is allowed to use allowlists while R5–R11 are incomplete.

Allowlists must be explicit and justified.

---

## 13. Definition of Done for one refactor slice

A refactor slice is complete only when:

1. One concrete route/flow was selected.
2. Current behavior/contract was checked.
3. Use case handles the real current flow, not only future abstraction.
4. Route imports module public API through `index.ts`.
5. Route does not import `@/lib/prisma`, unless still explicitly legacy/allowlisted.
6. Route does not import `@/lib/services/**`, unless still explicitly legacy/allowlisted.
7. Route does not import internal module files.
8. DTO is minimal and safe.
9. Source-of-truth/business rule is tested.
10. Architecture guard protects the migrated route.
11. README status changes only after real runtime integration.
12. Known blockers are documented, not hidden.
13. Validation was run or inability to run it was clearly explained.

Adding a use case is not enough.

Creating a module folder is not enough.

A route is not migrated until the runtime flow uses the module and tests/guards protect it.

---

## 14. Known current blockers

### R5 Users blockers

* Admin users are not fully migrated.
* Clerk webhook completion remains.
* User-access sync boundary remains.
* Patron/payment boundary remains.
* Legacy user services may still exist.
* DB `User.isPatron` must remain source of truth.
* Clerk metadata must remain cache only.

---

### R6 Video blockers

* `app/api/access/route.ts` uses legacy `AccessPolicy` and deprecated channel adapter.
* Admin video details route may still be mixed.
* `app/api/admin/videos/resync/route.ts` remains legacy/direct Prisma or only minimally scoped.
* Public frontend migration to module DTO remains future work.
* Public DTO is safe, but public playback/access route still needs dedicated completion.
* Media delivery/proxy/media-source are not fully modularized.

---

### R7 blockers before start

R7 must not start until:

* R5/R6 blockers are reviewed,
* access route strategy is defined,
* video/admin/access boundaries are safe,
* payment/patron source-of-truth rules are written,
* mini-X requirements for R7 are accepted.

---

### Remaining large legacy domains

Not yet migrated as full modules:

* payments,
* patron,
* comments,
* email,
* referrals,
* admin cockpit,
* release readiness.

---

## 15. Certification notes

### R0/R1 Certification Pass — 2026-06-09

* Removed deprecated `userId` / `role` from `AppContext`.
* Fixed `UserPolicy.canSeeProfile()` from `actor.role` to `actor.type`.
* Documented Clerk `isPatron` as cache, not source of truth.
* Added `user.errors.ts`.
* Replaced predictable `throw new Error` in modules with `AppError` / typed errors.
* Added `lib/modules/**` to coverage.
* Added tests for Actor/AppContext, UseCaseResult, UserPolicy, and user errors.
* Strengthened architecture guard for internal module imports and mixed closed-module routes.
* Applied minimal security hardening: `PublicVideoDto` no longer exposes `videoUrl`.

Status:

```txt
R0 [x]
R1 [x]
```

---

### R2/R3/R4 Certification Pass — 2026-06-09

R2 Audit:

* Audit foundation certified.
* Module API uses `AppContext` / `Actor`.
* Supports transaction-aware recording.
* Used by migrated channel/video/users actions.
* Legacy audit paths remain for comments/payments/email/admin detail routes and belong to their domain passes.

R3 Media:

* Media safety foundation certified.
* `MediaPolicy` includes URL allowlists and private host blocking.
* Thumbnail/video/avatar/comment-image safety covered.
* `PublicVideoDto` no-leak confirmed.
* HLS/DASH detection exists only for classification.
* Media delivery/proxy/media-source remain legacy.

R4 Channel:

* Strict single-channel foundation certified.
* No runtime fallback/guessing/auto-repair should exist.
* Maintenance preview/apply is explicit and auditable.
* Legacy channel adapter usage mapped.
* Deprecated compatibility adapter remains until R5/R6/R7/R10 cleanup.

Status:

```txt
R2 [x foundation]
R3 [x safety foundation]
R4 [x single-channel foundation]
```

---

## 16. Agent report template

Every agent must finish with this report:

```md
### Refactor Report — [Task Title]

#### Summary
- ...

#### Changed files
- ...

#### README
- README updated: YES/NO
- README remains source of truth: YES/NO
- Statuses changed: YES/NO
- Current next task changed: YES/NO

#### Real phase status
- R0:
- R1:
- R2:
- R3:
- R4:
- R5:
- R6:
- R7:
- R8:
- R9:
- R10:
- R11:

#### Validation
- Prisma validate: PASS/FAIL/NOT RUN + reason
- Architecture boundaries: PASS/FAIL/NOT RUN + reason
- Typecheck: PASS/FAIL/NOT RUN + reason
- Tests: PASS/FAIL/NOT RUN + reason
- Coverage: PASS/FAIL/NOT RUN + reason
- Lint: PASS/FAIL/NOT RUN + reason
- Build: PASS/FAIL/NOT RUN + reason

#### Architecture guard
- routes with direct Prisma:
- routes with `@/lib/services`:
- routes with internal module imports:
- legacy channel adapter imports:
- new allowlist entries:

#### Legacy/deprecated adapters
- ...

#### Known blockers
- ...

#### Scope control
- Did not start unrelated domains: YES/NO
- Did not update status beyond code reality: YES/NO
- Did not hide validation failures: YES/NO

#### Next recommended step
- ...
```

---

## 17. Near-term work plan

### Step 1 — R5/R6 blocker completion

Next active work:

```txt
R5/R6 blocker completion
```

Focus:

* users admin/webhook/access boundary,
* video admin details,
* video resync use case,
* `app/api/access/route.ts`,
* guard alignment,
* no R7 yet.

---

### Step 2 — R7 readiness review

Before implementation, perform an R7 architecture audit:

* inspect payment service,
* inspect Stripe webhook,
* inspect checkout,
* inspect refund/revoke flow,
* inspect patron source-of-truth,
* write R7 use-case map,
* decide idempotency/outbox minimal scope.

---

### Step 3 — R7 Patron + Payments build

Build modules:

* `lib/modules/patron`,
* `lib/modules/payments`,
* optional `lib/modules/idempotency` foundation if needed.

R7 must include mini-X concerns from day one.

---

### Step 4 — R7 certification

Certify:

* duplicate webhook does not double grant,
* refund revokes patron access,
* subscription never grants patron access,
* checkout never uses client `creatorId`,
* DB `User.isPatron` is source of truth,
* audit is written,
* side effects are post-commit or explicitly safe.

---

### Step 5 — R8/R9/R10/R11

Proceed only after R7 is stable.

---

## 18. Final project target

After R0–R11:

```txt
A clean, practical, production-grade modular monolith for a strict single-channel creator platform.
```

After Phase X:

```txt
A self-monitoring operational system for a private creator media platform.
```

The goal is not maximum abstraction.

The goal is:

```txt
the fewest places where future agents or developers can make dangerous mistakes.
```
