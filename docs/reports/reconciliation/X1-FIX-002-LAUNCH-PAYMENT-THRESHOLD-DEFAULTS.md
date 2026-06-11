# X1-FIX-002 — Launch payment threshold defaults

## Status

GO

## Co zmieniono

- Zaktualizowano domyślne progi kwalifikującego wsparcia (thresholds) dla walut launchowych (PLN, EUR, USD, CHF) w `lib/constants.ts`.
- Wyrównano legacy constants (`MIN_PATRON_AMOUNT`, `MIN_PATRON_AMOUNT_PLN`) z nowymi wartościami domyślnymi.
- Zaktualizowano testy jednostkowe w `tests/unit/payments.test.ts` oraz `tests/unit/modules/payments/payment-settings.test.ts` i `tests/unit/modules/payments/fulfill-payment.use-case.test.ts`, aby odzwierciedlały nowe progi.
- Dodano nowy plik testowy `tests/unit/modules/payments/currency-thresholds.test.ts` weryfikujący poprawne działanie fallbacków i nadpisań z bazy danych.

## Nowe launch defaults

| Currency | Default minimum |
| --- | --- |
| PLN | 10 |
| EUR | 10 |
| USD | 10 |
| CHF | 10 |
| GBP | 5 (bez zmian) |

## Co nie zostało rozstrzygnięte

- **GBP launch support:** GBP pozostaje z progiem 5 jako fallback, a jego status jako waluty launchowej zostanie rozstrzygnięty w osobnym tickecie `X1-FIX-003`.
- **Partial refund policy:** Pozostaje jako otwarte pytanie właściciela (OQ-001).
- **Access truth X2:** Mechanizm dostępu nadal synchronizuje `User.isPatron` (cache/bridge).

## Testy

- `tests/unit/modules/payments/currency-thresholds.test.ts`:
    - Default min amount 10 dla PLN, EUR, USD, CHF (PASS).
    - GBP zachowane na poziomie 5 (PASS).
    - Sprawdzenie eligibility dla 9.99 (FAIL) i 10.00 (PASS) (PASS).
    - Weryfikacja nadpisania progu przez admina w DB (PASS).
- `tests/unit/payments.test.ts`: zaktualizowane testy walidacji kwoty (PASS).
- `tests/unit/modules/payments/payment-settings.test.ts`: zaktualizowane testy ustawień płatności (PASS).
- `tests/unit/modules/payments/fulfill-payment.use-case.test.ts`: zaktualizowane testy fulfillmentu (PASS).

## Ryzyka pozostałe

- **Currency Scope:** Jeśli GBP ma zostać usunięte lub otrzymać inny próg, musi to zostać wykonane przed certyfikacją X1.
- **Cache Drift:** `User.isPatron` jako cache może ulec rozsynchronizowaniu (naprawa w X2).

## Następny rekomendowany ticket

`X1-FIX-003-supported-currencies-launch-scope`
