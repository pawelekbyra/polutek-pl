# PAYMENTS-WEBHOOK-SYSTEM-ACTOR-001 — Stripe webhook system actor context

Ticket ID: PAYMENTS-WEBHOOK-SYSTEM-ACTOR-001
Status: READY_FOR_BUILDER
Role: Builder / Reviewer
Priority: P0
Launch status: NO_GO
Type: Focused payment runtime safety fix + regression tests

## Product decision

A post-PR review found a P0 payment blocker after `CI-SIGNAL-RECONCILIATION-002` was opened: the Stripe webhook route creates `AppContext` without `actor: { type: 'system' }`. Payment fulfillment can therefore call `grantPatron` / `revokePatron` under the default guest actor.

Payment-to-PatronGrant fulfillment is not launch-green until the webhook actor context is fixed and covered by regression tests. Public launch remains `NO_GO`.

This ticket runs before `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001`.

## Goal

Ensure Stripe webhook fulfillment executes under an explicit backend system actor, not a guest/default actor, so automated payment fulfillment and refund/dispute handling can safely create, suspend, reactivate, or revoke `PatronGrant` records through the patron module.

## Required implementation

### A. Webhook actor context

- Find the Stripe webhook route that creates `AppContext` for payment fulfillment.
- Ensure the webhook path passes an explicit `actor: { type: 'system' }` or the project’s canonical equivalent into the context used by fulfillment.
- Preserve raw-body/signature verification behavior.
- Preserve payment fulfillment idempotency and local Payment truth behavior from `PAYMENTS-FULFILLMENT-IDEMPOTENCY-HARDENING-001`.

### B. PatronGrant mutation safety

- Verify `grantPatron` / `revokePatron` and related fulfillment paths receive a system actor when invoked by the Stripe webhook.
- Do not reintroduce `User.isPatron`, Clerk metadata, Stripe metadata, frontend state, or `Payment` alone as backend access truth.
- Keep `exists ACTIVE PatronGrant` as the patron access source of truth.

### C. Regression tests

- Add or update focused tests proving webhook fulfillment uses the system actor for grant/revoke lifecycle calls.
- Include at least one negative/regression assertion that the webhook path is not using the default guest actor for PatronGrant mutation.
- Keep tests narrow; do not broaden into production Stripe smoke/operator evidence.

## Non-goals

- Do not redesign payment fulfillment.
- Do not change payment schema or migrations.
- Do not change checkout UX.
- Do not change admin auth/channel diagnostics; that is the next ticket.
- Do not claim payments are fully launch-green or public-launch certified.
- Do not perform production Stripe smoke evidence; that remains operator/X7 evidence.

## Allowed paths

- Stripe webhook route files under `app/api/**/stripe/**` or the existing webhook route location.
- Payment fulfillment code under `lib/modules/payment/**` only where required for the actor context fix.
- Patron module tests or payment webhook tests under `tests/**` only where required for focused regression coverage.
- `docs/reports/reconciliation/**` for the PR report if needed.
- `docs/tickets/ready/**` for status updates.

## Acceptance criteria

- Stripe webhook fulfillment creates/uses `AppContext` with an explicit system actor.
- Payment-triggered PatronGrant grant/revoke lifecycle calls do not run under a guest/default actor.
- Focused regression tests cover the actor context behavior.
- Existing payment idempotency/local truth behavior remains intact.
- Payment runtime is safer, but launch status remains `NO_GO` until operator/legal/X7 evidence and final owner decision are complete.

## Validation

- `git diff --check`
- focused payment webhook / PatronGrant actor tests
- `npm run lint`
- `npm run typecheck`
- `npm run build` if the environment supports the full build

## Expected PR report

Include summary, changed files, exact actor-context change, tests, payment invariants preserved, intentionally untouched areas, risks/follow-ups, and confirmation that public launch remains `NO_GO`.
