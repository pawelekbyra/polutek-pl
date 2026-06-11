# X0-READY-002 — Przygotować checklistę Integrator activation PR dla control plane.

## ID

X0-READY-002

## Status

DONE_BY_ACTIVATION_PR

## Lane

cleanup-legacy

## Type

Documentation / Activation

## Goal

Przygotować checklistę Integrator activation PR dla control plane.

## Scope

Docs/inventory/spec work only unless a future owner-approved runtime ticket explicitly says otherwise.

## Allowed paths

docs/roadmap/**, docs/operations/**, docs/templates/** in active docs; historical staging equivalents before activation

## Forbidden paths

app/**, lib/**, prisma/**, package*.json

Always forbidden for this archived ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

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


## Activation note

Ten ticket został zrealizowany/dezaktywowany przez Integrator activation PR aktywujący root `AGENTS.md`, root `README.md` i aktywne `docs/**`. Nie jest kolejnym krokiem właściciela.
