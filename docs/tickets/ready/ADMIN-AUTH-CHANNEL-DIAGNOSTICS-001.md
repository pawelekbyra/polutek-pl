# ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001 — Admin auth reverification and production-safe channel diagnostics

Status: PLANNED_AFTER_PAYMENTS_HARDENING
Role: Builder / Reviewer
Priority: High
Launch status: NO_GO
Type: Focused runtime hardening + tests

## Product decision

This ticket merges `ADMIN-AUTH-POSTMERGE-REVERIFY-001` and `ADMIN-CHANNEL-ROOT-CAUSE-001` into one practical hardening task. Current main already uses DB-backed admin actor resolution through `requireAdminActor` / `requireAdminForApi`. The remaining value is regression coverage, deleted-user/admin-revocation tests, and production-safe diagnostics for admin channel failures.

## Goal

Prove and harden that admin routes and admin channel data use DB-authoritative identity/role state, return stable public errors, and expose useful diagnostics without leaking internals.

## Required implementation

### A. Admin auth regression pack

- Verify configured admin and DB role admin paths.
- Verify revoked admin and deleted user denial.
- Verify non-admin user denial for every admin route family used by the app.
- Verify comment moderation/admin actions still respect backend actor capabilities.
- Do not use Clerk metadata/publicMetadata as server authorization truth.

### B. Admin channel diagnostics

- Add or improve diagnostics around main channel lookup, missing channel, DB/schema mismatch, and connection errors.
- Public/admin-facing error responses should be stable and safe.
- Server logs should contain enough request/context information for operators, without secrets or raw DB URLs.
- DTOs should be typed tightly enough that admin UI does not depend on accidental `any` shapes for critical channel/video state.

### C. Test coverage

- Add focused route/use-case tests for admin auth denial and allowed paths.
- Add tests for missing/deleted main channel behavior.
- Add tests that sensitive errors are not exposed in JSON responses.
- Add tests for diagnostics DTO shape if admin UI consumes it.

## Non-goals

- Do not redesign admin UI broadly.
- Do not change payment, playback or Cloudflare lifecycle code except where tests reveal direct auth/channel defects.
- Do not claim production DB/operator evidence.

## Allowed paths

- `lib/api/auth.ts`
- `lib/auth-utils.ts`
- `lib/admin-config.ts`
- `lib/modules/channel/**`
- `lib/modules/video/**` only where admin channel DTO/diagnostics require focused changes
- `app/api/admin/**`
- `app/admin/**` only for safe display of diagnostics/errors
- `tests/unit/**admin**`
- `tests/unit/**auth**`
- `tests/unit/**channel**`
- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**` for status updates

## Acceptance criteria

- Admin authorization is DB-authoritative and covered by regression tests.
- Deleted/revoked users cannot access admin routes.
- Admin channel failures produce stable, non-sensitive errors and useful server diagnostics.
- Admin UI can display actionable channel/video diagnostics without relying on broad `any` contracts.

## Validation

- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- targeted admin/auth/channel tests
- `npm run build`

## Expected PR report

Include auth model confirmed, route families covered, diagnostics added, tests, known operator-only gaps, and confirmation that public launch remains `NO_GO`.
