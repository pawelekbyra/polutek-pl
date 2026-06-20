# ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001 — One-step admin video create flow

Status: IMPLEMENTATION_MERGED / SUPERSEDED_FOR_RUNTIME
Ticket ID: ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001
Role: Historical Builder ticket
Launch status: NO_GO

## Result

PR #981 merged the one-step admin video create flow. PR #983 added backend-owned publish-after-ready state. Current runtime work must not restart from this stale ticket because its original forbidden scope and implementation assumptions no longer match current main.

## Current decision

Remaining video work is grouped into:

1. `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001`
2. `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001`
3. `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001`

This file is retained as historical evidence for the original create-flow intent only.

## Original purpose

Replace the awkward admin create flow where admin first created a metadata-only draft and then navigated elsewhere to upload media. New admin creation needed to feel like one coherent action: fill metadata/translations/access, choose source, then save as draft or request publication.

## Original definition of done

- One-step create UI implemented.
- Existing upload component supports create-flow auto-start without breaking details-page upload.
- Draft/public intent is clear and honest.
- Public launch remains NO_GO.
