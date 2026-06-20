# X3-FIX-006 — Legacy storage migration plan

Ticket ID: X3-FIX-006
Status: HISTORICAL_SUPERSEDED
Launch status: NO_GO
Lane: video-provider
Type: Docs/admin inventory
Priority: Historical evidence only — not executable

## Supersession note

This ticket is historical/superseded and must not be used as an executable Builder prompt. Legacy migration planning and import concerns are superseded by the grouped provider lifecycle work, especially `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`, and by the current playback/access cleanup ticket `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001`. Any remaining legacy-media decisions must be handled through the canonical ready queue rather than this old X3 card. Public launch remains `NO_GO`.

## Goal

Produce a concrete migration plan for existing `Video.videoUrl`, R2, S3, and Vercel Blob media into the Cloudflare Stream-first asset model without treating legacy storage as active safe private patron playback.

## Context

X3-FIX-003 added the focused admin Cloudflare upload/attach/status workflow for existing videos. X3-FIX-004 made the admin add-video entry point Cloudflare-first for new draft videos. The remaining legacy-content question is how to identify and migrate old `videoUrl` / non-Cloudflare storage safely before enabling any launch-sensitive playback assumptions.

This ticket is a plan/inventory ticket. It must not introduce public playback behavior or private legacy fallback behavior.

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
- Propose follow-up runtime/import tickets if needed, without making them concurrently executable.

## Non-goals

- Do not implement Cloudflare import by URL in this ticket.
- Do not disable legacy private playback runtime in this ticket.
- Do not alter homepage/channel/sidebar/hero publication behavior.
- Do not add launch content or seed data.
- Do not resolve `npm audit/security` in this ticket.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries` if feasible
- `npm run quality:strict-escapes` if any code/script path is amended

If `npm audit/security` remains red, report it as pre-existing/out of scope.

## Definition of done

- Migration plan exists and clearly says R2/S3/Vercel Blob/direct `videoUrl` are legacy/migration sources, not active safe private patron playback providers.
- Plan distinguishes public/logged-in/patron launch decisions.
- Follow-up runtime migration/import tickets are proposed if needed.
- Public launch remains `NO_GO`.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Docs-only by default. Do not run in parallel with global roadmap/docs edits unless coordinated.
