# Strefa patrona: płatny dostęp do wybranych filmów

Stan: **produkt końcowy** (decyzja właściciela 2026-10-21: „tak ma działać i wyglądać”; to nie eksperyment, wycofania nie będzie). Złoty przycisk „Kup se Premium” w Hero otwiera kasę strefy patrona i zastępuje
bramkę napiwkową, która zostaje w kodzie, ale jest ukryta (`CLAUDE.md` §4.10, `payments-and-tips.md`). Braki przed przyjęciem prawdziwych pieniędzy: [`patron-zone-audit.md`](patron-zone-audit.md).

Nazwy zmiennych `PREMIUM_PASS_*` i prefiks `xp.premium_pass` w tabeli `AppSetting` zostały po pilotażu **celowo**: ich zmiana wymagałaby edycji `app.env` na serwerze albo osierociłaby istniejące dostępy.

## Co to jest

- **Dwie opcje** (karty wyboru w kroku 1; `PATRON_PRODUCTS` w `lib/modules/patron-zone/domain/config.ts`): „Dostęp na 30 dni” (`ACCESS_30D`) i „Dostęp bez limitu” (`ACCESS_LIFETIME`, etykieta „Najlepsza wartość”, domyślnie zaznaczona). Bez subskrypcji i bez odnawiania.
- **Cennik produkt × waluta** (`PATRON_PRICES`, ceny brutto w groszach/centach, zawierają 23% VAT; właściciel zmienia liczby w jednym miejscu). Waluty to lista bramki napiwkowej (`SUPPORTED_CURRENCIES`):

  | | PLN | EUR | USD | CHF | GBP |
  |---|---|---|---|---|---|
  | Dostęp na 30 dni | 14,99 | 3,99 | 4,49 | 3,99 | 3,49 |
  | Dostęp bez limitu | 29,99 | 7,99 | 8,99 | 7,99 | 6,99 |

  PLN to cena właściciela; pozostałe to okrągłe ceny detaliczne z grubsza wg kursów z 2026-10, wszystkie powyżej minimalnej opłaty Stripe (do przeglądu właściciela, zob. audyt).
- **Serwer przyjmuje tylko znany identyfikator produktu i znaną walutę i sam bierze kwotę z cennika** (przeglądarka nigdy nie podaje kwoty; trasy są `strict`). Przy rozliczeniu `fulfillPayment()` sprawdza, że kwota równa się cenie z cennika dla produktu i waluty płatności; inaczej **brak dostępu i alert**.
- **30 dni** dodaje 30 dni (od końca trwającego dostępu, inaczej od teraz), nie dalej niż 365 dni od teraz (`PATRON_MAX_AHEAD_DAYS`; dalsza wpłata jest odrzucana przed pobraniem pieniędzy). **Bez limitu** zapisuje jawny znacznik `lifetime: true` (+ `lifetimePaymentId`), nie odległą datę; zamienia trwające 30 dni na stały dostęp, a kolejny zakup jest odrzucany (`ALREADY_LIFETIME`).
- **Które filmy:** lista slugów w `PREMIUM_PASS_VIDEO_SLUGS` (konfiguracja, kolumna `Video.tier` się nie zmienia; domyślnie `jj`, `test-transkodowania`). Hero, nadchodząca premiera i film nieopublikowany nigdy nie są za bramką.
- **Baza:** zero migracji. Dostęp to wiersz `AppSetting` `xp.premium_pass:<userId>` (JSON, `provider` DEMO|STRIPE, `productId`, `paymentIds`, `totalMinor`, `lifetime`, `lifetimePaymentId`, `expiresAt`, zgody; starsze wersje są czytane jako 30 dni). Licznik lejka: `xp.premium_pass.stats:<data>`.

## Przełączniki (`app.env`, czytane w trakcie działania, bez przebudowy)

