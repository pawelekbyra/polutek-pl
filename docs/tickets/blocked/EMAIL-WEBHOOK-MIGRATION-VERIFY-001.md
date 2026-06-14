# EMAIL-WEBHOOK-MIGRATION-VERIFY-001 — Verify EmailEvent idempotency migration on fresh and upgraded PostgreSQL

Status: EVIDENCE_MISSING
Ticket ID: EMAIL-WEBHOOK-MIGRATION-VERIFY-001
Launch impact: HIGH

## Purpose
- Udowodnić poprawność migracji `20260614000000` na pustej bazie oraz bazie z istniejącymi danymi (upgrade).

## Target Behavior
- `providerEventId` musi być nullable dla starych rzędów.
- Unique index nie może wybuchnąć przy istnieniu wielu rzędów z `null`.
- Default status `PROCESSED` musi być bezpieczny dla starych rekordów (brak reprocessingu).

## Acceptance Criteria
- [ ] Evidence: migrate deploy na bazie z tysiącami legacy `EmailEvent` rows.
- [ ] Proof: brak utraty danych podczas migracji.
- [ ] Proof: nowe rekordy z `providerEventId` są unikalne.
- [ ] Instrukcja rollback/recovery dla operatora.
