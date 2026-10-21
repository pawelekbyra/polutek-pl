# Eksperyment „Wejściówka Premium” → „Strefa patrona”: plan wdrożenia (2026-10-20, zmiana 2026-10-21)

Status: **zbudowane na gałęzi `exp/premium-pass` (PR do `main`, nie scalone, nie wdrożone)**, z decyzjami właściciela z 2026-10-20 (niżej). Makieta wyglądu: [`premium-pass-mockup.html`](premium-pass-mockup.html) (otwórz plik w przeglądarce; przełącznik jasny/ciemny i telefon/komputer).

## Strefa patrona: prawdziwa płatność Stripe za dostęp (2026-10-21, zastępuje produkty i kasę poniżej)

Decyzja właściciela z 2026-10-21: z „wejściówki” robimy **„Zostań patronem projektu i uzyskaj dostęp do strefy patrona”** z prawdziwą płatnością przez Stripe. Poniższe punkty **zastępują** w tym dokumencie
wszystko, co mówi o dwóch wejściówkach (7 i 30 dni), o stałych cenach, o „nigdy nie pobiera pieniędzy” i o kasie bez Stripe (rozdz. 0, 2, 4, 5, 8 i decyzje 1 i 5 wyżej). Reszta (przełącznik
`PREMIUM_PASS_EXPERIMENT`, lista filmów, bramka dostępu, plan `PASS_REQUIRED`, wycofanie) zostaje.

### Co to jest i ile kosztuje

- **Płacisz, ile chcesz:** propozycje **10 / 25 / 50 / 100 zł** (domyślnie 25 zł) albo własna kwota. **Minimum 5 zł, maksimum 1000 zł** (PLN, kwota brutto w groszach, liczba całkowita). Minimum jest wyżej
  niż twarda dolna granica Stripe dla PLN (2 zł); limity są stałe w kodzie (`PATRON_*` w `domain/config.ts`), egzekwowane na serwerze (`validatePatronAmount`), nie w przeglądarce.
- **Długość dostępu:** każda udana wpłata daje **30 dni**, niezależnie od kwoty. Wpłata przy trwającym dostępie **przedłuża go o kolejne 30 dni od jego końca** (nic się nie odnawia samo, to nie subskrypcja).
  Dostęp nie może sięgać dalej niż **365 dni od teraz**: dalsza wpłata jest wtedy odrzucana przed pobraniem pieniędzy (`MAX_AHEAD`).
- Zablokowane filmy, tryb widoczności i bramka dostępu bez zmian. Zniknęły produkty `PASS_7D` / `PASS_30D`, kafelki metod płatności, kafelki produktów i pas DEMO w oknie kasy.

### Dwa przełączniki (oba w `app.env`, czytane w trakcie działania)

| Zmienna | Wartości | Domyślnie |
|---|---|---|
| `PREMIUM_PASS_EXPERIMENT` | `off` \| `testers` \| `all` | `off` |
| `PREMIUM_PASS_PAYMENTS` | `demo` \| `stripe` (dokładnie `stripe`, każda inna wartość to `demo`) | `demo` |

- **`demo`** (domyślnie): kasa wygląda jak prawdziwa, ale serwer tylko symuluje płatność (wiersz `AppSetting` z `provider: "DEMO"`); nie dotyka Stripe. Nic się nie zmienia, dopóki właściciel nie ustawi `stripe`.
- **`stripe`**: prawdziwa płatność, ale tylko gdy **wszystko** się zgadza (`resolvePremiumPayments`, `domain/payments-mode.ts`); inaczej kasa pokazuje „Płatności są chwilowo niedostępne” i **nigdy nie spada do trybu demo**
  (demo daje dostęp bez pieniędzy). Warunki: `STRIPE_SECRET_KEY` i `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` są **tego samego trybu** (test z test, live z live; mieszanka = niedostępne), `STRIPE_WEBHOOK_SECRET` jest ustawiony,
  a dla kluczy **live** otwarta jest globalna bramka sprzedaży `PLATFORM_GATE_SALES=on`. Klucze **testowe** działają przy zamkniętej bramce (żadne prawdziwe pieniądze się nie ruszają), tak właściciel sprawdza całość przed
  założeniem spółki. Przy kluczach testowych kasa i oferta mają widoczną etykietę **„Tryb testowy”** (z podpowiedzią karty `4242…`); przy live nie ma żadnej etykiety.
- Panel „DEMO” (wygaś / usuń mój dostęp) działa tylko w trybie `demo` i przy kluczach testowych; przy live serwer go odrzuca (dostęp jest wtedy dowodem prawdziwej wpłaty).

### Kasa w dwóch krokach (`PassCheckoutSheet`, pełna wysokość, bez paska demo)

1. **Krok 1:** kwota (propozycje + własna), **lista rozwijana metod płatności** (to samo `TipSelect` i te same kafelki, co w bramce napiwkowej: `getTipMethodTiles`, bez makiety „Crypto”),
   regulamin i polityka prywatności **tylko jako linki**, przycisk „Dalej · kwota”. Zapytanie o PaymentIntent idzie dopiero przy „Dalej” (nie przy otwarciu okna), więc samo otwarcie niczego nie tworzy. Jeśli Stripe nie dopuszcza wybranej
   metody dla tej płatności, kasa zostaje w kroku 1, zawęża listę do dozwolonych i mówi, że trzeba wybrać inną.
2. **Krok 2:** formularz wybranej metody to **te same formularze, co w bramce napiwkowej** (`TipPayStep`: BLIK, Przelewy24, karta, Apple/Google Pay, reszta przez Payment Element; w `TipPayFrame` doszedł opcjonalny `patron`,
   napiwek go nie przekazuje i działa jak dotąd) oraz **dwa pola wyboru**: „Akceptuję regulamin i politykę prywatności” i zgoda na natychmiastowy dostęp z utratą prawa odstąpienia (art. 38 pkt 13 ustawy o prawach konsumenta;
   zostawiona świadomie, można ją usunąć na wyraźną decyzję właściciela). Przycisk płatności jest nieaktywny, dopóki oba nie są zaznaczone (portfel Apple/Google nie otwiera się bez zgód). Tuż przed potwierdzeniem w Stripe
   przeglądarka zapisuje zgodę na swojej nieopłaconej płatności (`POST /api/user/premium-pass/consent` → `Payment.metadata.consents`); jeśli zapis się nie uda, płatność nie rusza.
3. Dostępność: wskaźnik kroków (`<ol>`, `aria-current="step"`), komunikat `aria-live` „Krok 2 z 2”, fokus przenosi się na nagłówek kroku, lista rozwijana obsługiwana klawiaturą (strzałki, Enter, Esc), błędy w `role="alert"`,
   animacje wyłączone przy `prefers-reduced-motion`, układ sprawdzony na 375 px.

### Przepływ pieniędzy i przyznawanie dostępu (nie ma równoległego stosu płatności)

```
Dalej (krok 1)  -> POST /api/user/premium-pass/intent        (tylko tryb stripe + dostępne; kwota walidowana na serwerze)
                -> createCheckoutIntent({ purpose: "premium_pass" })  [to samo, co napiwki]: jeden wiersz Payment (PENDING) + jeden PaymentIntent,
                   metadata: userId, paymentId, requestId, creatorId, purpose; opis „Dostęp do strefy patrona: …”; automatic_payment_methods
Krok 2          -> POST .../consent  -> Stripe.js potwierdza wybraną metodą (te same formularze, co napiwek)
Stripe          -> webhook payment_intent.succeeded (podpis weryfikowany na surowym ciele; zdarzenie z innym livemode niż klucz jest ignorowane)
                   | GET /api/payments/[id] (szybka ścieżka) | cron uzgadniania  ->  fulfillPayment()   (jedyna droga, idempotentna, CAS)
                -> w tej samej transakcji: Payment = SUCCEEDED, UserPaymentTotal, a dla payment.metadata.purpose = premium_pass
                   grantPatronAccessForPayment(): wiersz AppSetting `xp.premium_pass:<userId>` (blokada advisory na konto, id płatności zapisane raz)
                   -> bez znacznika wspierającego (PatronGrant) i bez maila „dziękuję za napiwek”
```

- **Dostęp jest przyznawany wyłącznie przez `fulfillPayment()`** po weryfikacji, że Stripe mówi `succeeded`, a kwota, waluta, intent i użytkownik zgadzają się z wierszem `Payment` (test `premium-pass-no-money.test.ts` pilnuje, że żadna trasa
  ani komponent nie woła `grantPatronAccessForPayment`). Przeglądarka tylko czeka (`GET /api/payments/[id]`) i czyta status.
- **Pełny zwrot** (`REFUNDED`) zdejmuje 30 dni tej wpłaty z dostępu (`revokePatronAccessForPayment`, z `applyRefundedTotal`). **Częściowy zwrot, spór i cofnięty zwrot** właściciel obsługuje ręcznie (dostęp się nie zmienia samoczynnie).
  **Zwroty robi właściciel ręcznie** (panel Stripe albo „Płatności” w panelu); kod niczego nie zwraca sam.
- **Księga:** płatność idzie do istniejącej tabeli `Payment` (ta sama, co napiwki; widać ją w panelu „Płatności” i „Przychody”), bo dostaje za darmo webhook, uzgadnianie, zwroty, spory i audyt. Odróżnia ją `metadata.purpose`
  (bez migracji). Pasek zbiórki liczy tylko napiwki: płatności strefy patrona są od niego odejmowane (`fundraising-progress.service.ts`). Mapowanie „kto ma dostęp do kiedy” zostaje w `AppSetting` (`xp.premium_pass:<userId>`, wersja 2:
  `provider` DEMO|STRIPE, `paymentIds`, `totalMinor`, zgody); stare wiersze v1 (dwie wejściówki demo) są czytane jako dostęp demo.
- **Czego nie ma:** migracji bazy, osobnego klienta Stripe, osobnego webhooka, zapisu do `Order`/`Entitlement`/`LedgerEntry`/`PatronGrant`, maila z potwierdzeniem (wymóg trwałego nośnika z art. 21 u.p.k. czeka na decyzję i spółkę).

### Jak włączyć (tylko właściciel, nic z tego nie robi kod ani agent)

