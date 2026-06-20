# CI-SIGNAL-RECONCILIATION-002 — CI/test/control-plane signal reconciliation

Ticket ID: CI-SIGNAL-RECONCILIATION-002
Status: READY_FOR_BUILDER
Role: Builder / Reviewer
Priority: P0
Launch status: NO_GO
Type: CI/test/control-plane signal restoration + mechanical cleanup

## Product decision

This ticket is created from the 2026-06-20 architecture launch-readiness audit. It runs after `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001`, because payments was already the active executable ticket and has now completed in PR #996 pending review/merge.

This is not a broad app refactor. It is a narrow confidence-restoration ticket so later work can trust CI/test/control-plane signals.

## Goal

Restore trustworthy CI/test/control-plane signal before continuing with non-payments launch-hardening work.

## Required implementation

### A. Test signal

- Inspect `package.json` test scripts and `.github/workflows/ci.yml`.
- Ensure CI has a job that runs the real Vitest suite or clearly distinguish any narrow smoke/critical-path command from full coverage.
- If a narrow critical-path command remains useful, rename it so it does not masquerade as full coverage.
- Do not remove focused test commands that are useful for local development.

### B. strict-escapes reconciliation

- Run `npm run quality:strict-escapes`.
- Fix straightforward unsafe type escapes where safe.
- Reconcile baseline entries that are stale, moved, or newly justified.
- Do not weaken the strict-escapes guard.

### C. hotspots reconciliation

- Run `npm run quality:hotspots`.
- Bring the admin video hotspot back under budget through extraction only.
- Preserve behavior and route/API contracts.

### D. control-plane docs

- Update `docs/MASTERPLAN.md` so CI risks reflect current reality:
  - guards may be wired but red;
  - narrow test commands are not full-suite evidence;
  - Vercel READY remains deployment evidence only.
- Keep `docs/tickets/ready/README.md` as the executable source of truth.
- Keep public launch `NO_GO`.

### E. audit finding routing

Ensure these findings are not lost:

- payment metadata-user and request-id idempotency findings were owned by the payments ticket and are recorded as completed pending PR #996 review/merge;
- dead legacy payment service paths were handled by PR #996 by delegating legacy fulfillment to the hardened modular use case;
- admin auth wrapper consistency belongs to `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`;
- playback `getGatedMedia` footgun is already playback-domain evidence and should be considered in final cleanup only if PR #994 did not resolve it.

## Non-goals

- Do not change payment fulfillment behavior.
- Do not change playback/access runtime behavior.
- Do not change admin auth semantics.
- Do not add migrations.
- Do not add dependencies unless strictly necessary.
- Do not claim launch readiness.

## Allowed paths

- `.github/workflows/ci.yml`
- `package.json`
- `scripts/strict-escapes-baseline.jsonc`
- files directly listed by current strict-escapes violations
- `app/admin/videos/page.tsx`
- `app/admin/videos/**` for behavior-preserving extraction only
- `docs/MASTERPLAN.md`
- `docs/roadmap/Launch-Execution-Backlog.md`
- `docs/tickets/ready/README.md`
- `docs/reports/reconciliation/**`
- `docs/tickets/ready/CI-SIGNAL-RECONCILIATION-002.md`

## Acceptance criteria

- CI/test naming accurately distinguishes full-suite signal from narrow smoke/critical-path checks.
- `npm run quality:strict-escapes` passes without weakening the guard.
- `npm run quality:hotspots` passes or any remaining exception is explicit and justified.
- `npm run quality:architecture-boundaries` remains green.
- `node scripts/check-control-plane-docs.mjs` remains green.
- Masterplan and backlog docs route every important audit finding to the correct owner ticket.
- Public launch remains `NO_GO`.

## Validation

- `git diff --check`
- `npm run quality:strict-escapes`
- `npm run quality:hotspots`
- `npm run quality:architecture-boundaries`
- `node scripts/check-control-plane-docs.mjs`
- corrected test command from `package.json`
- `npm run lint`
- `npm run typecheck` if the environment supports Prisma generation/types

## Expected PR report

Include summary, changed files, exact CI/test signal changes, strict-escapes/hotspots result, audit findings routed to other tickets, intentionally untouched areas, and confirmation that public launch remains `NO_GO`.