| Zmienna | Wartości | Domyślnie | Znaczenie |
|---|---|---|---|
| `PREMIUM_PASS_EXPERIMENT` | `off` \| `testers` \| `all` | `off` | kto widzi strefę: nikt / konta z `PREMIUM_PASS_TESTER_IDS` / wszyscy (także ADMIN na `www`; Studio i panel admina bez zmian) |
| `PREMIUM_PASS_TESTER_IDS` | lista id kont | pusta | tryb `testers` |
| `PREMIUM_PASS_VIDEO_SLUGS` | lista slugów | `jj`, `test-transkodowania` | filmy za bramką |
| `PREMIUM_PASS_PAYMENTS` | `demo` \| `stripe` (dokładnie `stripe`; inna wartość to `demo`) | `demo` | symulacja albo prawdziwa płatność |

- **`demo`**: kasa wygląda jak prawdziwa, ale serwer tylko symuluje płatność (`provider: "DEMO"`); nie dotyka Stripe. **Tylko w tym trybie** widać oznaczenia demo: pas „Tryb demo” (oferta, regulamin, konto), etykietę „TRYB DEMO” na scenie, przycisk „DEMO” z panelem (wygaś / usuń mój dostęp) i krok płatności bez formularza. Serwer odrzuca panel demo i symulowaną kasę w trybie `stripe` (`WRONG_MODE`).
- **`stripe`**: prawdziwa płatność, ale tylko gdy **wszystko** się zgadza (`resolvePremiumPayments`, `domain/payments-mode.ts`); inaczej kasa pokazuje „Płatności są chwilowo niedostępne” i **nigdy nie spada do trybu demo** (demo daje dostęp bez pieniędzy). Warunki: `STRIPE_SECRET_KEY` i `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` tego samego trybu (test z test, live z live), ustawiony `STRIPE_WEBHOOK_SECRET`, a dla kluczy **live** otwarta globalna bramka sprzedaży `PLATFORM_GATE_SALES=on`. Te warunki dotyczą kluczy `STRIPE_*` albo, gdy jest kompletny, osobnego zestawu `PREMIUM_PASS_STRIPE_*` (sekcja niżej). Klucze testowe działają przy zamkniętej bramce (pieniądze się nie ruszają) i dają etykietę „Tryb testowy” (podpowiedź karty `4242…`); przy live nie ma żadnej etykiety.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` jest wbudowany w obraz: jego zmiana wymaga przebudowy.

## Osobne klucze Stripe dla kasy premium

Domyślnie kasa premium używa tych samych kluczy co napiwki (`STRIPE_*`). Żeby wypróbować ją z prawdziwym Stripe w **trybie testowym** bez ruszania napiwków (zostają na live), można dodać **osobny zestaw**, który obejmuje wyłącznie płatności strefy patrona:

| Zmienna | Gdzie | Odpowiednik |
|---|---|---|
| `PREMIUM_PASS_STRIPE_SECRET_KEY` | `app.env` (i `admin.env` panelu, dla zwrotów/sporów) | `STRIPE_SECRET_KEY` |
| `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY` | `build.env` (wypalany w obrazie) **i** `app.env` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET` | `app.env` | `STRIPE_WEBHOOK_SECRET` |

