# Observability / Support / System Health Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Observability / Support / System Health.

## Product rules

- Owner health dashboard.
- Admin support diagnostics.
- Developer observability.
- Audit trail separate from operational logs.
- Privacy-safe analytics.
- No secrets/tokens in logs.
- Admin preview excluded from analytics.

## Launch-critical requirements

- Webhook processing states visible.
- Failed/stuck events visible.
- Payment/patron health and mismatches.
- Access diagnostics.
- Video upload/provider health.
- Playback errors.
- Email delivery health.
- Comment/community health.
- Alerts for critical billing/access/video failures.

## Target model

Operational events, audit events, health read models, support workflows and redaction policy.

## Forbidden shortcuts

- Logging secrets/tokens.
- Treating audit as debug logs.
- Hiding failed webhook states.
- Analytics that include admin previews as public views.

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
