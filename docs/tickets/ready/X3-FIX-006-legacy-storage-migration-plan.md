# X3-FIX-006 — Legacy storage migration plan

## ID

X3-FIX-006

## Status

READY

## Lane

video-provider

## Type

Docs/admin inventory

## Priority

Should-have before launch if legacy content exists

## Goal

Produce a concrete migration plan for existing `Video.videoUrl`, R2, S3, and Vercel Blob media into the Cloudflare Stream-first asset model without treating legacy storage as active safe private patron playback.

## Scope

Inventory and plan. This ticket should not change playback runtime unless explicitly amended.

## Allowed paths

- `docs/reports/reconciliation/**`
- `docs/tickets/ready/**`
- Optional read-only/admin inventory script or admin diagnostic path only if explicitly amended by owner

## Forbidden paths

- Playback runtime changes
- Provider implementation changes
- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless explicitly amended
- `package.json`
- `package-lock.json`
- Patron/user mutation files owned by X2 work

## Required changes

- Document how to identify legacy media by provider/host/tier/status.
- Define launch decision matrix for public/logged-in/patron legacy videos.
- Define migration sequencing to Cloudflare Stream.
- Define rollback and preservation policy for originals.
- Identify owner decisions needed for any legacy fallback exception.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries` if feasible

## Definition of done

- Migration plan exists and clearly says R2/S3/Vercel Blob are legacy/migration, not active safe private patron playback providers.
- Follow-up runtime migration/import tickets are proposed if needed.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Docs-only by default. Do not run in parallel with global roadmap/docs edits unless coordinated.
