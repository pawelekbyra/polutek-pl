# Admin Cockpit Spec

Status: STAGED ONLY — NIEAKTYWNE. Ta specyfikacja jest target/product standard po aktywacji, nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Admin Cockpit.

## Product rules

- Admin cockpit is support operations center, not vanity dashboard.
- Access Diagnostics first; dashboard second.
- Paid-but-locked support flow must be answerable without DB/Stripe/Clerk console.
- Manual grant/revoke/suspend/reactivate requires reason + audit.
- Dangerous actions require confirmation.

## Launch-critical requirements

- Panels: user identity, PatronGrant history, payments, refunds, disputes, subscription, Clerk mismatch, final access decision, video asset status.
- System health surfaces failed webhooks and mismatches.
- Stripe remains financial source; admin displays but does not fake financial truth.

## Target model

Read-only diagnostics first; corrective use-cases later through domain modules with audit.

## Forbidden shortcuts

- Generic dashboard before Access Diagnostics.
- Direct DB mutation from UI.
- Setting User.isPatron as access fix.
- Unaudited manual access repair.

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
