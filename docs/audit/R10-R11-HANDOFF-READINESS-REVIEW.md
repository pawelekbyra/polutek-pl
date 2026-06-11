# R10/R11 Handoff Readiness Review

## Status

READY_WITH_MINOR_DOC_FIXES

## Executive summary

The current tree is close to being ready for a separate Post-R control-plane activation PR, but it should not be activated yet without a small documentation reconciliation and owner PR hygiene pass.

No runtime activation was performed. The review found that R10 direct-Prisma cleanup is truthful in current `app/api/**`: no API route imports `@/lib/prisma` directly, focused R10 routes are now thin adapters over public module APIs, and `npm run quality:architecture-boundaries` passes. The staged control plane is also safely staged: `_tmp/ai-control-plane-staging/AGENTS.md` is absent and `_tmp/ai-control-plane-staging/AGENTS.template.md` exists.

Remaining issues are mostly reconciliation issues:

- Root `README.md` and older R10 audit docs still contain stale next-step wording that says admin comments moderation cleanup remains next, even though current code has modular admin comments routes and the old comment moderation services are gone.
- The architecture guard still carries stale allowlist entries for routes that are now clean, and it counts but does not fail direct `@/lib/services/` imports in routes.
- Legacy payment/patron/user-access bridges remain and should be explicitly ticketed for Post-R cleanup rather than silently treated as fully gone.
- Open PR status for #817/#814 could not be verified from this environment; owner should close or refresh them before activation.

## What was inspected

- Focused R10 routes:
  - `app/api/admin/comments/**`
  - `app/api/admin/videos/[id]/route.ts`
  - `app/api/admin/users/[userId]/route.ts`
  - `app/api/media/[...path]/route.ts`
  - `app/api/videos/[id]/playback-event/route.ts`
- Broader `app/api/**` import boundaries for direct `@/lib/prisma`, direct `@/lib/services/**`, and internal module imports.
- `scripts/check-architecture.ts` guard rules, allowlists, direct Prisma logic, closed-module logic, and legacy service checks.
- `lib/services/**`, especially patron/payment/user-access/content/comments leftovers.
- `lib/modules/patron`, `lib/modules/payments`, `lib/modules/access`, `lib/modules/media`, `lib/modules/video`, and `lib/modules/comments` for product invariant alignment.
- Current R7/R8/R9/R10 docs in `README.md` and `docs/audit/**`.
- Staged control-plane files under `_tmp/ai-control-plane-staging/**`.
- PR #817/#814 status was attempted via GitHub CLI and GitHub API, but this environment could not verify them.

## R10 cleanup status

- Direct Prisma in app/api routes: **PASS for current tree.** `rg -n "@/lib/prisma" app/api` returned no matches, and `npm run quality:architecture-boundaries` reported `Routes importing @/lib/prisma: 0 (0 allowlisted)`.
- Direct lib/services imports in app/api routes: **PARTIAL / known follow-up.** Current `app/api/**` still has five direct `@/lib/services/` imports:
  - `app/api/media-source/[videoId]/route.ts` imports legacy `PlaybackService`.
  - `app/api/channel/sidebar/route.ts` imports `ChannelLayoutService`.
  - `app/api/admin/users/[userId]/patron/route.ts` imports `UserAccessService`.
  - `app/api/admin/users/route.ts` imports `parseUserQueryParams` from `lib/services/admin/admin-query-parser`.
  - `app/api/admin/videos/route.ts` imports `parseVideoQueryParams` from `lib/services/admin/admin-query-parser`.
