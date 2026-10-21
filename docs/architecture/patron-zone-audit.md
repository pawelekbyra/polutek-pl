# Strefa patrona: audyt przed prawdziwymi pieniędzmi (2026-10-21)

Stan na 2026-10-21, `main` po #1901. Strefa patrona jest produktem docelowym (decyzja właściciela z 2026-10-21), nie eksperymentem. Opis działania: [`patron-zone.md`](patron-zone.md). Ten dokument odpowiada na jedno pytanie: **co jeszcze trzeba zrobić, zanim strefa przyjmie prawdziwe pieniądze**.

Legenda priorytetów: **P0** blokuje pierwszą prawdziwą sprzedaż, **P1** trzeba zrobić przed albo tuż po starcie, **P2** porządki i ulepszenia. Kto działa: `właściciel`, `księgowa`, `prawnik`, `dev` (agent/programista).

Ten audyt nie zmienia produkcji. Odczyty na serwerku i w Stripe były wyłącznie do odczytu; nazwy zmiennych `app.env` sprawdzono bez wartości (poza flagami niebędącymi sekretami), klucze nie były wypisywane.

## 0. Stan na produkcji w chwili audytu (odczyt)

| Fakt | Wartość | Skąd |
|---|---|---|
| `PREMIUM_PASS_EXPERIMENT` | `all` (wszyscy widzą bramkę) | `app.env` |
| `PREMIUM_PASS_PAYMENTS` | **nieustawione** = `demo` (płatność tylko symulowana, dostęp za darmo po kliknięciu) | `app.env` |
| `PREMIUM_PASS_VIDEO_SLUGS` | `jj,test-transkodowania` | `app.env` |
| `PREMIUM_PASS_TESTER_IDS` | nieustawione | `app.env` |
| `PLATFORM_GATE_SALES` | **nieustawione** = `off` | `app.env` |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | oba **live** (`sk_live_`, `pk_live_`) | `app.env` (tylko prefiksy) |
| `STRIPE_WEBHOOK_SECRET` | ustawiony (`whsec_`) | `app.env` |
| Płatności w bazie | 3 udane napiwki PLN (razem 15 zł), reszta anulowane/nieudane; **0 płatności strefy patrona** | `Payment` (liczby zbiorcze) |
| Wiersze dostępu `xp.premium_pass:*` | 4, wszystkie `provider: DEMO` (konta testowe) | `AppSetting` |
| Film `jj` | `LOGGED_IN`, `PUBLISHED` (film zbiórki), `test-transkodowania`: `PUBLIC`, `PUBLISHED` | `Video` |

Wniosek: dziś **nikt nie może zapłacić prawdziwie** (to jest bezpieczne), ale każdy widz może „kupić” dostęp symulacją za darmo i obejrzeć `jj` oraz `test-transkodowania`. Po wdrożeniu PR-a porządkującego tryb `demo` zostaje, dopóki `PREMIUM_PASS_PAYMENTS` nie zostanie ustawione na `stripe`; wtedy, przy kluczach live i wyłączonej bramce sprzedaży, kasa pokaże „niedostępne” (nie wróci do demo).

---

## P0: blokuje prawdziwą sprzedaż

### P0-1. Brak sprzedawcy (spółka POLUTEK Sp. z o.o. nie istnieje)

- **Ustalenie.** Kasa i potwierdzenie pokazują „Sprzedawca: POLUTEK Sp. z o.o. (dane demo)” (`app/components/premium-pass/pass-copy.ts`, `sellerName()`, używane w `PassSuccess.tsx` i `PassTermsPage.tsx`). Tekst „(dane demo)” pokazuje się też w trybie `stripe`, bo nie zależy od trybu. Konto Stripe jest zarejestrowane jako **osoba fizyczna** (`business_type: individual`), nazwa „Pawel Perfect”, strona `www.pawelperfect.pl`, MCC 7929, opis na wyciągu `WWWW.PAWELPERFECT.PL` (literówka: cztery „W”).
- **Ryzyko.** Sprzedaż cyfrowego dostępu konsumentom przez osobę fizyczną bez firmy i bez VAT, pod nazwą spółki, której nie ma, to wprowadzanie w błąd co do sprzedawcy i naruszenie obowiązków informacyjnych (art. 12 ustawy o prawach konsumenta).
- **Zrobić.** (1) Założyć podmiot albo świadomie sprzedawać jako działalność właściciela; decyzja formy: właściciel + księgowa + prawnik (otwarta decyzja w `docs/operations/STATUS.md`). (2) Po rejestracji: zmienić `sellerName()` na prawdziwe dane (nazwa, adres, NIP, KRS) i dodać je do regulaminu, kasy i potwierdzenia; usunąć „(dane demo)”. (3) Zaktualizować profil Stripe (typ podmiotu, nazwa, strona, opis na wyciągu, MCC) albo założyć nowe konto Stripe dla spółki i podmienić klucze. **Kto:** właściciel, księgowa, prawnik; część kodowa: dev.

