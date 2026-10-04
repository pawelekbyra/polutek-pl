# Audyt podsystemu napiwków (Stripe) i ewidencji wspierających — pawelperfect.com

Stan repo: `main` @ `88c787d0` (worktree `dns-migration-cloudflare-bcfaf0`), 2026-10-03. Audyt tylko do odczytu. Na produkcji wykonano wyłącznie dwa GET bez logowania: nagłówki CSP strony `/pl` i `GET /api/payment-settings`. Do Stripe się nie logowałem; korzystałem tylko z publicznej dokumentacji Stripe (źródła na końcu).

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 5/10.** Architektura po stronie serwera jest przemyślana: jedna kanoniczna ścieżka `fulfillPayment()`, CAS na statusie, sprawdzanie kwoty, waluty, użytkownika i intentu, dedup zdarzeń przez `StripeEvent`, właścicielski odczyt statusu i szybka ścieżka. Nic nie bramkuje treści na podstawie wpłat; sprawdziłem każde miejsce odczytu, wynik jest w §4. Są jednak trzy grupy poważnych problemów:

1. **Utrata wpłat w ewidencji (P0).** Jeśli jedna próba płatności się nie uda (zły kod BLIK, odrzucona karta, nieudane 3DS), a kolejna próba na tym samym PaymentIntent przejdzie, pieniądze trafiają na konto, ale rekord `Payment` zostaje na zawsze `FAILED`. Wtedy nie powstaje e-mail, wpis patrona, licznik w pasku zbiórki ani możliwość zwrotu z panelu. Dziś ten błąd jest częściowo zamaskowany, bo webhooki najpewniej w ogóle nie docierają (punkt 2). **Naprawa webhooka bez wcześniejszej naprawy PAY-01 zwiększy liczbę utraconych wpłat.**
2. **Webhook Stripe w praktyce nie działa (P0, hipoteza mocno uprawdopodobniona).** Na produkcji `StripeEvent` ma 0 wierszy, a `UserPaymentTotal` też 0. Handler zapisuje `StripeEvent` dla **każdego** zdarzenia z poprawnym podpisem, także nieobsługiwanego, a każde udane `fulfillPayment()` robi upsert do `UserPaymentTotal`. Wniosek: żadne zdarzenie nie przeszło weryfikacji podpisu w tej bazie i żadna wpłata nie przeszła przez `fulfillPayment()` (albo te tabele nie zostały przeniesione przy migracji z Neona). Wpłaty realizuje dziś tylko szybka ścieżka (gdy płacący czeka na ekranie) i cron co 15 minut.
3. **Model "patron" nie zgadza się z decyzją właściciela z 2026-10-03 (P1).** Patronem zostaje tylko ten, kto wpłaci co najmniej próg. Na produkcji próg dla EUR, USD, CHF i GBP to 5, a minimum to 3, więc wpłata 3–4,99 nie robi z nikogo patrona. Zwrot "tej jednej" wpłaty, do której przypięto grant, odbiera status, choć inne wpłaty zostają. Do tego powiadomienie dla patrona obiecuje "dostęp do pełnej zawartości", co jest sprzeczne z regulaminem.

Ponadto: produkcyjny CSP nie ma `https://hooks.stripe.com` ani `https://*.js.stripe.com` (Stripe wymaga ich m.in. dla 3DS). Stripe.js ładuje się na każdej wizycie strony głównej przez ukryty `DonationBox`. Własne kafelki metod płatności dublują to, co daje Payment Element. Kodu po modelu płatnego dostępu i po eksperymencie `TEMP_SUPPORT_AS_MODAL` zostało sporo.

**Liczba znalezisk: 43 — P0: 2, P1: 4, P2: 14, P3: 23.**

---

## 2. Faktyczny przepływ pieniędzy i danych

```
[Hero "Wspieraj"] --(niezalogowany)--> modal logowania
      | zalogowany: window event "polutek:open-support"
      v
ChannelHome.revealDonations()  (TEMP_SUPPORT_AS_MODAL=true)
      v
SupportModal (5 kroków, stan tylko w przeglądarce)
  1 recipient + checkbox Regulamin/Polityka (zgoda NIE trafia na serwer)
  2 disclaimer ("niczego nie odblokowuje")
  3 amount + waluta  --"Dalej"-->  useCheckoutFlow.submit()
        POST /api/checkout/create-intent {amountMinor,currency,title,requestId}
          auth() -> rateLimit 10/10min -> zod -> min/max z PaymentCurrencySetting
          createCheckoutIntent():
            dedup po (userId,requestId) -> Stripe Customer (raz) ->
            INSERT Payment(PENDING) -> stripe.paymentIntents.create(automatic_payment_methods,
              metadata{userId,paymentId,requestId,creatorId}, idempotencyKey) ->
            UPDATE Payment.stripeIntentId
          <- {clientSecret, paymentId, paymentMethodTypes}
  4 method: kafelki z paymentMethodTypes (+Apple/Google Pay z legacy paymentRequest, +"Crypto" atrapa)
  5 pay: confirmBlikPayment | confirmP24Payment(redirect) | CardElement+confirmCardPayment |
         ExpressCheckoutElement+confirmPayment | PaymentElement(deferred, jedna metoda)
      v
  wynik w przeglądarce -> trackConfirmedPayment() / powrót ?success=true&payment_id=
      v
  polling GET /api/payments/[id] co 2 s, max 10 razy
     getOwnedPaymentStatus(): {id,userId} -> jeśli PENDING: stripe.paymentIntents.retrieve
       -> succeeded? fulfillPayment(actor=system)          <-- SZYBKA ŚCIEŻKA

Równolegle (serwer):
  Stripe --POST--> /api/webhooks/stripe -> constructEvent -> StripeEvent lock ->
     payment_intent.succeeded -> fulfillPayment()
     payment_intent.payment_failed -> Payment PENDING->FAILED   (!! PAY-01)
     charge.refunded -> handleRefund()   charge.dispute.created/closed -> handleDispute()
  systemd timer co 15 min -> /api/cron/stripe-reconciliation:
     PENDING 15 min..7 dni -> retrieve -> succeeded: fulfillPayment | canceled: FAILED |
     requires_payment_method > 24 h: FAILED (intent w Stripe NIE anulowany)

fulfillPayment() [1 transakcja]:
  sprawdzenia (paymentId, user z metadata, intent, kwota, waluta) ->
  CAS PENDING->SUCCEEDED -> UserPaymentTotal += kwota ->
  próg patrona (admin/env/podłoga) && brak aktywnego grantu -> grantPatron(STRIPE_TIP):
     PatronGrant + AuditLog + Notification("Teraz masz dostęp do pełnej zawartości")
  po commicie: e-mail become-patron albo thank-you-donation (raz, bez ponowień)

Odczyty: pasek zbiórki (Payment groupBy, cache 60 s), odznaki PATRON, panel admina.
```

---

## 3. Znaleziska

Format: **ID — waga — typ — plik:linia**; problem; ścieżka wykonania; naprawa; nakład (S/M/L); pewność.

### P0