- Route thinness: **PASS for focused R10 routes.** Focused routes primarily perform request parsing, auth/rate-limit setup, context creation, use-case invocation, and response mapping. Business logic is now concentrated in modules/use cases rather than in the route handlers.
- Comments admin cleanup: **PASS for current code.** Admin comment routes import public `@/lib/modules/comments` use cases, not `@/lib/prisma` or removed legacy comment services. The remaining `lib/services/comments/comment.dto.ts` is a DTO compatibility file used by frontend components, not a moderation service implementation.
- Admin videos/users route cleanup: **PASS for the specific `[id]` and `[userId]` detail routes requested.** Both route files use public module APIs (`getAdminVideoDetails`, `getAdminUserDetails`) and context/response helpers. Broader admin users/videos list routes still import `admin-query-parser` helpers from `lib/services/admin`, which should be tracked as a future cleanup ticket.
- Media gated route cleanup: **PASS with legacy edge.** `app/api/media/[...path]/route.ts` delegates access/source checks to `getGatedMedia` and only calls `getGatedBlobResponse` after the module returns an allowed media source. It still uses blob/rate-limit infrastructure directly, which is acceptable route-adapter work for now.
- Playback-event route cleanup: **PASS with watch item.** `app/api/videos/[id]/playback-event/route.ts` delegates persistence and access checks to `recordPlaybackEventUseCase`. That use case performs backend access validation before recording non-`ACCESS_ERROR` events and only increments views after a valid session and `WATCHED_10_SECONDS` event.

## Architecture guard status

- Current state: `npm run quality:architecture-boundaries` passes. The guard reports zero direct Prisma route imports and zero route internal module imports.
- Stale allowlists:
  - `KNOWN_ROUTE_VIOLATIONS_ALLOWLIST` still includes several routes now described as migrated/certified rather than active violations, including admin comment and R8 comment routes.
  - The allowlist includes `app/api/videos/[id]/playback-event/route.ts` with a stale reason saying it still uses direct Prisma for event/view persistence; the current route delegates to `recordPlaybackEventUseCase`.
  - The guard has `PRISMA_ROUTES_ALLOWLIST: Record<string, string> = {}`, which is truthful and good.
- Missing protections:
  - Direct `@/lib/services/` imports in routes are counted but not failed globally. This is intentionally tolerant for current legacy bridges, but it means route service imports can persist unless a future ticket tightens the guard.
  - The legacy AccessPolicy allowance still contains stale patterns for `services/comments`, even though the old comment services are gone.
  - Guard wording around stale migrated route allowlist entries can obscure whether a route is truly still exempt or merely documented history.
- Recommended follow-up tickets:
  - **R10-GUARD-001:** Remove stale `KNOWN_ROUTE_VIOLATIONS_ALLOWLIST` entries for routes that no longer bypass module boundaries.
  - **R10-GUARD-002:** Convert direct route `@/lib/services/` imports from statistics-only to an explicit allowlist with owner-approved reasons.
  - **R10-GUARD-003:** Refresh legacy AccessPolicy allowances after R10 comment service deletion.

## Legacy services status

| Path | Classification | Risk | Recommended action |
| --- | --- | --- | --- |
| `lib/services/patron.service.ts` | intentional temporary legacy | Medium: compatibility bridge exports `grantPatronStatus` / `revokePatronStatus`; it delegates to `lib/modules/patron`, but still exposes legacy `isPatron`-shaped results. | Keep until payment fulfillment/test dependencies are migrated; create Post-R cleanup ticket to remove bridge callers. |
| `lib/services/payments/fulfillment.service.ts` | needs future ticket | Medium: still calls `grantPatronStatus`, so payment fulfillment relies on the patron legacy bridge even though the bridge delegates to the patron module. | Ticket migration to direct `grantPatron` module use case or a fully modular fulfillment use case. |
| `lib/services/payment.service.ts` | intentional temporary legacy | Low/Medium: deprecated facade around specialized payment services and modular use cases. | Keep as compatibility facade until no runtime/tests import it; track removal separately. |
| `lib/services/user-access.service.ts` | dangerous | Medium/High: deprecated bridge syncs Clerk metadata and has stale comment wording saying access decisions should rely on `User.isPatron`, which conflicts with the target invariant that active `PatronGrant` is the access truth. Runtime recalculation delegates to `recalculatePatronStatus`, but the wording and bridge are risky. | Create focused R10/R7 follow-up ticket to update/remove stale invariant wording and retire direct route/module callers. |
| `lib/services/comments/comment.dto.ts` | safe leftover | Low: DTO-only compatibility used by frontend comment components; old moderation services are gone. | Keep until frontend imports are migrated to module DTOs; no activation blocker. |
| `lib/services/content.service.ts` | needs future ticket | Low/Medium: deprecated content facade still used by sitemap/tests. | Ticket migration to module/content-specific public API before removal. |
| `lib/services/content/video.service.ts` | needs future ticket | Low/Medium: deprecated legacy service still imports legacy access policy and is referenced by content facade/tests. | Keep until content facade is replaced; include in legacy AccessPolicy cleanup. |
| `lib/services/content/creator.service.ts` | intentional temporary legacy | Low: still used by root/channel pages for read-side content loading. | Keep until a content/channel module read model replaces it. |
| `lib/services/audit.service.ts` | intentional temporary legacy | Low/Medium: still needed by legacy bridge flows such as Clerk sync failure audit. | Keep until audit module fully owns these flows. |
| `lib/services/email.service.ts` | intentional temporary legacy | Low/Medium: R9 has modular email use cases, but provider compatibility remains. | Keep until provider boundary is fully migrated. |
| `lib/services/storage/storage.service.ts` | intentional temporary legacy | Low/Medium: playback service still uses it for presigned URLs. | Keep until media/video provider ticket replaces storage signing with a module/provider boundary. |
| `lib/services/user.service.ts` | safe leftover | Low if unused in runtime; deprecated facade mostly retained for tests/allowlist history. | Verify no production imports, then remove in dead-service cleanup ticket. |
| `lib/services/user/profile.service.ts` | intentional temporary legacy | Medium: `lib/modules/users` still uses it as a bridge for get-or-create current user behavior. | Keep until users module owns profile creation fully. |
| `lib/services/admin/admin-query-parser.ts` | needs future ticket | Low: route query parsing helper still imported by admin users/videos list routes. | Move to route-local helper or module-facing query DTO parser in a small cleanup ticket. |