- **Wszystko albo nic:** zestaw działa tylko, gdy ustawione są wszystkie trzy. Gdy brakuje któregokolwiek, kasa premium zachowuje się dokładnie jak przedtem (używa `STRIPE_*`); częściowe ustawienie jest ignorowane. `validateAppEnv` sprawdza zgodność trybu secret/publishable i prefiks `whsec_`. Zestaw premium nigdy nie spada na klucze `STRIPE_*` dla płatności, które już go używają: brak klucza premium to błąd, nie użycie klucza live.
- **Co wybiera zestaw** (`lib/payments/stripe-key-sets.ts`): `resolvePremiumPayments` (zgodność kluczy, webhook secret i bramka sprzedaży tylko dla kluczy live; klucze testowe działają przy zamkniętej bramce, etykieta „Tryb testowy” zostaje), tworzenie PaymentIntent, Stripe.js w przeglądarce (`getStripeBrowser("premium")`, gdy DTO niesie `keySet: "premium"`), weryfikacja webhooka, szybka ścieżka statusu, cron uzgadniania, uzgadnianie zwrotów, zwroty i spory z panelu. Napiwki i reszta aplikacji zostają na `STRIPE_*`.
- **Skąd wiadomo, którego zestawu jest płatność:** nowa płatność premium utworzona na kluczach premium dostaje w `Payment.metadata` znacznik `stripeKeySet: "premium"` (kolumna JSON, **bez migracji**). Brak znacznika (wszystkie dotychczasowe płatności i napiwki) = `STRIPE_*`. Każde późniejsze wywołanie Stripe dla płatności (ponowne użycie próby, webhook, uzgadnianie, zwrot, spór) idzie kluczem jej zestawu, więc intent z trybu testowego nie jest odpytywany kluczem live (404, fałszywe alarmy) ani odwrotnie. Płatność na kluczach premium powstaje bez klienta Stripe (zapisany `User.stripeCustomerId` to klient trybu live). Nieopłacona próba z innego zestawu niż bieżący nie jest używana ponownie (klient zaczyna nową).
- **Webhook: jedna trasa, dwa sekrety** (`/api/webhooks/stripe`). Stripe ma osobne endpointy i sekrety dla trybu live i testowego; oba wskazują na ten sam adres. Podpis surowego ciała jest sprawdzany kolejno `STRIPE_WEBHOOK_SECRET` i (gdy zestaw jest kompletny) `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET`; sekret, który przeszedł, wyznacza zestaw zdarzenia; zły podpis oboma = 400; brak jednego sekretu nie psuje drugiego; brak obu = 500 jak dotąd. Zdarzenie jest ignorowane (200, `ignored`), gdy jego `livemode` nie zgadza się z trybem klucza jego zestawu albo dotyczy płatności z drugiego zestawu (zdarzenie testowe nigdy nie domknie napiwku i odwrotnie). Bez zmian: limit 1 MB, blokada i idempotencja po id zdarzenia.
- **Uzgadnianie:** cron i zwroty biorą klucz z płatności. Gdy zestaw premium zniknął z konfiguracji (powrót do demo), płatności premium nie są odpytywane kluczem live: świeże zostają, porzucone (>24 h) są zamykane lokalnie jako CANCELED, a sprawdzanie zwrotów jest pomijane. Po przywróceniu kluczy wszystko wraca do normy (`?scope=recover` ponownie sprawdza CANCELED).
- **Poza zakresem:** `scripts/ops/briefing.mjs` (stan dostarczania webhooków) odpytuje tylko konto na kluczu live i nie widzi zdarzeń trybu testowego.

### Instrukcja: kasa premium na kluczach testowych

1. W Stripe Dashboard przełącz na **tryb testowy** i skopiuj klucz sekretny (`sk_test_…`) i publikowalny (`pk_test_…`).
2. W trybie testowym: Developers, Webhooks, Add endpoint, adres `https://www.pawelperfect.com/api/webhooks/stripe`, zdarzenia: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. Skopiuj sekret podpisu (`whsec_…`). Istniejącego endpointu live nie ruszaj.
3. `app.env`: `PREMIUM_PASS_STRIPE_SECRET_KEY`, `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY`, `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET` oraz `PREMIUM_PASS_PAYMENTS=stripe`. `build.env`: `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY`. Opcjonalnie `admin.env`: `PREMIUM_PASS_STRIPE_SECRET_KEY` (ograniczony klucz testowy).
4. **Przebuduj obraz** (klucz publikowalny jest wypalany) i wdróż zwykłą ścieżką. `STRIPE_*` (napiwki) zostają bez zmian.
5. Kasa pokazuje „Tryb testowy”; karta `4242 4242 4242 4242`. Lista metod zależy od waluty i regionu wg ustawień konta Stripe (`payment_method_types` z intentu). Lista kafelków w kroku 2 jest podglądem tej samej listy (próbny intent anulowany od razu, patrz „Kasa w trzech krokach”); w panelu Stripe w trybie testowym widać krótko żyjące, anulowane płatności z metadanymi `probe=patron-methods`.
6. **Powrót do demo:** w `app.env` ustaw `PREMIUM_PASS_PAYMENTS=demo` (czytane w trakcie działania, bez przebudowy). Zmiennych premium nie trzeba usuwać. Powrót na `STRIPE_*` w trybie `stripe`: usuń choć jedną z trzech zmiennych premium (zmiana klucza publikowalnego w obrazie wymaga przebudowy).

