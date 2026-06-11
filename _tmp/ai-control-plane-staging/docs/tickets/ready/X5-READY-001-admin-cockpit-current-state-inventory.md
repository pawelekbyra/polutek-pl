# X5-READY-001 — Zinwentaryzować admin cockpit vs Access Diagnostics first target.

## ID

X5-READY-001

## Status

READY_AFTER_CONTROL_PLANE_ACTIVATION

## Lane

admin-cockpit

## Type

Inventory

## Goal

Zinwentaryzować admin cockpit vs Access Diagnostics first target.

## Scope

Docs/inventory/spec work only unless a future active version of this ticket explicitly says otherwise.

## Allowed paths

docs/reports/reconciliation/**, docs/specs/ADMIN-COCKPIT-SPEC.md read-only; code read-only

## Forbidden paths

runtime edits, prisma edits, package files

Always forbidden for this staged seed ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Inventory admin pages/routes, paid-but-locked diagnostics gaps, manual action audit gaps.

## Validation

git diff --check; npm run quality:architecture-boundaries if feasible

## Definition of done

Admin gap map complete.

## Expected PR report

Admin cockpit inventory report.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

CAUTION

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
