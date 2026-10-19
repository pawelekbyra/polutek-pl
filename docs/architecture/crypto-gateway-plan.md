# Własna bramka płatności krypto (BTCPay Server): plan, system NIEAKTYWNY

Status: **plan do decyzji właściciela (2026-10-19); nic z tego nie jest wdrażane.** Dokument nie zmienia zasad z CLAUDE.md §4.2, §4.10, §4.14, ani wyłączników `sales`/`payouts` (zostają `off`). Pytanie właściciela: "co potrzebujemy, żeby wdrożyć porządną bramkę płatności krypto na własnym serwerze". Kontekst: `payments-resilience.md` (warstwa 3, czyste krypto) oraz `payments-and-tips.md` (okno napiwku, makieta "Crypto").

Oznaczenia: **[zweryfikowano]** = potwierdzone na stronie źródłowej w dniu pisania; **[niezweryfikowano]** = z wyszukiwarki, źródeł wtórnych albo z pamięci, sprawdzić przed decyzją.

## 0. Streszczenie dla właściciela

- **Rekomendacja:** BTCPay Server (open source, Docker) na osobnym serwerze i subdomenie, **bez kluczy prywatnych na serwerze** (portfel sprzętowy, na serwerze tylko klucz publiczny xpub), najpierw **Bitcoin on-chain**, Lightning później, stablecoiny i Monero opcjonalnie.
- **Obecny serwer (serwerek) nie udźwignie tego obok produkcji:** 2 vCPU, 3,8 GB RAM z czego dostępne ok. 1,2 GB, swap już użyty w 1,8 GB. Wymaga osobnej, małej maszyny (4 GB RAM, 2 vCPU, 80 GB SSD). Szczegóły w §2.
- **Zakres na start: napiwki**, bez zwrotów i bez faktur. Sprzedaż (merchant of record, VAT, 14-dniowy zwrot) to inna sprawa i zostaje za wyłącznikiem `sales`.
- **Największe niewiadome nie są techniczne, tylko prawne i podatkowe** (§5): polska ustawa o rynku kryptoaktywów jest zablokowana wetem, wycena przychodu w PLN, brak ugruntowanej praktyki organów.
- **Szacunek:** ok. 6 do 10 dni roboczych kodu i testów plus ok. 1 do 2 dni administracji (§6), koszt stały ok. 10 do 20 EUR/mies. za serwer [niezweryfikowano].

## 1. Rekomendowany stos

### 1.1 BTCPay Server