## Kasa w trzech krokach (`app/components/premium-pass/PassCheckoutSheet.tsx`)

1. **Opcja i waluta** oraz podsumowanie zamówienia. Etykieta „Wybierz dostęp” stoi w jednym wierszu z małą szarą pigułką waluty („zł · PLN”, 36 px, pole klikalne 44 px; to `TipSelect` w trybie `compact` z tą samą listą walut co bramka napiwkowa, domyślnie `detectDefaultCurrency`; etykieta „Waluta” jest tylko dla czytników ekranu); pod wierszem dwie karty dostępu. Przy koncie z dostępem bez limitu pigułka jest nieaktywna. We wszystkich krokach odstęp od tekstu etykiety do pola pod nią jest ten sam (zmienna `--field-label-gap`, dziś 0: samo pole linii etykiety, ok. 2 px; domyślnie w bramce napiwkowej 8 px); pigułka waluty wystaje ponad wiersz etykiety, żeby go nie powiększać. Pod podsumowaniem stoi, wyrównane do prawej, „zawiera VAT” (bez stawki).
2. **Metoda płatności** (lista kafelków pochodzi ze Stripe, zob. niżej; do czasu odpowiedzi, w trybie demo i przy błędzie: kandydaci, PLN: BLIK, Przelewy24, karta; inne waluty: karta; Stripe zawęża listę jeszcze raz przy tworzeniu płatności), regulamin i polityka tylko jako linki. PaymentIntent płatności powstaje dopiero przy przejściu z kroku 2 do 3.

   **Podgląd metod ze Stripe (przed „Dalej”).** Stripe nie ma wywołania „jakie metody dla tej waluty”; jedynym źródłem jest `payment_method_types` PaymentIntentu z `automatic_payment_methods`. Dlatego po wejściu do kroku 2 (tryb `stripe`, płatności dostępne) przeglądarka pyta `POST /api/user/premium-pass/methods` `{productId, currency}` (`fetchPatronMethods`), a serwer (`previewPatronMethods`: `application/preview-payment-methods.use-case.ts`) tworzy **próbny** PaymentIntent (kwota z cennika dla produktu i waluty; metadata tylko `{probe: "patron-methods"}`: bez konta, `paymentId`, klienta i opisu), odczytuje listę i **od razu go anuluje**. Nic nie trafia do bazy; `client_secret` próby nigdy nie jest czytany ani zwracany (audyt H04 bez zmian: sekret płatności wciąż powstaje dopiero po kroku 2 i zgodach); odpowiedź to same nazwy metod. Klucze jak kasa (`getStripeClient(keySet)` wg `resolvePremiumPayments`: zestaw premium, gdy kompletny). Cache w pamięci procesu 10 min na zestaw+walutę+kwotę (równoległe żądania dzielą jedną próbę), krótki timeout Stripe (6 s, bez ponowień), limit 40 żądań/10 min na konto. Błąd Stripe, brak klucza albo timeout dają `200 {paymentMethodTypes: null}` (30 s bez ponawiania): klient zostaje przy kandydatach, żadnych szczegółów Stripe w odpowiedzi. Trasa pod `/api/user/` (sesja i kontrola same-origin w middleware; POST, bo to wywołanie Stripe). Klient trzyma listę razem z kluczem produkt+waluta, więc spóźniona odpowiedź dla starej waluty nie zmienia kafelków. Lista jest dokładna co do waluty i kwoty, ale bez kraju kupującego (jak przy intencie bez klienta): `Link` jest ukryty, Apple/Google Pay dochodzą tylko przy `card` i wsparciu przeglądarki. Anulowanie próby wysyła `payment_intent.canceled`; webhook rozpoznaje `metadata.probe` i ignoruje je po cichu (200, `ignored`). Metody bez własnego opisu mają ogólny kafelek (`describeTipMethod`); opisy i ikony ma `tip-flow-config.ts` (m.in. Klarna, PayPal, Revolut Pay, Bancontact, EPS, iDEAL, Sofort, Multibanco, MB WAY, MobilePay, TWINT, Swish).
