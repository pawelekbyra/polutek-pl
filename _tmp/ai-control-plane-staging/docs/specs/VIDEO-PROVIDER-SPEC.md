# Video Provider Spec

Status: STAGED ONLY — NIEAKTYWNE. Ta specyfikacja jest target/product standard po aktywacji, nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Video Provider.

## Product rules

- Cloudflare Stream first for cost/simple launch.
- Mux optional per VideoAsset by thin abstraction.
- Provider stored per VideoAsset.
- Video owns product metadata; VideoAsset owns provider/media state.
- Direct browser upload and TUS/resumable upload where provider supports it.
- Provider webhooks update processing state.
- Primary READY asset drives playback.
- Signed/private playback only after access allow.
- No active R2/S3 private fallback.

## Launch-critical requirements

- Admin can see provider/asset status.
- Upload/processing failures are visible.
- Migration strategy preserves originals or records migration path.
- Provider call never happens before access allow.

## Target model

Video, VideoAsset, VideoProvider interface, provider webhook handlers, media cockpit state, primary asset selection.

## Forbidden shortcuts

- Giant enterprise provider framework.
- R2/S3 as secure patron playback fallback.
- Provider call on denied access.
- Raw playbackUrl leaked to public DTO.

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
