# Access / Patron Hard Reset Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Access / Patron Hard Reset.

## Product rules

- Deny by default.
- Backend validates every sensitive request.
- Active PatronGrant is source of truth.
- `User.isPatron` does not exist (removed from `prisma/schema.prisma` in migration `20260630000000_remove_legacy_user_patron_cache`); any `isPatron` on a DTO/read model is derived live from active `PatronGrant` rows, never a stored/settable field.
- Clerk metadata is UI/cache only.
- Subscription never grants access.
- Admin override explicit and audited.

## Launch-critical requirements

- All playback-sensitive paths ask Access module.
- Denied PlaybackPlan has no token/source.
- No provider call on denial.
- Mismatch diagnostics show Clerk/Subscription differences against the `PatronGrant` truth without trusting them.

## Target model

Access module centralizes decisions and returns explicit allow/deny reason consumed by PlaybackPlan and Admin Diagnostics.

## Forbidden shortcuts

- Access based on a `User`-table patron cache field (none exists in the schema).
- Access based on Clerk metadata.
- Access based on Subscription.
- Frontend-only access checks.
- Fail-open access.

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