3. **Płatność** formularzami bramki napiwkowej (`TipPayStep`, `TipPayFrame` z opcjonalnym `patron`: BLIK, P24, karta, Apple/Google Pay, reszta przez Payment Element) i dwa pola zgód: regulamin z polityką oraz natychmiastowy dostęp z utratą prawa odstąpienia (art. 38 pkt 13 u.p.k.). Przycisk jest nieaktywny, dopóki oba nie są zaznaczone; tuż przed potwierdzeniem w Stripe przeglądarka zapisuje zgodę na swojej nieopłaconej płatności (`POST /api/user/premium-pass/consent` → `Payment.metadata.consents`); jeśli zapis się nie uda, płatność nie rusza.

Karta sprzedawcy (`PassSellerCard`, dane w jednym obiekcie `PATRON_SELLER` w `pass-copy.ts`: nazwa, linia „Spółka zarejestrowana w Polsce”, `nip: null` do uzupełnienia jedną zmianą) (neutralna: białe tło i szara obwódka jak pola opcji) stoi między podsumowaniem a linkami prawnymi w krokach 1 i 2, a w kroku 3 jest wariantem jednowierszowym; przycisk (i) rozwija krótki akapit. Dolna linia okna (`PassSecurityFooter`) jest neutralna wobec operatora płatności (nie nazywa Stripe); w trybie demo mówi, że nic nie zostanie pobrane.

**Położenie kasy (panel boczny na komputerze, decyzja właściciela 2026-10-28).** Od szerokości okna **900 px** kasa jest pływającym panelem przy **prawej** krawędzi (`premium-pass.module.css`, blok `@media (min-width: 900px)`): szerokość 520 px (`min(520px, 100vw - 32px)`), margines 16 px od góry, dołu i prawej strony, zaokrąglenie 16 px ze wszystkich stron, obwódka `--chan-line` i cień jak w oknie powiadomień (`0 24px 60px -18px rgba(15,23,42,.28)`); treść przewija się wewnątrz (`.sheetBody`), pasek przycisków zostaje na dole. Tło jest tylko lekko przyciemnione (`rgba(5,7,13,.2)`), żeby film i strona były widoczne, ale okno pozostaje modalne (`aria-modal`, pułapka fokusu, Escape, blokada przewijania tła; przewijanie nie powoduje skoku strony dzięki globalnemu `scrollbar-gutter`). Dotknięcie przyciemnionego tła zamyka kasę (obsługa na samym `Backdrop`, nie na „outside press” Base UI, który zostaje wyłączony, bo nakładki Stripe: 3DS, portfele, BLIK, dopisują się do `<body>`); nie zamyka w trakcie płatności (`locked`). Animacja: wjazd **od góry** (`sheetDrop`: `translateY(-32px)` + `opacity`, 240 ms, keyframes, bo kasa jest montowana już otwarta, więc samo przejście by nie ruszyło), wyjazd odwrotnie (`data-ending-style`, przejście); **nie z prawej**, bo panel konta (`UserMenu`, z-index 1100, 320 px, wjazd z prawej) już tak wjeżdża. Z `prefers-reduced-motion` bez animacji i przejść. Panel konta nie otwiera kasy i nie da się kliknąć przycisku kupna pod jego tłem; gdyby oba były otwarte (zdarzenie `polutek:open-patron` z zewnątrz), kasa (z-index 9990+) leży nad panelem konta i go przykrywa. Poniżej 900 px nic się nie zmienia: 561-899 px wyśrodkowana kolumna 520 px na całą wysokość, do 560 px pełny ekran. Arkusz dokumentów prawnych (`LegalSheet`, z-index 9992+) zostaje pełnoekranowy i otwiera się nad panelem. Na 900-1100 px panel zasłania 31-37% szerokości kadru filmu (przy 1280 px: 22%); to świadoma cena, bo szerokość 520 px jest stała. `SupportModal` (napiwek) ma własny kontener i nie jest objęty.