### P0-2. Faktury, VAT, paragony

- **Ustalenie.** Ceny są podane brutto „zawiera 23% VAT” (`PATRON_VAT_RATE_PERCENT`), ale **nic nie wystawia faktury ani paragonu**: żadnego rekordu faktury w kodzie strefy, brak `receipt_email` w `paymentIntents.create` (`lib/modules/payments/application/create-checkout-intent.use-case.ts`), Stripe Tax nie jest używany. Nie wiadomo, czy w panelu Stripe jest włączone „wysyłaj potwierdzenia”.
- **Ryzyko.** Sprzedaż z 23% VAT w cenie przez podmiot, który nie jest podatnikiem VAT (albo bez kasy fiskalnej/faktury) jest błędem podatkowym; sprzedaż za granicę (EUR/USD/GBP/CHF) oznacza VAT OSS albo VAT kraju klienta, a ceny w tabeli są brutto PL.
- **Zrobić.** Księgowa: status VAT, czy usługa cyfrowa wymaga kasy/e-paragonu, stawka dla klientów zagranicznych (OSS), czy sprzedawać w EUR/USD/GBP/CHF od razu, czy tylko w PLN. Dev (po decyzji): faktura/paragon (np. Stripe Invoicing/Tax albo własny numerator), `receipt_email`, wpis w `Payment`. **Kto:** księgowa, właściciel, dev.

### P0-3. Potwierdzenie na trwałym nośniku (art. 21 ustawy o prawach konsumenta) nie jest wysyłane

- **Ustalenie.** `fulfillPayment()` dla płatności strefy patrona celowo pomija `thankPayer()` (`if (input.notifyPayer !== false && !result.premium)` w `lib/modules/payments/application/fulfill-payment.use-case.ts`). Nie istnieje żaden mail „potwierdzenie zakupu dostępu”. Ekran sukcesu to nie trwały nośnik. Plan (`patron-zone.md`) zapisuje to jako „czeka na decyzję i spółkę”.
- **Ryzyko.** Bez potwierdzenia umowy (z treścią zgody na natychmiastowe świadczenie i informacją o utracie odstąpienia) konsument nie traci prawa odstąpienia po rozpoczęciu świadczenia (art. 38 pkt 13 w zw. z art. 21 u.p.k.), więc po obejrzeniu może żądać zwrotu w ciągu 14 dni.
- **Zrobić.** Dev: szablon maila „Potwierdzenie zakupu” (PL/EN, katalog i18n w parytecie), wysyłany po commit w `fulfillPayment()` z danymi: sprzedawca, produkt, kwota brutto/VAT, okres dostępu, treść zgód z `metadata.consents`, link do regulaminu (PDF/treść), formularz odstąpienia, kontakt; audyt `EMAIL_SEND_FAILED` jak przy napiwku. Prawnik zatwierdza treść. **Kto:** dev, prawnik.

### P0-4. Regulamin strefy patrona jest „projektem”, a istniejący regulamin mówi coś przeciwnego

- **Ustalenie.** `/regulamin-premium` (`PassTermsPage.tsx`) ma tytuł „(projekt)” i tekst „ostateczny tekst zatwierdzi prawnik przed pierwszą prawdziwą sprzedażą”; strona jest `noindex`. Jednocześnie obowiązujący regulamin i polityka (`app/regulamin`, `LEGAL_DOCUMENTS_VERSION = 2026-10-11`), szablon maila w `lib/email-defaults.ts`, tekst `TipDisclaimerStep` i `CLAUDE.md` §0/§1 mówią: serwis niekomercyjny, „napiwek niczego nie odblokowuje, wszystkie filmy są dostępne dla każdego zalogowanego”. Strefa patrona jest sprzeczna z tymi dokumentami.
- **Ryzyko.** Sprzeczne zapisy, brak klauzul wymaganych dla sprzedaży konsumenckiej (reklamacje/rękojmia za treści cyfrowe, odstąpienie, okres dostępu, zakończenie dostępu, zasady zwrotu, ADR/ODR, dane sprzedawcy).
- **Zrobić.** Prawnik: regulamin sprzedaży dostępu (PL/EN), aktualizacja regulaminu serwisu i polityki prywatności (nowa kategoria danych: płatności, zgody, sprzedawca), podniesienie `LEGAL_DOCUMENTS_VERSION`. Dev: podmiana tytułu i treści strony, usunięcie noindexu z regulaminu po zatwierdzeniu, aktualizacja `CLAUDE.md`, `STATUS.md`, maila i `TipDisclaimerStep`. **Kto:** prawnik, dev, właściciel.

