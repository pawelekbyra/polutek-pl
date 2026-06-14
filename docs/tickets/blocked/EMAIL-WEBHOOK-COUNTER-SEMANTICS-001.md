# EMAIL-WEBHOOK-COUNTER-SEMANTICS-001 — Define and enforce broadcast aggregate counter semantics

Status: DECISION_REQUIRED / CONFIRMED_GAP
Ticket ID: EMAIL-WEBHOOK-COUNTER-SEMANTICS-001
Launch impact: MEDIUM_TO_HIGH

## Purpose
- Zdefiniować i wymusić poprawną semantykę liczników `sentCount` i `errorCount`.
- Obsłużyć permutacje kolejności zdarzeń (out-of-order).

## Verified Current Behavior
- `sentCount` zwiększany tylko przy `PENDING -> SENT`.
- Jeśli `DELIVERED` przyjdzie przed `SENT`, status przejdzie do `DELIVERED`, a późniejszy `SENT` zostanie zignorowany, co zaniży `sentCount`.

## Required Decision
Czy `sentCount` oznacza:
1. Otrzymano dokładnie event `email.sent`.
2. Wiadomość osiągnęła co najmniej stan `SENT` (włączając `DELIVERED`, `OPENED`, etc.).

## Acceptance Criteria
- [ ] Implementacja wybranej semantyki w `updateRecipientStatus`.
- [ ] Zapobieganie podwójnemu naliczaniu (double increment).
- [ ] Testy pokrywające permutacje: `DELIVERED -> SENT`, `OPENED -> SENT`, `BOUNCED -> SENT`.
- [ ] Strategia uzgodnienia (reconciliation) dla już zaniżonych danych.