**Dokumenty prawne w kasie (arkusz, nie nowa karta).** Każdy odnośnik do dokumentu w kasie (zgody w kroku 3, dolna linia kroków 1-2) to `LegalLink` (`app/components/legal/legal-sheet-context.tsx`): prawdziwy `<a href target=_blank>` (działa bez JS, z Ctrl/Cmd i środkowym przyciskiem), a zwykłe kliknięcie otwiera `LegalSheet` (`app/components/legal/LegalSheet.tsx`) jako zagnieżdżony dialog Base UI NA kasie (provider stoi wewnątrz popupu kasy, więc nic się nie odmontowuje i stan kasy zostaje). Arkusz jest **pełnoekranowy na każdej szerokości** (stały nagłówek z dużym „Zamknij” i „Otwórz w nowej karcie”, tekst w kolumnie do ok. 760 px). Escape, gest w dół na nagłówku (tylko dotyk) zamykają sam arkusz; fokus wraca na kliknięty link. W kasie otwierają się **prawdziwy regulamin serwisu (`doc="terms"`, ten sam tekst co `/regulamin`) i prawdziwa polityka prywatności** z `LegalDocs.tsx`, ładowane leniwie (`LegalDocBody.tsx`); projekt regulaminu strefy (`PassTermsContent`, `doc="passTerms"`) zostaje tylko dla strony `/regulamin-premium` i nie jest linkowany z kasy. Karta sprzedawcy nie ma własnego linku (zdanie w rozwijanym akapicie odsyła słownie do Regulaminu). Uwaga prawna: regulamin serwisu mówi dziś, że serwis niczego nie sprzedaje (wpłaty to darowizny), co przeczy sprzedaży dostępu; decyzja o treści należy do właściciela (audyt H02). Stary „pasek testowy” na stronie regulaminu strefy to `DemoRibbon` (tryb demo) w `PassTermsPage`; w arkuszu go nie ma. Nowy link do dokumentu w kasie ma używać `LegalLink`, nie ręcznego `<a>`.

Dostępność: wskaźnik kroków (`<ol>`, `aria-current="step"`), komunikat `aria-live`, fokus na nagłówku kroku, lista rozwijana z klawiatury, błędy w `role="alert"`, `prefers-reduced-motion`, układ sprawdzony na 375 px w harnessie przeglądarki (nie na prawdziwym telefonie).

## Przepływ pieniędzy i przyznawanie dostępu (nie ma równoległego stosu płatności)

