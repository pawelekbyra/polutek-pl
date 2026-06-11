# X0-READY-003 — Zaplanować przyszłe skrócenie root README do control panel w aktywnym control plane.

## ID

X0-READY-003

## Status

DONE_BY_ACTIVATION_PR

## Lane

cleanup-legacy

## Type

Documentation / Plan

## Goal

Zaplanować przyszłe skrócenie root README do control panel w aktywnym control plane.

## Scope

Docs/inventory/spec work only unless a future owner-approved runtime ticket explicitly says otherwise.

## Allowed paths

README.md plan doc, docs/roadmap/** in active docs

## Forbidden paths

app/**, lib/**, prisma/**, package*.json

Always forbidden for this archived ticket: `app/**`, `lib/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `package.json`, `package-lock.json`, runtime behavior changes.

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


## Activation note

Ten ticket został zrealizowany/dezaktywowany przez Integrator activation PR aktywujący root `AGENTS.md`, root `README.md` i aktywne `docs/**`. Nie jest kolejnym krokiem właściciela.