- Samodzielnie hostowany, otwarty procesor płatności; wdrożenie przez Docker (skrypty "btcpayserver-docker"). Dokumentacja wdrożeń wymienia VPS jako sposób produkcyjny, ręczny build bez Dockera jako "nie do produkcji", a OpenVZ jako niewspierany. [zweryfikowano] https://docs.btcpayserver.org/Deployment/
- Własna subdomena (np. `pay.<domena>`) na osobnej maszynie, za TLS (Let's Encrypt wbudowane w stos) albo za Cloudflare. DNS i Cloudflare to zmiana w usłudze zewnętrznej: tylko na zgodę właściciela (CLAUDE.md §0).
- **Niekustodialnie:** w sklepie BTCPay podpinamy portfel przez **xpub** z portfela sprzętowego (np. Trezor, Ledger, Coldcard). Serwer generuje adresy, nie umie ich wydać. Klucz prywatny nigdy nie trafia na serwer; to największa zaleta wobec "gorącego portfela". Do pieniędzy z napiwków dostęp ma tylko osoba z urządzeniem. [zasada architektury BTCPay; szczegóły konfiguracji portfela w dokumentacji do sprawdzenia przy wdrożeniu: niezweryfikowano]
- **Waluty (dokumentacja generatora Dockera) [zweryfikowano]:** `btc`, `ltc`, `grs`, `ftc`, `dash`, `doge`, `mona`, `xmr` (wtyczka społeczności), `bdx`, `lbtc` (Liquid), `zec`, `dcr`; "Bitcoin i Litecoin są utrzymywane przez projekt BTCPay, reszta zależy od społeczności i jest na własne ryzyko". Lightning: Core Lightning, LND, Phoenixd (tylko BTC); "Lightning jest opcjonalny i domyślnie wyłączony". https://docs.btcpayserver.org/Docker/cryptocurrencies/ , https://docs.btcpayserver.org/Docker/lightning/
- **Monero:** wtyczka wymaga osobnego portfela z adresem głównym i prywatnym kluczem podglądu (view key), nigdy seeda ani klucza wydawania; demon przycięty domyślnie; ok. 105 GB w lipcu 2026, planować min. 250 GB SSD. [zweryfikowano] https://docs.btcpayserver.org/Docker/specs/ i /Docker/cryptocurrencies/
- **Stablecoiny (USDT/USDC):** nie ma ich w dokumentacji rdzenia. Z wyszukiwania: raport BTCPay 2025 wspomina wtyczkę USDT, istnieją wtyczki społeczności (np. MakePay, Nisaba) bez potwierdzonej obsługi USDC na EVM; osobne projekty (np. PayRam) nie są wtyczkami BTCPay. **[niezweryfikowano]**, traktować jako lead. Dodatkowo stablecoiny typu EMT wchodzą w reżim PSD2/MiCA (patrz `payments-resilience.md` §2), więc to ostatnia faza i tylko po opinii prawnika.

### 1.2 Kolejność

1. **Bitcoin on-chain** (najprostszy, najpewniejszy, bez zarządzania płynnością).
2. **Lightning** (Phoenixd jest najlżejszą opcją [niezweryfikowano co do zasobów], ale to gorący portfel z kanałami: wymaga płynności przychodzącej, backupu kanałów i monitorowania; środki na węźle LN są pod kontrolą serwera, więc inaczej niż on-chain nie są "zimne").
3. Opcjonalnie Monero i stablecoiny, osobno, po decyzji prawnej.

### 1.3 Wymagania zasobów wg dokumentacji [zweryfikowano]

Strona "Server Specifications" https://docs.btcpayserver.org/Docker/specs/ :

- Bitcoin-only, przycięty (`opt-save-storage-xs`): **4 GB RAM, 2 rdzenie, 50 GB SSD jako absolutne minimum**, zalecany zapas.
- Progi przycinania bloków: `opt-save-storage` 100 GB, `-s` 50 GB, `-xs` 25 GB, `-xxs` 5 GB. Dysk systemowy = 10 GB + 15 GB chainstate + 8 GB na każdy węzeł inny niż Bitcoin; bloki = próg × liczba węzłów.
- Nie stosować `xxs` z Lightningiem. Węzeł nieprzycięty jest potrzebny tylko dla `opt-txindex`, ElectrumX i Mempool.
- Starsza strona FAQ podaje "2 GB RAM, 80 GB" dla przyciętego węzła (https://docs.btcpayserver.org/FAQ/Deployment/): dokumentacja nie jest spójna, planować wg nowszej strony Specifications, czyli 4 GB.
- Początkowa synchronizacja jest ciężka dla CPU i dysku (skraca ją "Fast Sync" z dokumentacji wdrożeń). [zweryfikowano, bez liczb czasu]

## 2. Czy obecny serwer to udźwignie (odczyt tylko-do-odczytu, 2026-10-19)

Wykonano wyłącznie odczyty przez `ssh serwerek` (nproc, free, df, docker system df, docker stats --no-stream, docker ps). Żadnych zmian, restartów ani sekretów.

| Zasób | Stan | Wymóg BTCPay + przycięty BTC |
|---|---|---|
| CPU | 2 vCPU (AMD EPYC-Genoa), load avg ok. 0,2 do 0,7 | 2 rdzenie, ale początkowa synchronizacja zajmie oba na wiele godzin |
| RAM | 3,8 GB łącznie, **ok. 2,5 GB użyte, ok. 1,2 GB dostępne** | **4 GB tylko dla stosu BTCPay** |
| Swap | 4 GB, **już 1,8 GB użyte** (maszyna już przerzuca pamięć) | brak zapasu |
| Dysk | 75 GB, 30 GB użyte, **43 GB wolne** (z tego 12,4 GB do odzyskania z cache budowania Dockera) | min. 50 GB SSD |
| Kontenery | 11 działających (m.in. app, admin, db, redis, encoder, collector, support: web/sidekiq/db/redis) | |

**Werdykt: NIE, nie na tym serwerze.** Blokuje RAM, nie dysk. Na pamięci jest już ciasno (swap w użyciu), a synchronizacja węzła Bitcoin przez wiele godzin obciążałaby CPU i dysk wspólnie z bazą i kodowaniem wideo, czyli ryzykowałaby produkcję. Do tego bramka płatności powinna być odseparowana awaryjnie i bezpieczeństwem od aplikacji (awaria lub włamanie na jednym nie może dotknąć drugiego).

**Wymagane:** osobny VPS, minimum **4 GB RAM, 2 vCPU, 80 GB SSD** (przy późniejszym Lightningu i zapasie raczej 8 GB / 160 GB). Koszt ok. 10 do 20 EUR/mies. **[niezweryfikowano, sprawdzić cennik dostawcy; CLAUDE.md wskazuje Hetzner]**. Alternatywy: dodanie RAM i dysku do obecnej maszyny (mniej bezpieczne, bo wspólna awaria) albo hostowany BTCPay (usługa trzeciej strony, kompromis niekustodialności, osobna ocena).

## 3. Integracja z modułem `lib/modules/payments`

### 3.1 Jak jest dziś (Stripe)

- `create-checkout-intent` tworzy `Payment(PENDING)` plus PaymentIntent (klucz idempotencji `userId+requestId`), `handle-stripe-webhook` weryfikuje podpis na surowym ciele, blokuje zdarzenie po `StripeEvent.id`, a sukces idzie wyłącznie przez `fulfillPayment()` (CAS `PENDING|FAILED|CANCELED -> SUCCEEDED`, sprawdza kwotę, walutę, intent i użytkownika, dodaje `PatronGrant`, po commicie wysyła podziękowanie). Reszta ścieżek: szybka ścieżka `GET /api/payments/[id]`, cron `stripe-reconciliation` co 15 min, zwroty i spory (`handle-refund`, `handle-dispute`, `admin-refund`, `reconcile-refunds`).
- Model `Payment` ma `stripeIntentId`/`stripeSessionId`, `currency`, `amountMinor` (grosze), `status` (PENDING, SUCCEEDED, FAILED, CANCELED, REFUNDED, PARTIALLY_REFUNDED, DISPUTED, CHARGEBACK_LOST), `metadata`.
- Okno napiwku: kafelek "Crypto" z `TIP_CRYPTO_PLACEHOLDER` (`tip-flow-config.ts`) i komponent `CryptoPlaceholder` w `TipPayStep.tsx` (komunikat "już wkrótce", nie pobiera pieniędzy).
- Wyłączniki: `lib/platform-gates.ts` (`channelCreation`, `sales`, `payouts`, zmienne `PLATFORM_GATE_*`, domyślnie `off`). Napiwki nie są sprzedażą i dziś nie mają własnego wyłącznika.

### 3.2 Port dostawcy obok Stripe

Nie przepisujemy Stripe. Dodajemy cienki interfejs tylko tam, gdzie dostawcy się różnią:

```
PaymentProvider (nowy port, lib/modules/payments/domain)
  createCharge(input) -> { providerRef, checkoutUrl | clientData, expiresAt }
  parseAndVerifyWebhook(rawBody, headers) -> ProviderEvent  // podpis na surowym ciele
  fetchCharge(providerRef) -> ProviderChargeState            // do uzgadniania
```

Implementacje: `stripe` (istniejący kod, bez zmian zachowania) i `btcpay` (nowy). `fulfillPayment()` zostaje jedynym wejściem do `SUCCEEDED`; dostaje neutralne `providerRef` (dla Stripe nadal `stripeIntentId`). Zasada z CLAUDE.md "nie omijaj `fulfillPayment()`" obowiązuje bez wyjątku.

### 3.3 Dane

Minimalnie inwazyjnie, bez ruszania unikalności Stripe:

- `Payment.provider` (enum `STRIPE` | `BTCPAY`, domyślnie `STRIPE`), `Payment.providerRef` (unikalne razem z `provider`). Istniejące wiersze dostają `STRIPE`.
- Nowa tabela `CryptoCharge` 1:1 z `Payment`: `btcpayInvoiceId` (unikalne), `fiatAmountMinor`, `fiatCurrency`, `expiresAt`, `btcpayStatus`, `btcpayAdditionalStatus`, `paidAmountSats` / `paidAmountText` (jako tekst, nie float), `rateSnapshot` (JSON: kurs i para z faktury BTCPay), `receivedFiatPlnMinor` (wycena na dzień zaliczenia), `lastSyncedAt`.
- Nowa tabela `BtcpayEvent` (odpowiednik `StripeEvent`): klucz `deliveryId`, `type`, `status` (PROCESSING/PROCESSED/FAILED), `payload`, `error`. Pole `payload` bez danych osobowych.
- Migracja według `database-and-migrations.md`; dodatkowa, wsteczna zgodna (kolumny z domyślnymi wartościami), więc bezpieczna dla wdrożenia z poprzednią wersją.

### 3.4 Webhook BTCPay

- Trasa np. `app/api/webhooks/btcpay/route.ts`, runtime Node, odczyt **surowego ciała** (bez `req.json()`).
- **Podpis [zweryfikowano]:** nagłówek `BTCPay-Sig` = `sha256=` + hex(HMAC-SHA256(klucz = sekret webhooka, dane = surowe bajty ciała)); porównanie w stałym czasie, przed jakimkolwiek parsowaniem. https://docs.btcpayserver.org/Developers/api/examples/ . Sekret webhooka w zmiennej środowiskowej (np. `BTCPAY_WEBHOOK_SECRET`), nie w repozytorium.
- **Typy zdarzeń [zweryfikowano w kodzie klienta BTCPay]:** m.in. `InvoiceCreated`, `InvoiceReceivedPayment`, `InvoicePaymentSettled`, `InvoiceProcessing`, `InvoiceExpired`, `InvoiceSettled`, `InvoiceInvalid`, `InvoiceExpiredPaidPartial`, `InvoicePaidAfterExpiration`. https://github.com/btcpayserver/btcpayserver (plik `WebhookEventType.cs`). Dokumentacja integracji sklepu każe subskrybować `InvoiceProcessing`, `InvoiceExpired`, `InvoiceSettled`, `InvoiceInvalid` oraz dla płatności po terminie `InvoiceReceivedPayment` i `InvoicePaymentSettled`. https://docs.btcpayserver.org/Development/ecommerce-integration-guide/
- **Pola ładunku [częściowo niezweryfikowano, z zgłoszeń na GitHubie]:** `deliveryId`, `webhookId`, `isRedelivery`, `type`, `timestamp`, `storeId`, `invoiceId`; ładunek nie niesie kwoty.
- **Idempotencja:** wiersz `BtcpayEvent` zapisany przed przetwarzaniem po `deliveryId` (unikalny klucz), identycznie jak `StripeEvent`. Ponowne dostarczenie (BTCPay ponawia po 10 s, 1 min, potem co 10 min [niezweryfikowano w oficjalnej dokumentacji; wynik z PR w serwisie trzecim]) kończy się `duplicate` i kodem 200.
- **Nigdy nie ufamy samemu ładunkowi.** Po weryfikacji podpisu handler pobiera fakturę z Greenfield API (`GET /api/v1/stores/{storeId}/invoices/{id}`, nagłówek `Authorization: token <klucz>`) i decyduje wg `status` + `additionalStatus` oraz sprawdza zgodność kwoty, waluty i `metadata.paymentId`. Klucz API ma tylko potrzebne uprawnienia (utworzenie i odczyt faktur jednego sklepu). [zweryfikowano: https://docs.btcpayserver.org/Developers/api/examples/ ; nazwy konkretnych uprawnień sprawdzić w UI]
- Rozbieżny tryb (testnet vs mainnet) odrzucany jak `livemode` w Stripe (`BTCPAY_NETWORK` w konfiguracji kontra sklep).

### 3.5 Stany faktury BTCPay a nasz `PaymentStatus`

Stany BTCPay [zweryfikowano, https://docs.btcpayserver.org/Users/invoices/]: `New`, `Processing`, `Settled`, `Expired`, `Invalid` plus wyjątki `PaidPartial`, `PaidOver`, `PaidLate` oraz `Marked` (ręczne oznaczenie w BTCPay, nie dowód zatwierdzenia w blockchainie).

| BTCPay | additionalStatus | Nasz stan i działanie |
|---|---|---|
| New | brak / PaidPartial | `PENDING` (częściowa wpłata zapisana w `CryptoCharge`, bez realizacji) |
| Processing | (pełna kwota widziana, brak potwierdzeń) | `PENDING`, UI: "czekamy na potwierdzenie sieci"; **nie realizujemy** |
| Settled | brak | `SUCCEEDED` przez `fulfillPayment()` |
| Settled | PaidOver | `SUCCEEDED` na kwotę zamówienia; nadwyżka do rejestru (§3.7) |
| Expired | brak | `CANCELED` (po `expiresAt`, cron zamyka) |
| Expired | PaidPartial | `PENDING` -> po przeglądzie ręcznym `CANCELED`, kwota do rejestru niedopłat |
| Expired | PaidLate | **nie** realizujemy automatycznie; alert i ręczna decyzja (przyjąć jako napiwek albo oddać) |
| Invalid | dowolny | `FAILED`, alert (wpłata mogła dojść; zweryfikować niezależnie, tak jak radzi dokumentacja) |
| Marked (ręcznie) | | traktować jako `PENDING`/alert; **sukces tylko po potwierdzeniu w łańcuchu** |

Zasada: sukces tylko z `Settled` z poprawnym podpisem i sprawdzeniem faktury; status `Processing` (niepotwierdzony) nigdy nie daje podziękowania. Polityka potwierdzeń (speed policy) ustawiona w sklepie: dla napiwków np. 1 potwierdzenie, dla większych kwot więcej [wartości do decyzji; domyślne ustawienia BTCPay niezweryfikowano].

### 3.6 Cena, kurs, wygaśnięcie

- Faktura tworzona w **PLN lub EUR** (`currency` + `amount` w jednostkach głównych; konwersja z naszych groszy tylko na granicy), a BTCPay wylicza kwotę w BTC po kursie ze skonfigurowanych źródeł i **zamraża go na czas ważności faktury**. [zasada działania; źródła kursów i ich ustawienia: niezweryfikowano]
- Wygaśnięcie: parametr czasu faktury (domyślnie ok. 15 do 60 min w zależności od ustawień sklepu [niezweryfikowano]); proponowane 30 min dla on-chain. Po wygaśnięciu płatność nadal może przyjść (PaidLate), co obsługuje §3.5.
- Minimalna kwota napiwku w krypto wyższa niż karta (opłata sieciowa, kwoty "pyłowe"): osobne minimum w `PaymentCurrencySetting` albo stała w konfiguracji [do decyzji].
- Kwoty zapisujemy jako liczby całkowite (satoshi) i tekst, nigdy `float`.

### 3.7 Niedopłata i nadpłata (polityka)

- **Niedopłata:** nie realizujemy. Użytkownik widzi, ile brakuje, i może dopłacić na ten sam adres w czasie ważności faktury. Po wygaśnięciu: wiersz w rejestrze niedopłat, ręczna decyzja (zwrot kosztem opłaty sieciowej albo przyjęcie jako niższy napiwek, jeśli właściciel tak zdecyduje). Tolerancja drobnej niedopłaty (np. opłata pobrana przez giełdę): próg do decyzji, domyślnie 0.
- **Nadpłata:** napiwek realizowany na kwotę zamówienia, nadwyżka w rejestrze; w napiwkach najprostsza polityka to **przyjęcie całości jako napiwku** (kwota ewidencyjna = zamówiona, różnica w notatce). Do potwierdzenia przez księgowego.
- **Płatność po terminie:** alert do administratora, bez automatycznej realizacji.

### 3.8 Uzgadnianie (reconcile)

Analog crona `stripe-reconciliation` (co 15 min): dla `Payment` z `provider=BTCPAY` w stanach nieterminalnych pobiera fakturę z Greenfield, woła ten sam kod mapowania co webhook (jedna funkcja `applyBtcpayInvoiceState`) i `fulfillPayment()` przy `Settled`. Zamyka wygasłe po grace period. Wykrywa rozjazdy (kwota, waluta). Wpina się w istniejący harmonogram zadań (CLAUDE.md, lista cronów).

### 3.9 Zwroty

**Zwroty krypto są ręczne i nieodwracalne.** Nie ma `issueRefund` jak w Stripe: zwrot to nowa transakcja z naszego portfela sprzętowego na adres, który podał płacący (adres nadawcy bywa adresem giełdy, więc nie wolno zakładać, że zwrot tam trafi). BTCPay ma mechanizm "refund" faktury i wypłat (zdarzenie `InvoiceRefund`, `PayoutCreated` w typach webhooków), ale wymaga człowieka z urządzeniem. Konsekwencje:

- `admin-refund` dla `provider=BTCPAY` nie wykonuje zwrotu, tylko tworzy zadanie ręczne i po potwierdzeniu wpisuje `REFUNDED` z identyfikatorem transakcji w audycie.
- W regulaminie napiwku: napiwek dobrowolny i bezzwrotny (zgodnie z obecnym modelem); wyjątek tylko decyzją właściciela.
- Brak sporów i chargebacków (plus tej metody).

### 3.10 Interfejs

- `CryptoPlaceholder` w `TipPayStep.tsx` zastąpić komponentem `CryptoPayForm`: tworzy intent po stronie serwera (`POST /api/checkout/create-crypto-charge`), a następnie albo przekierowuje do hostowanego checkoutu BTCPay (najprostsze, bez własnego kodu QR), albo osadza własne okno z adresem/QR i odliczaniem. Rekomendacja: **hostowany checkout BTCPay na start** (mniej kodu i mniej powierzchni ataku), powrót na `?success=true&payment_id=...` jak dziś.
- Ekran powrotu: stany "czekamy na potwierdzenie sieci" (Processing), "nie dotarła pełna kwota" (PaidPartial), "czas minął" (Expired) bez żargonu technicznego (zgodnie z `payments-and-tips.md`).
- Kafelek "Crypto" pokazywany tylko, gdy wyłącznik krypto jest włączony; inaczej zostaje makieta "Już wkrótce" (stan dzisiejszy).
- CSP (`generateCSP()` w `lib/utils/security.ts`): przy przekierowaniu zmian nie trzeba; przy osadzaniu `frame-src`/`connect-src` dla domeny BTCPay dopisać w jednym miejscu.
- Teksty przez `tx()` (PL/EN), regulamin i politykę prywatności uzupełnić o krypto.

### 3.11 Wyłącznik i konfiguracja

- Nowa zmienna `PAYMENTS_CRYPTO` (`off`/`on`, domyślnie `off`, nieznana wartość = `off`) w `lib/platform-gates.ts` jako czwarty wyłącznik albo osobny moduł konfiguracji; **nie** wolno przy tym zmieniać znaczenia `sales`/`payouts`. Napiwki krypto nie wymagają `sales`.
- Zmienne: `BTCPAY_BASE_URL`, `BTCPAY_STORE_ID`, `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET`, `BTCPAY_NETWORK`. Wartości tylko na serwerze (jak `STRIPE_*`), nie w repozytorium ani dokumentacji. Dopisać do tabeli zmiennych w CLAUDE.md przy wdrożeniu.

### 3.12 Plan testów

1. Jednostkowe: weryfikacja `BTCPay-Sig` (poprawny, zły, brak, zmienione ciało), mapowanie stanów (tabela §3.5), idempotencja `deliveryId`, niezmienniki kwot.
2. Integracyjne na **regtest** (lokalny BTCPay w Dockerze z węzłem regtest; mainnet nie jest potrzebny): faktura, pełna wpłata, niedopłata, nadpłata, wygaśnięcie, płatność po terminie, ponowne dostarczenie webhooka, utrata webhooka (naprawia cron).
3. Testy na **testnet** (Bitcoin testnet lub signet), z prawdziwym portfelem i prawdziwym czasem potwierdzeń.
4. Test kolejności zdarzeń: `Settled` przed `Processing`, duplikaty, webhook po ręcznym uzgodnieniu.
5. Dopiero po tym: pierwsza płatność na mainnecie kwotą symboliczną, za zgodą właściciela.

## 4. Bezpieczeństwo

- **Portfel sprzętowy** (dwa urządzenia lub urządzenie i kopia) i zapis frazy odzyskiwania (seed) na papierze/metalu, w dwóch fizycznie osobnych miejscach; fraza nigdy nie jest wpisywana na komputerze ani serwerze, nie trafia do czatu, repozytorium, zdjęć ani chmury. Dobrze rozważyć multisig (np. 2 z 3) dla większych kwot [decyzja].
- Na serwerze tylko xpub; zapytać, kto ma dostęp do urządzenia i procedurę na wypadek jego utraty lub śmierci posiadacza (dziedziczenie, odzyskiwanie).
- **Utwardzenie serwera:** logowanie SSH tylko kluczem, brak hasła root, zapora (otwarte 22 z ograniczeniem, 80/443, port peer Bitcoin 8333 jeśli ma przyjmować połączenia), automatyczne aktualizacje bezpieczeństwa, fail2ban, osobny użytkownik, brak współdzielonych kluczy z serwerkiem.
- **Panel BTCPay:** dwuskładnikowe logowanie, konto administratora osobne od kont roboczych, brak publicznej rejestracji, klucz API o minimalnych uprawnieniach i rotacja.
- **Osobna baza** (stos BTCPay ma własny Postgres; nie współdzielić z bazą aplikacji ani z `pp-support`).
- **Kopie zapasowe:** BTCPay ma skrypt kopii zapasowej (konfiguracja, baza, a przy Lightningu kopia kanałów: "Backup and Restore" w dokumentacji); kopia szyfrowana poza maszyną, regularny test odtworzenia. Dla on-chain najważniejsza jest fraza odzyskiwania, nie kopia serwera. [zasada; dokładne polecenia sprawdzić przy wdrożeniu]
- **Monitoring:** alerty o niedostępności węzła/BTCPay, zatrzymanej synchronizacji, braku miejsca na dysku, nieudanych webhookach (liczba kodów ≠ 2xx), wygasłych, a opłaconych fakturach (PaidLate), rozjazdach z crona; powiadomienie na adres administratora (istniejący `recordAlert`).
- **Ryzyka aplikacyjne:** sfałszowany webhook (podpis + pobranie faktury), podwójna realizacja (CAS + `deliveryId`), ujawnienie adresów/danych w logach (logować tylko identyfikatory), podmiana adresu w checkoutcie (hostowany checkout na naszej domenie z TLS i HSTS).
- Zmiany w usługach zewnętrznych i na serwerze produkcyjnym tylko na zgodę właściciela (CLAUDE.md §0).

## 5. Prawo, podatki, AML: pytania do księgowego i prawnika

Nic poniżej nie jest poradą; to lista rzeczy do sprawdzenia przed uruchomieniem.

**Stan prawa krypto w Polsce [zweryfikowano w prasie, stan na ok. połowa 2026; sprawdzić aktualny]:** ustawa o rynku kryptoaktywów (wdrożenie MiCA, nadzór KNF) została zawetowana po raz trzeci, a Sejm nie odrzucił weta (241 głosów za przy wymaganych ok. 266). Według tych relacji polskie podmioty nie mogą dziś uzyskać krajowej licencji CASP, działać mogą w Polsce podmioty licencjonowane w innym państwie UE, a Komisja Europejska wszczęła postępowanie przeciw Polsce. Źródła: https://www.prawo.pl/biznes/trzecie-weto-ustawy-o-rynku-kryptoaktywow,1544811.html , https://www.rp.pl/finanse/art45097901-sejm-nie-przelamal-weta-nawrockiego-domanski-uderza-w-pis-kryptosrebrniki , https://www.bankier.pl/wiadomosc/25-glosow-zabraklo-do-odrzucenia-weta-Ustawa-o-kryptowalutach-nadal-zablokowana-9192153.html . Daty późniejsze niż te artykuły: **niezweryfikowano**.

Pytania:

1. **Status CASP/AML:** czy samo **przyjmowanie** kryptowalut w zamian za własne towary i usługi (napiwki, bez wymiany, bez przechowywania cudzych środków) w ogóle czyni nas dostawcą usług kryptoaktywów albo instytucją obowiązaną (AML)? Zwykle nie (akceptant nie świadczy usługi na rzecz innych), ale to **do potwierdzenia** na piśmie, zwłaszcza że prawo krajowe jest w zawieszeniu. Niekustodialny model (klucze u nas, brak pośrednictwa) jest tu korzystny. [ocena wstępna, niezweryfikowano]
2. **KYC:** do odbioru napiwków nie jest wymagane; sprawdzić, czy próg kwotowy lub charakter wpłat (np. jedna duża wpłata) wywołuje obowiązki (AML, sprawdzenie źródła) i jak reagować na podejrzane wpłaty ("tainted coins").
3. **Wycena w PLN:** przychód/napiwek w momencie otrzymania w kwocie PLN po kursie. Dla VAT przy fakturach w walucie obcej stosuje się kurs średni NBP z ostatniego dnia roboczego przed obowiązkiem podatkowym (art. 31a ustawy o VAT) [zweryfikowano w źródłach wtórnych: https://poradnikprzedsiebiorcy.pl/-faktura-w-kryptowalucie-czy-mozna-taka-wystawic , https://www.infakt.pl/blog/?p=50319], ale dla kryptowaluty nie ma jednolitej praktyki: w 2023 r. KIS miała odpowiedzieć, że "nie ma wypracowanego stanowiska" w sprawie regulowania faktur kryptowalutą. **Rozważyć wniosek o interpretację indywidualną.** Zapisywać kurs BTCPay z faktury oraz kurs NBP.
4. **Napiwek a sprzedaż:** napiwek dobrowolny to nie dostawa towarów/usług (VAT), a darowizna/przysporzenie (podatek od darowizn lub przychód podatkowy zależnie od formy prowadzenia działalności i podmiotu). To zależy od decyzji o podmiocie prawnym (patrz `docs/audit/2026-10-13/` i `multi-creator-platform.md`).
5. **Podatek dochodowy:** późniejsza wymiana BTC na PLN (lub wydanie BTC) to odpłatne zbycie waluty wirtualnej: przychód z kapitałów pieniężnych, 19%, PIT-38/CIT; koszt = wartość wcześniej opodatkowanego przychodu. [zweryfikowano w źródłach wtórnych; stan przepisów sprawdzić]. Ewidencja każdej wpłaty (kurs, data, txid) i każdego wydania.
6. **Sprzedaż (faza późniejsza):** faktura w PLN, VAT liczony od wartości w PLN, prawo odstąpienia (14 dni) i nieodwracalna płatność: patrz `payments-resilience.md` §3. Krypto nie dla `sales` bez osobnej decyzji.
7. **Stablecoiny/EMT:** PSD2/MiCA (patrz `payments-resilience.md` §2); osobna opinia.
8. **RODO i prywatność:** adresy i txid to dane osobowe, gdy da się je powiązać z użytkownikiem (publiczny łańcuch jest trwały). Opisać w polityce prywatności, nie zapisywać więcej niż trzeba (CLAUDE.md §4.18).
9. **Rachunkowość:** jak ujmować saldo BTC (aktywa, odpisy z tytułu zmiany kursu), kto prowadzi ewidencję.

## 6. Koszty, nakład i fazy

**Koszty [niezweryfikowano, orientacyjnie]:**
- Serwer: 10 do 20 EUR/mies. (4 GB / 2 vCPU / 80 GB), więcej przy 8 GB i Lightningu.
- Portfel sprzętowy: ok. 70 do 200 EUR jednorazowo (x2 przy kopii); nośnik na frazę (metal) ok. 20 do 100 EUR.
- Opłaty transakcyjne: opłaty sieci Bitcoin płaci nadawca; po naszej stronie opłata przy wydawaniu środków. BTCPay nie pobiera prowizji od transakcji (oprogramowanie darmowe) [niezweryfikowano].
- Konsultacje: księgowy/prawnik (wycena, AML, interpretacja): według stawek, ważne przed uruchomieniem.

**Nakład (przybliżony):**

| Faza | Zakres | Nakład |
|---|---|---|
| 0. Decyzje | Odpowiedzi właściciela (lista niżej), konsultacja prawna i podatkowa | zależy od właściciela |
| 1. Infrastruktura | Nowy VPS, Docker, BTCPay, przycięty BTC, subdomena, portfel xpub, hartowanie, kopie, monitoring | 1 do 2 dni (+ czas synchronizacji węzła: godziny do dni, zależnie od łącza i dysku [niezweryfikowano]) |
| 2. Kod: napiwki BTC on-chain | Port dostawcy, migracja, webhook, mapowanie, reconcile, UI zamiast `CryptoPlaceholder`, wyłącznik, testy regtest/testnet | 6 do 10 dni roboczych |
| 3. Pilotaż | Mainnet, mała kwota, za zgodą właściciela, obserwacja 2 do 4 tygodni | ok. 1 dzień + obserwacja |
| 4. Lightning | Phoenixd/LND/CLN, płynność, kopie kanałów | 3 do 5 dni |
| 5. Opcje | Monero, stablecoiny (po opinii prawnej) | osobna wycena |
| 6. Sprzedaż w krypto | Dopiero po `sales` + prawo konsumenckie + podatek | poza zakresem tej notatki |

## 7. Decyzje potrzebne od właściciela

1. Czy w ogóle wchodzimy w krypto, i czy tylko jako **napiwki** (rekomendowane) bez zwrotów.
2. Zgoda na **osobny serwer** (budżet miesięczny, dostawca, region) i subdomenę (np. `pay.`); kto jest administratorem.
3. **Kto trzyma portfel sprzętowy i frazę odzyskiwania**, czy multisig, procedura awaryjna/dziedziczenia.
4. Waluta wyceny: PLN czy EUR; minimalna kwota napiwku w krypto.
5. Polityka niedopłat/nadpłat/płatności po terminie (§3.7) i tolerancje.
6. Hostowany checkout BTCPay (zalecany) czy własne okno płatności.
7. Zgoda na konsultację prawną/podatkową i ewentualny wniosek o interpretację indywidualną; decyzja o podmiocie prawnym (zależność od `docs/audit/2026-10-13/`).
8. Zakres sieci: tylko BTC on-chain na start; czy i kiedy Lightning, Monero, stablecoiny.
9. Co robić ze środkami: trzymać w BTC czy okresowo wymieniać na PLN (konsekwencje podatkowe, giełda to osobny podmiot z KYC).
10. Moment włączenia: wyłącznik `PAYMENTS_CRYPTO` pozostaje `off`, dopóki lista kontrolna z §3.12 i §5 nie jest zamknięta.

## 8. Źródła (otwarte w dniu pisania)

- BTCPay, wdrożenia: https://docs.btcpayserver.org/Deployment/
- BTCPay, specyfikacje serwera: https://docs.btcpayserver.org/Docker/specs/
- BTCPay, FAQ wdrożeń (starsze wymagania): https://docs.btcpayserver.org/FAQ/Deployment/
- BTCPay, waluty: https://docs.btcpayserver.org/Docker/cryptocurrencies/
- BTCPay, Lightning: https://docs.btcpayserver.org/Docker/lightning/
- BTCPay, stany faktur: https://docs.btcpayserver.org/Users/invoices/
- BTCPay, przewodnik integracji sklepu: https://docs.btcpayserver.org/Development/ecommerce-integration-guide/
- BTCPay, przykłady API (Greenfield, podpis webhooka): https://docs.btcpayserver.org/Developers/api/examples/
- BTCPay, typy zdarzeń webhooka (kod): https://github.com/btcpayserver/btcpayserver (BTCPayServer.Client/Models/WebhookEventType.cs)
- Polska ustawa o kryptoaktywach, trzecie weto: https://www.prawo.pl/biznes/trzecie-weto-ustawy-o-rynku-kryptoaktywow,1544811.html
- VAT/PIT płatności w krypto (źródła wtórne): https://poradnikprzedsiebiorcy.pl/-faktura-w-kryptowalucie-czy-mozna-taka-wystawic , https://www.infakt.pl/blog/?p=50319
