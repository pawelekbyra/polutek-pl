# X0-READY-002 — Przygotować checklistę Integrator activation PR dla staged control plane.

## ID

X0-READY-002

## Status

READY_AFTER_CONTROL_PLANE_ACTIVATION

## Lane

cleanup-legacy

## Type

Documentation / Activation

## Goal

Przygotować checklistę Integrator activation PR dla staged control plane.

## Scope

Docs/inventory/spec work only unless a future active version of this ticket explicitly says otherwise.

## Allowed paths

docs/roadmap/**, docs/operations/**, docs/templates/** after activation; staging equivalents before activation

## Forbidden paths

app/**, lib/**, prisma/**, package*.json

Always forbidden for this staged seed ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Checklist aktywacji: files to copy, source-of-truth switch, validation, rollback/delete _tmp plan.

## Validation

git diff --check

## Definition of done

Checklist covers activation, no runtime change.

## Expected PR report

Activation checklist report.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

SERIAL

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
