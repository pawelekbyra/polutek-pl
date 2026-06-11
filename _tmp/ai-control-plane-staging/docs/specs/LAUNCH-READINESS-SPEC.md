# Launch Readiness Spec

Status: STAGED ONLY — NIEAKTYWNE. Ta specyfikacja jest target/product standard po aktywacji, nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Launch Readiness.

## Product rules

- Public launch gate, not private beta.
- Access leak is launch blocker.
- Payment fulfillment gap is launch blocker.
- Privacy/legal/cookie/email consent gaps are launch blockers.
- Admin must diagnose paid-but-locked.
- Owner runbook required.
- Final certification X7 required.

## Launch-critical requirements

- Accessibility, mobile and performance checks.
- Security review.
- Backups and recovery/runbooks.
- Manual QA.
- Legal/privacy review.
- Critical alerts configured.

## Target model

Launch checklist, cert report, owner manual, manual QA evidence and blocker register.

## Forbidden shortcuts

- Launch with known access leak.
- Launch with broken payment fulfillment.
- Launch without unsubscribe/consent.
- Launch without owner support path for paid-but-locked.

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