**PAY-01 — P0 — błąd (utrata ewidencji pieniędzy)**
`lib/modules/payments/application/handle-stripe-webhook.use-case.ts:155-162`, `lib/modules/payments/infrastructure/payment.repository.ts:85-111` (CAS `status: PENDING`), `lib/modules/payments/application/fulfill-payment.use-case.ts:64-76`, `app/api/cron/stripe-reconciliation/route.ts:33-42,79-90`, `lib/modules/payments/application/get-payment-status.use-case.ts:230,299`.
- **Problem:** `payment_intent.payment_failed` zmienia lokalny `Payment` z `PENDING` na `FAILED`. Według Stripe to zdarzenie oznacza tylko nieudaną **próbę**: PaymentIntent wraca do `requires_payment_method` i może później przejść. UI celowo na to pozwala: TipPayStep czyści kod BLIK po błędzie i pozwala spróbować ponownie, a zmiana metody nie tworzy nowego intentu. Gdy kolejna próba się uda, `fulfillPendingPaymentWithCAS` szuka `status: PENDING` i nic nie znajduje. Wtedy `fulfillPayment` zwraca `null` ("already fulfilled or not in a fulfillable state"), a szybka ścieżka i cron w ogóle nie patrzą na `FAILED`. Cron dodatkowo oznacza `FAILED` po 24 h przy `requires_payment_method`, nie anulując intentu w Stripe.
- **Skutek:** pieniądze są pobrane, a w bazie jest `FAILED`. Nie ma e-maila, wpisu patrona ani wpisu w pasku zbiórki. Zwrot z panelu jest zablokowany (`admin-refund.use-case.ts:23-27` nie dopuszcza `FAILED`). Klient przy wyniku "processing" może zobaczyć "Coś poszło nie tak… Nic nie zostało pobrane" (`TipThanksStep.tsx:243,283`).
- **Naprawa:** (a) `payment_failed` nie zmienia statusu, tylko zapisuje `lastPaymentError` w metadata; (b) CAS w `fulfillPayment` dopuszcza `PENDING | FAILED | CANCELED → SUCCEEDED`, bo źródłem prawdy jest odpowiedź Stripe `succeeded`, ze sprawdzoną kwotą i intentem; (c) cron przed oznaczeniem porażki robi `stripe.paymentIntents.cancel()` i ustawia `CANCELED`; (d) testy: failed → succeeded na tym samym intencie, webhook i cron.
- **Nakład:** S/M. **Pewność:** wysoka (kod plus dokumentacja Stripe o cyklu życia PaymentIntent).

