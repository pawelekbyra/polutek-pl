# X4-READY-001 — Zinwentaryzować obecne PlaybackPlan/player/locked states vs target no-player-on-denial.

## ID

X4-READY-001

## Status

READY_AFTER_CONTROL_PLANE_ACTIVATION

## Lane

playback-player

## Type

Inventory

## Goal

Zinwentaryzować obecne PlaybackPlan/player/locked states vs target no-player-on-denial.

## Scope

Docs/inventory/spec work only unless a future active version of this ticket explicitly says otherwise.

## Allowed paths

docs/reports/reconciliation/**, docs/specs/PLAYBACKPLAN-PLAYER-SPEC.md read-only; code read-only

## Forbidden paths

runtime edits, prisma edits, package files

Always forbidden for this staged seed ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Inventory player mounting, token/source leakage, analytics tracking, admin preview.

## Validation

git diff --check; npm run quality:architecture-boundaries if feasible

## Definition of done

Playback gap map complete.

## Expected PR report

PlaybackPlan inventory report.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

SERIAL

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
