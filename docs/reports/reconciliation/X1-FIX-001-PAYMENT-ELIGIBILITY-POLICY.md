# X1-FIX-001 — Payment eligibility policy before PatronGrant

## Status

GO

## Co zmieniono

- Dodano jawny mechanizm sprawdzania kwalifikowalności płatności do otrzymania statusu Patrona (`evaluatePaymentPatronEligibility`) w `PaymentPolicy`.
- Zintegrowano politykę w `fulfillPayment` use case. Teraz status Patrona jest nadawany tylko wtedy, gdy płatność spełnia progi minimalne (thresholds) dla danej waluty.
- Zaktualizowano `fulfillPayment`, aby obsługiwał scenariusze, w których płatność jest udana (SUCCEEDED), ale nie kwalifikuje się do statusu Patrona (np. kwota poniżej minimum). W takim przypadku wysyłany jest e-mail z podziękowaniem za darowiznę zamiast e-maila o staniu się Patronem.
- Poprawiono obsługę powtórzeń (replay) w `fulfillPayment`, zapewniając bezpieczną synchronizację z Clerk nawet przy ponownym przetworzeniu tego samego webhooka.
- Dodano testy jednostkowe pokrywające nowe reguły biznesowe.

## Jak działa eligibility policy

Polityka sprawdza następujące warunki przed nadaniem `PatronGrant`:
1. **Status płatności:** Musi być `SUCCEEDED`.
2. **Obsługiwana waluta:** Waluta musi posiadać zdefiniowane limity w systemie.
3. **Próg minimalny:** Kwota płatności musi być równa lub wyższa niż `minAmountMinor` dla danej waluty (pobrane z ustawień bazy danych lub domyślnych).

Wynik polityki zawiera czytelny kod powodu (`ELIGIBLE`, `BELOW_THRESHOLD`, `PAYMENT_NOT_SUCCEEDED`, `CURRENCY_NOT_SUPPORTED`).

## Co zostało zabezpieczone

- **Fulfillment Safety:** Nawet jeśli walidacja na etapie tworzenia intencji płatności zostanie obejściem lub limity zmienią się w międzyczasie, fulfillment nie nada statusu Patrona dla płatności poniżej progu.
- **Email Accuracy:** Użytkownicy otrzymują właściwy rodzaj e-maila (Patron vs Donacja) na podstawie faktycznego wyniku nadania uprawnień.
- **Idempotency:** Replay webhooka nie tworzy duplikatów `PatronGrant` i nie próbuje ponownie nadawać uprawnień, jeśli już istnieją.
- **Audit/Logging:** Logowane są powody odrzucenia kwalifikowalności do statusu Patrona.

## Czego nie zmieniono

- dispute lifecycle,
- refund lifecycle,
- partial refund policy,
- access truth X2 (nadal synchronizujemy `User.isPatron` jako cache/bridge),
- schema Prisma,
- UI,
- package files.

## Testy

- `tests/unit/modules/payments/fulfill-payment.use-case.test.ts`:
    - Płatność powyżej progu nadaje status Patrona (PASS).
    - Płatność poniżej progu NIE nadaje statusu Patrona (PASS).
    - Płatność w nieobsługiwanej walucie NIE nadaje statusu Patrona (PASS).
    - Replay przetworzonej płatności nie nadaje statusu ponownie (PASS).
- `npm run quality:architecture-boundaries`: PASS.
- `tests/unit/stripe-webhook.test.ts`: PASS.
- `tests/unit/payments.test.ts`: PASS.

## Ryzyka pozostałe

- **Access Truth:** Backend nadal polega na `User.isPatron`, co jest celem naprawy w fazie X2.
- **Threshold Defaults:** Domyślne progi w kodzie nadal odbiegają od docelowych progu launchu (wymaga X1-FIX-002).
- **Manual Actions:** Manualne nadawanie statusu przez admina nadal wymaga ujednolicenia audytu.

## Następny rekomendowany ticket

`X1-FIX-002-align-launch-payment-threshold-defaults`
