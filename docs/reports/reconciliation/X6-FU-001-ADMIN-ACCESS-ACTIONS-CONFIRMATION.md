# X6-FU-001 — Admin access actions confirmation

Status: `IMPLEMENTED`
Verdict: `MERGE`

## Summary

This PR replaces browser prompt-based manual Patron grant/revoke actions with a structured confirmation dialog on the admin user detail page. The workflow requires a non-empty audit reason, displays the access effect before confirmation, makes revoke visually destructive, blocks duplicate submits while pending, and keeps retryable error feedback visible.

It also adds a compact read-only paid-but-locked diagnostic summary using existing admin user detail data: payment facts, active/revoked PatronGrant records, PatronGrant truth, cache mismatch, and newsletter/subscription state explicitly labeled as unrelated to access.

## Intent

Reduce launch-critical support risk around admin access-impact actions by making manual PatronGrant changes deliberate, accessible, auditable, and clear about the active PatronGrant source of truth.

## Changed files

- `app/admin/users/UserPatronActions.tsx` — structured grant/revoke confirmation dialog, required reason, pending guard, success/error feedback.
- `app/admin/users/AdminAccessDiagnostics.tsx` — read-only access diagnostic summary.
- `app/admin/users/[userId]/page.tsx` — renders the diagnostic summary next to admin Patron actions.
- `tests/unit/admin-user-access-actions-ui.test.ts` — focused characterization tests for the UI contract and diagnostics source-of-truth copy.
- `docs/tickets/ready/X6-FU-001-admin-access-actions-confirmation.md` — ticket status moved from proposed to implemented after owner activation.
- `docs/reports/reconciliation/X6-FU-001-ADMIN-ACCESS-ACTIONS-CONFIRMATION.md` — implementation report.

## Validation commands with result

- `git diff --check` — passed.
- `npm run lint` — passed with an existing warning in `app/admin/videos/page.tsx` about `migrationStatusFilter` hook dependency; no new lint failures.
- `npm run typecheck` — passed.
- `npm run quality:architecture-boundaries` — passed with existing allowlisted temporary route service import warnings.
- `npm test -- --run tests/unit/admin-user-access-actions-ui.test.ts` — passed, 8 tests.

## Scope confirmation

Implemented exactly the owner-activated X6-FU-001 runtime/UI follow-up. The work stays within the allowed admin user UI, focused test, ticket status, and report paths.

## What did not change

- No payment policy changes.
- No PatronGrant backend policy changes.
- No API route/use-case changes.
- No schema or migration changes.
- No package/dependency changes.
- No global docs/roadmap changes.
- No video, playback, or comments changes.

## Risks

- Focused tests are source-level characterization tests because this repository's Vitest setup is Node-only and does not include React Testing Library/jsdom component rendering conventions.
- The admin detail page is still a client-side `any` DTO consumer; this PR did not broaden scope into typing the full admin user DTO.

## Follow-ups

- Consider adding a repository-standard React component test harness for admin UI flows if future tickets need DOM-level interaction tests.
- Existing lint warning in `app/admin/videos/page.tsx` should be handled separately.

## Ticket status

`IMPLEMENTED` — ready for review.