Test na produkcji bez prawdziwych pieniędzy wymaga kluczy testowych (inna para kluczy i osobny endpoint webhooka w Stripe w trybie testowym; dziś na produkcji jest klucz **live**, więc test najlepiej na osobnym środowisku):
`PREMIUM_PASS_EXPERIMENT=all`, `PREMIUM_PASS_PAYMENTS=stripe`, `STRIPE_SECRET_KEY=sk_test_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` (zmienna `NEXT_PUBLIC_` jest wbudowana w obraz: wymaga przebudowy),
`STRIPE_WEBHOOK_SECRET=whsec_…` (endpoint `/api/webhooks/stripe`, zdarzenia `payment_intent.*`, `charge.refunded`, `refund.*`, `charge.dispute.*`).
**Prawdziwa sprzedaż** (po założeniu POLUTEK Sp. z o.o., regulaminie od prawnika, VAT i zatwierdzeniu Stripe): klucze live + `PLATFORM_GATE_SALES=on` + `PREMIUM_PASS_PAYMENTS=stripe`. Dopóki bramka sprzedaży jest wyłączona,
klucze live nigdy nie pobiorą pieniędzy z tej funkcji (kasa pokazuje „niedostępne”).

### Wycofanie, gdy są już prawdziwe płatności

`premium-pass-revert.sh --flag-only` ustawia `PREMIUM_PASS_EXPERIMENT=off` **i** `PREMIUM_PASS_PAYMENTS=demo` (nikt nowy nie zapłaci; trasy odpowiadają 404). Webhook i uzgadnianie nadal rozliczają wpłaty w toku i przyznają dostęp (mapowanie
dostępu leży w bazie, nie zależy od przełącznika). **Pełne wycofanie:** commity eksperymentu (też te w module płatności) cofa `git revert`; skrypt **nigdy nie usuwa wierszy `Payment`**, kasuje tylko mapowanie dostępu
(`AppSetting xp.premium_pass%`) i najpierw zapisuje je do pliku `premium-pass-grants-<czas>.tsv` na serwerze. Gdy istnieją dostępy z prawdziwych wpłat albo wpłaty w toku, skrypt **odmawia** (kod wyjścia 6), dopóki nie podasz
`--confirm-real-payments` (flaga zostaje wtedy wyłączona). **Po wycofaniu kodu** wpłata, która jeszcze była `PENDING`, zostałaby rozliczona jak napiwek (stary kod nie zna celu płatności), więc przed pełnym wycofaniem
poczekaj, aż wpłaty w toku się rozstrzygną. Zwroty za dostęp, który znika, robi właściciel ręcznie.

---

### Decyzje właściciela (2026-10-20) i odstępstwa implementacji od planu

Te punkty **zastępują** odpowiadające im miejsca niżej (rozdziały 2, 3, 7, 8, 9, 12, 16, 19):

