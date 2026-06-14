# EMAIL-WEBHOOK-ROUTE-SECURITY-001 — Harden Resend webhook authentication and production environment contract

Status: CONFIRMED_SECURITY_GAP
Ticket ID: EMAIL-WEBHOOK-ROUTE-SECURITY-001
Launch impact: BLOCKER

## Purpose
- Wzmocnić autentykację webhooków Resend.
- Wymusić weryfikację Svix w środowisku produkcyjnym.
- Usunąć lukę bypassu sygnatury.

## Verified Current Behavior
- Produkcyjna ścieżka dopuszcza fallback `x-resend-webhook-secret` bez weryfikacji Svix.
- Brak `RESEND_WEBHOOK_SECRET` w `requiredProductionVars` w `env/validation.ts`.

## Target Behavior
- `NODE_ENV === 'production'` WYMAGA weryfikacji Svix (ID, Timestamp, Signature).
- Legacy fallback jest niedostępny w produkcji (chyba że istnieje jawny ADR).
- `RESEND_WEBHOOK_SECRET` jest obowiązkową zmienną produkcyjną.

## Acceptance Criteria
- [ ] `lib/env/validation.ts` zawiera `RESEND_WEBHOOK_SECRET` w `requiredProductionVars`.
- [ ] Route odrzuca requesty bez poprawnych nagłówków Svix w produkcji.
- [ ] Malformed JSON zwraca bezpieczne 400.
- [ ] Testy pokrywają `production fallback rejection`.

## Security Impact
Zapobiega atakom typu replay oraz spoofingowi webhooków przez osoby znające tylko wspólny sekret.
