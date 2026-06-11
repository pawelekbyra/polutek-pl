# X2-READY-001 — Zinwentaryzować obecne źródła prawdy access i mismatch z PatronGrant target.

## ID

X2-READY-001

## Status

READY

## Lane

access

## Type

Inventory

## Goal

Zinwentaryzować obecne źródła prawdy access i mismatch z PatronGrant target.

## Scope

Docs/inventory/spec work only unless a future owner-approved runtime ticket explicitly says otherwise.

## Allowed paths

docs/reports/reconciliation/**, docs/specs/ACCESS-PATRON-SPEC.md read-only; code read-only

## Forbidden paths

runtime edits, prisma edits, package files

Always forbidden for this ready ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Inventory: User.isPatron, Clerk metadata, Subscription, PatronGrant, PlaybackPlan denial.

## Validation

git diff --check; npm run quality:architecture-boundaries if feasible

## Definition of done

Access truth map complete.

## Expected PR report

Access gap report.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

SERIAL

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