## Product invariants check

- Payment vs PatronGrant vs Subscription: **Mostly aligned, with legacy bridges.** Payment modular code records financial facts and Patron module owns grants. Subscription module is separate newsletter/mailing consent. Legacy payment fulfillment still reaches Patron through `grantPatronStatus`, so the bridge must remain tracked.
- Patron access target truth: **Target aligned in modules.** Patron recalculation and access use cases read active `PatronGrant` state. This matches target truth: `active PatronGrant`.
- User.isPatron legacy: **Known risk.** `User.isPatron` remains as legacy/migration/display state and is still exposed by compatibility bridge results. It must not be treated as the backend source of truth. `lib/services/user-access.service.ts` contains stale wording that should be fixed in a future docs/runtime-comment cleanup ticket.
- Clerk metadata: **Known non-source-of-truth.** Clerk metadata sync remains a compatibility/frontend convenience path, not the access authority. Keep this explicit in activation docs and future tickets.
- PlaybackPlan denied states: **Aligned for reviewed paths.** Denied playback plans return `canPlay: false` with `source: undefined`; the gated media module returns denied errors before building allowed media responses. Playback event recording checks backend access and denies non-`ACCESS_ERROR` events when access is missing, preventing denied playback from counting views.
- Comments visibility vs permission: **Mostly aligned.** Current modular comments use access checks to gate writing/reactions/reporting/moderation context. Public visibility for reading locked patron comments should remain explicitly tested in Post-R comment spec/tickets because current use cases still check video access before listing comments.
- Email Subscription != Patron: **Aligned at module boundary.** Subscription code is separate from Patron/Payment code; no inspected path indicated newsletter subscription granting patron access.

## Staged control plane readiness

- AGENTS.template.md: **PASS.** `_tmp/ai-control-plane-staging/AGENTS.template.md` exists.
- No staged AGENTS.md: **PASS.** `_tmp/ai-control-plane-staging/AGENTS.md` does not exist.
- MANIFEST: **PASS.** `MANIFEST.md` lists `AGENTS.template.md` as the staged future contract template and documents the future copy/rename to root `AGENTS.md` during activation.
- root README staging note: **PASS.** Root README states the staged control plane is not active and root README remains the active R-phase source of truth until R10/R11 handoff/certification or explicit owner approval.
- X0.5: **PASS.** Seed tickets exist under `_tmp/ai-control-plane-staging/docs/tickets/ready/X0.5-*`.
- X7: **PASS.** Seed ticket `_tmp/ai-control-plane-staging/docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md` exists.
- OWNER-TIMELINE: **PASS.** `_tmp/ai-control-plane-staging/docs/roadmap/OWNER-TIMELINE.md` exists.
- CODEX-WORKFLOW: **PASS.** `_tmp/ai-control-plane-staging/docs/roadmap/CODEX-WORKFLOW.md` exists.
- specs: **PASS.** Staged specs exist for access, admin cockpit, comments/moderation, email/comms, launch readiness, observability/support, payments/patron safety, playback/player, and video provider.
- seed tickets: **PASS.** Staged ready tickets exist for X0, X0.5, X1, X2, X3, X4, X5, and X7. No activation was performed.

