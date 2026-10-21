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
- **`stripe`**: prawdziwa płatność, ale tylko gdy **wszystko** się zgadza (`resolvePremiumPayments`, `domain/payments-mode.ts`); inaczej kasa pokazuje „Płatności są chwilowo niedostępne” i **nigdy nie spada do trybu demo** (demo daje dostęp bez pieniędzy). Warunki: `STRIPE_SECRET_KEY` i `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` tego samego trybu (test z test, live z live), ustawiony `STRIPE_WEBHOOK_SECRET`, a dla kluczy **live** otwarta globalna bramka sprzedaży `PLATFORM_GATE_SALES=on`. Klucze testowe działają przy zamkniętej bramce (pieniądze się nie ruszają) i dają etykietę „Tryb testowy” (podpowiedź karty `4242…`); przy live nie ma żadnej etykiety.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` jest wbudowany w obraz: jego zmiana wymaga przebudowy.

## Kasa w trzech krokach (`app/components/premium-pass/PassCheckoutSheet.tsx`)

1. **Waluta i opcja** (to samo `TipSelect` i lista walut co bramka napiwkowa; domyślnie `detectDefaultCurrency`) oraz podsumowanie zamówienia.
2. **Metoda płatności** (PLN: BLIK, Przelewy24, karta; inne waluty: karta; Stripe zawęża listę przy tworzeniu płatności), regulamin i polityka tylko jako linki. PaymentIntent powstaje dopiero przy przejściu z kroku 2 do 3.
3. **Płatność** formularzami bramki napiwkowej (`TipPayStep`, `TipPayFrame` z opcjonalnym `patron`: BLIK, P24, karta, Apple/Google Pay, reszta przez Payment Element) i dwa pola zgód: regulamin z polityką oraz natychmiastowy dostęp z utratą prawa odstąpienia (art. 38 pkt 13 u.p.k.). Przycisk jest nieaktywny, dopóki oba nie są zaznaczone; tuż przed potwierdzeniem w Stripe przeglądarka zapisuje zgodę na swojej nieopłaconej płatności (`POST /api/user/premium-pass/consent` → `Payment.metadata.consents`); jeśli zapis się nie uda, płatność nie rusza.

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
