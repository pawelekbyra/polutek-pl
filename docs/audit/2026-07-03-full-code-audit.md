# Audyt kodu — 2026-07-03

Raport naprawczy po pełnym audycie z 2026-07-03. Wszystkie znaleziska z raportu źródłowego zostały przejrzane i zamknięte w kodzie albo przez jednoznaczną decyzję produktowo-bezpieczeństwową.

## Status: wykonane

Naprawiono:

- **W1** — webhook Mux działa fail-closed przy braku `MUX_WEBHOOK_SECRET`, weryfikuje podpis `t=... ,v1=...` na payloadzie `timestamp.body` i odrzuca replay poza oknem 300 sekund.
- **W2** — playback Mux dla `PATRON` bez podpisywania zwraca plan `ERROR`; nie jest już wystawiany bezterminowy publiczny manifest `stream.mux.com` dla treści patron-only.
- **W3** — cron Stripe reconciliation nie omija już `fulfillPayment()` i nie ustawia `SUCCEEDED` gołym `updateMany` dla użytkowników z istniejącym grantem.
- **W4** — `payment_intent.payment_failed` przechodzi przez CAS `PENDING -> FAILED`, więc opóźniony event nie nadpisuje płatności już zakończonej sukcesem.
- **W5** — `requires_payment_method` nie jest już oznaczane jako `FAILED` po godzinie; okno wydłużono do 24 godzin.
- **W6** — `PATRON_MIN_TIP_AMOUNT` / `PATRON_MIN_TIP_CURRENCY` sterują progiem eligibility patrona przez `resolvePatronThresholdMinor()` użyte w `fulfillPayment()`. Próg jest liczony niezależnie od minimum checkoutu (`getPaymentCurrencyLimits()` pozostaje nietknięte), więc podniesienie progu patrona nie blokuje drobnych napiwków; env dotyczy tylko skonfigurowanej waluty, dla pozostałych walut próg = minimum checkoutu.
- **Ś1** — `warning_closed` (inquiry zamknięte bez chargebacku) jawnie **przywraca** grant zrewokowany przez `dispute.created` (odrewokowanie po `disputeSuspensionReason`, jak w gałęzi `isWon`) i ustawia płatność na `SUCCEEDED`. Guard chroni płatności `REFUNDED`/`CHARGEBACK_LOST` przed wskrzeszeniem. `recalculatePatronStatus()` pozostaje pure-read, dlatego odrewokowanie jest wykonane wprost.
- **Ś2** — konflikt locka webhooka Stripe nie jest już potwierdzany jako sukces; handler zwraca błąd, aby Stripe ponowił delivery.
- **Ś3** — media rate-limit używa prawego członu `x-forwarded-for`, zgodnie z modelem zaufanego proxy na Vercelu.
- **Ś4** — publiczna wyszukiwarka nie indeksuje już wideo `PATRON`.
- **Ś5** — nadanie patrona zapisuje zdarzenie audytowe `PATRON_GRANTED`.
- **Ś6** — fallback po `P2002` w `grantPatron` nie próbuje czytać z abortowanej transakcji.
- **N1** — autoryzacja crona porównuje token w sposób timing-safe.
- **N2** — reconciliation przekazuje do `fulfillPayment()` kwotę i walutę pobrane ze Stripe intentu, dzięki czemu kontrole mismatch porównują Stripe z lokalną płatnością.
- **N4** — komentarz w `prisma/schema.prisma` wskazuje aktywne `PatronGrant` jako źródło prawdy.
- **N6** — przestarzały bridge płatności nie używa już gołego `update` do przejścia dispute-won na `SUCCEEDED`.
- **N7** — naprawiono nieaktualne fixture'y testowe i sygnatury read modelu.
- **N8** — redakcja raw media rozpoznaje `stream.mux.com` i `videodelivery.net` jako źródła surowych mediów.

Pozostawiono jako świadomy trade-off:

- **N3** — równoległe granty admina są funkcjonalnie nieszkodliwe; idempotencja payment-linked grantów pozostaje chroniona unikalnym `paymentId`.
- **N5** — utracone maile fulfillmentu nadal nie są ponawiane automatycznie; nie blokuje to granta, a błąd jest zapisywany w audycie jako `EMAIL_SEND_FAILED`.

## Korekta po weryfikacji (uzupełnienie)

Przegląd naprawy wykrył dwie kwestie domknięte w tym samym branchu:

- **Ś1 był niekompletny** — pierwsza wersja gałęzi `warning_closed` ustawiała płatność na `SUCCEEDED`, ale nie odrewokowywała grantu (a `recalculatePatronStatus` jest pure-read), więc patron nadal tracił dostęp po niegroźnym inquiry i powstawał niespójny stan (payment SUCCEEDED + grant revoked). Dodano jawne odrewokowanie + guard na `REFUNDED`/`CHARGEBACK_LOST` oraz testy regresyjne.
- **W6 był w złym miejscu** — pierwsza wersja nadpisywała `getPaymentCurrencyLimits()` (minimum checkoutu), co blokowało drobne napiwki i łamiło `currency-thresholds.test.ts` w środowisku CI (gdzie `PATRON_MIN_TIP_AMOUNT=500`). Próg przeniesiono do dedykowanego `resolvePatronThresholdMinor()` wpiętego w `fulfillPayment()`, rozdzielając próg patrona od minimum checkoutu.

Naprawiono przy tym dwie porażki CI ujawnione przez powyższe (`tests/coverage`, `strict escapes`): zaktualizowano baseline strict-escapes po zmianie na CAS w `payment_failed` oraz uzupełniono mocki `currency-settings` w testach płatności o `resolvePatronThresholdMinor`.
