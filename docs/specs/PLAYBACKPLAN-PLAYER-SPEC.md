# PlaybackPlan / Player Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: PlaybackPlan / Player.

## Product rules

- Player renders backend PlaybackPlan.
- Frontend does not decide access.
- Allowed plan mounts player.
- Denied plan renders locked placeholder.
- Locked state is separate render tree, not overlay.
- Denied plan has no token/source.
- Tracking starts only on real playback.
- Admin preview excluded from public analytics.

## Launch-critical requirements

- States: READY, LOGIN_REQUIRED, PATRON_REQUIRED, VIDEO_NOT_READY, NO_PRIMARY_ASSET, PROCESSING, UNAVAILABLE, ERROR.
- Mobile/accessibility UX covered.
- Captions/subtitles prepared.
- Resume/progress can be later unless already present.

## Target model

PlaybackPlan DTO, player shell, locked placeholder, analytics event boundary, admin preview marker.

## Forbidden shortcuts

- Mounting player under overlay.
- Fetching stream before access allow.
- Counting denied view as playback.
- Leaking playbackUrl/token.

## Test strategy

- Unit tests dla policy/use-case/repository granic.
- Route/API contract tests dla wrażliwych przepływów.
- Negative tests dla forbidden shortcuts.
- Idempotency/security tests tam, gdzie domena dotyka webhooków, access, providerów lub tokenów.
- Admin/support tests dla diagnostyki i audit trail.
- Manual QA checklist przed certyfikacją fazy.

## Codex ticket candidates

- Inventory aktualnego kodu vs ta specyfikacja.
- Gap analysis z podziałem launch-critical/should-have/post-launch.
- Jedna migracja use-case albo route family per ticket.
- Test-only ticket dla negative cases.
- Docs reconciliation po merge batcha.

## Certification criteria

- Kod i docs są zgodne.
- Guardy i testy nie kłamią.
- Forbidden shortcuts są pokryte testem albo raportem braku użycia.
- Znane blockery są zapisane w `docs/tickets/blocked/`.
- Certifier rekomenduje status, właściciel merge'uje.

## Open owner questions

- Czy dana rzecz jest launch-critical czy post-launch, jeśli nie wynika to z owner decisions?
- Czy istnieją dodatkowe ograniczenia prawne/UX dla tej domeny?
- Czy obecny runtime ma elementy, które warto zachować zamiast przepisywać?
## Current implementation snapshot

This section is informational and references current reconciliation evidence. The normative requirements above remain the product standard.

Merged implementation/local tests do not equal production launch certification; X6/X7 production/manual evidence remains required.