**PAY-02 — P0 — błąd/operacje (webhook nie realizuje zdarzeń)**
`lib/modules/payments/application/handle-stripe-webhook.use-case.ts:84-115`, `app/api/webhooks/stripe/route.ts:8-26`, `lib/modules/payments/domain/payment.errors.ts:3-8`.
- **Problem:** każde zdarzenie z poprawnym podpisem zapisuje wiersz `StripeEvent` w `acquireLock` (linia 98), niezależnie od typu. Przy 147 płatnościach `StripeEvent` = 0 oraz `UserPaymentTotal` = 0. `incrementUserPaymentTotal` w `fulfill-payment.use-case.ts:90` tworzy wiersz przy każdej udanej realizacji, a wiersze nie są usuwane przy zwrotach. Oznacza to, że (a) żaden webhook nie przeszedł weryfikacji podpisu, prawdopodobnie przez zły lub brakujący `STRIPE_WEBHOOK_SECRET`, zły tryb test/live, niezasubskrybowane zdarzenia albo zły URL endpointu, oraz (b) **żadna** płatność nie przeszła przez `fulfillPayment()` w tej bazie. Druga możliwość: tabele nie przyszły z dumpa Neona. Błąd podpisu zwraca 400 (domyślny status `PaymentError`), a Stripe ponawia przez 3 dni i wyłącza endpoint. Deduplikacja zdarzeń jest poprawna w kodzie, ale w praktyce nigdy nie była użyta.
- **Weryfikacja (dla właściciela lub agenta z dostępem, tylko odczyt):** `SELECT status, count(*) FROM "Payment" GROUP BY 1;` oraz `SELECT source, count(*) FROM "PatronGrant" GROUP BY 1;`. Jeśli istnieją `SUCCEEDED`, a `UserPaymentTotal` jest pusty, ktoś ustawiał status poza `fulfillPayment`. Dodatkowo: w Stripe Dashboard → Webhooks → historia dostarczeń endpointu `https://www.pawelperfect.com/api/webhooks/stripe` (kody 400 lub 500?) oraz logi aplikacji z frazą `Webhook Signature Error`.
- **Naprawa:** najpierw PAY-01, potem poprawny sekret i lista zdarzeń (`payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `charge.dispute.*`). Do tego admin health `/api/admin/health/stripe`: tryb kluczy pk/sk, lista endpointów przez API, czas ostatniego `StripeEvent` i alert, gdy przez N godzin przy płatnościach brak zdarzeń.
- **Nakład:** S (konfiguracja) + M (health). **Pewność:** średnia–wysoka co do braku działania, średnia co do przyczyny.

### P1

**PAY-03 — P1 — bezpieczeństwo/UX (CSP blokuje 3DS)**
`lib/utils/security.ts:84-101`. Potwierdzone na produkcji: `frame-src` zawiera tylko `https://js.stripe.com`, a `script-src` tylko `https://js.stripe.com`.
- **Problem:** Stripe wymaga `frame-src https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com` oraz `script-src https://*.js.stripe.com https://js.stripe.com`. `hooks.stripe.com` jest potrzebne dla metod z przekierowaniem, w tym kart z 3D Secure. W UE niemal każda płatność kartą wymaga SCA, więc wyzwanie 3DS w ramce może zostać zablokowane i płatność kartą się nie uda.
- **Naprawa:** dodać brakujące hosty. Opcjonalnie dodać `img-src https://*.stripe.com`. Dopisać test jednostkowy na `generateCSP()`.
- **Nakład:** S. **Pewność:** średnio-wysoka (zależy od tego, czy dany bank otwiera ramkę `hooks.stripe.com`; Stripe wymienia ją wprost).

**PAY-04 — P1 — błąd modelu (próg patrona sprzeczny z decyzją właściciela)**
`lib/modules/payments/application/fulfill-payment.use-case.ts:92-111`, `lib/payments/currency-settings.ts:55-60,90-111`, `lib/modules/payments/domain/payment.policy.ts:247-294`. Produkcja (`/api/payment-settings`): PLN min 5 / próg 5; EUR, USD, CHF, GBP min **3** / próg **5**.
- **Problem:** decyzja z 2026-10-03 brzmi "wpłacił = patron", a kod tworzy grant tylko przy `amountMinor >= patronThresholdMinor`. Wpłaty 3–4,99 EUR/USD/CHF/GBP nie robią z nikogo patrona, a w panelu wyglądają jak wpłaty "nie-patrona".
- **Naprawa:** usunąć próg i tworzyć grant (albo wyliczać status, zob. §6) przy każdej udanej wpłacie. Backfill dla istniejących `SUCCEEDED` bez grantu. Usunąć `patronThresholdMinor` z UI admina i z API.
- **Nakład:** S (+ migracja danych S). **Pewność:** wysoka.

**PAY-05 — P1 — błąd (cofnięcie statusu mimo innych wpłat)**
`lib/modules/payments/application/fulfill-payment.use-case.ts:98-111` (grant tylko przy pierwszej wpłacie), `handle-refund.use-case.ts:92-98`, `handle-dispute.use-case.ts:162-178,254-260`, `patron.repository.ts:48-57`.
- **Problem:** `PatronGrant` jest przypięty do **pierwszej** kwalifikującej się wpłaty (`paymentId`), a kolejne wpłaty grantu nie dostają (`alreadyPatron`). Pełny zwrot albo przegrany spór dla tej pierwszej wpłaty cofa jedyny grant, choć użytkownik ma inne `SUCCEEDED`. `recalculatePatronStatus` jest czystym odczytem i niczego nie odtwarza.
- **Naprawa:** po zwrocie lub sporze przeliczać status z **wszystkich** wpłat użytkownika. Najprościej przejść na model wyliczany (§6).
- **Nakład:** M. **Pewność:** wysoka.

**PAY-06 — P1 — UX/zgodność z regulaminem (sygnał)**
`lib/modules/notifications/application/send-notification.use-case.ts:77-83` (`patronAccess`: "Teraz masz dostęp do pełnej zawartości." / "You now have access to all content."), wywoływane z `grant-patron.use-case.ts:87-94` przy każdym grancie. Także `welcome` (linia 74): "dołącz do społeczności patronów".
- **Problem:** treść obiecuje dostęp za wpłatę, co jest sprzeczne z regulaminem ("niczego nie odblokowuje"). Dzwonek jest ukryty (`TEMP_HIDE_NOTIFICATIONS_BELL`), ale wiersze `Notification` powstają i pokażą się po odkryciu dzwonka. Override z tabeli `NotificationTemplate` może tę treść zastąpić, ale domyślna jest błędna.
- **Naprawa:** zmienić treść na podziękowanie bez obietnic albo nie wysyłać tego powiadomienia wcale, skoro e-mail już dziękuje. Sprawdzić, czy w `NotificationTemplate` nie ma zapisanej starej treści. Kwestię regulaminową tylko sygnalizuję.
- **Nakład:** S. **Pewność:** wysoka.

### P2

**PAY-07 — P2 — wydajność/prywatność:** `app/components/channel/SidebarPlaylist.tsx:16` statycznie importuje `DonationBox`, a ten importuje `lib/hooks/useCheckoutFlow.ts:30`, gdzie `loadStripe()` jest wołane przy ewaluacji modułu. W efekcie Stripe.js (z ramkami i sygnałami antyfraudowymi `m.stripe.network`) ładuje się przy **każdej** wizycie na stronie głównej, choć box jest ukryty flagą. Naprawa: usunąć `DonationBox` (PAY-34) albo ładować Stripe leniwie w `SupportModal` (on już jest `dynamic`). S. Pewność wysoka.

**PAY-08 — P2 — błąd/śmieci w danych (porzucone intenty):** `app/components/channel/SupportModal.tsx:109-124` (`backToAmount` → `flow.resetCheckout()`), `lib/hooks/useCheckoutFlow.ts:386-389` (nowy `requestId` przy każdej zmianie kwoty lub waluty), `create-checkout-intent.use-case.ts:186-214`. Każde "Dalej" na kroku kwoty z nową kwotą tworzy nowy PaymentIntent i nowy `Payment(PENDING)`, a stare nie są anulowane. Każde ponowne otwarcie modala także. To prawdopodobnie główne źródło 147 wierszy. Cron oznacza je `FAILED` po 24 h, ale intent w Stripe zostaje otwarty. Naprawa: aktualizować kwotę istniejącego intentu (`paymentIntents.update`) albo przejść na deferred intent (tworzenie dopiero przy płatności, §6); porzucone anulować. M. Pewność wysoka.

**PAY-09 — P2 — błąd (kolejność zdarzeń sporu):** `handle-dispute.use-case.ts:254-260`. Gałąź domyślna bezwarunkowo ustawia `DISPUTED`, także gdy płatność jest `REFUNDED`, `SUCCEEDED` po wygranej albo `PENDING`. Stripe nie gwarantuje kolejności, więc `charge.dispute.closed(won)` przed `created` daje `DISPUTED` na zawsze. Naprawa: rozstrzygać po `dispute.status` pobranym ze Stripe w momencie obsługi (retrieve) i ignorować przejścia wstecz. M. Pewność średnia.

**PAY-10 — P2 — błąd:** `admin-dispute-sync.use-case.ts:148-151` mapuje `warning_closed` na `"warning"`. W `handleDispute` to trafia do gałęzi domyślnej (linia 254), więc ręczna synchronizacja zamkniętego zapytania ustawia `DISPUTED` i cofa grant. Webhook przekazuje surowe `warning_closed` i działa poprawnie. Naprawa: przekazywać `warning_closed` bez mapowania. S. Pewność wysoka.

**PAY-11 — P2 — audyt/bezpieczeństwo:** `admin-refund.use-case.ts:80-104` i `handle-refund.use-case.ts:51`. (a) Jeśli `charge.refunded` z webhooka dojdzie przed zapisem z panelu, `deltaRefundMinor` = 0, funkcja kończy się przed `recordAuditEvent` i przed zapisem `refundedById`, więc zwrot zrobiony przez admina nie ma śladu w audycie. (b) `stripe.refunds.create` bez `idempotencyKey`, więc przy ponowieniu żądania (sieć) możliwy jest podwójny zwrot częściowy. (c) `reason` ze schematu jest zamieniany na stałe `requested_by_customer`, a sam tekst trafia tylko do bazy. Naprawa: audyt w `adminRefund` niezależnie od delty, klucz idempotencji `refund-<paymentId>-<requestId>`. S. Pewność wysoka.

**PAY-12 — P2 — błąd (statystyki admina):** `payment.repository.ts:206-226`. "Succeeded" liczy tylko `SUCCEEDED` (pomija `PARTIALLY_REFUNDED` i `DISPUTED`), a "refunded" sumuje zwroty ze wszystkich statusów. Suma netto jest więc zaniżona, a częściowo zwrócone wpłaty znikają z przychodu. Naprawa: liczyć brutto dla `SUCCEEDED + PARTIALLY_REFUNDED (+DISPUTED osobno)` i netto = brutto − zwroty. S. Pewność wysoka.

**PAY-13 — P2 — błąd (przeliczanie walut):** `lib/modules/users/domain/payment-totals.ts:8-15` pomija CHF i GBP w `normalizedTotal` (panel i eksport użytkowników). Osobny zestaw kursów jest w `lib/modules/video/domain/fundraising.ts:126-134` (5 walut). Naprawa: jedna funkcja kursów dla obu miejsc. S. Pewność wysoka.

**PAY-14 — P2 — prywatność (decyzja właściciela):** `lib/comments-public-author.ts:9,35` dokłada publiczną odznakę `PATRON` przy komentarzach, widoczną dla wszystkich, a więc ujawnia, kto wpłacił. Decyzja właściciela: status widoczny "wyłącznie dla admina (i ewentualnie jako ozdobna odznaka)". Odznaka jest dziś publiczna i domyślnie włączona, bez zgody osoby. Do decyzji: zostawić, uczynić ją opcjonalną (opt-in w koncie) albo usunąć. Kwestię prawną (RODO) tylko sygnalizuję. S. Pewność wysoka.

**PAY-15 — P2 — UX/zgodność (sygnał):** `lib/modules/video/domain/fundraising.ts:183-187` i `fundraising-progress.service.ts:65-68`. Ręcznie ustawione wypełnienie (`fundraisingManualPercent`; według CLAUDE.md §4.16 premiera ma 65) pokazywane jest publicznie jako postęp zbiórki, choć nie wynika z wpłat. Widz tego nie odróżni. Sygnalizuję ryzyko wprowadzenia w błąd. Naprawa techniczna: oznaczenie w UI albo rezygnacja z trybu ręcznego. S. Pewność wysoka.

**PAY-16 — P2 — UX/copy:** `app/components/channel/SidebarPlaylist.tsx:313` nazywa sekcję filmów tieru PATRON "Strefa Fenkjuu" / "Thank You Zone". Nazwa sugeruje strefę dla wspierających, a dostęp daje samo logowanie. Klucze `donate`/`patronZone` = "STREFA THANK YOU" w `LanguageContext.tsx:142,152,192,202` są martwe (PAY-33). Kwestię regulaminową tylko sygnalizuję. S. Pewność wysoka.

**PAY-17 — P2 — zgodność (sygnał):** zgoda na Regulamin i Politykę (`TipRecipientStep.tsx:45-49`, `SupportModal.tsx:75,116` z `requireTerms: false`) istnieje tylko w stanie przeglądarki. Serwer nie zapisuje, która wersja dokumentu (`LEGAL_EFFECTIVE_DATE`) została zaakceptowana ani kiedy. Naprawa: przesyłać `termsVersion` i zapisywać w `Payment.metadata` oraz `PaymentIntent.metadata`. S. Pewność wysoka.

**PAY-34 — P2 — śmieci (utrwalenie modala, usunięcie `TEMP_SUPPORT_AS_MODAL`):** do usunięcia:
- `lib/temp-support-modal.ts`;
- `app/components/channel/DonationBox.tsx` (294 linie), `app/components/channel/DonationAmountField.tsx` (83), `app/components/playlist/CheckoutModal.tsx` (241), `app/components/playlist/CheckoutSummaryPanel.tsx` (140);
- `SidebarSupportBox` i `patronBox` w `SidebarPlaylist.tsx:56-62,306-308,342-346` oraz prop `showSupportBox`;
- w `ChannelHome.tsx`: gałąź else w `revealDonations` (212-223), `getVisibleDonationsElement` (104), komentarze o `#donations`;
- obsługa `?support=1` (`ChannelHome.tsx:236`, `DonationBox.tsx:106`);
- w `useCheckoutFlow`: `isTermsAccepted`/`showTermsError`/`onTermsCheckedChange`/`isCheckoutModalOpen`/blokada `body.overflow` (342-347)/`requireTerms`/`isMounted`/`minimums`, wraz z `t.pleaseAcceptTerms`;
- testy: `DonationBox*.test.tsx` (3), `channel-home-support-handoff.test.tsx`, część `useCheckoutFlow*.test.tsx`;
- docstring "currently just DonationBox" w `useCheckoutFlow.ts:26,100-106`.

M. Pewność wysoka.

**PAY-35 — P2 — śmieci/projekt (trzy minima):** `PaymentCurrencySetting` (`schema.prisma`: `minAmountMinor`, `patronThresholdMinor`, `patronBoxMinMinor`), `currency-settings.ts`, `get-payment-settings.use-case.ts` (dubluje `getPaymentCurrencyLimits` 1:1), `app/api/payment-settings/route.ts:13-29`, `PaymentSettingsForm.tsx:17,102-122`. W modelu bez dostępu sens ma tylko jedno minimum (podłoga). Próg patrona znika (PAY-04), a minimum "boxa" jest egzekwowane tylko w UI, bo serwer sprawdza podłogę. Naprawa: jedna kolumna `minAmountMinor` (i ewentualnie `maxAmountMinor`), jedna funkcja odczytu, migracja usuwająca kolumny po okresie przejściowym. M. Pewność wysoka.

**PAY-40 — P2 — brak testu:** brakuje testów dla:
- failed → succeeded na jednym intencie (PAY-01);
- CSP z `hooks.stripe.com` (PAY-03);
- webhooka z prawdziwym podpisem (`stripe.webhooks.generateTestHeaderString`) zamiast mocka `constructEvent`;
- odwróconej kolejności zdarzeń sporu (PAY-09);
- wyścigu webhook kontra zwrot z panelu (PAY-11);
- zwrotu przy kilku wpłatach użytkownika (PAY-05);
- `warning_closed` w admin sync (PAY-10);
- tego, że `paymentIntents.create` dostaje stałą treść `description` (PAY-18).

E2E płatności w trybie testowym (`tests/e2e/beta-smoke.spec.ts` ich nie obejmuje). M. Pewność wysoka.

### P3

**PAY-18 — P3 — bezpieczeństwo:** `lib/payments/checkout.schema.ts:20` i `create-checkout-intent.use-case.ts:202`. `description` intentu (widoczny w aplikacji banku przy BLIK, na wyciągu i w Dashboardzie) pochodzi z ciała żądania klienta (1–120 znaków dowolnego tekstu). Naprawa: stała po stronie serwera (z `APP_NAME` i języka). S.

**PAY-19 — P3 — bezpieczeństwo:** `create-checkout-intent.use-case.ts:226` przekazuje surowy komunikat błędu Stripe do `PaymentProviderError`, dalej przez `handleApiError` (`lib/errors.ts:21-25`) do klienta, gdzie wyświetla go toast (`useCheckoutFlow.ts:422`). Komunikaty Stripe potrafią ujawnić konfigurację, np. "Invalid API Key provided: sk_live_****…". Naprawa: ogólny komunikat dla klienta, szczegóły tylko do logu. S.

**PAY-20 — P3 — błąd:** `create-checkout-intent.use-case.ts:141-194`. Dwa równoległe żądania z tym samym `requestId` mijają `findPaymentByRequestId`, a drugie `createPayment` wpada na `@@unique([userId, requestId])` (P2002) i kończy się błędem 500. To samo dzieje się, gdy istnieje `PENDING` bez `stripeIntentId` albo nie uda się `retrieve` (linie 153-165). Naprawa: łapać P2002 i zwracać istniejący rekord. S.

**PAY-21 — P3 — błąd:** `handle-stripe-webhook.use-case.ts:120-129` i `fulfill-payment.use-case.ts:35`. `payment_intent.succeeded` dla intentu spoza aplikacji (Payment Link, ręczna płatność w Dashboardzie, brak `metadata.paymentId`) rzuca `PAYMENT_ID_MISSING`, zwraca 500, a Stripe ponawia przez 3 dni i może wyłączyć endpoint. Naprawa: odpowiedzieć 200 i zapisać jako "ignored", jeśli brak `paymentId`. S.

**PAY-22 — P3 — śmieci/odporność:** `app/api/webhooks/stripe/route.ts:8-12` rozpoznaje błąd podpisu po tekście `'signature'`, choć istnieją nieużywane klasy `PaymentWebhookSignatureError`/`ConfigError`/`ProcessingError` (`payment.errors.ts:10-29`). Brak obsługi `payment_intent.canceled` i nieudanego zwrotu (`charge.refund.updated` / `refund.failed`, istotne dla BLIK i P24). Dla `CONFLICT` webhook zwraca 400 zamiast 409/500. S.

**PAY-23 — P3 — błąd (transakcja):** `grant-patron.use-case.ts:87-94` woła `sendNotification(..., currentTx)`, a ta w `send-notification.use-case.ts:39-64` łapie wyjątek. W Postgresie nieudane zapytanie przerywa całą transakcję ("current transaction is aborted"), więc kolejne zapytania w `fulfillPayment` padną i realizacja się wycofa. Złapanie wyjątku nie ratuje transakcji. Naprawa: powiadomienie po commicie (outbox albo after-commit). S.

**PAY-24 — P3 — e-maile:** `fulfill-payment.use-case.ts:158-181`. Wysyłka po commicie bez ponowień: awaria procesu między commitem a wysyłką albo błąd Resend oznacza brak e-maila (zostaje tylko wpis audytu `EMAIL_SEND_FAILED`). Warunek `becamePatronNow || (wasEligible && isPatron)` jest redundantny, bo `wasEligible === shouldGrant`. Szablony `become-patron` i `thank-you-donation` (`lib/email-defaults.ts:118+`) mają dziś praktycznie tę samą treść ("niczego nie odblokowuje" w obu), więc wystarczy jeden. Treść jest zgodna z modelem. "Dokładnie raz" jest zapewnione przez `isFirstFulfillment` z CAS, z zastrzeżeniem "najwyżej raz", nie "co najmniej raz". S.

**PAY-25 — P3 — dane:** `patron.repository.ts:48-67` przy cofnięciu nadpisuje pole `reason` grantu (powód nadania) tekstem cofnięcia. `handle-dispute.use-case.ts:175-178,257-259` pisze do `reason` zamiast do `revokeReason` i przy przegranej nadpisuje `revokedAt` także już cofniętych grantów (brak `revokedAt: null` w `where`). S.

**PAY-26 — P3 — błąd:** `handle-dispute.use-case.ts:194,229`. Wygrany spór lub zamknięte zapytanie na płatności `PARTIALLY_REFUNDED` ustawia `SUCCEEDED`, gubiąc informację o częściowym zwrocie. S.

**PAY-27 — P3 — odporność:** `GET /api/payments/[id]` (`get-payment-status.use-case.ts:299-300`) przy `PENDING` woła Stripe API przy każdym odpytaniu i nie ma limitu żądań. Zalogowany użytkownik może tym zużywać limit API Stripe konta (wspólny dla wszystkich). Naprawa: rate limit per użytkownik i cache 2–3 s. S.

**PAY-28 — P3 — UX:** `TipPayStep.tsx:34-50` (`useTipConfirm`). Blokada podwójnego kliknięcia opiera się na stanie Reacta. Dwa szybkie kliknięcia przed renderem mogą wywołać dwa `confirm*` na jednym intencie: drugie dostaje błąd i na chwilę pokazuje komunikat. Stripe nie pobierze dwa razy, bo to jeden intent. Naprawa: `useRef` jako blokada. S.

**PAY-29 — P3 — UX/copy:** `TipThanksStep.tsx:243,279-285`. `REFUNDED_DISPUTED` pokazuje "Nic nie zostało pobrane", co jest nieprawdą dla zwrotu lub sporu. `ACCESS_SYNC_PENDING` to nazwa z modelu dostępu (`get-payment-status.use-case.ts:198,210,315`; `accessSynced`), a dla każdej wpłaty bez nowego grantu status pozostaje "ACCESS_SYNC_PENDING". Naprawa: statusy `SUCCEEDED`/`PROCESSING`/`FAILED`/`REFUNDED` bez pojęcia dostępu. S.

**PAY-30 — P3 — UX (niska pewność):** `SupportModal.tsx:82-102` wykrywa portfele przez przestarzałe `stripe.paymentRequest()` z wpisanym na sztywno `country: "PL"` i kwotą 100, a `TipWalletForm.tsx:186-204` robi to drugi raz przez `ExpressCheckoutElement.onReady`. W `onConfirm` (`TipWalletForm.tsx:162-173`) nie ma `event.paymentFailed()` przy błędzie, więc arkusz portfela może nie zamknąć się czytelnie. Apple Pay wymaga rejestracji domeny `www.pawelperfect.com` w Stripe (Payment method domains); nie zweryfikowałem tego. S.

**PAY-31 — P3 — dług techniczny:** `TipPayStep.tsx:196-243` używa przestarzałego `CardElement` w osobnej grupie `Elements`. Stripe zaleca Payment Element (§6). M.

**PAY-32 — P3 — UX:** `tip-flow-config.ts:90` dodaje kafelek "Crypto" zawsze, na końcu listy. `TipPayStep.tsx:313-328` tylko odsyła z powrotem i **nie przyjmuje pieniędzy** (sprawdzone: brak wywołania Stripe, `rememberTipMethod` go pomija). To jednak ślepa uliczka w kluczowym przepływie. `NEXT_PUBLIC_TIP_BTC/ETH_ADDRESS` w `.env.example:58-59` nie są czytane przez kod. Do decyzji właściciela. S.

**PAY-33 — P3 — śmieci (martwy kod i dane):**
- `app/api/checkout/route.ts` (alias POST → create-intent, brak wywołań);
- `PaymentStatus.CANCELED` nigdy nie jest ustawiany (cron używa `FAILED`);
- `Payment.stripeSessionId` oraz `session_id`/`canceled` w `STRIPE_RETURN_PARAMS` (`useCheckoutFlow.ts:15-23`) pochodzą z dawnego Checkout Session;
- `lib/modules/payments/domain/payment-adjustments.ts` i `lib/services/payment.service.ts` (używane tylko w testach);
- `get-payment-settings.use-case.ts` (duplikat);
- `MIN_PATRON_AMOUNT(_PLN)` w `lib/constants.ts:3-4` (brak użyć);
- `PATRON_MIN_TIP_*` w `.env.example:48-49`;
- klucze tłumaczeń bez użyć w `app/`: `support`, `donate`, `supportArtist`, `supportBrand`, `patronZone`, `acceptTerms`, `tipTheGuy` (`LanguageContext.tsx:139-163,189-213`; występują tylko w mockach testów DonationBox);
- prop `isPatron` w `ChannelVideoCard.tsx:19,37`, nieużywany, oraz zapytanie `patronGrant` dla niego w `app/[locale]/channel/[slug]/page.tsx:133-135`;
- `viewerState: "PATRON"` w `channel-layout.service.ts:54-62`: dodatkowy join bez wpływu na zachowanie, bo `isLocked` traktuje PATRON jak LOGGED_IN (172-178);
- nieużywany wynik `userResult` w `app/api/checkout/create-intent/route.ts:43-44` (brak sprawdzenia, czy konto nie jest usunięte).

S–M.

**PAY-36 — P3 — śmieci/model:** `UserPaymentTotal` to zdenormalizowany cache, który da się wyliczyć jednym `groupBy` po `Payment`. Na produkcji ma 0 wierszy. Pole `normalizedTotal` jest liczone w każdym use case patrona (`grant-`, `revoke-`, `recalculate-`, `get-patron-status`), choć nikt go tam nie potrzebuje. Naprawa: liczyć z `Payment` i usunąć tabelę po migracji. M.

**PAY-37 — P3 — błąd:** `app/api/cron/stripe-reconciliation/route.ts:70-90`. Przy `canceled` ustawia `FAILED` zamiast `CANCELED`. Przy `requires_payment_method` po 24 h ustawia `FAILED` bez anulowania intentu. `PENDING` starsze niż 7 dni nie są nigdy rozliczane. Brak limitu partii. Zob. PAY-01. S.

**PAY-38 — P3 — operacje:** brak sprawdzenia zgodności trybów `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test/pk_live) i `STRIPE_SECRET_KEY` (sk_test/sk_live). Webhook nie porównuje `event.livemode` z trybem klucza. Brak `/api/admin/health/stripe` (są tylko `health/cloudflare` i `health/mux`). S.

**PAY-39 — P3 — dokumentacja:** rozbieżności opisane w §5. S.

**PAY-41 — P3 — odporność:** `lib/payments/currency-settings.ts:44-46` po cichu zwraca stałe domyślne (min 10) przy błędzie bazy. UI i serwer mogą wtedy pokazywać i egzekwować inne minimum niż ustawione w panelu. Naprawa: logować i zwracać 503. S.

**PAY-42 — P3 — bezpieczeństwo (card testing):** niskie minimum (3 EUR), dowolna liczba prób potwierdzenia na jednym intencie, konto zakładane tanio (jest Turnstile). Limit 10 intentów / 10 min per użytkownik (`create-intent/route.ts:29-33`) nie ogranicza prób kart na jednym intencie. Stripe opisuje zbiórki i darowizny jako typowy cel testowania kart. Naprawa: reguły Radar (blokada przy N nieudanych próbach) i monitoring odrzuceń. S.

**PAY-43 — P3 — dokumentacja/nazewnictwo:** model `Subscription` (6 wierszy) **nie jest płatnością**. To obserwowanie kanału i zapis na newsletter (`lib/modules/subscriptions/**`, `email.policy.ts:42`, `signed-unsubscribe`), aktywnie używane. Komentarz w schemacie ("LEGACY: historical channel-follow… only") jest mylący. Proponuję zmienić nazwę na `ChannelFollow` przy okazji innej migracji. S.

---

## 4. Wszystkie miejsca czytające status patrona

Żadne z nich nie bramkuje treści. `checkVideoAccess()` ma tylko komentarz (`lib/modules/access/application/check-video-access.use-case.ts:120`).

| Plik:linia | Co czyta | Wpływ na zachowanie |
|---|---|---|
| `lib/comments-public-author.ts:9,35` | `patronGrants` autora | **Publiczna** odznaka `PATRON` przy komentarzach (PAY-14) |
| `app/components/comments/components/CommentItem.tsx:68` (`isPatronAuthor`, `types.ts:48`) | odznaka z DTO | wygląd komentarza |
| `app/components/home/HomeExperience.tsx:108-126,145` | `patronGrant.findFirst` | `isPatronDecorative` (ADMIN lub grant) |
| `app/components/comments/EmbeddedComments.tsx:116-117,429` → `CommentComposer.tsx:134` | `isPatronDecorative` | pierścień `chan-patron-ring` w polu komentarza |
| `app/components/comments/hooks/useComments.ts:92-93` | `isPatronDecorative` | optymistyczna odznaka nowego komentarza |
| `lib/modules/users/application/get-user-profile.use-case.ts:30-43` → `app/api/user/profile/route.ts:26` → `app/components/Navbar.tsx:66,85` → `app/components/auth/UserMenu.tsx:50-55` | aktywny grant | pierścień i tooltip "Patron" przy własnym awatarze |
| `lib/modules/users/application/get-user-access-profile.use-case.ts:29,36` | `hasActivePatronGrant` | pole DTO `isPatron`; bez wpływu na dostęp |
| `lib/modules/users/application/sync-current-user.use-case.ts:21,29` | `patronGrants` | pole DTO `isPatron` |
| `lib/api/auth.ts:16` | — | pole `isPatron: undefined` w aktorze (martwe) |
| `lib/modules/channel/application/channel-layout.service.ts:54-62` | grant | `viewerState="PATRON"`; brak wpływu (`isLocked` 172-178) |
| `app/[locale]/channel/[slug]/page.tsx:133-135,233` | grant | prop do `ChannelVideoCard`, który go nie używa |
| `lib/modules/email/infrastructure/email.repository.ts:20-22,34,42` | grant | wybór odbiorców mailingu admina (PATRONS / NON_PATRONS) |
| `lib/modules/notifications/application/broadcast-notification.use-case.ts:21` | grant | odbiorcy powiadomień (`PATRONS`) |
| `lib/auth/prune-unverified.ts:26` | `patronGrants: none` | konta z grantem nie są czyszczone (ochrona) |
| `lib/modules/users/application/account-deletion-cleanup.use-case.ts:47` | granty | obsługa przy usuwaniu konta |
| `lib/modules/payments/application/fulfill-payment.use-case.ts:57,98-139` | aktywny grant | czy tworzyć grant oraz wybór e-maila |
| `lib/modules/payments/application/get-payment-status.use-case.ts:310-321` | grant dla `paymentId` | `uiStatus` `SUCCEEDED` vs `ACCESS_SYNC_PENDING` (PAY-29) |
| `handle-refund.use-case.ts:92-111`, `handle-dispute.use-case.ts:55-260` | granty | cofanie i przywracanie (PAY-05, PAY-25) |
| Admin: `list-admin-users.use-case.ts:132-146,187,220-227,280-292`, `get-admin-user-details.use-case.ts:65-95`, `export-admin-users.use-case.ts:60-96`, `get-admin-users-stats.use-case.ts:31`, `app/admin/users/[userId]/page.tsx:87-152,252-267`, `app/admin/users/AdminAccessDiagnostics.tsx:18-36`, `app/admin/users/UserPatronActions.tsx`, `app/admin/users/page.tsx:38-61` | granty | filtry, sortowanie, diagnostyka, ręczne nadanie i cofnięcie |
| `app/components/notifications/NotificationsMenu.tsx:137-149` | rodzaj powiadomienia `PATRON` | styl powiadomienia (dzwonek ukryty) |

---

## 5. Rozbieżności dokumentacja ↔ kod

1. **CLAUDE.md §4.2 i §2 Stack:** "Stripe webhook → record StripeEvent → record Payment → eligibility → fulfillPayment". W kodzie `Payment` powstaje przy create-intent, nie w webhooku. Webhook w praktyce nie działa (PAY-02), realizacja idzie przez szybką ścieżkę i cron.
2. **CLAUDE.md §4.1:** "A user is recorded as having supported iff `patronGrants some revokedAt null`". Wpłaty poniżej progu nie dają grantu, więc "wsparł" ≠ "ma grant" (PAY-04).
3. **CLAUDE.md §4.2 (zamknięcie ekranu sukcesu):** wspomina "Patron badge, `viewerIsPatron` video locks". `viewerIsPatron` usunięto 2026-09-26.
4. **CLAUDE.md §4.10:** opisuje `DonationBox` jako "single tip widget rendered by SidebarPlaylist". Jest ukryty flagą. Opis checkboxa odstąpienia i "test debt" jest historyczny. Fragment "Three distinct per-currency minimums" nadal zgadza się z kodem, ale w nowym modelu jest zbędny (PAY-35).
5. **CLAUDE.md, wpis TEMP_SUPPORT_AS_MODAL:** opisuje "Kwota napiwku" jako krok 1, checkbox na kroku kwoty i 3 kropki, a "Update 2026-09-30" tylko to częściowo prostuje. W kodzie jest 5 kroków (`SupportModal.tsx:34`). Opis intentu "Napiwek dla www.pawelperfect.pl": dziś `APP_NAME` = `www.pawelperfect.com`, a opis i tak przychodzi z klienta (PAY-18).
6. **CLAUDE.md §7 Key files:** `DonationBox.tsx` jako "Stripe checkout entry"; faktycznie wejściem jest `SupportModal.tsx` i `app/components/support/**`.
7. **CLAUDE.md §6:** tabela crona mówi o harmonogramie Vercela. Produkcja działa na timerach systemd (SERWEREK.md §16 mówi o tym dobrze).
8. **`docs/specs/PAYMENTS-PATRON-SAFETY-SPEC.md`:**
   - "Stripe Checkout is one-time support": kod używa PaymentIntents, nie Checkout;
   - "Payment is financial fact; PatronGrant is access right": nota na górze to prostuje, ale reguły nie;
   - "default launch values: 10 PLN…": produkcja ma 5 PLN i 3/5 dla pozostałych walut;
   - "Idempotent StripeEvent ledger": tabela pusta;
   - "Dispute suspends linked grant…": zgodne, ale nie uwzględnia wielu wpłat.
9. **Komentarze w kodzie:**
   - `prisma/schema.prisma` przy `patronThresholdMinor` ("grants lifetime patron access… fixed amount shown to non-patrons");
   - `get-payment-status.use-case.ts:226` ("authenticated Clerk user"); Clerk usunięty;
   - `useCheckoutFlow.ts:26,48-51,100-106` ("currently just DonationBox", "Clerk viewer id");
   - `SupportModal.tsx:36-46` ("Kwota napiwku" → "Metoda" →…, 3 kroki);
   - `Hero.tsx:341-350` (box w zakładce "videos"; dziś modal);
   - `currency-settings.ts:15-21`.
10. **`Subscription` w schemacie:** opisany jako "LEGACY", a jest aktywnie używany (PAY-43).

---

## 6. Lepsze rozwiązania i model docelowy

### 6.1 Ewidencja "patron" — model docelowy

**Rekomendacja: status wspierającego wyliczany z `Payment`, plus ręczne nadpisanie przez admina.**

- `isSupporter(user) = EXISTS Payment WHERE userId = u.id AND status IN ('SUCCEEDED','PARTIALLY_REFUNDED') AND amountMinor > refundedAmountMinor` (indeks `@@index([userId, status])` już jest). `supporterSince = MIN(createdAt)` tych wpłat. `totalByCurrency = groupBy`.
- Ręczne decyzje admina: osobne pole `User.supporterOverride` (`NONE | FORCE_ON | FORCE_OFF`) z audytem, albo zostawić `PatronGrant` **tylko** dla źródeł `ADMIN`/`LEGACY`/`MIGRATION`.
- Usunąć: progi, `grantPatron` w `fulfillPayment`, `STRIPE_TIP` grant, przypinanie grantu do `paymentId`, cofanie i przywracanie grantu w zwrotach i sporach, `UserPaymentTotal`, `normalizedTotal` w use case'ach patrona, powiadomienie `patronAccess`.

**Za:**
- jedno źródło prawdy, uzgadniane ze Stripe (cron, szybka ścieżka, webhook);
- znikają całe klasy błędów: PAY-04 (próg), PAY-05 (wiele wpłat), PAY-25 (nadpisywanie powodów), synchronizacja grantów przy sporach (PAY-09 dotyczy wtedy tylko statusu `Payment`);
- ubywa około 6 plików use case'ów i polityk oraz kilku gałęzi w refund i dispute;
- zgodne z decyzją "wpłacił = patron" i "to ewidencja, nie dostęp".

**Przeciw:**
- odczyty (odznaka w komentarzach, filtry admina, odbiorcy mailingów) robią `EXISTS` na `Payment` zamiast na `PatronGrant`; przy tej skali bez znaczenia, a w razie potrzeby można dodać widok SQL;
- trzeba zmigrować istniejące granty `LEGACY`/`MIGRATION`/`ADMIN` do nadpisania, żeby nie zgubić ręcznych decyzji;
- traci się "datę nadania grantu" jako osobny fakt; zastępuje ją data pierwszej wpłaty.

**Alternatywa (mniejsza zmiana):** zostawić `PatronGrant` jako jeden wiersz na użytkownika (unikalny `userId`, bez `paymentId`). Tworzyć go przy każdej udanej wpłacie (upsert), a po zwrocie lub sporze cofać tylko wtedy, gdy suma netto wszystkich zaliczanych wpłat spadnie do zera. Kod admina zostaje bez zmian, ale nadal są dwa źródła prawdy.

### 6.2 Płatność — co zrobić prościej

Stan dziś: własne kafelki metod, 5 osobnych formularzy (BLIK, P24, CardElement, ExpressCheckoutElement, PaymentElement w trybie deferred), przestarzałe `paymentRequest` do wykrywania portfeli, intent tworzony przed wyborem metody (PAY-08).

**Opcja A (rekomendowana, M):** zostawić własne kroki 1–3 (odbiorca i zgoda, informacja, kwota z walutą). Kroki "metoda" i "płatność" zastąpić **jednym Payment Element** (layout `accordion` lub `tabs`) w trybie **deferred intent**: `Elements({mode:'payment', amount, currency})`, a PaymentIntent tworzony dopiero po kliknięciu "Wyślij" (`elements.submit()` → serwer tworzy intent → `stripe.confirmPayment({elements, clientSecret, redirect:'if_required'})`). Payment Element sam pokazuje BLIK (z polem kodu), P24, kartę z 3DS, Apple Pay, Google Pay i PayPal, w kolejności zależnej od kraju i urządzenia, i sam obsługuje przekierowania. Ewentualny przycisk portfela nad nim to ten sam `ExpressCheckoutElement`.

Co to daje:
- usunięcie `TipMethodStep`, `TipPayStep` (328 linii), `TipWalletForm`, `tip-confirm`, większości `tip-flow-config` i `TipSelect` dla metod;
- koniec z porzuconymi intentami (PAY-08);
- brak dublowanego wykrywania portfeli (PAY-30) i brak przestarzałego `CardElement` (PAY-31);
- jeden kod potwierdzenia i mniej testów.

Wada: mniej kontroli nad wyglądem listy metod (konfiguracja przez Appearance API).

**Opcja B (najprostsza, S/M):** Stripe Checkout (hostowany lub "full embedded page") z ceną "Customer chooses price" (`custom_unit_amount`, min, max, preset) i `submit_type: 'donate'`. Stripe obsługuje wszystkie metody, 3DS, stronę powrotu i paragony. W aplikacji zostaje: kroki 1–2, utworzenie sesji (`metadata.userId`, `client_reference_id`), webhook `checkout.session.completed` i `checkout.session.async_payment_succeeded`/`_failed` oraz polling po `session_id`. Stripe w dokumentacji Express Checkout Element wprost zaleca Checkout Sessions zamiast Payment Intents w większości integracji. Wada: wyjście na stronę Stripe albo jego osadzony formularz (mniej "własnej bramki"); kwotę wpisuje się u Stripe, chyba że użyje się ceny inline. CSP sprowadza się do `checkout.stripe.com`.

Niezależnie od wybranej opcji:
- opis intentu po stronie serwera (PAY-18);
- `metadata.termsVersion` (PAY-17);
- `payment_failed` nie zmienia statusu (PAY-01);
- jeden status UI bez pojęcia "access" (PAY-29);
- leniwe ładowanie Stripe.js (PAY-07).

### 6.3 Webhook — zgodnie z praktykami Stripe

Subskrybować tylko potrzebne zdarzenia. Odpowiadać 2xx szybko. Dedup po `event.id` (jest). Nie zakładać kolejności: przy sporach i zwrotach pobierać obiekt ze Stripe w chwili obsługi. Weryfikować podpis na surowym ciele (jest: `req.text()`). Rotować sekret. Ignorować z 200 zdarzenia obcych intentów (PAY-21). Mieć monitoring "brak zdarzeń przy płatnościach" (PAY-02).

---

## 7. Kolejność małych PR-ów

1. **PR-1 (P0, S/M) — realizacja z `FAILED`:** `payment_failed` bez zmiany statusu, CAS dopuszcza `FAILED|CANCELED→SUCCEEDED` przy `succeeded` ze Stripe, cron anuluje intent przed `CANCELED`, testy failed→succeeded. **Przed naprawą webhooka.** (PAY-01, PAY-37)
2. **PR-2 (P0, operacje + S) — diagnoza webhooka:** `/api/admin/health/stripe` (tryby kluczy, lista endpointów, ostatni `StripeEvent`), odpowiedź 200 dla obcych intentów, właściwe klasy błędów. Potem poprawa sekretu i listy zdarzeń w Stripe (właściciel lub agent). (PAY-02, PAY-21, PAY-22, PAY-38)
3. **PR-3 (P1, S) — CSP Stripe:** `hooks.stripe.com`, `*.js.stripe.com` (frame i script), `img-src *.stripe.com`, test. (PAY-03)
4. **PR-4 (P1, S) — treść powiadomień:** `patronAccess` i `welcome` bez obietnic dostępu; ewentualnie rezygnacja z `patronAccess`. (PAY-06)
5. **PR-5 (P1, M) — "wpłacił = patron":** usunięcie progu w `fulfillPayment`, backfill grantów dla istniejących `SUCCEEDED`, przeliczanie po zwrocie i sporze z wszystkich wpłat. Albo od razu model wyliczany z §6.1 jako PR-5a (odczyty) i PR-5b (usunięcie grantów `STRIPE_TIP` i `UserPaymentTotal`). (PAY-04, PAY-05, PAY-36)
6. **PR-6 (P2, M) — utrwalenie modala:** usunięcie `TEMP_SUPPORT_AS_MODAL`, `DonationBox`, `CheckoutModal`, `CheckoutSummaryPanel`, `DonationAmountField`, `SidebarSupportBox`, `?support=1`, gałęzi `revealDonations`, uproszczenie `useCheckoutFlow`, martwe tłumaczenia, aktualizacja testów. Usuwa przy okazji ładowanie Stripe.js na każdej stronie. (PAY-34, PAY-07, PAY-33 część)
7. **PR-7 (P2, S) — ustawienia płatności:** jedno minimum, usunięcie `getPaymentSettings`, uproszczenie `/api/payment-settings` i formularza admina, migracja kolumn po okresie przejściowym. (PAY-35, PAY-41)
8. **PR-8 (P2, S) — admin:** audyt zwrotu niezależny od webhooka, klucz idempotencji zwrotu, `warning_closed` w admin sync, statystyki brutto i netto, wspólne kursy walut z CHF i GBP. (PAY-10, PAY-11, PAY-12, PAY-13)
9. **PR-9 (P2, M) — spory odporne na kolejność:** pobieranie dispute ze Stripe, brak przejść wstecz, `revokeReason` zamiast `reason`. (PAY-09, PAY-25, PAY-26)
10. **PR-10 (P2/P3, S) — create-intent:** stały opis po stronie serwera, `termsVersion` w metadata, ogólne komunikaty błędów, obsługa P2002, rate limit `GET /api/payments/[id]`, blokada podwójnego kliknięcia przez `useRef`, statusy UI bez "ACCESS". (PAY-17, PAY-18, PAY-19, PAY-20, PAY-27, PAY-28, PAY-29)
11. **PR-11 (decyzje właściciela, S):** publiczna odznaka PATRON (zostawić, opt-in, usunąć), tryb ręczny paska zbiórki, nazwa sekcji "Strefa Fenkjuu", kafelek "Crypto". (PAY-14, PAY-15, PAY-16, PAY-32)
12. **PR-12 (M) — Payment Element w trybie deferred** (opcja A z §6.2) albo Checkout (opcja B), po PR-1…PR-6. (PAY-08, PAY-30, PAY-31)
13. **PR-13 (S) — dokumentacja:** CLAUDE.md §2, §4.1, §4.2, §4.10, §6, §7, wpis TEMP, `PAYMENTS-PATRON-SAFETY-SPEC.md`, komentarze w kodzie, nazwa `Subscription`. (PAY-39, PAY-43). Najlepiej aktualizować w każdym PR na bieżąco, zgodnie z regułą CLAUDE.md.
14. **Równolegle:** testy z PAY-40 dopisywane w PR-ach, których dotyczą. Reguły Radar przeciw testowaniu kart (PAY-42) ustawia się w Dashboardzie Stripe, bez kodu.

---

## Źródła (dokumentacja Stripe)

- Integration security guide (CSP dla Stripe.js: `frame-src https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com`, `script-src https://*.js.stripe.com https://js.stripe.com`, `hooks.stripe.com` dla 3DS): https://docs.stripe.com/security/guide
- Webhooks, best practices (duplikaty, tylko potrzebne zdarzenia, asynchroniczna obsługa, weryfikacja podpisu na surowym ciele, rotacja sekretu): https://docs.stripe.com/webhooks
- Webhook signature errors: https://docs.stripe.com/webhooks/signature
- `payment_intent.payment_failed` → PaymentIntent przechodzi do `requires_payment_method` i nie jest stanem końcowym (tabela w): https://docs.stripe.com/payments/off-session-payments/migrate-from-payment-intents ; cykl życia: https://docs.stripe.com/payments/paymentintents/lifecycle
- Express Checkout Element (rejestracja domeny dla Apple/Google Pay; Stripe zaleca Checkout Sessions zamiast Payment Intents w większości integracji): https://docs.stripe.com/elements/express-checkout-element
- Pay what you want / napiwki w Checkout (`Customer chooses price`): https://docs.stripe.com/payments/checkout/pay-what-you-want?payment-ui=stripe-hosted
- Ryzyko testowania kart przy zbiórkach i darowiznach: https://docs.stripe.com/disputes/prevention/identifying-fraud
