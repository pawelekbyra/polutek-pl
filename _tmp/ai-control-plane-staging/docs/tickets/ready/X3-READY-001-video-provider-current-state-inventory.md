# X3-READY-001 — Zinwentaryzować obecne video/media provider usage i migrację do Cloudflare-first/Mux-ready modelu.

## ID

X3-READY-001

## Status

READY_AFTER_CONTROL_PLANE_ACTIVATION

## Lane

video-provider

## Type

Inventory

## Goal

Zinwentaryzować obecne video/media provider usage i migrację do Cloudflare-first/Mux-ready modelu.

## Scope

Docs/inventory/spec work only unless a future active version of this ticket explicitly says otherwise.

## Allowed paths

docs/reports/reconciliation/**, docs/specs/VIDEO-PROVIDER-SPEC.md read-only; code read-only

## Forbidden paths

runtime edits, prisma edits, package files

Always forbidden for this staged seed ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Inventory provider calls, asset state, upload paths, playback URL exposure, legacy storage.

## Validation

git diff --check; npm run quality:architecture-boundaries if feasible

## Definition of done

Provider gap map complete.

## Expected PR report

Video provider inventory report.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

CAUTION

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