### P0-5. Treść zgody na utratę odstąpienia

- **Ustalenie.** Pole zgody (`PassPaymentStep.tsx`): „Chcę dostępu od razu. Wiem, że gdy zacznę oglądać, tracę prawo odstąpienia od umowy.” Zgoda jest zapisywana w `Payment.metadata.consents` (wersja regulaminu + czas), a przy „bez limitu” dostęp otwiera się od razu.
- **Ryzyko.** Sformułowanie „gdy zacznę oglądać” nie zgadza się z faktycznym momentem rozpoczęcia świadczenia (dostęp przyznawany w chwili potwierdzenia płatności, nie odtworzenia). Wymaga wyraźnej zgody na rozpoczęcie świadczenia przed upływem terminu odstąpienia i potwierdzenia utraty prawa (art. 38 pkt 13 u.p.k.). Dla dostępu bezterminowego dodatkowo pytanie o charakter umowy (treść cyfrowa vs usługa).
- **Zrobić.** Prawnik: właściwe brzmienie (PL/EN, 8 języków, parytet katalogu). Dev: podmiana tekstu, zapis dokładnego brzmienia/wersji obok zgody. **Kto:** prawnik, dev.

### P0-6. Co faktycznie włącza prawdziwe pobieranie pieniędzy (procedura)

- **Ustalenie.** Pieniądze pobiera wyłącznie tryb `PREMIUM_PASS_PAYMENTS=stripe` (`lib/modules/patron-zone/domain/payments-mode.ts`, `resolvePremiumPayments()`), dostępny tylko gdy: klucze secret i publishable istnieją i są tego samego trybu, `STRIPE_WEBHOOK_SECRET` jest ustawiony, a dla kluczy **live** `PLATFORM_GATE_SALES=on`. Bez któregokolwiek kasa pokazuje „niedostępne” i nigdy nie wraca do demo. Test źródeł (`premium-pass-no-money`) pilnuje, że dostęp przyznaje tylko `fulfillPayment()`. Na produkcji: klucze live są, webhook secret jest, bramka sprzedaży wyłączona.
- **Uwaga.** `PLATFORM_GATE_SALES` jest **bramką globalną** (sprzedaż, zamówienia, zwroty także w module `sales`); jej włączenie to decyzja szersza niż strefa patrona. Stary kanał napiwków (`createCheckoutIntent`) bramki sprzedaży nie sprawdza i dziś, mimo ukrycia w UI, działałby na kluczach live (3 udane napiwki w bazie).
- **Zrobić.** Dopiero po P0-1..P0-5: właściciel w `app.env` ustawia `PLATFORM_GATE_SALES=on` i `PREMIUM_PASS_PAYMENTS=stripe`, restart aplikacji; zmienne `NEXT_PUBLIC_*` wymagają przebudowy obrazu. Przed tym próba na kluczach **test** (osobny endpoint webhooka w trybie testowym) z pełną ścieżką: płatność, dostęp, zwrot. Dev: rozważyć jawny wymóg `PLATFORM_GATE_SALES` także dla ścieżki napiwkowej, jeśli właściciel chce ją zachować wyłączoną na stałe. **Kto:** właściciel (zmiana na produkcji tylko na jego zgodę), dev.

### P0-7. Brak zweryfikowanego testu end-to-end na kluczach testowych

- **Ustalenie.** Przepływ pieniędzy (intent, zgoda, webhook, przyznanie dostępu, zwrot) nie był przeprowadzony na prawdziwym Stripe w trybie testowym; testy to testy jednostkowe z atrapami i harness przeglądarkowy. Test na Postgresie `tests/postgres/premium-pass-ledgers.pg.test.ts` (księgi przy symulowanym zakupie) **nie był uruchomiony lokalnie** (patrz sekcja „Zweryfikowane vs niezweryfikowane”).
- **Zrobić.** Dev + właściciel: środowisko z `sk_test_`/`pk_test_`, osobny webhook, scenariusze z kartą testową, BLIK testowy, 3DS, zwrot pełny, zwrot częściowy, spór (testowa karta sporu), dwie wpłaty pod rząd. Uruchomić `npm run test:integration:postgres` na bazie Postgres (pg test). **Kto:** dev, właściciel (klucze).

---

## P1: przed startem albo tuż po