```
Dalej (krok 2)  -> POST /api/user/premium-pass/intent        (tylko tryb stripe; klient podaje id produktu i walutę, kwota z cennika serwera)
                -> createCheckoutIntent({ purpose: "premium_pass" })  [ten sam kod co napiwki]: wiersz Payment (PENDING) + PaymentIntent,
                   metadata: userId, paymentId, requestId, creatorId, purpose
Krok 3          -> POST .../consent  -> Stripe.js potwierdza wybraną metodą
Stripe          -> webhook payment_intent.succeeded (podpis na surowym ciele; livemode różny od klucza jest ignorowany)
                   | GET /api/payments/[id] (szybka ścieżka) | cron uzgadniania  ->  fulfillPayment()   (jedyna droga, idempotentna, CAS)
                -> w tej samej transakcji: Payment = SUCCEEDED, UserPaymentTotal, a dla purpose = premium_pass
                   grantPatronAccessForPayment(): wiersz AppSetting `xp.premium_pass:<userId>` (blokada advisory na konto)
                   -> bez znacznika wspierającego (PatronGrant) i bez maila „dziękuję za napiwek”
```

- **Dostęp przyznaje wyłącznie `fulfillPayment()`** po weryfikacji, że Stripe mówi `succeeded`, a kwota, waluta, intent i użytkownik zgadzają się z wierszem `Payment`. Test `premium-pass-no-money.test.ts` pilnuje, że żadna trasa ani komponent nie woła `grantPatronAccessForPayment`.
- **Pełny zwrot** (`REFUNDED`) zdejmuje udział tej wpłaty (30 dni albo znacznik lifetime; `revokePatronAccessForPayment`). Częściowy zwrot, spór i cofnięty zwrot właściciel obsługuje ręcznie (dostęp się nie zmienia sam; zob. audyt). Kod niczego nie zwraca sam.
- **Księga:** płatność idzie do tabeli `Payment` (ta sama co napiwki; widać ją w panelu „Płatności”), odróżnia ją `metadata.purpose`. Pasek zbiórki liczy tylko napiwki (`fundraising-progress.service.ts` odejmuje płatności strefy).
- **Czego nie ma:** zapisu do `Order`/`Entitlement`/`LedgerEntry`/`PatronGrant`, maila z potwierdzeniem (art. 21 u.p.k.), faktur ani paragonów, odznaki patrona za zakup. To są punkty audytu.

## Decyzja dostępu i plan odtwarzania

- `checkVideoAccess` (po sprawdzeniu personelu i bramki 18+, przed gałęzią `PAID`): film z listy bez aktywnego dostępu daje `PASS_REQUIRED` (gość też, CTA prowadzi przez logowanie). Plan odmowy jak każdy: bez źródła, tokenu, sesji, rozdziałów i napisów; niesie `access.offer` (ceny, nie dane dostępu) i `access.offer.payments` (tryb demo/stripe). Plan odtwarzalny filmu z dostępem czasowym niesie `premiumPassUntil`.
- Miejsca czytające dostęp przechodzą przez `checkVideoAccess`: komentarze (czytanie otwarte, pisanie za dostępem), `/embed` i oEmbed (film w trybie `all` jest „tylko na stronie”), JSON-LD rozdziałów (pomijane), pasek boczny (kafelek PATRON, zablokowany bez dostępu), „Kontynuuj oglądanie” (pomija zablokowane).
- Przeglądarka po zakupie odświeża plan (`refreshPlaybackPlan`); `/api/media-source` zostaje `no-store`.

## Trasy i strony

