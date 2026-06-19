# X3-FIX-004 — Admin video create form Cloudflare-first shell

Ticket ID: X3-FIX-004
Status: READY_FOR_BUILDER
Launch status: NO_GO
Lane: video-provider / admin
Type: Runtime admin workflow
Priority: Launch-critical

## Goal

Replace the admin video creation entry point that still behaves like a legacy YouTube/raw URL form with a Cloudflare-first creation shell that creates a draft video record and immediately guides the admin into the Cloudflare asset workflow introduced by X3-FIX-003.

## Context

PR #962 merged X3-FIX-003 and added the focused admin Cloudflare upload/attach/status flow for existing videos. The remaining operator problem is earlier in the workflow: the admin add-video panel still presents legacy URL/YouTube-style inputs as the primary path. That blocks normal product work because an admin should be able to start a Cloudflare-first draft without pretending a legacy `videoUrl` is the launch source.

`ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001` is historical umbrella context only. This ticket is the single executable runtime task.

## Scope

Build a small Cloudflare-first admin create shell. This is not the full publication, hero, visibility, filtering, TUS lifecycle, privacy verification, or launch certification contract.

## Allowed paths

- `app/admin/videos/**`
- `app/api/admin/videos/**`
- `lib/modules/video/**`
- `tests/unit/modules/video/**`
- `tests/unit/api/**` for admin video create/upload/status tests
- `docs/reports/reconciliation/**` for the ticket report only

## Forbidden paths

- `README.md`
- `AGENTS.md`
- `docs/roadmap/**`
- `scripts/check-architecture.ts` unless explicitly amended
- `package.json`
- `package-lock.json` unless explicitly amended
- Patron/user mutation files owned by X2 work
- Public playback routes, homepage/channel/sidebar visibility contracts, and launch certification docs

## Required changes

- Make the primary admin add-video path Cloudflare-first, not YouTube/raw-URL-first.
- Allow creating a draft video record without requiring `videoUrl` as the primary media source.
- After draft creation, guide the admin to the video details/media workflow where they can generate a Cloudflare upload URL, attach a Cloudflare UID, and sync status.
- Keep any legacy `videoUrl` input visibly secondary and labeled `legacy/migration only`.
- Do not fake Cloudflare readiness; new Cloudflare asset state must remain `PENDING` until provider sync/webhook makes it ready.
- Preserve clear failure states and operator copy for missing/failed asset status.

## Non-goals

- Do not implement public publish/hero/sidebar/channel visibility changes.
- Do not implement the full TUS resume/cancel/retry lifecycle.
- Do not seed or create launch content.
- Do not proxy full video files through Next.js.
- Do not implement launch certification/operator evidence.
- Do not resolve `npm audit/security` or unrelated control-plane guard debt in this runtime ticket.

## Validation

- `git diff --check`
- `npm run quality:architecture-boundaries`
- `npm run quality:strict-escapes`
- targeted admin/video unit tests
- `npm run typecheck`

If `control-plane docs` or `npm audit/security` remain red for pre-existing reasons, report them explicitly without broadening this ticket.

## Definition of done

- Admin can create a draft video through a Cloudflare-first flow without supplying a legacy YouTube/raw media URL as the primary source.
- The newly created draft makes the next operator action obvious: generate Cloudflare upload URL or attach/sync Cloudflare asset UID.
- Legacy `videoUrl` remains available only as a secondary migration escape hatch and is not presented as launch playback.
- No public playback behavior is changed.
- Public launch remains `NO_GO`.

## Expected PR report

Include summary, intent, changed files, validation, scope confirmation, what did not change, risks, follow-ups, and ticket status.

## Parallel safety

Do not run in parallel with publication/hero contract work, TUS lifecycle work, playback provider contract work, or unrelated launch certification/audit remediation.
