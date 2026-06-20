# ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001 — One-step admin video create flow

Status: READY_FOR_BUILDER
Ticket ID: ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001
Role: Builder
Priority: URGENT
Launch status: NO_GO

## Owner activation
Decision source: chat instruction on 2026-06-20: create the ticket, change rules as needed, and implement the one-step video add flow beautifully and honestly.
Approved by: Paweł / Product Owner
Approval date: 2026-06-20
Recorded by: Codex
Supersedes: the previous NON_EXECUTABLE status of this card for this bounded implementation only.
Does not supersede: product invariants in `AGENTS.md`, video access/player invariants, launch `NO_GO`, or provider/operator evidence requirements.
Implementation status: READY_FOR_BUILDER
Legal status: not applicable
Operator-evidence status: not provided
Launch status: NO_GO

## Purpose
Replace the awkward user-facing create flow where admin first creates a metadata-only draft and then navigates elsewhere to upload media. New admin creation must feel like one coherent action: fill metadata/translations/access, choose the video file, then save as draft or request publication.

## Allowed scope
- `docs/tickets/ready/ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001.md`
- `docs/tickets/ready/README.md`
- `app/admin/videos/page.tsx`
- `app/admin/videos/[id]/page.tsx`
- `app/admin/videos/components/VideoForm.tsx`
- `app/admin/videos/components/VideoUploadSection.tsx`
- `app/admin/videos/components/VideoFilters.tsx`
- `app/api/admin/videos/[id]/upload/route.ts`
- `lib/modules/video/infrastructure/cloudflare-stream.client.ts`
- focused tests for admin video/create/upload behavior

## Forbidden scope
- No Prisma schema or migration edits.
- No package/dependency edits.
- No architecture guard edits.
- No public playback/access weakening.
- No claim that public launch is certified.
- No provider production PASS claim without operator evidence.

## Required behavior
- New-video form presents metadata, translations, access, thumbnail, desired final state, and file selection in one coherent create screen.
- Admin can save as draft with or without a selected file.
- Admin can request publication from the same create screen only when a Cloudflare source is selected: either direct upload file or existing Cloudflare Stream UID/address; the app must transparently create a draft, attach/upload/process the asset, then publish only after Cloudflare asset reaches READY.
- If processing is asynchronous, the UI must honestly show that publication is pending and must not pretend completion before backend publish succeeds.
- Existing edit behavior must remain available, but the admin video create/media mechanism must not expose legacy videoUrl as the recommended path.

## Validation commands
- `node scripts/check-control-plane-docs.mjs`
- `npm run typecheck`
- `git diff --check`
- `git diff --name-only`

## Definition of Done
- One-step create UI is implemented within allowed files.
- Existing upload component supports create-flow auto-start without breaking details-page upload.
- Draft/public intent is clear and honest.
- Validation commands are run and reported.
- Public launch remains NO_GO.
