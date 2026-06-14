# EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001 — Enforce event type integrity during failed/stale lock takeover

Status: CONFIRMED_GAP / BLOCKED_BY_LOCK_DESIGN
Ticket ID: EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001
Launch impact: HIGH

## Purpose
- Zapewnić, że takeover query uwzględnia `event.type`.
- Zapobiec przejęciu locka przez event o tym samym `providerEventId`, ale innym typie (integrity mismatch).

## Verified Current Behavior
- `updateMany` w `acquireLock` filtruje tylko po `providerEventId` i statusie/czasie.
- Typ jest sprawdzany dopiero *po* potencjalnym udanym takeoverze w osobnym query, co tworzy wyścig.

## Target Behavior
- Zapytanie `updateMany` podczas takeovera musi zawierać `type: event.type` w klauzuli `where`.
- Mismatch typu nie może zwrócić `ACQUIRED`.
- Wykryty mismatch typu generuje ustrukturyzowany alert.

## Acceptance Criteria
- [ ] `takeover` update query zawiera filtr na `type`.
- [ ] Próba przejęcia locka z innym typem kończy się statusem `CONFLICT` (lub dedykowanym błędem).
- [ ] Test udowadniający, że event typu B nie przejmie locka typu A o tym samym ID.
