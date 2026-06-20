# ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001 — Historical admin video umbrella

Status: HISTORICAL_SUPERSEDED
Ticket ID: ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001
Role: Historical umbrella specification
Priority: Historical evidence
Launch status: NO_GO

This card is retained as historical evidence of the earlier admin-video repair decomposition after PR #926.

The old umbrella split has been replaced by the grouped launch queue:

- `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — DONE.
- `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` — current ticket.
- `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` — next media/access ticket.

Use `docs/tickets/ready/README.md` for the active queue.

## Historical scope

The older umbrella tracked safe draft creation, Cloudflare-first admin creation, upload lifecycle, media processing states, manual UID attachment, legacy migration/import, publication readiness, hero/sidebar invariants, admin diagnostics and provider verification.

## Replacement mapping

| Historical concern | Current grouped owner |
| --- | --- |
| Upload, attach, import, provider state, media diagnostics | `VIDEO-PROVIDER-LIFECYCLE-HARDENING-001` — DONE |
| Publication readiness, hero, sidebar, archive/unpublish transitions | `VIDEO-PUBLICATION-HERO-STATE-CONTRACT-001` |
| Public playback and old media access paths | `PLAYBACK-ACCESS-LEGACY-RETIREMENT-001` |
| Admin auth and main-channel diagnostics | `ADMIN-AUTH-CHANNEL-DIAGNOSTICS-001` |

Public launch remains `NO_GO`.
