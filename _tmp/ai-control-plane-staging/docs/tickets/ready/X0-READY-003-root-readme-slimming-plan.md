# X0-READY-003 — Zaplanować przyszłe skrócenie root README do control panel po aktywacji.

## ID

X0-READY-003

## Status

READY_AFTER_CONTROL_PLANE_ACTIVATION

## Lane

cleanup-legacy

## Type

Documentation / Plan

## Goal

Zaplanować przyszłe skrócenie root README do control panel po aktywacji.

## Scope

Docs/inventory/spec work only unless a future active version of this ticket explicitly says otherwise.

## Allowed paths

README.md plan doc, docs/roadmap/** after activation

## Forbidden paths

app/**, lib/**, prisma/**, package*.json

Always forbidden for this staged seed ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

## Required changes

Plan bez rewrite README w tym ticket; proposed sections and migration notes.

## Validation

git diff --check

## Definition of done

Plan approved or blocked by owner.

## Expected PR report

README slimming plan.

Must include: what changed, what did not change, validation, blockers, follow-up tickets.

## Parallel safety

SERIAL

Do not run in parallel with tasks touching the same global docs, lane, spec or route/module family.