### P1-1. Wypłacalność ścieżek spór / zwrot (dostęp nie reaguje)

- **Ustalenie** (`lib/modules/payments/application/handle-dispute.use-case.ts`, `handle-refund.use-case.ts`, `lib/modules/patron-zone/application/patron-grant.ts`):
  - pełny zwrot (`REFUNDED`) cofa udział płatności w dostępie (30 dni albo znacznik „bez limitu”): **jedyne automatyczne cofnięcie**;
  - **spór (`DISPUTED`) i przegrany spór (`CHARGEBACK_LOST`) nie cofają dostępu strefy patrona**; `handleDispute` rusza tylko znacznik wspierającego (`revokeSupporterGrantIfNoPaidTips`), a płatność strefy nie ma takiego znacznika;
  - częściowy zwrot nie zmienia dostępu;
  - zwrot, który później nie wyszedł (`refund.failed`/anulowany), **nie przywraca** dostępu cofniętego wcześniej pełnym zwrotem (gałąź „refund reverted” przywraca tylko znacznik wspierającego).
- **Ryzyko.** Chargeback za „bez limitu” zostawia klientowi dostęp na zawsze, mimo że pieniądze wróciły do klienta.
- **Zrobić.** Dev: (a) przy `CHARGEBACK_LOST` cofnąć dostęp tej płatności (`revokePatronAccessForPayment`), przy `DISPUTED` wstrzymać (decyzja), a po wygranej przywrócić; (b) przy odwróconym zwrocie przywrócić dostęp; (c) testy w `tests/unit/modules/patron-zone/premium-pass-fulfilment.test.ts` (lub nowy plik) i pg. Właściciel: polityka (czy wstrzymywać dostęp w sporze). **Kto:** dev, właściciel.

### P1-2. Webhook Stripe: brakujące zdarzenia