1. **Dwie wejściówki:** „Wejściówka 7 dni” **14,99 zł** i „Wejściówka 30 dni” **29,00 zł** (ceny brutto, „cena brutto, zawiera 23% VAT”). 30 dni ma etykietę „Najlepsza wartość”, bez przekreśleń i bez obniżek (Omnibus nie dotyczy). Wybór jest na scenie filmu (obie ceny), na stronie oferty (dwie karty) i w kasie (dwa kafelki, domyślnie 30 dni). Ceny są stałe w kodzie (`PASS_PRODUCTS`), zmienne `PREMIUM_PASS_PRICE_MINOR` i `PREMIUM_PASS_DAYS` nie istnieją.
2. **Zablokowane filmy:** `jj` i `test-transkodowania`. To domyślna lista, gdy `PREMIUM_PASS_VIDEO_SLUGS` nie jest ustawiona (konfiguracja, nigdy zmiana `Video.tier`).
3. **Tryb na produkcji: `all`** (wszyscy widzą paywall). `off|testers|all` zostają.
4. **ADMIN też za bramką:** gdy eksperyment jest widoczny, bramka wejściówki działa także dla ADMIN na `www` (właściciel widzi paywall na swoim koncie); Studio i panel `admin.pawelperfect.com` bez zmian (panel ma własny `admin.env`, Studio nie odtwarza filmów). **Panel demo** („Wygaś / Usuń moją wejściówkę”) ma każdy zalogowany widz, dla którego eksperyment jest widoczny, i działa wyłącznie na jego własnym wierszu.
5. **Sprzedawca w kasie i potwierdzeniu:** „Sprzedawca: POLUTEK Sp. z o.o. (dane demo)”; ceny „cena brutto, zawiera 23% VAT”.
6. **Adres strony oferty: `/premium`** (`/en/premium`, `/<lang>/premium`), regulamin demo: `/regulamin-premium`, `/en/premium-terms`. Powód: `matcher` w `middleware.ts` pomija **każdą ścieżkę zawierającą „js”** (zgubiony `\` w `"\.(?:…|js(?!on)|…)"`), więc `/wejsciowka` omijałaby proxy (bez przepisania na `/pl`, bez bramki i CSP). Błąd matchera jest osobnym zadaniem, poza eksperymentem.
7. **Test na Postgresie** leży w `tests/postgres/premium-pass-ledgers.pg.test.ts` (tam są testy `*.pg.test.ts` w tym repo).
8. **Chip „Premium · ważna do …”** pokazuje się przez kilka sekund w rogu odtwarzacza (montuje go `PremiumWrapper`), bo `Hero.tsx` jest przy budżecie; `Hero` dostał tylko jedną linię (`premiumPass={video.premiumPass}`), żeby gość z linkiem do filmu `LOGGED_IN` zobaczył ofertę zamiast ściany logowania.

Eksperyment pokazuje, jak wyglądałaby na `www.pawelperfect.com` profesjonalna sprzedaż **wejściówki** do tajnych materiałów premium. **Nigdy nie pobiera pieniędzy**: płatność jest symulowana na serwerze i nie ma w niej formularza karty ani połączenia z płatnościami. Całość działa za jednym przełącznikiem, wchodzi jednym commitem (squash) i znika jednym poleceniem (§17).

---

## 0. Najważniejsze w pięciu punktach

1. **Produkt:** dwie jednorazowe wejściówki, **bez subskrypcji i bez odnawiania**: 7 dni za 14,99 zł i 30 dni za 29,00 zł brutto. Otwierają wszystkie filmy oznaczone jako Premium na swój czas od zakupu.
2. **Pieniądze:** produkcyjny klucz Stripe jest w trybie **live** (sprawdzony prefiks 2026-10-20), więc eksperyment **w ogóle nie dotyka Stripe**: brak `loadStripe`, brak intentów, brak pól karty. „Płatność” to przycisk symulacji na serwerze (`provider = DEMO`). Na każdym ekranie zakupu jest stały pas „TRYB DEMO: nic nie zostanie pobrane”.
3. **Baza:** **zero migracji**. Filmy Premium to lista slugów w zmiennej środowiskowej (kolumna `Video.tier` się nie zmienia), a wejściówka demo to wiersz w istniejącej tabeli `AppSetting` (klucz `xp.premium_pass:<userId>`).
4. **Kto widzi:** przełącznik `PREMIUM_PASS_EXPERIMENT=off|testers|all` w `app.env` (czytany w trakcie działania, bez przebudowy). Decyzja właściciela: produkcja w `all` (wszyscy, także ADMIN na `www`); `testers` zostaje do testów na wskazanych kontach.
5. **Wycofanie:** `bash scripts/experiments/premium-pass-revert.sh` (pełne: revert commita + wdrożenie + sprzątanie) albo `bash scripts/experiments/premium-pass-revert.sh --flag-only` (wyłączenie w kilka sekund, bez wdrożenia).

---

## 1. Ograniczenia i to, co już jest w repo

**Twarde ograniczenia (od właściciela):** żadnych prawdziwych pieniędzy, żadnych danych kart, żadnych kluczy live; strona zostaje `noindex`; wszystko za jednym przełącznikiem i jednym squashem; preferowane zero zmian w bazie; słaby komputer właściciela (bez pełnego zestawu testów lokalnie, tylko testy celowane).

**Co już istnieje i jak to wykorzystujemy** (sprawdzone w kodzie `origin/main` 827545a8):

| Element | Stan dziś | Co robi eksperyment |
|---|---|---|
| Wyłącznik `sales` (`lib/platform-gates.ts`) | `off` na produkcji (zmienna nieustawiona) | **Nie rusza go.** Eksperyment nie jest sprzedażą i nie korzysta z `lib/modules/sales` (`setVideoPrice`, `recordOrderPaid` odmawiają przy `sales=off`, i dobrze). |
| `channelCreation` | `invite` | bez zmian |
| `AccessTier.PAID` + `Entitlement` + `Order` + `LedgerEntry` (etap 6) | w schemacie; `checkVideoAccess` ma gałąź `PAID` → `PAYMENT_REQUIRED` | **Nie używamy.** `Order`/`LedgerEntry` to księgi pieniędzy (udział twórcy, VAT); zapis tam z demo zanieczyściłby księgi. `Entitlement` jest per film i wymaga `Order`. Wejściówka (dostęp do wielu filmów na czas) to inny kształt. |
| Powód `PAYMENT_REQUIRED` | jest w `access-reason.ts`, ale `PlaybackService.toStatus()` mapuje go na `ERROR` | dodajemy osobny powód i stan planu `PASS_REQUIRED` (nie mieszamy z przyszłą prawdziwą sprzedażą per film) |
| `PremiumWrapper.tsx` + `AccessLockOverlay.tsx` | blokady tylko `LOGIN_REQUIRED` i `COMING_SOON` | jedna nowa gałąź w `PremiumWrapper` montuje nowy komponent `PremiumPassOverlay` (osobny plik) |
| `CheckoutForm.tsx` (Stripe `PaymentElement`) | martwy kod (nikt go nie importuje) | **nie używamy** (to prawdziwe pola płatności) |
| Okno napiwku `SupportModal` + `app/components/support/*` | jedyna droga płatności (§4.10) | bez zmian; od niego bierzemy tylko język wizualny (karty 16 px, ramka 2 px w kolorze atramentu, kanarkowy akcent) |
| Stripe | klucz **live**, webhook, `fulfillPayment()` tylko dla napiwków | **bez żadnej zmiany i bez żadnego wywołania** |
| Telemetria (`/api/t`) | zamknięty kontrakt bez zdarzeń własnych | bez zmian kontraktu (§13) |
| Wcześniejsze badanie | `docs/audit/2026-10-12/architektura-platnego-dostepu.md` | zgodnie z nim: osobna nazwa pojęcia, brak `PatronGrant` w dostępie, osobny stan planu, „flaga tylko dla konta właściciela” |

**Filmy na produkcji (odczyt 2026-10-20):** `czesc-all-star` (Hero, PUBLIC), `test-transkodowania` („Film testowy 4”, PUBLIC, 60 s), `dla-patronow` („Tajny Projekt”, premiera 2026-12-31), `jj` („Zbieram hajs na mój Tajny Projekt”, LOGGED_IN, 45 s); `czesc` jest szkicem.

---

## 2. Decyzje produktowe

| Decyzja | Wybór w planie | Dlaczego |
|---|---|---|
| Rodzaj | **jednorazowa wejściówka na czas**, nie subskrypcja | Model TVOD „wypożyczenie na czas” (Vimeo OTT: rental = dostęp na określony czas, purchase = na zawsze) jest najprostszy prawnie i najczytelniejszy dla widza; brak odnowień = brak problemu z anulowaniem subskrypcji. „Bez subskrypcji. Nie odnawia się.” to silny sygnał zaufania. |
| Czas | **30 dni** od chwili zakupu | wystarczy na cały materiał i powroty; w wariancie B (pytanie do właściciela) druga karta „7 dni, 14,99 zł” |
| Cena | **29,00 zł brutto**, bez przekreśleń i promocji | brak obniżki = brak obowiązku Omnibus „najniższa cena z 30 dni” (art. 4 ustawy o informowaniu o cenach); jedna uczciwa cena |
| Waluta | PLN; dla interfejsu w innych językach ta sama cena, sformatowana lokalnie (`Intl.NumberFormat`) | demo; prawdziwa sprzedaż i tak wymaga decyzji o walutach |
| Co jest zablokowane | filmy z listy `PREMIUM_PASS_VIDEO_SLUGS`; domyślnie **`jj` i `test-transkodowania`** | jedyne opublikowane filmy, które nie są Hero ani premierą; Hero (`czesc-all-star`) zostaje darmowy (to wizytówka i zwiastun), premiera `dla-patronow` zostaje kokpitem premiery |
| Co widać bez wejściówki | tytuł, opis, miniatura (z rozmyciem w kafelku), czas trwania, rozdziały **nie** (jak dziś: tylko plan READY), komentarze **do czytania** | wzorzec „pokaż wartość przed bramką” (zablokowane w miejscu, gdzie byłaby treść, krótkie wyjaśnienie, jedno CTA) |
| Konto | zakup **wymaga konta**; gość widzi ofertę i „Zaloguj się, aby kupić” | wejściówka musi być przypięta do konta (dostęp z wielu urządzeń); konto jest darmowe i już mamy Google One Tap + klucze dostępu |
| Personel | ADMIN na `www` dalej widzi wszystko (obejście `canPreview` zostaje), z chipem „Premium · podgląd personelu” | nie ruszamy niezmiennika §4.4; właściciel testuje zakup na **drugim, zwykłym koncie** |

---

## 3. Przełącznik i konfiguracja (jedno miejsce)

Nowy czysty moduł `lib/modules/experiment-premium-pass/domain/config.ts`:

| Zmienna (`app.env`, czytana w trakcie działania) | Wartości | Domyślnie |
|---|---|---|
| `PREMIUM_PASS_EXPERIMENT` | `off` \| `testers` \| `all`; każda inna wartość = `off` | `off` |
| `PREMIUM_PASS_TESTER_IDS` | lista `User.id` po przecinku (tylko dla `testers`) | pusta |
| `PREMIUM_PASS_VIDEO_SLUGS` | lista slugów filmów Premium | pusta (= nic nie jest Premium) |
| `PREMIUM_PASS_PRICE_MINOR`, `PREMIUM_PASS_DAYS` | liczby całkowite, walidowane (100..100000, 1..365) | `2900`, `30` |

Zasady:
- Funkcja `premiumPassFor(actor, env)` zwraca `null` (eksperyment niewidoczny dla tego widza) albo konfigurację. Każde miejsce w kodzie pyta **tylko ją**. `off` = kod zachowuje się bit w bit jak dziś (test strażnik porównuje decyzje `checkVideoAccess` dla `off` i bez zmiennych).
- Slug, który wskazuje film Hero (`isMainFeatured`), nadchodzącą premierę albo film nie-`PUBLISHED`/`UNLISTED`, jest ignorowany (log ostrzegawczy raz na proces).
- Brak `NEXT_PUBLIC_*`: przeglądarka dostaje stan wyłącznie z odpowiedzi serwera (plan, DTO, `/api/user/premium-pass`), więc przełączenie to edycja `app.env` + `docker compose up -d --no-deps app` (kilka sekund), bez przebudowy obrazu (tak jak `TELEMETRY_BEACON`).
- Wpis do `CLAUDE.md` §0 („rejestr tymczasowych flag”) w tym samym commicie: nazwa flagi, cel, polecenie wycofania. Revert usuwa wpis razem z kodem.

---

## 4. Jak niemożliwe jest pobranie pieniędzy

Warstwy (każda z osobna wystarcza):
1. **Brak kodu płatności.** Moduł eksperymentu i jego komponenty nie importują `stripe`, `@stripe/*`, `lib/modules/payments`, `lib/modules/sales`, `getStripeClient`, `getStripeBrowser`. Test źródeł (`tests/unit/experiments/premium-pass-no-money.test.ts`) czyta wszystkie pliki eksperymentu i pada przy takim imporcie albo przy słowach `PaymentElement`, `confirmPayment`, `paymentIntents`, `checkout.sessions`.
2. **Brak pól wrażliwych.** Ekran płatności nie ma żadnego `<input>` na numer karty, datę, CVC, kod BLIK, login banku. Metody płatności to wyłącznie kafelki wyboru (radio). Test komponentu sprawdza brak `autocomplete="cc-*"` i brak pól liczbowych w kroku płatności.
3. **Serwer nie zna innego dostawcy.** `POST /api/user/premium-pass/checkout` przyjmuje `simulate: "success" | "declined"` i zapisuje tylko wiersz `AppSetting` z `provider: "DEMO"`. Nie ma parametru, który przełącza na prawdziwą płatność.
4. **Etykiety.** Stały pas „TRYB DEMO: płatność symulowana, nic nie zostanie pobrane” na ofercie, w kasie i na potwierdzeniu (nie da się go wyłączyć konfiguracją); numer zamówienia ma prefiks `DEMO-`; przycisk kasy ma podpis „Demo: bez obciążenia”.
5. **Brak maili.** Eksperyment nie wysyła żadnego e-maila (potwierdzenie „na trwałym nośniku” jest tylko pokazane jako makieta na ekranie sukcesu, §8.4).
6. **Nic w księgach.** Brak zapisów w `Payment`, `PatronGrant`, `Order`, `Entitlement`, `LedgerEntry`, `UserPaymentTotal`; panel „Przychody” i pasek zbiórki niczego nie widzą. Test integracyjny na Postgresie liczy wiersze tych tabel przed i po symulowanym zakupie (muszą być równe).

Dlaczego nie tryb testowy Stripe: produkcja ma klucz live; dołożenie drugiej pary kluczy testowych na produkcji to nowy sekret, nowa ścieżka webhooka i ryzyko pomyłki trybów (audyt PA-07/PAY-38). Regulamin Stripe zakazuje też testów w trybie live prawdziwymi kartami. Symulacja daje ten sam wygląd bez żadnego z tych ryzyk. Integracja ze Stripe Checkout Sessions + Payment Element (zalecana przez Stripe) to temat prawdziwej sprzedaży, po decyzjach prawnych.

---

## 5. Model danych (bez migracji)

**Filmy Premium:** lista slugów w `PREMIUM_PASS_VIDEO_SLUGS`. Kolumna `Video.tier` się **nie zmienia** (film `jj` zostaje `LOGGED_IN`, `test-transkodowania` `PUBLIC`), więc wyłączenie flagi natychmiast przywraca stary dostęp bez żadnej zmiany danych.

**Wejściówka demo:** jeden wiersz `AppSetting` na konto:

```
key   = "xp.premium_pass:<User.id>"
value = {"v":1,"product":"PASS_30D","provider":"DEMO","ref":"DEMO-7Q4K-2M9X",
         "priceMinor":2900,"currency":"PLN","method":"blik",
         "grantedAt":"2026-10-21T10:00:00.000Z","expiresAt":"2026-11-20T10:00:00.000Z",
         "consents":{"termsVersion":"demo-2026-10","waiverAt":"2026-10-21T10:00:00.000Z"}}
```

- Zapis i odczyt wyłącznie przez `lib/modules/experiment-premium-pass/infrastructure/pass-store.ts` (zod przy odczycie; zły JSON = brak wejściówki, nigdy wyjątek).
- Wiersz trzyma tylko id konta (bez e-maila i imienia). `AppSetting` nie jest nigdzie wyliczany listą (sprawdzone: jedyne `deleteMany` jest po konkretnym kluczu), więc nic go nie pokaże w panelu.
- Jedna wejściówka na konto: kolejny „zakup” przy aktywnej wejściówce zwraca 409 `PASS_ALREADY_ACTIVE` (UI pokazuje „Masz już wejściówkę do …”); po wygaśnięciu nowy zakup nadpisuje wiersz.
- Usunięcie konta zostawia osierocony wiersz (bez danych osobowych poza id); sprząta go polecenie wycofania (§17). Eksport danych konta go nie obejmuje (demo; zanotowane w otwartych pytaniach).

Odrzucona alternatywa: nowa tabela `ExperimentPremiumPass` z migracją addytywną. Lepsza „na papierze”, ale revert commita zostawia tabelę i wpis w `_prisma_migrations`, czyli wycofanie nie byłoby pełne bez ręcznej operacji na bazie.

---

## 6. Decyzja dostępu i plan odtwarzania

### 6.1 `checkVideoAccess` (`lib/modules/access/application/check-video-access.use-case.ts`)

Wstawka po sprawdzeniu `canPreview` (personel i członkowie kanału przechodzą jak dziś) i po bramce 18+, **przed** gałęzią `PAID` i poziomami:

```ts
const pass = premiumPassFor(actor, env);                    // null = experiment invisible to this viewer
if (pass && pass.isPremiumSlug(video.slug)) {
  const active = actor.type === "user" ? await pass.hasActivePass(ctx, actor.userId, now) : false;
  if (!active) return decide({ hasAccess: false, reason: "PASS_REQUIRED", premiumPass: true });
}
```

- Gość dostaje `PASS_REQUIRED` (nie `LOGIN_REQUIRED`): widzi ofertę, a CTA prowadzi przez logowanie.
- Zalogowany z aktywną wejściówką idzie dalej zwykłą ścieżką poziomów (np. zablokowane konto nadal nie obejrzy).
- Bramka premiery w `PlaybackService` zostaje **przed** decyzją o planie (premiera wygrywa z Premium).
- `AccessDecisionDto` dostaje opcjonalne `premiumPass?: true`; `AccessDecisionReason` dostaje `"PASS_REQUIRED"`.

### 6.2 `PlaybackService` i `PlaybackPlan`

- `PlaybackPlanStatus` += `"PASS_REQUIRED"`; `toStatus()` mapuje `PASS_REQUIRED` → `PASS_REQUIRED`. Plan odmowy jak każdy inny: **bez źródła, tokenu, sesji, rozdziałów, napisów** (§4.3). Zostaje poster (publiczna miniatura) i tytuł.
- Plan odmowy niesie `access.offer` (tylko w planie `PASS_REQUIRED`): `{ product: "PASS_30D", priceMinor, currency, days, signedIn: boolean, demo: true }`. To dane oferty, nie dane dostępu.
- `playback-plan-state.ts`: `PASS_REQUIRED` w `SAFE_PLAYBACK_STATES` i `BLOCKED_PLAYBACK_STATES`, plus komunikat zapasowy (§10).
- Cache planów w pamięci przeglądarki: po udanym zakupie klient wywołuje istniejące odświeżenie planu (`refreshPlaybackPlan`) i czyści wpis planu tego filmu; `/api/media-source` zostaje `no-store`.

### 6.3 Inne miejsca, które czytają dostęp (przechodzą przez `checkVideoAccess`, więc są bezpieczne same z siebie)

| Miejsce | Zachowanie w eksperymencie |
|---|---|
| Komentarze: `list-video-comments` | `PASS_REQUIRED` dopisany do `isPubliclyReadableReason` (czytać mogą wszyscy, jak przy `LOGIN_REQUIRED`; to dowód społeczny). Pisanie i reakcje: odmowa jak dziś przy braku dostępu, UI pokazuje „Kup wejściówkę, aby komentować”. |
| `record-playback-event`, `video-progress`, `/api/access` | odmowa automatyczna (brak dostępu) |
| `/embed/<slug>` + oEmbed (`decideEmbed`) | film Premium (gdy flaga widoczna dla anonimowego widza, czyli `all`) traktowany jak nie-PUBLIC: karta „Obejrzyj na stronie”, oEmbed 404. Jedna linia w `decideEmbed`. |
| JSON-LD `hasPart`/`Clip` rozdziałów | pomijane dla filmu Premium (rozdziały i tak są tylko w planie READY) |
| Wyszukiwarka, RSS | bez zmian (tytuł i miniatura to zwiastun); opis w wynikach zostaje, bo to treść publiczna |
| Pasek boczny (`ChannelLayoutService`) | element dostaje `premium: true` i `isLocked = !hasActivePass` dla widza, dla którego eksperyment jest widoczny; odpowiedź jest już `force-dynamic` per widz |
| Półka „Kontynuuj oglądanie” | film Premium bez aktywnej wejściówki jest pomijany (jak płatne) |
| Hero | nigdy Premium (§3) |

---

## 7. Przepływy użytkownika

```
                       ┌──────────── film Premium (?v=jj) ─────────────┐
                       │                                                │
            gość ──────┤  PASS_REQUIRED (signedIn=false)                │
                       │  Overlay: zwiastun + oferta + „Zaloguj się     │
                       │  i kup wejściówkę” → okno logowania →          │
                       │  po zalogowaniu wraca na ten sam film,         │
                       │  oferta otwiera się sama (?pass=checkout)      │
                       │                                                │
  zalogowany bez ──────┤  PASS_REQUIRED (signedIn=true)                 │
  wejściówki           │  „Kup wejściówkę 29 zł” → Kasa (arkusz):       │
                       │   1. Podsumowanie + zgody                      │
                       │   2. Metoda (BLIK / Karta / Apple Pay /        │
                       │      Google Pay / Przelewy24) – tylko wybór    │
                       │   3. „Zamawiam i płacę 29,00 zł” (demo)        │
                       │   → przetwarzanie (1,2 s) → Sukces/odmowa      │
                       │   → „Oglądaj teraz” → plan READY, odtwarzacz   │
                       │                                                │
  z wejściówką ────────┤  READY jak każdy film + chip „Premium ·        │
                       │  ważna do 20.11” pod tytułem                   │
                       │                                                │
  wygasła ─────────────┤  PASS_REQUIRED + baner „Twoja wejściówka       │
                       │  wygasła 20.11. Kup nową” (ta sama kasa)       │
                       └────────────────────────────────────────────────┘
```

Szczegóły:
- **Gość:** po kliknięciu CTA otwiera się istniejące okno logowania (`useAuthModal().open("sign-in")`) z dopiskiem „Konto jest darmowe. Po zalogowaniu wrócisz do zakupu”. Powrót: parametr `pass=checkout` w adresie (dopisany przed otwarciem okna, czytany raz i usuwany jak `?t=`).
- **Odmowa demo** („Symuluj odrzuconą płatność”): ekran „Płatność nie przeszła. Nic nie zostało pobrane” + „Spróbuj ponownie” / „Wybierz inną metodę”. Nic się nie zapisuje.
- **Podwójne kliknięcie / dwie karty:** serwer jest idempotentny po `requestId` z klienta (UUID w pamięci strony); drugi zakup przy aktywnej wejściówce = 409 i ekran „Masz już wejściówkę”.
- **Wygaśnięcie:** liczone przy każdym odczycie (`expiresAt <= now`), bez crona.
- **Panel demo** (tylko w trybie `testers`, tylko dla testerów): mały przycisk „Demo” w rogu strony z akcjami „Wygaś moją wejściówkę teraz”, „Usuń moją wejściówkę”. Pozwala właścicielowi obejrzeć wszystkie stany bez czekania 30 dni. Trasy `POST /api/user/premium-pass/demo` (`action: "expire" | "reset"`).

---

## 8. Ekrany (opis wizualny, teksty PL/EN, stany)

Język wizualny: jasna strona jak dziś (`--chan-*`), a „strefa Premium” to **ciemna scena** (odtwarzacz i tak jest czarny) z ciepłym złotem z kanarkowego `--chan-amber` i atramentowymi ramkami z okna napiwku. Jeden kolor akcji: złoto na ciemnym, atrament na jasnym. Zaokrąglenia jak w oknie napiwku (16 px karty, 12-14 px przyciski), cień miękki, cyfry ceny w Geist z `font-variant-numeric: tabular-nums`. Ruch: wejście 220 ms `--ease-enter`, wszystko wyłączone przy `prefers-reduced-motion`. Ikony: kłódka, bilet, tarcza (bezpieczeństwo), zegar (czas ważności), z istniejącego zestawu `app/components/icons` (dopisanie brakujących to część zadania).

### 8.1 Zablokowany film (strona główna `?v=<slug>`, w miejscu odtwarzacza)

```
Komputer (obszar odtwarzacza 16:9)                         Telefon 375 px
┌─────────────────────────────────────────────────────┐   ┌───────────────────────┐
│ [poster rozmyty 24px + przyciemnienie 70%]          │   │ [poster rozmyty]      │
│  ┌ PREMIUM ┐                         TRYB DEMO      │   │ ┌PREMIUM┐   TRYB DEMO │
│                                                     │   │      🔒               │
│        🔒  Materiał za kulisami                     │   │ Materiał za kulisami  │
│        Zbieram hajs na mój Tajny Projekt · 0:45     │   │ 0:45 · w wejściówce   │
│                                                     │   │ ┌───────────────────┐ │
│   ┌───────────────────────────────────────────┐     │   │ │Kup wejściówkę     │ │
│   │ Wejściówka 30 dni            29,00 zł     │     │   │ │29,00 zł           │ │
│   │ ✓ 2 filmy premium  ✓ bez subskrypcji      │     │   │ └───────────────────┘ │
│   │ [ Kup wejściówkę · 29 zł ]  Co jest w środku│   │ Bez subskrypcji ·     │
│   └───────────────────────────────────────────┘     │   │ Co jest w środku →    │
└─────────────────────────────────────────────────────┘   └───────────────────────┘
```

- Tytuł sceny: „Materiał za kulisami” / „Behind the scenes”. Podtytuł: tytuł filmu · czas.
- Karta oferty (desktop) albo sam przycisk + jedna linia (telefon, bo wysokość 16:9 przy 375 px to ok. 211 px).
- CTA zalogowanego: „Kup wejściówkę · 29 zł” / „Get the pass · PLN 29”. CTA gościa: „Zaloguj się i kup wejściówkę” / „Sign in to get the pass”.
- Link „Co jest w środku?” / „What's inside?” prowadzi do strony wejściówki (§8.2).
- Stan wygasły: nad kartą pasek „Twoja wejściówka wygasła 20.11.2026” / „Your pass expired on 20 Nov 2026”, CTA „Kup nową wejściówkę” / „Get a new pass”.
- Pod odtwarzaczem (opis filmu) chip „Premium” z kłódką; z aktywną wejściówką chip „Premium · ważna do 20.11” / „Premium · valid until 20 Nov”.
- Dostępność: scena to `<section aria-labelledby>`, CTA to prawdziwy `<button>`, kontrast złota na tle ≥ 4,5:1 (złoto `#fbbf24` na `#0b0f1a` ≈ 11:1), rozmycie posteru jest dekoracją (`aria-hidden`).

### 8.2 Strona wejściówki `/wejsciowka` (`/en/pass`, języki UI `/<lang>/pass`)

Strona oferty (pricing). `noindex` jak cała beta, w `isPublicRoute` i `shouldRewriteForPolish`; gdy eksperyment niewidoczny dla widza, odpowiada 404.

```
┌──────────────────────────── ciemny pas hero ─────────────────────────────┐
│  TRYB DEMO · płatność symulowana                                          │
│  Wejściówka za kulisy                                                     │
│  Materiały, których nie ma nigdzie indziej. Jedna opłata, 30 dni,         │
│  bez subskrypcji.                                                         │
│  [ kafelki 2 filmów: rozmyte miniatury, kłódka, czas ]                    │
└───────────────────────────────────────────────────────────────────────────┘
┌──────── karta ceny (wyśrodkowana, max 440 px) ────────┐  ┌── FAQ ─────────┐
│  WEJŚCIÓWKA 30 DNI                                    │  │ Czy to się      │
│  29,00 zł   jednorazowo                               │  │ odnawia? Nie.   │
│  cena brutto, zawiera VAT                             │  │ Na ilu urządze- │
│  ✓ wszystkie filmy Premium (2)                        │  │ niach? ...      │
│  ✓ dostęp od razu po zakupie, 30 dni                  │  │ Odstąpienie?    │
│  ✓ nie odnawia się, bez subskrypcji                   │  │ ...             │
│  ✓ na każdym urządzeniu po zalogowaniu                │  └─────────────────┘
│  [ Kup wejściówkę ]                                   │
│  BLIK · Karta · Apple Pay · Google Pay · Przelewy24   │
│  🛡 Płatność obsługuje operator (w demo: symulacja)    │
└───────────────────────────────────────────────────────┘
```

- Teksty: „Wejściówka za kulisy” / „Backstage pass”; „Jedna opłata, 30 dni, bez subskrypcji.” / „One payment, 30 days, no subscription.”; „cena brutto, zawiera VAT” / „price includes VAT” (do potwierdzenia, §19).
- FAQ (akordeon `<details>`): odnawianie (nie), urządzenia (każde po zalogowaniu), od kiedy liczy się czas (od zakupu), odstąpienie (§9), co gdy film zniknie, kontakt `support@pawelperfect.com`.
- Wariant B (pytanie do właściciela): dwie karty obok siebie, „7 dni · 14,99 zł” i „30 dni · 29 zł · Najczęściej wybierana”.
- Telefon: karta ceny na całą szerokość (16 px marginesu), CTA przyklejony u dołu ekranu (`position: sticky`, z `scroll-margin` tak, by fokus nie był zasłonięty, WCAG 2.4.11).

### 8.3 Kasa (arkusz: modal na komputerze, pełny ekran od dołu na telefonie)

Jeden ekran z trzema sekcjami (bez kroków „Dalej”, bo kupujemy jedną rzecz): Baymard pokazuje, że ukryte koszty i niewidoczna łączna kwota to główne przyczyny porzucenia, więc **łączna kwota jest widoczna cały czas**, a przycisk powtarza kwotę.

```
┌──────────────────────── Kasa ─────────────────────── ✕ ┐
│ TRYB DEMO · nic nie zostanie pobrane                   │
│ ┌ Twoje zamówienie ──────────────────────────────────┐ │
│ │ 🎟 Wejściówka 30 dni · Premium        29,00 zł     │ │
│ │ ważna do 20.11.2026, nie odnawia się               │ │
│ │ Razem do zapłaty (brutto)             29,00 zł     │ │
│ └────────────────────────────────────────────────────┘ │
│ Konto: pa•••@gmail.com  (potwierdzenie trafi tutaj)    │
│                                                        │
│ Metoda płatności                                       │
│ ◉ BLIK      ○ Karta     ○ Apple Pay                    │
│ ○ Google Pay            ○ Przelewy24                   │
│ (demo: bez pól do wpisania – wybór wystarczy)          │
│                                                        │
│ ☐ Akceptuję Regulamin wejściówki i Politykę prywatn.   │
│ ☐ Chcę dostępu od razu i wiem, że po rozpoczęciu       │
│   oglądania tracę prawo odstąpienia od umowy           │
│                                                        │
│ [   Zamawiam i płacę 29,00 zł   ]                      │
│     Demo: bez obciążenia                               │
│ Symuluj odrzuconą płatność                             │
│ 🛡 Bezpieczna płatność · Sprzedawca: … (§19)           │
└────────────────────────────────────────────────────────┘
```

- Metody (kolejność dla Polski): BLIK (ok. 65% płatności e-commerce w PL według Stripe), Karta, Apple Pay (tylko gdy przeglądarka to zgłasza: `window.ApplePaySession`), Google Pay (tylko Chrome/Android), Przelewy24. Kafelki to `role="radiogroup"` z prawdziwymi `<input type="radio">`; strzałki przełączają. W demo żadna metoda nie otwiera pól.
- Zgody to dwa osobne, **niezaznaczone** pola (aktywna zgoda). Przycisk jest aktywny zawsze; kliknięcie bez zgód przewija do pierwszego brakującego pola i pokazuje błąd tekstem przy polu (`aria-invalid`, `aria-describedby`, WCAG 3.3.1), zamiast nieaktywnego przycisku bez wyjaśnienia.
- Przycisk: „Zamawiam i płacę 29,00 zł” / „Order and pay PLN 29.00” (sformułowanie równoważne „zamówienie z obowiązkiem zapłaty”, art. 17 ust. 3 u.p.k.; samo „Zamawiam” nie wystarcza). Pod nim drobny podpis „Demo: bez obciążenia” / „Demo: no charge”.
- Przetwarzanie: przycisk zamienia się w pasek „Łączę z operatorem płatności (demo)…” z animacją 1,2 s, arkusz nie daje się zamknąć w tym czasie (`aria-busy`, komunikat w `aria-live="polite"`).
- Telefon: arkusz od dołu na pełną wysokość, przycisk przyklejony u dołu nad paskiem bezpieczeństwa iOS (`env(safe-area-inset-bottom)`), sekcja zamówienia zwijana do jednej linii „Wejściówka 30 dni · 29,00 zł ▾”.
- Fokus: przy otwarciu na nagłówku, pułapka fokusu w arkuszu, `Esc` zamyka (poza przetwarzaniem), po zamknięciu fokus wraca na CTA.

### 8.4 Sukces i potwierdzenie

```
┌──────────────────────────────────────────────┐
│ TRYB DEMO                                    │
│        ✓ (animowany znak, 360 ms)            │
│   Wejściówka aktywna                         │
│   Masz dostęp do 20.11.2026, 10:00           │
│   [  ▶ Oglądaj teraz  ]                      │
│ ┌ Potwierdzenie ────────────────────────────┐│
│ │ Nr zamówienia   DEMO-7Q4K-2M9X            ││
│ │ Produkt         Wejściówka 30 dni         ││
│ │ Kwota           29,00 zł (demo, 0 zł)     ││
│ │ Metoda          BLIK (symulacja)          ││
│ │ Zgoda na natychmiastowy dostęp: 21.10 …   ││
│ └───────────────────────────────────────────┘│
│ W prawdziwej sprzedaży to potwierdzenie      │
│ przyszłoby e-mailem (trwały nośnik).         │
└──────────────────────────────────────────────┘
```

- „Oglądaj teraz” / „Watch now” odświeża plan bieżącego filmu (READY) i zamyka arkusz; odtwarzacz rusza z dźwiękiem w tym samym geście (jak przy bramie, gest użytkownika pozwala na dźwięk).
- Potwierdzenie zawiera to, czego wymaga art. 21 u.p.k. w prawdziwej sprzedaży (dane umowy i informacja o zgodzie na dostarczenie treści cyfrowych z utratą prawa odstąpienia); w demo pokazujemy je na ekranie i w „Moje konto → Wejściówka”.
- Stan odmowy: ikona ostrzeżenia, „Płatność nie przeszła. Nic nie zostało pobrane.” / „The payment did not go through. Nothing was charged.”, przyciski „Spróbuj ponownie” i „Zmień metodę”.

### 8.5 Kafelki i pasek boczny

- Miniatura filmu Premium bez wejściówki: rozmycie 8 px + przyciemnienie, złota plakietka „PREMIUM” z kłódką w lewym górnym rogu (zamiast obecnej grafiki „Zaloguj się”), czas trwania zostaje widoczny. Z wejściówką: ostra miniatura, plakietka „PREMIUM” bez kłódki.
- `ChannelVideoCard` (147 linii) i `SidebarPlaylist` (369/470) dostają tę plakietkę przez nowy mały komponent `PremiumBadge`.

### 8.6 „Moje konto → Wejściówka”

Sekcja w istniejącym oknie konta: stan (brak / aktywna do … / wygasła …), numer `DEMO-…`, data zgody, przycisk „Kup wejściówkę” albo „Przejdź do filmów Premium”. Bez przycisku „Anuluj subskrypcję” (nie ma subskrypcji), z linią „Wejściówka nie odnawia się”.

### 8.7 Pas „TRYB DEMO”

Wspólny komponent `DemoRibbon`: pasek 28 px, ukośne paski w `--cm-amber-*`, tekst atramentem „TRYB DEMO · płatność symulowana · nic nie zostanie pobrane” / „DEMO MODE · simulated payment · nothing will be charged”, `role="note"`. Na ciemnej scenie wariant złoty na czarnym.

---

## 9. Elementy prawne widoczne w przepływie

To są **makiety elementów**, które prawdziwa sprzedaż musi mieć; ich treść zatwierdza prawnik i księgowy (§19). W demo są widoczne, żeby właściciel ocenił wygląd i miejsce.

| Wymóg | Gdzie w przepływie | Źródło |
|---|---|---|
| Cena łączna z podatkami przed zamówieniem; cena podana konsumentowi to cena brutto (domniemanie VAT) | karta ceny, podsumowanie w kasie, przycisk | art. 12 ust. 1 u.p.k.; art. 3 ust. 3 ustawy o informowaniu o cenach |
| Przycisk „zamówienie z obowiązkiem zapłaty” lub równoważny | przycisk kasy „Zamawiam i płacę 29,00 zł” | art. 17 ust. 3 u.p.k. (brak = umowa nie zostaje zawarta) |
| Utrata prawa odstąpienia przy treści cyfrowej: wyraźna zgoda na rozpoczęcie przed upływem 14 dni i poinformowanie o utracie prawa | drugie pole wyboru w kasie (niezaznaczone), FAQ, potwierdzenie | art. 38 pkt 13 u.p.k. |
| Potwierdzenie umowy na trwałym nośniku, z informacją o udzielonej zgodzie | ekran sukcesu (w demo), w prawdziwej sprzedaży e-mail | art. 21 u.p.k. |
| Akceptacja regulaminu i polityki prywatności | pierwsze pole wyboru, linki otwierają się w oknie (bez opuszczania kasy) | art. 8 ustawy o świadczeniu usług drogą elektroniczną |
| Omnibus (najniższa cena z 30 dni) | **nie dotyczy**, bo nie pokazujemy obniżek; test pilnuje braku przekreślonych cen | art. 4 ustawy o informowaniu o cenach |
| Dane sprzedawcy | stopka kasy „Sprzedawca: …” | art. 12 ust. 1 pkt 2-3 u.p.k. |

W demo linki prawne prowadzą do nowej strony „Regulamin wejściówki (projekt, DEMO)” z jednym akapitem: to pokaz wyglądu, żadna umowa nie jest zawierana, nic nie jest pobierane, właściwy regulamin powstanie z prawnikiem. Obecne dokumenty prawne (`LegalDocs.tsx`, „Dostęp do treści nigdy nie wymaga płatności”) **nie są zmieniane** w eksperymencie; dlatego tryb `all` dla wszystkich widzów jest decyzją właściciela (§19).

---

## 10. Teksty (PL / EN)

Wszystkie przez `tx("…", "…")`; tłumaczenia sześciu języków UI w **osobnych plikach** `lib/i18n/catalog/premium-pass/<lang>.json`, które `loadCatalog()` dokleja do głównego katalogu (`{...base, ...premiumPass}`). Dzięki temu revert nie koliduje z późniejszymi zmianami w dużych plikach katalogów, a test parytetu działa bez zmian (czyta przez `loadCatalog`).

| Klucz miejsca | PL | EN |
|---|---|---|
| plakietka | PREMIUM | PREMIUM |
| scena: tytuł | Materiał za kulisami | Behind the scenes |
| scena: CTA zalogowany | Kup wejściówkę · {price} | Get the pass · {price} |
| scena: CTA gość | Zaloguj się i kup wejściówkę | Sign in to get the pass |
| scena: link | Co jest w środku? | What's inside? |
| scena: wygasła | Twoja wejściówka wygasła {date}. | Your pass expired on {date}. |
| oferta: nagłówek | Wejściówka za kulisy | Backstage pass |
| oferta: lead | Materiały, których nie ma nigdzie indziej. Jedna opłata, {days} dni, bez subskrypcji. | Material you won't find anywhere else. One payment, {days} days, no subscription. |
| oferta: cena | {price} jednorazowo | {price} one-time |
| oferta: VAT | cena brutto, zawiera VAT | price includes VAT |
| korzyść 1 | Wszystkie filmy Premium ({count}) | All Premium videos ({count}) |
| korzyść 2 | Dostęp od razu, przez {days} dni | Instant access for {days} days |
| korzyść 3 | Nie odnawia się, bez subskrypcji | Does not renew, no subscription |
| korzyść 4 | Na każdym urządzeniu po zalogowaniu | On every device you sign in on |
| kasa: tytuł | Kasa | Checkout |
| kasa: razem | Razem do zapłaty (brutto) | Total to pay (incl. VAT) |
| kasa: ważność | ważna do {date}, nie odnawia się | valid until {date}, does not renew |
| kasa: konto | Potwierdzenie trafi na {email} | The confirmation goes to {email} |
| kasa: metoda | Metoda płatności | Payment method |
| zgoda 1 | Akceptuję Regulamin wejściówki i Politykę prywatności. | I accept the Pass Terms and the Privacy Policy. |
| zgoda 2 | Chcę dostępu od razu. Wiem, że gdy zacznę oglądać, tracę prawo odstąpienia od umowy. | I want access right away. I understand that once I start watching, I lose my right to withdraw. |
| błąd zgody | Zaznacz to pole, aby kontynuować. | Tick this box to continue. |
| przycisk | Zamawiam i płacę {price} | Order and pay {price} |
| podpis demo | Demo: bez obciążenia | Demo: no charge |
| symulacja odmowy | Symuluj odrzuconą płatność | Simulate a declined payment |
| przetwarzanie | Łączę z operatorem płatności (demo)… | Contacting the payment provider (demo)… |
| sukces: tytuł | Wejściówka aktywna | Your pass is active |
| sukces: ważność | Masz dostęp do {date} | You have access until {date} |
| sukces: CTA | Oglądaj teraz | Watch now |
| odmowa | Płatność nie przeszła. Nic nie zostało pobrane. | The payment did not go through. Nothing was charged. |
| już masz | Masz już wejściówkę ważną do {date}. | You already have a pass valid until {date}. |
| pas demo | TRYB DEMO · płatność symulowana · nic nie zostanie pobrane | DEMO MODE · simulated payment · nothing will be charged |
| komentarze | Kup wejściówkę, aby komentować ten film. | Get the pass to comment on this video. |
| zapasowy komunikat planu | Ten film jest w wejściówce Premium. | This video is part of the Premium pass. |

Uwaga: `{price}`, `{date}`, `{days}`, `{count}`, `{email}` to placeholdery `tx` (test pilnuje tych samych placeholderów w PL i EN); e-mail w kasie jest maskowany (`pa•••@gmail.com`).

---

## 11. Tokeny projektu

Nowe tokeny tylko w zakresie komponentów eksperymentu (klasa `.pp-pass` na korzeniu sceny/kasy, plik `app/components/premium-pass/premium-pass.module.css`), wyprowadzone z `--chan-*`; nic nie zmienia się w `globals.css`:

```css
.pp-pass {
  --pass-stage:      #0b0f1a;                                   /* ciemna scena Premium */
  --pass-stage-2:    color-mix(in srgb, var(--chan-blue) 14%, #0b0f1a);
  --pass-gold:       var(--chan-amber-bright);                  /* #fbbf24 */
  --pass-gold-strong:var(--chan-amber);                         /* #f59e0b */
  --pass-gold-ink:   var(--chan-amber-ink);                     /* tekst na złocie */
  --pass-on-stage:   #f8fafc;
  --pass-on-stage-muted: color-mix(in srgb, #f8fafc 68%, transparent);
  --pass-line-stage: color-mix(in srgb, #f8fafc 14%, transparent);
  --pass-card:       var(--chan-card);
  --pass-line:       var(--chan-line);
  --pass-ink:        var(--chan-ink);
  --pass-ok:         #16a34a;
  --pass-radius-card: 16px;
  --pass-radius-btn:  14px;
  --pass-shadow: 0 24px 54px -28px rgba(15, 23, 42, 0.34);
}
```

Strona jest dziś tylko jasna (Tailwind `darkMode: "class"` nieużywany). Makieta pokazuje też wariant ciemny, żeby ocenić, jak scena Premium zachowa się, gdy kiedyś powstanie motyw ciemny; implementacja eksperymentu robi **tylko jasny motyw strony** (scena Premium i tak jest ciemna).

---

## 12. API (wszystko pod `/api/user/*`, więc z istniejącą ochroną CSRF z `middleware.ts`)

| Trasa | Kto | Co |
|---|---|---|
| `GET /api/user/premium-pass` | zalogowany, dla którego eksperyment jest widoczny (inaczej 404) | `{ offer, pass: { state: "none"|"active"|"expired", expiresAt?, ref? } }`, `Cache-Control: private, no-store` |
| `POST /api/user/premium-pass/checkout` | j.w. | zod `strict`: `{ requestId: uuid, method: "blik"|"card"|"apple_pay"|"google_pay"|"p24", consents: { terms: true, waiver: true }, simulate: "success"|"declined" }`. Brak zgód = 400 `CONSENT_REQUIRED`. Aktywna wejściówka = 409 `PASS_ALREADY_ACTIVE`. `success` zapisuje wiersz `AppSetting` i zwraca `{ ref, expiresAt }`; `declined` nic nie zapisuje i zwraca 402 `DEMO_DECLINED`. Limit 10/min na konto (`lib/rate-limit.ts`). Ten sam `requestId` dwa razy = ta sama odpowiedź. |
| `POST /api/user/premium-pass/demo` | tylko tester w trybie `testers` | `{ action: "expire" | "reset" }` |
| strona `/wejsciowka`, `/en/pass` | każdy, dla kogo eksperyment jest widoczny; inaczej 404 | serwerowy render oferty |

Gość nie dostaje osobnej trasy: ofertę ma w planie odtwarzania (`access.offer`) i na stronie `/wejsciowka` (w trybie `all`).

---

## 13. Analityka

Bez zmiany kontraktu beaconu (kolektor to osobny kontener i osobne wdrożenie):
- Odsłony `/wejsciowka` i `/en/pass` są liczone automatycznie (ścieżka strony).
- Lejek po stronie serwera: jedna linia logu na zdarzenie (`[premium-pass] event=offer_view|checkout_open|checkout_submit|demo_success|demo_declined|already_active`, bez id konta i bez e-maila), plus licznik dzienny w `AppSetting` `xp.premium_pass.stats:<YYYY-MM-DD>` (JSON z licznikami). Wycofanie usuwa te wiersze.
- Wynik dla właściciela: „ile osób zobaczyło ofertę, otworzyło kasę, kliknęło zapłać” w ciągu doby; w trybie `testers` to praktycznie tylko jego własne kliknięcia, więc analityka ma sens dopiero w `all`.

---

## 14. Dostępność (WCAG 2.2 AA)

- Kasa: `role="dialog"`, `aria-modal`, nagłówek jako etykieta, pułapka fokusu, `Esc`, powrót fokusu; przyklejony przycisk nie zasłania pola z fokusem (2.4.11).
- Błędy przy polach tekstem i `aria-invalid` (3.3.1), opis rozwiązania (3.3.3); nigdy nieaktywny przycisk bez powodu.
- Metody płatności jako grupa radio z klawiaturą; plakietka „PREMIUM” ma tekst, nie tylko kolor; kłódka `aria-hidden` z tekstem obok.
- Kontrast: złoto `#fbbf24` na `#0b0f1a` ok. 11:1, atrament na `--chan-amber-soft` > 12:1; tekst przygaszony na scenie ≥ 4,5:1.
- Cele dotyku ≥ 44×44 px; `prefers-reduced-motion` wyłącza rozmycie animowane, znak sukcesu i pasek przetwarzania (zostaje tekst).
- Komunikaty stanu (przetwarzanie, sukces, odmowa) w `aria-live="polite"`.
- Uwaga: strona ma świadomie wyłączone powiększanie palcami (§4.13, decyzja właściciela); teksty kasy mają co najmniej 15 px na telefonie.

---

## 15. Testy (celowane, bez pełnego zestawu na komputerze właściciela)

| Plik | Co sprawdza |
|---|---|
| `tests/unit/experiments/premium-pass-config.test.ts` | parsowanie flagi (nieznane = `off`), testerzy, slugi, walidacja ceny i dni, ignorowanie Hero/premiery |
| `tests/unit/experiments/premium-pass-access.test.ts` | macierz: tryb {off, testers, all} × aktor {gość, user, tester, tester z wejściówką, wygasła, admin} × film {premium, zwykły, premiera}; przy `off` decyzje identyczne jak bez zmiennych |
| `tests/unit/experiments/premium-pass-plan.test.ts` | plan `PASS_REQUIRED` nie ma `source`, tokenu, `playbackSessionId`, rozdziałów, napisów; ma `access.offer` |
| `tests/unit/experiments/premium-pass-no-money.test.ts` | brak importów Stripe/płatności/sprzedaży w plikach eksperymentu; brak `cc-*` i pól karty; brak przekreślonych cen |
| `tests/unit/experiments/premium-pass-checkout-route.test.ts` | zod, zgody, 409, idempotencja `requestId`, `declined` nic nie zapisuje, 404 dla niewidocznego |
| `tests/unit/components/premium-pass-overlay.test.tsx` | CTA gościa vs zalogowanego, stan wygasły, pas DEMO zawsze widoczny |
| `tests/integration/premium-pass-ledgers.pg.test.ts` (Postgres) | po symulowanym zakupie liczba wierszy `Payment`, `PatronGrant`, `Order`, `Entitlement`, `LedgerEntry`, `UserPaymentTotal` bez zmian |
| aktualizowane świadomie | `access-lock-overlay-cta.test.ts` (dziś zakazuje CTA płatności: wyjątek tylko dla `PremiumPassOverlay` i tylko z pasem DEMO), `playback-plan-state-messaging.test.ts`, `catalog-parity` (automatycznie) |

Polecenie weryfikacji dla agenta implementującego: `nice -n 10 npx vitest run tests/unit/experiments tests/unit/modules/access tests/unit/components/premium-pass-overlay.test.tsx tests/unit/i18n/catalog-parity.test.ts tests/unit/playback-plan-state-messaging.test.ts tests/unit/components/access-lock-overlay-cta.test.ts`, `npm run quality:architecture-boundaries`, `npm run quality:hotspots`, `npx tsc -p tsconfig.typecheck.json --noEmit`; przed wdrożeniem `npm run build`.

---

## 16. Pliki, budżety rozmiaru i podział zadań

### 16.1 Lista plików

Nowe:
```
lib/modules/experiment-premium-pass/index.ts
lib/modules/experiment-premium-pass/domain/config.ts          (flaga, testerzy, slugi, oferta; czyste)
lib/modules/experiment-premium-pass/domain/pass-state.ts      (none/active/expired; czyste)
lib/modules/experiment-premium-pass/infrastructure/pass-store.ts (AppSetting, zod)
lib/modules/experiment-premium-pass/application/checkout-demo.use-case.ts
lib/modules/experiment-premium-pass/application/demo-controls.use-case.ts
app/api/user/premium-pass/route.ts
app/api/user/premium-pass/checkout/route.ts
app/api/user/premium-pass/demo/route.ts
app/[locale]/wejsciowka/page.tsx, app/[locale]/pass/page.tsx   (cienkie, wspólny komponent)
app/[locale]/regulamin-wejsciowki/page.tsx, app/[locale]/pass-terms/page.tsx (strona „projekt, DEMO”)
app/components/premium-pass/PremiumPassOverlay.tsx
app/components/premium-pass/PassCheckoutSheet.tsx
app/components/premium-pass/PassMethodPicker.tsx
app/components/premium-pass/PassSuccess.tsx
app/components/premium-pass/PassOfferPage.tsx
app/components/premium-pass/PremiumBadge.tsx
app/components/premium-pass/DemoRibbon.tsx
app/components/premium-pass/DemoControls.tsx
app/components/premium-pass/usePremiumPass.ts
app/components/premium-pass/premium-pass.module.css
lib/i18n/catalog/premium-pass/{de,es,fr,it,pt,zh}.json
scripts/experiments/premium-pass-revert.sh   (+ scripts/experiments/README.md: jedna strona)
tests/... (§15)
```

Zmieniane (małe wstawki, każda z komentarzem `// experiment: premium-pass (docs/experiments/premium-pass.md)`, żeby grep znajdował wszystkie):

| Plik | Linie dziś / budżet | Zmiana | Po |
|---|---|---|---|
| `lib/modules/access/application/check-video-access.use-case.ts` | 162 / 550 | +8 | ~170 |
| `lib/modules/access/domain/access-reason.ts`, `access-decision.dto.ts` | małe | +3 | – |
| `lib/modules/playback/application/playback.service.ts` | 332 / 550 | +10 | ~342 |
| `lib/modules/playback/domain/playback.dto.ts` | małe | +8 | – |
| `app/components/playback-plan-state.ts` | 163 / 550 | +12 | ~175 |
| `app/components/PremiumWrapper.tsx` | **469 / 500** | +5 (jedna gałąź `PASS_REQUIRED` → `<PremiumPassOverlay/>`) | ~474 |
| `app/components/ChannelVideoCard.tsx` | 147 / 450 | +6 | ~153 |
| `app/components/channel/SidebarPlaylist.tsx` | 369 / 470 | +4 | ~373 |
| `lib/modules/channel/application/channel-layout.service.ts` | 160 / 550 | +10 | ~170 |
| `lib/modules/comments/application/list-video-comments.use-case.ts` | – | +1 | – |
| `lib/modules/syndication` (`decideEmbed`), `lib/video-chapters-seo.ts` | – | +2 każdy | – |
| `lib/i18n/routing.ts` | – | trasa `pass: { pl: "/wejsciowka", en: "/en/pass" }` | – |
| `middleware.ts` | 250 / 550 | +2 (`isPublicRoute`, `shouldRewriteForPolish`) | ~252 |
| `lib/i18n/catalog/index.ts` | małe | +8 (doklejenie katalogu eksperymentu) | – |
| `CLAUDE.md` §0 | – | wpis w rejestrze flag tymczasowych | – |
| `docs/experiments/premium-pass.md` | – | „Stan: wdrożone” + sha | – |

**Nie ruszamy** plików na granicy budżetu: `ChannelHome.tsx` (468/470), `Hero.tsx` (487/500), `VideoPlayer.tsx`. Arkusz kasy montuje się portalem z `PremiumPassOverlay`, więc `ChannelHome` nie wymaga zmian. Chip „Premium · ważna do …” pod tytułem renderuje `PremiumBadge` wstawiony w `PremiumWrapper` (poza `Hero`). Nowe pliki klienckie trzymamy poniżej 300 linii (budżet 450).

Końce linii: pliki w `scripts/experiments/` muszą mieć LF, więc do `.gitattributes` dochodzi `scripts/experiments/** text eol=lf`; pozostałe pliki LF jak całe repo (`core.autocrlf=false`), bez BOM.

### 16.2 Podział na zadania (jedna gałąź `exp/premium-pass`, jeden PR, scalanie squashem)

Jeden agent naraz (zasada repo), w kolejności:
1. **A. Rdzeń (serwer):** moduł `experiment-premium-pass`, wstawki w `checkVideoAccess`, `PlaybackService`, DTO, komentarze, embed, JSON-LD, pasek boczny; testy §15 (config, access, plan, no-money, ledgers).
2. **B. API i trasy:** trzy trasy `/api/user/premium-pass*`, strona oferty i strona „Regulamin wejściówki (DEMO)”, routing i middleware; test tras.
3. **C. Interfejs:** komponenty `app/components/premium-pass/*` według makiety, wstawki w `PremiumWrapper`, `ChannelVideoCard`, `SidebarPlaylist`, sekcja w „Moje konto”; test komponentu; zrzuty ekranu 375 px i 1280 px do opisu PR.
4. **D. Teksty i wycofanie:** katalogi 6 języków, `scripts/experiments/premium-pass-revert.sh` + README, `.gitattributes`, wpis w `CLAUDE.md`, aktualizacja tego dokumentu; sucha próba skryptu (`--dry-run`).

PR ma tytuł `experiment(premium-pass): demo backstage pass with simulated checkout`, a commit squash (opis scalenia) musi zawierać linię-przyczepkę **`Experiment-Id: premium-pass`** (skrypt wycofania szuka po niej). Każda późniejsza poprawka eksperymentu też ma tę linię w opisie scalenia.

Wdrożenie (decyzja właściciela) z `PREMIUM_PASS_EXPERIMENT=all` i `PREMIUM_PASS_VIDEO_SLUGS=jj,test-transkodowania` dopisanymi do `app.env` (z kopią pliku i wpisem `ai-log`); `PREMIUM_PASS_TESTER_IDS` potrzebne tylko w trybie `testers`.

---

## 17. Wycofanie jednym poleceniem

### 17.1 Polecenia

```bash
# Pełne wycofanie (kod, wdrożenie, dane, zmienne) – z katalogu repo na komputerze właściciela:
bash scripts/experiments/premium-pass-revert.sh

# Tylko wyłączenie (sekundy, bez wdrożenia; kod zostaje uśpiony):
bash scripts/experiments/premium-pass-revert.sh --flag-only

# Podgląd bez zmian:
bash scripts/experiments/premium-pass-revert.sh --dry-run
```

Uruchomienie polecenia przez właściciela jest jego zgodą na wdrożenie i zmianę `app.env` (§0 CLAUDE.md).

### 17.2 Co robi skrypt (pełne wycofanie)

1. **Wyłączenie natychmiast** (zanim cokolwiek innego): na serwerku kopia `app.env` → `app.env.bak-premium-pass-<data>`, ustawienie `PREMIUM_PASS_EXPERIMENT=off`, `docker compose up -d --no-deps app`, wpis `AI_AGENT=premium-pass-revert ai-log "..."`. Od tej chwili strona działa jak przed eksperymentem, nawet jeśli dalsze kroki się nie udadzą.
2. `git fetch origin main`; lista commitów eksperymentu: `git log origin/main --format=%H --grep='^Experiment-Id: premium-pass$'` (najnowsze pierwsze). Zero commitów = koniec z komunikatem.
3. Tymczasowy worktree z `origin/main`, gałąź `revert/premium-pass-<MMDDHHMM>`, `git revert --no-edit <sha…>` (od najnowszego). Konflikt = `git revert --abort`, usunięcie worktree, komunikat „Wyłączone flagą (krok 1), pełny revert wymaga agenta” i kod wyjścia 3.
4. Sprawdzenie w worktree: `git grep -n "experiment-premium-pass\|premium-pass" -- app lib middleware.ts` ma być puste; `nice -n 10 npx vitest run tests/unit/i18n/catalog-parity.test.ts tests/unit/modules/access` (lekko, kilkanaście sekund).
5. `git push -u origin <gałąź>`, `gh pr create --title "Revert premium-pass experiment" --body …`, potem `SKIP_CI=1 bash scripts/ops/mergedeploy.sh <PR> <gałąź> revert-xpass` (squash + wdrożenie na serwerek; `deploy.sh` sam cofa obraz przy nieudanym health).
6. Sprzątanie na serwerku po udanym wdrożeniu: `/opt/serwerek/scripts/backup.sh`, potem `DELETE FROM "AppSetting" WHERE key LIKE 'xp.premium\_pass%'` (wypisuje liczbę usuniętych wierszy), usunięcie linii `PREMIUM_PASS_*` z `app.env` (z kopią), `docker compose up -d --no-deps app`, wpis `ai-log`.
7. Weryfikacja (wypisuje PASS/FAIL dla każdego punktu, §17.3).

`--flag-only` wykonuje tylko krok 1 i weryfikację a-c z §17.3.

### 17.3 Weryfikacja po wycofaniu

| # | Sprawdzenie | Oczekiwane |
|---|---|---|
| a | `curl -s -o /dev/null -w "%{http_code}" https://www.pawelperfect.com/premium` | `404` (flaga off) albo `307` (kod wycofany: ścieżka nie jest już publiczna) |
| b | `curl -s https://www.pawelperfect.com/api/media-source/<id jj>` jako gość | `status: "LOGIN_REQUIRED"` (jak przed eksperymentem), nigdzie `PASS_REQUIRED` |
| c | `curl -sI https://www.pawelperfect.com/en` | `200`, `X-Robots-Tag: noindex` |
| d | `git grep -n "Experiment-Id: premium-pass"` na nowym `origin/main` w kodzie (`app`, `lib`) | brak plików eksperymentu |
| e | `SELECT count(*) FROM "AppSetting" WHERE key LIKE 'xp.premium\_pass%'` | `0` |
| f | `docker exec polutek-app-1 env \| cut -d= -f1 \| grep PREMIUM_PASS` | pusto |
| g | ręcznie: film `jj` zalogowanym kontem gra, `test-transkodowania` gra gościowi | tak |

Zmiany w bazie nie było, więc nie ma czego cofać migracją, a `deploy.sh --rollback` nie jest potrzebny.

---

## 18. Ryzyka

| Ryzyko | Zabezpieczenie |
|---|---|
| Ktoś pomyśli, że to prawdziwa sprzedaż | pas DEMO na każdym ekranie, prefiks `DEMO-`, podpis pod przyciskiem, start w trybie `testers` |
| Pomyłka i wywołanie Stripe | brak kodu (test źródeł), brak pól, brak dostawcy innego niż `DEMO` |
| Zmiana dostępu do darmowych filmów po wyłączeniu | `tier` w bazie się nie zmienia; `off` daje identyczne decyzje (test) |
| Konflikt revertu z późniejszymi commitami | wstawki są krótkie i oznaczone, katalogi w osobnych plikach; w razie konfliktu flaga (krok 1) już wyłączyła eksperyment |
| Wyłączony personel nie widzi blokady | właściciel testuje drugim kontem (testerzy po `User.id`) |
| `PremiumWrapper` przekroczy budżet 500 | wstawka ≤ 6 linii, reszta w `app/components/premium-pass/` |

---

## 19. Pytania do właściciela (tylko te, które naprawdę wymagają decyzji)

1. **Cena i warianty:** jedna wejściówka „30 dni · 29 zł” czy dwie karty („7 dni · 14,99 zł” i „30 dni · 29 zł”)?
2. **Które filmy Premium:** `jj` („Zbieram hajs na mój Tajny Projekt”) i `test-transkodowania` („Film testowy 4”)? `jj` to dziś film zbiórki, więc zablokowanie go ukryje apel przed częścią widzów.
3. **Kto widzi eksperyment:** start w `testers` (tylko Twoje konto testowe; ekran gościa obejrzysz w makiecie), a potem na chwilę `all`, żeby zobaczyć widok gościa na żywo? Tryb `all` pokazuje cenę wszystkim odwiedzającym, a obecny regulamin mówi, że dostęp nigdy nie wymaga płatności; przy pasie DEMO i braku pobrania to pokaz, ale decyzja jest Twoja.
4. **Konto testowe:** które konto (inne niż `pawel.perfect@gmail.com`, bo ADMIN zawsze widzi wszystko) wpisać jako tester?
5. **Dane sprzedawcy i VAT w makiecie:** co wpisać w stopce kasy na czas demo („Sprzedawca: dane w przygotowaniu” proponuję) i czy pokazywać „zawiera VAT” (osoba prywatna bez VAT nie dolicza podatku; to temat dla księgowego przed prawdziwą sprzedażą)?

Rzeczy rozstrzygnięte w planie bez pytania (można zmienić): brak e-maili w demo, brak Stripe w ogóle, zero migracji, komentarze filmów Premium czytelne dla wszystkich.

---

## 20. Źródła

Badania UX i płatności:
- Baymard Institute, postrzegane bezpieczeństwo formularza płatności (19% porzuceń z braku zaufania do strony z kartą; obramowanie wrażliwych pól i znak bezpieczeństwa obok): https://baymard.com/research-articles/perceived-security-of-payment-form, https://baymard.com/blog/visually-reinforce-sensitive-fields
- Baymard Institute, przyczyny porzucenia koszyka (dodatkowe koszty, brak łącznej kwoty z góry, wymuszone konto, długa kasa): https://baymard.com/blog/reduce-cart-abandonment
- Stripe, najlepsze praktyki Payment Element (Checkout Sessions zalecane, układ akordeonu przy > 4 metodach, Express Checkout Element): https://docs.stripe.com/payments/payment-element/best-practices
- Stripe, najlepsze praktyki Apple Pay (rejestracja po zakupie, domyślnie Apple Pay na urządzeniach Apple, nie pytać o adres przy towarach cyfrowych, nigdy nieaktywny przycisk): https://docs.stripe.com/apple-pay/best-practices
- Stripe, BLIK (ponad 65% płatności e-commerce w Polsce, kod 6 cyfr z aplikacji banku, PLN): https://docs.stripe.com/payments/blik, https://stripe.com/en-hr/payment-method/blik
- Stripe, Przelewy24 (przekierowanie do banku, PLN/EUR, bez sporów): https://docs.stripe.com/payments/p24
- Stripe, testowanie (testy wyłącznie w trybie testowym; testowanie w trybie live prawdziwymi danymi zabronione): https://docs.stripe.com/testing
- Vimeo OTT, sposoby sprzedaży (wypożyczenie na czas, zakup, subskrypcja): https://help.vimeo.com/hc/en-us/articles/12426980310417-Ways-to-sell-on-Vimeo-OTT
- Stripe, modele OTT (SVOD/AVOD/TVOD): https://stripe.com/at/resources/more/ott-business-models
- Wzorce blokady treści (rozmyty podgląd w miejscu treści, krótkie wyjaśnienie, jedno CTA, najpierw pokaż wartość): https://designerup.co/blog/how-to-design-paywall-subscription-and-upgrade-screens/, https://unil.ink/help-center/articles/app-locked-video
- WCAG 2.2 (Focus Not Obscured 2.4.11 AA, Redundant Entry 3.3.7 A, Accessible Authentication 3.3.8 AA): https://www.w3.org/TR/WCAG22/

Prawo (do weryfikacji przez prawnika; to nie jest porada prawna):
- Art. 17 ust. 3 u.p.k., przycisk „zamówienie z obowiązkiem zapłaty”: https://lexlege.pl/ustawa-o-prawach-konsumenta/art-17/, https://poradnikprzedsiebiorcy.pl/-przycisk-zamawiam-z-obowiazkiem-zaplaty-czy-konieczny
- Art. 38 pkt 13 u.p.k., treści cyfrowe i utrata prawa odstąpienia: https://fakturownia.pl/firma-w-praktyce/zrozumienie-art-38-ustawy-o-prawach-konsumenta-i-jego-znaczenie, https://pro.rp.pl/prawo-w-firmie/art11867411-zakup-tresci-cyfrowych-a-odstapienie-od-umowy
- Art. 21 u.p.k., potwierdzenie na trwałym nośniku z informacją o zgodzie: https://lexlege.pl/ustawa-o-prawach-konsumenta/art-21/, https://standardyprawa.pl/akt/51/art/9866
- Ceny brutto (art. 3 ust. 3 ustawy o informowaniu o cenach) i Omnibus (art. 4, najniższa cena z 30 dni przy obniżce): https://poradnikprzedsiebiorcy.pl/-jak-podawac-ceny-towarow-i-uslug-zeby-uniknac-problemow-i-kar, https://poradnikprzedsiebiorcy.pl/-zasady-informowania-o-obnizce-cen
- Tekst jednolity u.p.k.: https://www.prawo.pl/akty/dz-u-2026-1244-t-j,18105223.html

Repo: `docs/audit/2026-10-12/architektura-platnego-dostepu.md`, `docs/architecture/multi-creator-platform.md`, `docs/architecture/payments-and-tips.md`, `CLAUDE.md` §4.3, §4.4, §4.10, §4.24, §4.25.
