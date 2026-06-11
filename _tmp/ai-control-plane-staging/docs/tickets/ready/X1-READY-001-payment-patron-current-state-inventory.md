# X1-READY-001 — Zinwentaryzować aktualne payment/patron side effects vs target lifecycle.

## ID

X1-READY-001

## Status

READY_AFTER_CONTROL_PLANE_ACTIVATION

## Lane

payments-patron

## Type

Inventory

## Goal

Zinwentaryzować aktualne payment/patron side effects vs target lifecycle.

## Scope

Docs/inventory/spec work only unless a future active version of this ticket explicitly says otherwise.

## Allowed paths

docs/reports/reconciliation/**, docs/specs/PAYMENTS-PATRON-SAFETY-SPEC.md read-only; code read-only

## Forbidden paths

runtime edits, prisma edits, package files

Always forbidden for this staged seed ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Inventory: Stripe webhook, Payment, PatronGrant, refunds, disputes, manual grants, audit gaps.

## Validation

git diff --check; npm run quality:architecture-boundaries if feasible

## Definition of done

Inventory complete; runtime unchanged.

## Expected PR report

Gap report with ticket candidates.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

SERIAL

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
