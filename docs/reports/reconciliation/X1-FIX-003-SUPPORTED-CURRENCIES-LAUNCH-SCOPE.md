# X1-FIX-003 — Supported currencies launch scope

## Status

GO

## Decyzja właściciela

GBP jest launch-supported.
Domyślny próg GBP: 10 GBP.

## Co zmieniono

- Zaktualizowano `docs/strategy/OWNER-DECISIONS.md`, dodając GBP do listy walut z domyślnym progiem 10.
- Ustawiono domyślny próg dla GBP na 10 w `lib/constants.ts`.
- Zaktualizowano testy jednostkowe `tests/unit/modules/payments/currency-thresholds.test.ts` oraz `tests/unit/payments.test.ts`, aby uwzględniały nowy próg dla GBP.

## Launch-supported currencies

| Currency | Default minimum |
| --- | --- |
| PLN | 10 |
| EUR | 10 |
| USD | 10 |
| CHF | 10 |
| GBP | 10 |

## Co nie zostało zmienione

- Prisma/schema
- package files
- Stripe integration
- PatronGrant lifecycle
- refund/dispute lifecycle
- partial refund policy
- X2 access truth

## Testy

- `tests/unit/modules/payments/currency-thresholds.test.ts`:
    - Default min amount 10 dla PLN, EUR, USD, CHF, GBP (PASS).
    - Sprawdzenie eligibility dla 9.99 GBP (FAIL) i 10.00 GBP (PASS) (PASS).
- `tests/unit/payments.test.ts`: dodane i zaktualizowane testy walidacji kwoty dla GBP (PASS).
- `npm run quality:architecture-boundaries`: PASS.

## Ryzyka pozostałe

- **Partial Refund Policy:** Pozostaje jako otwarte pytanie właściciela (OQ-001).
- **Access Truth X2:** Backend nadal synchronizuje `User.isPatron` jako cache.

## Następny rekomendowany ticket

`X1-FIX-005-full-refund-revokes-linked-payment-grant-only`
albo `X1-OWNER-001-partial-refund-policy-decision`, jeśli partial refund blokuje dalszą kolejność.
