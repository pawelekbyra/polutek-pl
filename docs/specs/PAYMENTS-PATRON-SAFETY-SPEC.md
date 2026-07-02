# Payments / Patron Safety Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Payments / Patron Safety.

## Product rules

- Stripe Checkout is one-time support/donation.
- Patron eligibility threshold is admin-configurable per currency; default launch values: 10 PLN, 10 USD, 10 EUR, 10 CHF, 10 GBP.
- PatronGrant is permanent by default unless revoked/suspended.
- Payment != access.
- Payment is financial fact; PatronGrant is access right.
- Full refund revokes linked grant.
- Dispute suspends linked grant; dispute won reactivates; dispute lost/chargeback revokes.
- Manual grant/suspend/reactivate/revoke requires reason + audit.

## Launch-critical requirements

- Raw body webhook signature verification.
- Idempotent StripeEvent ledger.
- No grant for below-minimum payment.
- Duplicate webhook creates no duplicate grant.
- Server-side minimum amount validation.
- Partial refund policy must be explicit or routed to manual review.

## Target model

Payment record, StripeEvent ledger, Patron eligibility policy, PatronGrant use-case, audit events for manual actions and financial corrections.

## Forbidden shortcuts

- Stripe webhook -> User.isPatron = true.
- Payment alone grants access.
- Client-side amount trust.
- Manual grant without reason/audit.
- Duplicate grant on webhook retry.

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
