# VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001 — Publication, hero and admin video state contract

Status: DONE
Role: Builder
Priority: Launch-critical
Launch status: NO_GO
Type: Runtime implementation + focused tests

## Product decision

This ticket replaces the old standalone `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001` card. It must run after `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`, because publication correctness depends on a coherent provider asset lifecycle.

Current main already has `publishAdminVideo`, backend publish-after-ready, admin publish/unpublish/archive actions, hero flags, sidebar fields, and video diagnostics. The remaining work is to make video state transitions explicit, idempotent, observable, and consistent across manual publish and automatic publish-after-ready.

## Goal

Define and enforce one stable contract for manual publish, automatic publish after Cloudflare READY, unpublish to draft, archive/restore, hero video selection, sidebar visibility/order, `publishedAt` semantics, and admin diagnostics for blocked publication.

## Required implementation

### A. Publication state machine

- Document and enforce allowed transitions: `DRAFT -> PUBLISHED`, `PUBLISHED -> DRAFT`, `DRAFT/PUBLISHED -> ARCHIVED`, and `ARCHIVED -> DRAFT`.
- `publishAdminVideo` remains the only backend gate for publication.
- Publication must require a primary Cloudflare Stream asset in `READY` state.
- Manual publish and publish-after-ready must share the same validation path and stable error codes.
- Repeated publish on an already published video must be idempotent and must not duplicate audit noise.

### B. publishedAt semantics

- Decide and enforce whether `publishedAt` is first-published-at or current-published-at.
- Encode this behavior in tests.
- Unpublish/archive must not accidentally erase historical data unless explicitly intended.

### C. Hero contract

- A hero video must be published, public, playable, and non-archived.
- Setting one hero must clear previous hero in the same channel/main scope.
- Unpublishing or archiving a hero video must clear or block hero status consistently.
- Admin UI must explain why a video cannot be made hero.

### D. Sidebar contract

- Sidebar visibility/order updates must be validated server-side.
- Archived or non-published videos must not become visible in public sidebar unless explicitly allowed by product decision.
- Add tests for sidebar order and visibility transitions.

### E. Admin diagnostics

- Show publication blockers in admin details/list: missing asset, non-Cloudflare asset, non-primary asset, asset not READY, provider sync failed, publish-after-ready error, and hero not allowed.
- Diagnostics must be useful to the admin without exposing sensitive provider details.

## Non-goals

- Do not implement upload/import lifecycle here; that belongs to `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`.
- Do not change public playback behavior except where needed to validate publishability.
- Do not claim public launch readiness.

## Allowed paths

- `app/admin/videos/**`
- `app/api/admin/videos/**`
- `lib/modules/video/**`
- `lib/modules/channel/**` only for hero/sidebar channel consistency if required
- `tests/unit/**video**`
- `tests/unit/api/**` for admin route tests
- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` for status updates

## Acceptance criteria

- Publication transition rules are enforced server-side and represented truthfully in admin UI.
- Hero cannot point to an invalid video state.
- Sidebar cannot expose invalid video states.
- `publishedAt` behavior is intentional and covered by tests.
- Manual and automatic publish use the same publication gate.
- Audit events are useful and not spammy.

## Validation

- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- targeted video publication/hero/sidebar tests
- `npm run build`

## Expected PR report

Include state-machine decision, changed files, tests, migration status if none, remaining risks, and confirmation that public launch remains `NO_GO`.