| Trasa | Kto | Co |
|---|---|---|
| `GET /api/user/premium-pass` | zalogowany, dla którego strefa jest widoczna (inaczej 404) | `{ offer, pass }`, `no-store`; `?intent=checkout` liczy otwarcie kasy |
| `POST /api/user/premium-pass/intent` | j.w., tryb `stripe` | PaymentIntent dla produktu i waluty |
| `POST /api/user/premium-pass/methods` | j.w., tryb `stripe` | nazwy metod płatności ze Stripe dla produktu i waluty (próbny intent anulowany od razu; nic w bazie, bez `client_secret`) |
| `POST /api/user/premium-pass/consent` | j.w. | zapis zgód na własnej nieopłaconej płatności |
| `POST /api/user/premium-pass/checkout` | j.w., tryb `demo` | symulowany zakup (`WRONG_MODE` w `stripe`) |
| `POST /api/user/premium-pass/demo` | j.w., tryb `demo` | wygaś / usuń własny dostęp (`WRONG_MODE` w `stripe`) |
| `/premium`, `/en/premium`, `/<lang>/premium` | strona oferty, 404 gdy strefa wyłączona, `noindex` | |
| `/regulamin-premium`, `/en/premium-terms` | **projekt** regulaminu strefy (do zatwierdzenia przez prawnika) | |

Adres to `/premium`, nie `/wejsciowka`: `matcher` w `middleware.ts` pomija każdą ścieżkę zawierającą „js” (zgubiony `\` w wyrażeniu); błąd jest osobnym zadaniem.

## Elementy prawne w przepływie (makiety do zatwierdzenia)

Cena brutto z VAT przed zamówieniem (art. 12 u.p.k.), przycisk z obowiązkiem zapłaty (art. 17 ust. 3), zgoda na utratę prawa odstąpienia (art. 38 pkt 13), akceptacja regulaminu i polityki, brak cen przekreślonych (Omnibus nie dotyczy), sprzedawca w stopce kasy (dziś „POLUTEK Sp. z o.o. (dane demo)”, spółka nie istnieje). **Potwierdzenie na trwałym nośniku (art. 21) nie jest wysyłane.** Treść zatwierdza prawnik i księgowy; szczegóły i kolejność prac w [`patron-zone-audit.md`](patron-zone-audit.md).

## Analityka

Odsłony `/premium` liczy zwykły kolektor. Lejek serwerowy: jedna linia logu na zdarzenie (`[premium-pass] event=offer_view|checkout_open|checkout_submit|demo_success|demo_declined|already_active`, bez id konta i e-maila) oraz dzienny licznik w `xp.premium_pass.stats:<data>`. Brak zdarzeń sukcesu płatności i zwrotu (audyt).

## Pliki

| Obszar | Gdzie |
|---|---|
| Moduł (domena, przypadki użycia, magazyn) | `lib/modules/patron-zone/` (`domain/config.ts` przełącznik i cennik, `domain/payments-mode.ts`, `application/pass-access.ts` bramka dostępu, `application/patron-checkout.use-case.ts`, `application/patron-grant.ts`, `application/checkout-demo.use-case.ts`, `infrastructure/pass-store.ts`) |
| Interfejs | `app/components/premium-pass/` (kasa, oferta, scena zablokowanego filmu, konto, plakietki, host `PatronCheckoutHost`), teksty obcojęzyczne: `lib/i18n/catalog/premium-pass/<język>.json` |
| API i strony | `app/api/user/premium-pass/*`, `app/[locale]/premium`, `regulamin-premium`, `premium-terms` |
| Wstawki w innych modułach | `access` (`check-video-access`), `playback`, `comments`, `syndication` (`embed-eligibility`), `channel` (`channel-layout`), `watch-progress`, `payments` (`purpose`, `fulfill-payment`, `handle-refund`), `video` (`fundraising-progress`) |
| Testy | `tests/unit/modules/patron-zone/` (dostęp, plan, konfiguracja, tryb płatności, rozliczenie, trasy, `no-money`), `tests/unit/components/premium-pass-*.test.tsx`, `patron-checkout-host.test.tsx`, `tests/postgres/premium-pass-ledgers.pg.test.ts` (test na prawdziwym Postgresie, jeszcze nieuruchomiony) |
| Ulubione (osobna funkcja) | `lib/modules/favorites`, `app/components/channel/FavoritesShelf.tsx`, `FavoriteButton.tsx` (przycisk nie jest nigdzie renderowany; półka i migracja zostają) |
