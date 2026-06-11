# Comments / Moderation Spec

Status: STAGED ONLY — NIEAKTYWNE. Ta specyfikacja jest target/product standard po aktywacji, nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Comments / Moderation.

## Product rules

- Comment visibility != comment permission.
- Comments visible to everyone under all published tiers.
- PUBLIC/LOGGED_IN: logged-in users can comment.
- PATRON: patron/admin can comment/react/write.
- Guests can read but not write/report.
- Spoiler risk under patron-only comments; spoiler report reason.
- Moderation states: VISIBLE, HELD_FOR_REVIEW, HIDDEN, DELETED.
- No shadow bans.

## Launch-critical requirements

- Report abuse exists at launch.
- Rate limiting and duplicate detection.
- Admin moderation queue.
- Hide/delete/restore/dismiss require audit.
- Single-level replies at launch.
- Comment editing deferred.
- Reactions/hearts Phase 2 unless existing runtime is certified.

## Target model

Comments module asks Access for write permission; read visibility is publication/moderation driven.

## Forbidden shortcuts

- Non-patron blocked from reading patron comments.
- Guests writing/reporting.
- UI-only permission checks.
- Shadow bans.
- Unaudited moderation.

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
