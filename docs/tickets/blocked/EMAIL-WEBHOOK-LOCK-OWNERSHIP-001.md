# EMAIL-WEBHOOK-LOCK-OWNERSHIP-001 — Add lease ownership and fencing to EmailEvent processing

Status: CONFIRMED_GAP / BLOCKED_BY_POSTMERGE_VERIFICATION
Ticket ID: EMAIL-WEBHOOK-LOCK-OWNERSHIP-001
Launch impact: HIGH / LAUNCH_BLOCKER

## Purpose
- Dodać tożsamość aktualnego workera/attemptu do locka.
- Zapobiec finalizacji przez stale worker (fencing).
- Implementacja conditional success/failure release.
- Wykrywanie utraty własności (CAS ownership loss detection).

## Verified Current Behavior
- Lock updateMany nie sprawdza tożsamości workera.
- Brak attempt ID / lease token w bazie.
- Stale worker (powyżej 10m) może nadpisać wynik nowszego workera.

## Root Cause
Minimalistyczna implementacja locka w PR #905 nie uwzględniła scenariuszy wyścigów przy przejmowaniu wygasłych locków.

## Target Behavior
- `EmailEvent` zawiera `leaseToken` (lub `lockVersion`).
- `acquireLock` generuje nową tożsamość dla każdego przejęcia.
- `releaseWithSuccess/Failure` wykonuje `updateMany` z filtrem na `leaseToken`.
- Jeśli `count === 0` podczas release, system loguje `LOST_OWNERSHIP` i nie zgłasza sukcesu.

## Acceptance Criteria
- [ ] Model `EmailEvent` zaktualizowany o `leaseToken` (lub odpowiednik).
- [ ] `EmailEventLockService.acquireLock` zwraca tożsamość lease.
- [ ] `releaseWithSuccess` wymaga poprawnej tożsamości.
- [ ] `releaseWithFailure` wymaga poprawnej tożsamości.
- [ ] Scenariusz: worker A acquires -> lease expires -> worker B reacquires -> A release rejected -> B success finalized.

## Required Tests
- Unit tests: Mockowane wyścigi tożsamości.
- Integration tests: Dwa niezależne Prisma clients symulujące worker A i B.

## Non-Goals
- Zmiana innych providerów (Stripe).
- Zmiana głównego use case (poza wstrzyknięciem tokena).
