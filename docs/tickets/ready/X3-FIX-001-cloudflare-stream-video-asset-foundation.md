# X3-FIX-001 — Cloudflare Stream VideoAsset foundation

## ID

X3-FIX-001

## Status

READY

## Lane

video-provider

## Type

Runtime foundation / schema

## Priority

Launch-critical

## Goal

Create the smallest Cloudflare-first `VideoAsset` foundation needed for X3 playback/upload work, while keeping Mux design-compatible per asset and treating R2/S3/Vercel Blob as legacy/migration only.

## Scope

Add provider/state fields and domain/repository mapping for Cloudflare Stream asset metadata. Do not build a heavy enterprise multi-provider framework.

## Allowed paths

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `lib/modules/video/**`
- `lib/modules/media/**`
- `tests/unit/modules/video/**`
- `tests/unit/modules/media/**`
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden paths

- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless the ticket is explicitly amended
- `package.json`
- `package-lock.json`
- Patron/user mutation files owned by X2 work

## Required changes

- Add a Cloudflare Stream-capable provider identity to `VideoAsset`.
- Add minimal asset state fields needed by playback: primary/current asset marker or equivalent, provider asset ID, provider playback ID/UID as appropriate, processing state, failure reason, and timestamps.
- Preserve existing R2/S3/Vercel Blob values as legacy/migration states, not active target providers.
- Add repository/domain DTO tests proving the new fields map correctly.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- Targeted unit tests for changed video/media modules
- Prisma validation/generation command available in repo if feasible

## Definition of done

- Cloudflare Stream can be represented per `VideoAsset`.
- Existing legacy assets remain representable for migration.
- No playback/upload runtime behavior is implemented in this ticket.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

SERIAL ONLY. This ticket touches schema and video asset foundation. Do not run in parallel with other schema, provider, playback, package, roadmap, or architecture guard work.
