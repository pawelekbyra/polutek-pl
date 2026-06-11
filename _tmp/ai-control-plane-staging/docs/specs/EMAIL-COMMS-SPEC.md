# Email / Newsletter / Broadcast Spec

Status: STAGED ONLY — NIEAKTYWNE. Ta specyfikacja jest target/product standard po aktywacji, nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Email / Newsletter / Broadcast.

## Product rules

- Subscription = mailing consent only.
- Patron != newsletter subscriber.
- Unsubscribe never affects PatronGrant.
- Patron does not imply marketing consent.
- Transactional emails separate from marketing.
- PL/EN templates.
- Admin broadcast audit.

## Launch-critical requirements

- Broadcast preview/test-send required.
- Delivery webhooks.
- Bounce/complaint suppression.
- Preference center target.
- Consent state must be visible to admin without implying access.

## Target model

Email/subscription module manages consent, templates, broadcast, delivery events and suppression. Patron module owns access.

## Forbidden shortcuts

- Email unsubscribe revokes access.
- Patron automatically subscribed to marketing.
- Marketing and transactional mixed.
- Broadcast without preview/test-send/audit.

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
