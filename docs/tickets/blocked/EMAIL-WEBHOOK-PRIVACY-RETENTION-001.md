# EMAIL-WEBHOOK-PRIVACY-RETENTION-001 — Minimize EmailEvent ledger data and define retention

Status: PARTIAL / CONFIRMED_GAP
Ticket ID: EMAIL-WEBHOOK-PRIVACY-RETENTION-001
Launch impact: MEDIUM_TO_HIGH

## Purpose
- Zminimalizować dane PII w ledgerze `EmailEvent`.
- Zdefiniować politykę retencji.

## Target Behavior
- `EmailEvent.email` jest usuwany lub używany tylko w approved paths.
- Ledger przechowuje tylko identyfikatory (`providerEventId`, `email_id`).
- Ustalony okres retencji (np. 30 dni).
- Zautomatyzowany cleanup job lub instrukcja dla operatora.

## Acceptance Criteria
- [ ] Analiza czy `EmailEvent.email` jest niezbędny do diagnostyki.
- [ ] Implementacja mechanizmu czyszczenia starych logów.
- [ ] Redakcja wrażliwych danych z metadata w `releaseWithSuccess`.