## Open PR / stale PR notes

- #817: Could not verify live PR status from this environment. GitHub CLI produced no usable output, and direct GitHub API requests failed with `Tunnel connection failed: 403 Forbidden`. Owner should close #817 as superseded by #818 if it is still open.
- #814: Could not verify live PR status from this environment. Owner should close or refresh #814 because any activation review predating #815/#816/#818 is stale.

## Blockers

No runtime blockers were found for a future docs-only activation PR, but the following should be resolved before activation is merged:

1. **Minor docs reconciliation:** Root README and older R10 audit docs still imply admin comments cleanup is the next task. Current code indicates that specific cleanup is already done.
2. **Guard reconciliation:** Stale route allowlist reasons should be cleaned up so future agents do not mistake historical exemptions for active violations.
3. **Legacy service ticketing:** Direct route `@/lib/services/` imports and payment/patron/user-access bridges should be documented as explicit future tickets, not hidden debt.
4. **Stale PR hygiene:** #817 should be closed as superseded by #818 if open; #814 should be closed or refreshed if open.

## Recommended next step

Minor docs fix first.

Make one small docs/guard-reconciliation PR that:

- Updates root README current task/process text so it no longer says admin comments moderation cleanup is still next.
- Refreshes R10 audit docs or adds a short reconciliation note pointing to this review.
- Optionally, in a separate guard-only PR, removes stale allowlist entries and introduces an explicit allowlist for the five current direct route service imports.

After that, the owner can decide whether to run the separate Integrator activation PR or require R11 docs/spec first.

## Suggested next Codex prompt

```txt
You are Codex working in pawelekbyra/kraufanding.

Role: Integrator / docs-only R10 reconciliation.

Start from current main. Do not activate the Post-R control plane. Do not create root AGENTS.md. Do not move staged files from _tmp/ai-control-plane-staging/ into root docs/.

Task: perform the minor docs reconciliation identified by docs/audit/R10-R11-HANDOFF-READINESS-REVIEW.md.

Allowed paths: README.md and docs/audit/** only.

Required changes:
- Update the current-task/process wording in README.md so it no longer says R10 admin comments moderation cleanup is still the next task.
- Keep README cautious: R10 is not fully certified; R11 has not started; Post-R control plane remains staged/inactive.
- Add or update a short R10 reconciliation note in docs/audit/** that points to the readiness review and records remaining follow-ups: guard allowlist cleanup, direct route service import ticketing, legacy payment/patron/user-access bridge cleanup.

Do not modify runtime code, tests, Prisma, package files, scripts/check-architecture.ts, or staged control-plane files.

Run git diff --check and report validation honestly.
```

## Validation

- git diff --check: **PASS**.
- npm run quality:architecture-boundaries: **PASS**. Output reported 0 direct Prisma route imports, 5 route service imports, 0 internal module imports, and `Architecture check passed`.
- npm run typecheck: **PASS**.
- other:
  - `rg -n "@/lib/prisma" app/api`: **PASS**, no matches.
  - `rg -n "@/lib/services/" app/api`: **INFO**, five current route service imports listed above.
  - Staged control-plane file checks: **PASS** for no staged `AGENTS.md`, existing `AGENTS.template.md`, and required staged roadmap/spec/ticket files.
  - PR #817/#814 live status verification: **BLOCKED**, GitHub API unavailable from environment (`Tunnel connection failed: 403 Forbidden`) and no remote was configured.

## Final recommendation

READY_FOR_OWNER_DECISION
