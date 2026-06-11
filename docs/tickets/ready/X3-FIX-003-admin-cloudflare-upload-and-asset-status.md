# X3-FIX-003 — Admin Cloudflare upload and asset status

## ID

X3-FIX-003

## Status

READY

## Lane

video-provider / admin

## Type

Runtime admin workflow

## Priority

Launch-critical

## Goal

Add a small admin workflow for creating/attaching Cloudflare Stream assets and showing provider/processing status in video management.

## Scope

Admin-only upload/attach/status path after the asset foundation exists. Prefer Cloudflare direct upload/TUS where appropriate. Do not implement Mux upload unless a later owner decision requires it.

## Allowed paths

- `app/api/admin/videos/**`
- `app/admin/videos/**`
- `lib/modules/video/**`
- `lib/modules/media/**`
- `tests/unit/modules/video/**`
- `tests/unit/api/**` for admin video upload/status tests
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden paths

- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless explicitly amended
- `package.json`
- `package-lock.json` unless Cloudflare SDK/package choice is explicitly approved in ticket amendment
- Patron/user mutation files owned by X2 work

## Required changes

- Add admin endpoint/use-case to create a Cloudflare Stream upload or attach a provider asset ID.
- Store/update `VideoAsset` provider status from admin workflow.
- Show provider, state, failure reason, and key timestamps in admin video details/form.
- Keep existing raw `videoUrl` path marked legacy; do not present it as the launch patron-private provider path.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- Targeted admin video tests

## Definition of done

- Admin can start/record a Cloudflare asset workflow.
- Admin can see whether asset is uploading/processing/ready/failed.
- No public playback behavior is changed except consuming safe asset status if already introduced.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Do not run in parallel with admin video route/UI work, provider foundation schema work, or playback provider contract work.
