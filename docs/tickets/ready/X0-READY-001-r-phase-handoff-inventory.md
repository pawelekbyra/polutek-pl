# X0-READY-001 — Zinwentaryzować stan R0-R11 po handoff i porównać root README, docs/audit, guardy i aktualny kod.

## ID

X0-READY-001

## Status

READY

## Lane

cleanup-legacy

## Type

Documentation / Inventory

## Goal

Zinwentaryzować stan R0-R11 po handoff i porównać root README, docs/audit, guardy i aktualny kod.

## Scope

Docs/inventory/spec work only unless a future owner-approved runtime ticket explicitly says otherwise.

## Allowed paths

docs/reports/reconciliation/**, docs/audit/** read-only references, README.md read-only reference

## Forbidden paths

app/**, lib/**, prisma/**, package.json, package-lock.json, scripts/check-architecture.ts

Always forbidden for this ready ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Raport inventory bez zmian runtime; lista blokad aktywacji; rekomendacja GO/FIX/BLOCKED dla X0 activation.

## Validation

git diff --check; npm run quality:architecture-boundaries if feasible

## Definition of done

Report exists, blockers listed, no runtime files changed.

## Expected PR report

Summary, evidence, blockers, activation recommendation.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

SERIAL

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