- **Ustalenie** (odczyt API Stripe): jedyny endpoint `https://www.pawelperfect.com/api/webhooks/stripe`, status `enabled`, wersja API `2025-10-29.clover`, zdarzenia: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`. Kod obsługuje dodatkowo `charge.refund.updated`, `refund.updated`, `refund.failed` (`handle-stripe-webhook.use-case.ts`), ale **endpoint tych zdarzeń nie subskrybuje**. Plan zakłada zdarzenia `refund.*`.
- **Skutek.** Nieudany/anulowany zwrot (typowy dla BLIK/P24) nie dociera webhookiem; uzgadnianie (`stripe-reconciliation`, timer co 15 minut, odczytane z `systemctl list-timers`) może go nadrobić, ale nie sprawdzono, czy obejmuje zwroty.
- **Zrobić.** Właściciel (zmiana w Stripe = zgoda właściciela) lub dev przez zgodę: dodać zdarzenia `charge.refund.updated`, `refund.updated`, `refund.failed`, `payment_intent.canceled`. Dev: sprawdzić, co robi cron uzgadniania ze zwrotami. **Kto:** właściciel, dev.

### P1-3. Metody płatności na koncie Stripe

- **Ustalenie** (odczyt API): zdolności konta aktywne: karta, BLIK, Przelewy24, Apple/Google Pay (przez kartę), Link, Revolut Pay, iDEAL, Bancontact, EPS, Klarna, MB Way, MobilePay, Multibanco, TWINT; nieaktywne: giropay, sofort, cartes bancaires (oczekuje). Na koncie są **dwie konfiguracje „Default”**: jedna z BLIK i P24 wyłączonymi, druga (nowsza) z włączonymi (BLIK, P24, iDEAL, Klarna, PayPal, Revolut Pay, TWINT, EPS, Bancontact, MB Way, MobilePay, Multibanco). Ostatnie nieudane próby (30 dni) pokazują `card` i `revolut_pay`, co sugeruje, że działa druga konfiguracja. Kod używa `automatic_payment_methods`, więc lista zależy wyłącznie od konfiguracji konta i waluty intentu.
- **Ryzyko.** Nie wiadomo na pewno, która konfiguracja jest używana; Klarna/PayPal/Multibanco/MobilePay w kasie patrona mogą być niepożądane (zwroty, spory, VAT). W PLN powinny być: karta, BLIK, P24; w USD/GBP/CHF: karta, portfele.
- **Zrobić.** Właściciel: w panelu Stripe zdecydować o liście metod dla strefy patrona (zalecenie: karta + Apple/Google Pay + Link + BLIK + P24 + iDEAL; resztę wyłączyć), usunąć dublującą się konfigurację. Dev: test per waluta w trybie testowym (zrzut listy kafelków), ewentualnie przejście na jawną `payment_method_configuration`. **Kto:** właściciel, dev.

### P1-4. Apple Pay / Google Pay: domeny

- **Ustalenie** (odczyt `payment_method_domains` i `apple_pay/domains`): zweryfikowane i aktywne dla `pawelperfect.com`, `www.pawelperfect.com`, `pawelperfect.pl`, `www.pawelperfect.pl` (Apple Pay, Google Pay, Link: `active`). **Brak** `polutek.com`/`www.polutek.com`, a adres pomocy w kasie to `support@polutek.com`.
- **Zrobić.** Gdy produkt przejdzie na domenę `polutek.com`, dodać i zweryfikować domenę w Stripe (plik weryfikacyjny lub panel). Zweryfikować, że skrzynka `support@polutek.com` istnieje i ktoś ją czyta (stały adres w `PATRON_SUPPORT_EMAIL`). Konto Stripe ma adres wsparcia `hello@pawelperfect.pl`: ujednolicić. **Kto:** właściciel, dev.

### P1-5. Kto widzi płatności i patronów (panel admina, zwroty, spory, obsługa)

- **Ustalenie.** Panel admina (`admin-revenue`) pokazuje płatności, spory i eksport, a pełny zwrot z panelu trafia w to samo `handleRefund`. **Płatność strefy patrona jest w liście nieodróżnialna od napiwku** (zapytania nie wybierają `metadata.purpose`/`productId`). Nie istnieje żaden widok „kto ma dostęp do strefy, do kiedy, z jakiej płatności”: dostęp leży w `AppSetting` (`xp.premium_pass:<userId>`), poza `PatronGrant`/`Entitlement`; `admin-community` (profil użytkownika) o nim nie wie, nie ma ręcznego nadania/odebrania dostępu (np. po reklamacji). Czas odpowiedzi na spór ma Stripe (termin w `Payment.metadata.dispute.dueBy`), ale bez powiadomienia o terminie.
- **Zrobić.** Dev: kolumna „Produkt” w liście płatności; sekcja „Strefa patrona” w profilu użytkownika (stan, do kiedy, płatności, zgody) z akcjami „przedłuż / odbierz” zapisanymi w audycie; alert przy `payment.dispute_opened` na skrzynkę właściciela. Właściciel/obsługa: opisać w `PP-SUPPORT-GUIDE.md` obsługę zwrotu i reklamacji strefy. **Kto:** dev, właściciel.

### P1-6. Wybór filmów premium: tylko lista w `app.env`

- **Ustalenie.** Film jest za bramką wyłącznie przez `PREMIUM_PASS_VIDEO_SLUGS` (`isPremiumPassVideo` w `lib/modules/patron-zone/domain/config.ts`), czytane przy żądaniu. Nie ma przełącznika w Studio ani w panelu; `Video.tier` się nie zmienia. Bez zmiennej obowiązuje domyślna lista `jj`, `test-transkodowania`. Wartość produkcyjna zgadza się z domyślną. Film `jj` to film zbiórki („Zbieram hajs na mój Tajny Projekt”): zablokowany dla gości, ukrywa apel; `test-transkodowania` to film testowy. Hero i zapowiedź (premiera) nigdy nie są blokowane (warnowane w logu).
- **Zrobić.** Właściciel: potwierdzić listę docelową. Dev: przełącznik „Film dla patronów” w Studio (zapis do `AppSetting`/kolumny z migracją) zamiast edycji `app.env`; do tego czasu zmiana listy = edycja `app.env` + restart (wymaga zgody właściciela). **Kto:** właściciel, dev.

### P1-7. Mapa dostępu: przypadki brzegowe

Zachowanie kodu (`domain/pass-state.ts`, `patron-grant.ts`, `patron-checkout.use-case.ts`), w razie wątpliwości testy `premium-pass-access/fulfilment`:

| Przypadek | Zachowanie | Uwaga |
|---|---|---|
| 30 dni, aktywny dostęp | kolejne 30 dni od bieżącego końca | max 365 dni w przód (`PATRON_MAX_AHEAD_DAYS`), potem `MAX_AHEAD` |
| „Bez limitu” | znacznik lifetime, brak daty końca | potem zakup blokowany (`ALREADY_LIFETIME`) |
| „Bez limitu” przy istniejących 30 dniach | lifetime nadrzędny | zwrot lifetime zostawia 30 dni, jeśli były |
| Pełny zwrot | cofa udział płatności | automatyczne |
| Częściowy zwrot | bez zmian | ręcznie (decyzja polityki) |
| Zwrot, który nie wyszedł | **bez przywrócenia** | P1-1 |
| Spór / przegrany spór | **dostęp zostaje** | P1-1 |
| Dwie płatności jednocześnie | blokada advisory na konto, id płatności raz | bez luki |
| Konto usunięte/zbanowane | nie zbadano interakcji z `xp.premium_pass:<id>` i zwrotem | do sprawdzenia przez deva |
| Zmiana ceny w `PATRON_PRICES` w trakcie | płatność w locie z kwotą spoza tabeli: brak dostępu + alert `premium_pass.unexpected_payment` | właściciel dostaje alert, ręczna decyzja |
| Dostęp „DEMO” z poprzedniej fazy | 4 wiersze na produkcji | patrz P1-9 |

**Zrobić.** Dev: testy dla brakujących wierszy, decyzja co do kont usuniętych i zbanowanych (czy dostęp i zwrot). **Kto:** dev.

### P1-8. Odznaka patrona, `PatronGrant`, konto, powiadomienia

- **Ustalenie.** Płatność strefy patrona **nie tworzy `PatronGrant`** i nie daje odznaki patrona (`const { created } = premium ? { created: false } : ensureSupporterGrant(...)`); odznaka na kafelku filmu („Patron”) oznacza film za bramką, nie osobę. Sekcja „Moje konto” (`PassAccountSection.tsx`) pokazuje datę ważności lub wygaśnięcia; brak historii płatności i faktur. Brak jakiegokolwiek powiadomienia o zakupie, zbliżającym się końcu (30 dni) lub wygaśnięciu (nie zbudowano żadnej wiadomości ani powiadomienia w dzwonku). `UserPaymentTotal` zawyża „sumę wpłat użytkownika” o zakupy dostępu.
- **Zrobić.** Właściciel: czy patron strefy dostaje odznakę i status „patron” w komentarzach (`PatronGrant` ze źródłem strefy) i jak to się ma do zasady „napiwek niczego nie daje”. Dev: powiadomienie o wygasaniu (7 dni przed i po), mail/dzwonek, historia zakupów w koncie. **Kto:** właściciel, dev.

### P1-9. Dane demo na produkcji

- **Ustalenie.** 4 wiersze `provider: DEMO` w `AppSetting` dają dostęp bez płatności; panel „DEMO” pozwala je gasić i kasować. Po wdrożeniu PR-a porządkującego panel i wstęgę pokazuje wyłącznie tryb `demo`.
- **Zrobić.** Przed włączeniem `stripe`: właściciel zatwierdza, dev wygasza/usuwa wiersze DEMO (zapis do pliku przed usunięciem), żeby konta testowe nie miały dostępu za darmo. **Kto:** właściciel, dev.

### P1-10. Ceny w walutach: przegląd właściciela

- **Ustalenie.** `PATRON_PRICES` (`domain/config.ts`): 30 dni: 14,99 PLN / 3,99 EUR / 4,49 USD / 3,49 GBP / 3,99 CHF; bez limitu: 29,99 PLN / 7,99 EUR / 8,99 USD / 6,99 GBP / 7,99 CHF. Ceny to ręcznie zaokrąglone odpowiedniki PLN po kursie z 2026-10, wszystkie powyżej minimum Stripe. Nie są sprawdzone przez właściciela ani księgową (VAT w kraju klienta, opłata Stripe dla kart zagranicznych, 14,99 PLN a prowizja BLIK/P24).
- **Zrobić.** Właściciel + księgowa: akceptacja tabeli (albo tylko PLN na start), policzenie marży po opłatach Stripe. Dev: zmiana liczb w jednym miejscu. **Kto:** właściciel, księgowa.

### P1-11. Analityka lejka

- **Ustalenie.** Lejek to log + dzienny licznik w `AppSetting` (`xp.premium_pass.stats:<data>`): `offer_view`, `checkout_open`, `checkout_submit`, `demo_success`, `demo_declined`, `intent_created`, `max_ahead`. **Brak zdarzeń** `payment_succeeded`, `payment_failed`, `refund` i zdarzenia „zablokowany film obejrzany”; licznik nigdzie nie jest wyświetlany (ani w panelu admina, ani w analityce twórcy). Odsłony `/premium` liczy kolektor po ścieżce.
- **Zrobić.** Dev: zdarzenia sukcesu/porażki z `fulfillPayment()`, widok „Lejek strefy patrona” w panelu (dzienne liczniki, konwersja), przeniesienie tras zdarzeń do jednego miejsca. **Kto:** dev, właściciel (jakie liczby chce).

### P1-12. Testy na prawdziwym telefonie i dostępność

- **Ustalenie.** Wszystko sprawdzano w emulowanym widoku 375 px i w harnessie; **nigdy na prawdziwym telefonie** (iOS Safari: Apple Pay, BLIK, 3DS, klawiatura w arkuszu kasy; Android Chrome: Google Pay). Dostępność: zasady (fokus, `aria-live`, kontrasty) opisane w planie, nie było audytu czytnikiem ekranu ani automatycznym narzędziem (axe) na kasie z prawdziwym Stripe Elements (iframe).
- **Zrobić.** Właściciel (urządzenia) + dev: lista kontrolna na iPhone i Androidzie na kluczach testowych; axe/Lighthouse na `/premium` i w otwartej kasie; sprawdzenie, że pole BLIK i 3DS nie psują fokusa. **Kto:** właściciel, dev.

---

## P2: porządki i ulepszenia

### P2-1. SEO i indeksowanie `/premium`

- **Ustalenie.** `/premium` i `/regulamin-premium` zwracają `robots: noindex, nofollow`; całe serwis jest w becie (`SITE_IS_BETA`, pusta mapa strony, brak `sitemap` w `robots.txt`). Strony dają 404, gdy strefa jest wyłączona. Zablokowane filmy są oznaczone w DTO (`premiumPass`) i nie ujawniają strumienia.
- **Zrobić.** Przy wyjściu z bety: zdecydować, czy oferta ma być indeksowana (zalecenie: tak dla `/premium`, nie dla regulaminu wersji roboczej), dodać do mapy strony, `hreflang`, dane strukturalne `Offer` (dopiero po P0-1/P0-2), canonical. **Kto:** właściciel, dev.

### P2-2. Przycisk ulubionych (`FavoriteButton`)

- **Ustalenie.** Funkcja ulubionych jest zbudowana: migracja `20261021120000_video_favorites`, modele i API (`/api/videos/[id]/favorite`, `/api/user/favorites`), moduł `lib/modules/favorites`, półka `FavoritesShelf` w `ViewerShelves`, komponent `FavoriteButton`. **Nigdzie nie renderuje się przycisk** (usunięty z `Hero`), więc nikt nie może dodać filmu do ulubionych; półka jest zawsze pusta (na produkcji `VideoFavorite`: 0 wierszy). Backend i migracja zostają.
- **Zrobić.** Właściciel: wrócić do funkcji (gdzie przycisk, np. pasek akcji pod filmem) czy usunąć półkę. Dev: dopóki nie ma przycisku, ukryć pustą półkę, albo dodać przycisk w nowym miejscu (budżet `Hero.tsx` jest przy limicie). **Kto:** właściciel, dev.

### P2-3. Błąd `matcher` w `middleware.ts` (ścieżki z „js”)

- **Ustalenie.** Wzorzec `[^?]*\.(?:…|js(?!on)|…)` w stringu JS ma pojedynczy `\.` (znika w łańcuchu), więc pomijane są **wszystkie ścieżki zawierające „js”** (np. `/wejsciowka` omijałaby proxy: bez przepisania na `/pl`, bramek i CSP). Dlatego oferta jest pod `/premium`. Osobne zadanie istnieje, błąd nadal jest.
- **Zrobić.** Dev: poprawić na `\\.` albo literał regex (`middleware.ts`, test ścieżki `/wejsciowka`, `/json`), osobnym PR-em. **Kto:** dev.

### P2-4. Czerwone kontrole sprzed zmian i budżety

- `npm run quality:architecture-boundaries` kończy się błędem: `lib/modules/video/application/get-public-video-chapters.ts` bez `authorize()`/`assertAuthorized()`/`requireVideo()` (CLAUDE.md §4.23). Występuje na `main`, nie dotyczy strefy. **Zrobić:** dev, autoryzacja w use case albo wpis w `AUTHZ_EXEMPT` z uzasadnieniem.
- `npm run quality:hotspots` jest czerwone: `app/components/premium-pass/PassCheckoutSheet.tsx` 497 linii przy budżecie 450 (strefa patrona), a także `EmbeddedComments.tsx`, `StudioUploadWizard.tsx`, `StudioVideoEditor.tsx` (cudze). **Zrobić:** dev, wydzielić z `PassCheckoutSheet` kroki (plik `PassCheckoutStages.tsx`) albo udokumentować wyjątek.
- `npm run quality:strict-escapes` jest czerwone na `main` (wpisy `as any` w `playback.service.ts` poza bazą); `tests/unit/modules/channel/channel-avatar-source.test.tsx` (3 testy: „A component suspended while responding to synchronous input”) pada na `main` niezależnie od strefy. **Zrobić:** dev, osobne poprawki.
- Zweryfikowano uruchomieniem poleceń przed i po zmianach PR-a porządkującego: wyniki identyczne jak na `main`, PR niczego nie pogarsza.

### P2-5. Niezweryfikowane stwierdzenia z wcześniejszych raportów

Zbiorczo, do sprawdzenia przy teście na kluczach testowych (P0-7):
- że etykieta „Tryb testowy” pojawia się tylko na kluczach test, a wstęga DEMO tylko w trybie `demo` (sprawdza to PR porządkujący testami jednostkowymi, nie widziane na żywo);
- że `GET /api/payments/[id]` (szybka ścieżka) i cron uzgadniania przyznają dostęp tak samo jak webhook dla płatności strefy;
- że `livemode` zdarzenia różne od klucza jest ignorowane (z planu, nie testowane na Stripe);
- że ekran „zwrot/odmowa/BLIK po powrocie z banku” (parametr `pass_payment` w adresie powrotu) poprawnie wznawia kasę;
- że `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` w obrazie produkcyjnym jest kluczem live (sprawdzono tylko wartość w `app.env`, nie wbudowaną w obraz).

### P2-6. Ukryty kanał napiwków (stary SupportModal)

- **Ustalenie.** Po tym PR-ze brama napiwkowa jest nieosiągalna z interfejsu (kod i testy zostają). Na produkcji `STRIPE_*` są live, a ścieżka napiwkowa (`createCheckoutIntent` bez `purpose`) nadal działa po stronie serwera: trasa `POST /api/checkout/create-intent` jest dostępna dla zalogowanych. Linki zwrotne `?support=1` i `?success=true&payment_id=` już nie otwierają okna. Teksty z `lib/email-defaults.ts` i `TipDisclaimerStep` przestają być osiągalne, ale zostają w kodzie.
- **Zrobić.** Dev: opcjonalnie zablokować `/api/checkout/create-intent` za bramką (np. wymaganie `PLATFORM_GATE_SALES`), żeby „ukryte” znaczyło też „niedostępne z API”. **Kto:** dev, właściciel.

---

## Zweryfikowane vs niezweryfikowane

**Zweryfikowane (odczyt, nic nie zmieniono):**
- zmienne `app.env`: nazwy i wartości flag niebędących sekretami; klucze Stripe live, webhook secret ustawiony (tylko prefiksy i długość);
- konto Stripe (odczyt API): kraj PL, `charges_enabled`/`payouts_enabled` tak, brak zaległych wymagań, typ podmiotu osoba fizyczna, zdolności płatności, dwie konfiguracje metod, jedyny endpoint webhooka i jego 5 zdarzeń, domeny Apple/Google Pay (4 domeny aktywne), brak sporów, ostatnie próby 30 dni;
- baza produkcyjna (liczby zbiorcze, bez danych osobowych): płatności, wiersze dostępu, wiersze lejka, taryfy filmów, `VideoFavorite`;
- timer uzgadniania Stripe działa co 15 minut;
- kod: logika przyznawania/cofania dostępu, brak maila po zakupie, brak `receipt_email`, brak widoku płatności patrona i dostępu w panelu, brak przełącznika Studio, brak `PatronGrant` dla zakupu, sprzedawca „(dane demo)” również w trybie `stripe`, treść zgody, `matcher` z błędem;
- uruchomione polecenia: `quality:architecture-boundaries` (1 naruszenie, `get-public-video-chapters`), `quality:hotspots` (czerwone, w tym `PassCheckoutSheet`).

**Niezweryfikowane (wymaga właściciela, urządzeń albo środowiska testowego):**
- jakakolwiek prawdziwa lub testowa płatność przez całą ścieżkę Stripe (kasa, webhook, dostęp, zwrot, spór);
- która konfiguracja metod płatności faktycznie obsługuje intenty (wnioskowane z nieudanych prób, nie z intentu strefy);
- lista kafelków per waluta (PLN, EUR, USD, GBP, CHF);
- działanie na prawdziwym iPhonie i Androidzie (Apple Pay, Google Pay, BLIK, 3DS);
- audyt dostępności czytnikiem ekranu i narzędziem automatycznym;
- test Postgres `tests/postgres/premium-pass-ledgers.pg.test.ts` (nie uruchomiony; wymaga bazy);
- czy skrzynka `support@polutek.com` istnieje i dostarcza pocztę;
- ustawienia panelu Stripe poza API (wysyłka potwierdzeń do klientów, Radar, ustawienia VAT);
- zachowanie crona uzgadniania wobec zwrotów;
- interakcja dostępu z kontem usuniętym, zbanowanym lub zmienionym e-mailem.
