# Audyt płatności pawelperfect.com (Stripe, księga wpłat, panel zwrotów)

Data: 2026-10-05. Gałąź `audit/payments-2026-10-05` (od `main` @ `7a54a2d3`). Audyt na kodzie, bez dostępu do produkcji i bez żadnego
prawdziwego wywołania Stripe/Resend/Cloudflare. Wcześniejszy audyt (`docs/audit/2026-10-03/audit-feat-payments.md`) i faza 3 panelu traktowałem jako
niezweryfikowane i sprawdziłem w kodzie i w testach. Źródła zewnętrzne na końcu.

## 1. Werdykt

**Można przyjąć pierwszą prawdziwą wpłatę, pod warunkami z sekcji 7 (P0 przed startem).** Rdzeń jest poprawny: jedna kanoniczna ścieżka zapisu wpłaty z CAS,
sprawdzenie kwoty/waluty/intentu/użytkownika, podpis webhooka na surowym ciele, dedup zdarzeń, klucze idempotencji przy tworzeniu intentu i zwrocie,
zwrot ograniczony przez Stripe i bazę. Wszystkie krytyczne błędy z audytu z 3.10 (PAY-01, 04, 05, 09, 10, 11, 12) są naprawione w kodzie i mają testy.
Znalazłem **0 CRITICAL, 0 HIGH, 4 MEDIUM, 6 LOW, 6 INFO**. Dwa MEDIUM i cztery LOW naprawiłem (z testami, które przed poprawką padały).
Największe ryzyko jest operacyjne, nie w kodzie: **webhook nigdy nie dostał udanej wpłaty**, więc jego konfiguracja (sekret `whsec_` właściwego endpointu,
lista zdarzeń, tryb live) jest niesprawdzona na prawdziwych danych; zapasem są szybka ścieżka i cron co 15 minut.

## 2. Tabela znalezisk

| ID | Waga | Temat | Status |
|---|---|---|---|
| PA-01 | MEDIUM | `charge.refunded` / spór dla wpłaty jeszcze nie zapisanej jako opłacona psuje księgę albo ginie | NAPRAWIONE `f2aa7f8c` |
| PA-02 | MEDIUM | cron rekonsyliacji: wiersze z intentem nieznanym Stripe (testowe po przejściu na live) blokują paczkę 100 najstarszych | NAPRAWIONE `078875dd` |
| PA-03 | MEDIUM | usunięcie konta nie usuwa Klienta w Stripe (e-mail zostaje u Stripe) | DO DECYZJI (opcje niżej) |
| PA-04 | MEDIUM | księga zwrotów opiera się na lokalnym `refundedAmountMinor`; równoległe zwroty i zwroty z Dashboardu doganiane dopiero przez webhook; brak obsługi `refund.failed`; cron nie pyta Stripe o zwroty | OTWARTE (rekomendacja) |
| PA-05 | LOW | minimum napiwku z panelu (dozwolone od 1) może być niższe niż minimum Stripe (PLN 2,00): intent odrzucany, płacący widzi ogólny błąd | NAPRAWIONE `3fa3fae2` |
| PA-06 | LOW | widok rekonsyliacji pomijał `DISPUTED`: otwarty spór dawał fałszywą różnicę | NAPRAWIONE `ce2cd253` |
| PA-07 | LOW | walidacja env nie wykrywała `sk_live` z `pk_test` ani `STRIPE_WEBHOOK_SECRET` bez `whsec_` | NAPRAWIONE `4bbe679b` |
| PA-08 | LOW | `normalizedTotal` (panel użytkowników, eksport) pomija CHF i GBP (dawne PAY-13) | OTWARTE, tylko wyświetlanie |
| PA-09 | LOW | `adminRefund`: jeśli zapis audytu rzuci wyjątek PO udanym zwrocie w Stripe, DB nie jest zaktualizowana (dogoni webhook lub ponowienie z tym samym kluczem) | OTWARTE |
| PA-10 | LOW | Brak udokumentowanej retencji wierszy `Payment` (księgowość a RODO) | DO DECYZJI |
| PA-11 | INFO | wpłata w toku w chwili usunięcia konta może utworzyć znacznik wspierającego na koncie-nagrobku | brak działania |
| PA-12 | INFO | zdarzenie z `paymentId` spoza tej bazy (wspólne konto Stripe z innym środowiskiem) daje 500 i ponowienia do 3 dni; Stripe może wyłączyć endpoint | brak działania, gdy konto nie jest współdzielone |
| PA-13 | INFO | limit 10 intentów / 10 min liczy też ponowne użycie tego samego `requestId` (zmiany kwoty w tył i w przód) | UX |
| PA-14 | INFO | zwrot na `DISPUTED` dozwolony w use case i w skrypcie ops, zablokowany tylko w panelu | spójnie z decyzją panelu |
| PA-15 | INFO | opłaty Stripe nie są przechowywane, „netto” = po zwrotach, bez opłat | zgodnie z dokumentem fazy 3 |
| PA-16 | INFO | domyślny klucz idempotencji zwrotu (skrypt ops) i klucze Stripe wygasają po 24 h | akceptowalne |

## 3. Szczegóły

### PA-01 (MEDIUM, naprawione): zdarzenia zwrotu/sporu przed zapisem wpłaty
`lib/modules/payments/application/handle-refund.use-case.ts:191` (przed poprawką), `handle-dispute.use-case.ts:314-360`, CAS w `payment.repository.ts:92-118`.
Scenariusz: webhook leżał, wpłata ma status `PENDING` do crona (do 15 min), w tym czasie przychodzi `charge.refunded` (zwrot z Dashboardu) albo zdarzenia
Stripe przychodzą w odwróconej kolejności (Stripe tego nie gwarantuje). `handleRefund` ustawiał `REFUNDED`/`PARTIALLY_REFUNDED`, a późniejszy `fulfillPayment`
nie mógł już przejść (CAS wymaga `PENDING|FAILED|CANCELED`), więc nigdy nie powstał znacznik wspierającego ani wpis w `UserPaymentTotal`, za to suma
osoby była zmniejszana (clamp do 0 zaniżał sumy innych wpłat tej osoby). Spór na `PENDING` był po cichu pomijany jako „przetworzony”.
Poprawka: zdarzenie kończy się błędem ponawialnym (`PAYMENT_NOT_RECORDED_YET`, 500 dla Stripe), więc Stripe dostarcza je ponownie po zapisie wpłaty.
Dowód: `tests/unit/modules/payments/webhook-out-of-order.test.ts` (3 testy padały przed poprawką: 200 zamiast 5xx, status `PARTIALLY_REFUNDED` zamiast `SUCCEEDED`),
oraz Postgres `payments.pg.test.ts` (suma innej wpłaty nietknięta).

### PA-02 (MEDIUM, naprawione): cron zatkany wierszami z innego trybu Stripe
`app/api/cron/stripe-reconciliation/route.ts:199-207` (paczka 100, najstarsze pierwsze), `reconcile-payment.use-case.ts`. Po przejściu z kluczy testowych na live
`paymentIntents.retrieve` dla starych intentów testowych zwraca `resource_missing`; wiersz zostawał `PENDING` i zajmował miejsce w każdej paczce. Przy ≥100 takich
wierszach (wcześniej było 147 wierszy testowych) cron przestałby dochodzić do prawdziwych wpłat (webhook i szybka ścieżka nadal działają, więc to utrata warstwy zapasowej).
Poprawka: porzucony (>24 h) wiersz `PENDING` z `resource_missing` jest oznaczany `CANCELED` (zakres `?scope=recover` nadal go sprawdza, więc pomyłka kluczy jest odwracalna).
Świeży wiersz z takim błędem zostaje (test). Dowód: `tests/unit/cron/stripe-reconciliation.test.ts` (nowy test padał przed poprawką).
**Uwaga operacyjna:** przy przejściu na live i tak warto jednorazowo oznaczyć stare testowe wpłaty (lub je usunąć po decyzji właściciela, patrz PA-10).

### PA-03 (MEDIUM, do decyzji): Klient w Stripe po usunięciu konta
`lib/modules/users/application/account-deletion-cleanup.use-case.ts:146-156` czyści `stripeCustomerId` lokalnie i anonimizuje użytkownika, ale `customers.create`
(`create-checkout-intent.use-case.ts:76`) wysłał do Stripe e-mail i `metadata.userId`; obiekt Klienta zostaje. Dane transakcji Stripe i tak musi trzymać (księgowość,
AML), ale e-mail na Kliencie nie jest do tego potrzebny. Opcje: (A) przy usunięciu konta (best-effort, z kolejką ponowień jak usunięcie kontaktu Resend) wywołać
`customers.update(id,{email:null,name:null,metadata:{userId:''}})` (zalecane: zachowuje powiązanie płatności, kasuje dane osobowe); (B) `customers.del` (płatności zostają, Klient znika);
(C) nic, i opisać w polityce prywatności Stripe jako niezależnego administratora. Rekomendacja: A. Nie wdrażałem: to nowe wywołanie zewnętrzne w ścieżce usuwania konta i decyzja o polityce.
Dane płacącego u nas: e-mail i nazwa (konto), `Payment` (kwota, status, `metadata.requestId`, `refundReason` wpisany przez admina), brak IP i karty; `StripeEvent.payload` to tylko
`{id,type,created,livemode,object}` (bez danych osobowych); audyt zwrotu zawiera `userId`, nie e-mail; IP/UA w `AuditLog` są zerowane przez zadanie retencji.

### PA-04 (MEDIUM, otwarte): księga zwrotów a Stripe
`admin-refund.use-case.ts:363-378,421-432`. Limit zwrotu liczony jest z lokalnego `refundedAmountMinor`, a `handleRefund` dostaje „lokalne + żądane”.
(a) Dwa równoległe zwroty z różnymi kluczami (dwa okna, dwóch adminów) oba przechodzą lokalnie; Stripe pilnuje sumy (nie zwróci więcej niż wpłata), ale lokalnie wiersz zna tylko 500
z 1000, dopóki nie przyjdzie `charge.refunded` z `amount_refunded` (test Postgres to dokumentuje). (b) Zwrot z Dashboardu jest lokalnie widoczny dopiero po webhooku. (c) `refund.failed`
nie jest obsługiwane (monotoniczność kwoty ignoruje zmniejszenie). Przy działającym webhooku to samonaprawia się; przy niedziałającym księga się rozjeżdża, a widok rekonsyliacji tego nie
wykryje, bo nie pyta Stripe. Rekomendacja: w cronie (albo przyciskiem „Odśwież ze Stripe” przy wpłacie) czytać `charges.retrieve(...).amount_refunded` i wołać `handleRefund`; dopisać `refund.failed`.
Dobrze zrobione: skrypt ops porównuje zwroty w Stripe z bazą przed zleceniem i blokuje przy różnicy.

### PA-05 (LOW, naprawione): minimum poniżej minimum Stripe
`apps/admin/app/(panel)/ustawienia/actions.ts:93` pozwala ustawić minimum 1 w każdej walucie, a Stripe wymaga m.in. 2,00 PLN, 0,50 EUR/USD/CHF, 0,30 GBP. Intent z 1,50 PLN
kończył się błędem Stripe, wierszem `FAILED` i ogólnym komunikatem. Poprawka w `lib/payments/currency-settings.ts` (`STRIPE_MIN_CHARGE_MINOR`): efektywne minimum nigdy poniżej progu Stripe, bramka
i serwer pokazują i egzekwują to samo. Test w `payment-settings.test.ts` (padał przed poprawką). Waluty bezdziesiętne: nieobsługiwane (tylko PLN, EUR, USD, CHF, GBP, wszystkie 2 miejsca), więc `*100` jest poprawne.

### PA-06 (LOW, naprawione) i PA-07 (LOW, naprawione)
PA-06: `lib/modules/admin-revenue/queries.ts` (rekonsyliacja). `UserPaymentTotal` maleje dopiero przy przegranym sporze, więc `DISPUTED` musi być po stronie wpłat. Test sprawdza zapytanie.
PA-07: `lib/env/validation.ts`: w produkcji błąd, gdy `STRIPE_SECRET_KEY` i `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` są z różnych trybów albo sekret webhooka nie zaczyna się od `whsec_`
(sprawdzane przez `scripts/validate-env.ts`; klucze `rk_` obsłużone). Test padał przed poprawką. Webhook dodatkowo ignoruje zdarzenia z trybu innego niż klucz (już było, `handle-stripe-webhook.use-case.ts:129`).

### PA-08 do PA-10 (LOW, otwarte)
PA-08: `lib/modules/users/domain/payment-totals.ts:8-15` sumuje tylko PLN/EUR/USD. Naprawa: ta sama tabela kursów co `minorToPln` (osobny drobny commit, nie robiłem, by nie łamać granic modułów bez przeglądu).
PA-09: `admin-refund.use-case.ts:401` (`recordAuditEvent` bez try/catch) po udanym `refunds.create`. Skutek: akcja panelu kończy się błędem, lokalna kwota zwrotu czeka na webhook; ponowienie z tym samym kluczem
(okno zostaje otwarte) zwróci ten sam zwrot ze Stripe i dokończy zapis. Naprawa: najpierw `handleRefund`, potem audyt w try/catch z logiem. Nie zmieniałem: kolejność audytu to decyzja o priorytecie audytu nad spójnością.
PA-10: brak zapisanej polityki retencji `Payment` (zwykle księgowość wymaga wieloletniego przechowywania, do potwierdzenia z księgowym; RODO pozwala to dla obowiązku prawnego, a konto jest anonimizowane,
płatności zostają przy nagrobku, co jest właściwym wzorcem).

## 4. Obszary sprawdzone i poprawne (z dowodem)

* **Podpis webhooka**: surowe ciało `req.text()` przed jakimkolwiek parsowaniem (`app/api/webhooks/stripe/route.ts:17`), `Stripe.webhooks.constructEvent`, tolerancja domyślna 300 s
  (`node_modules/stripe/cjs/Webhooks.js:8`). Testy (uruchomione): zły sekret, zmodyfikowane ciało, brak nagłówka, brak `STRIPE_WEBHOOK_SECRET` (500), **stary znacznik czasu (400, nowy test)**.
* **Replay i dedup**: `StripeEvent.id` jako klucz główny, blokada `PROCESSING` z odzyskiwaniem `FAILED` i nieaktualnych (>10 min), `CONFLICT` daje 409 (ponowienie). Postgres: z 6 równoległych dostaw
  dokładnie jedna dostaje blokadę, `PROCESSED` jest potwierdzane jako duplikat, `FAILED` można przejąć (nowy test).
* **Baza niedostępna**: wyjątek z `acquireLock` trafia do `catch` trasy i daje 500 (nowy test), Stripe ponawia; zdarzenie nie jest potwierdzane. Błąd przetwarzania oznacza zdarzenie `FAILED` i też zwraca 500.
* **Realizacja wpłaty**: sprawdzenie id wpłaty, użytkownika z metadanych, intentu, kwoty i waluty; CAS `PENDING|FAILED|CANCELED → SUCCEEDED`; suma i znacznik tylko przy `count>0`. Postgres: 5 równoczesnych realizacji
  (webhook + szybka ścieżka + cron) liczą wpłatę **raz** (nowy test), niezgodna kwota nie zmienia wiersza.
* **Zwroty**: kwota ograniczona do wpłaty, monotoniczna (starsze zdarzenie nie cofa), CAS na `refundedAmountMinor`, replay i 4 równoległe identyczne zdarzenia stosują się raz, przy pełnym zwrocie znacznik znika tylko bez innych
  opłaconych wpłat (Postgres). Przegrany spór odejmuje kwotę netto i znacznik; wygrany przywraca `PARTIALLY_REFUNDED` lub `SUCCEEDED`; kolejność zdarzeń sporu rozstrzyga aktualny status ze Stripe (`disputes.retrieve`).
* **Tworzenie intentu**: wymagane logowanie (brak płatników anonimowych), zod `.strict`-owy kształt, `amountMinor` całkowite dodatnie, waluta z listy, min/maks po stronie serwera, `description` i metadane ustalane na serwerze,
  klucz idempotencji `payment-intent-<paymentId>`, unikalność `(userId, requestId)`, ponowne użycie tej samej próby, błędy Stripe nie wyciekają do klienta. `return_url` budowany w przeglądarce z `window.location`; serwer nie przyjmuje żadnego URL,
  więc nie ma otwartego przekierowania. Intenty nieutworzone przez aplikację (bez `paymentId`) są potwierdzane i ignorowane.
* **Status po powrocie**: odczyt tylko właściciela (`{id,userId}`), limit 60/min, ścieżka szybka przez to samo `fulfillPayment` (wyścig z webhookiem bezpieczny, patrz test Postgres).
* **Panel zwrotów**: brama (`openGate`: sesja ≤12 h, rola OWNER, odmowa na danych przykładowych, limit 10/10 min, **step-up 5 min**), zod `.strict`, ponowne wczytanie wpłaty i limit „zostało do zwrotu”, parser kwot (`parseMoneyToMinor`, bez błędu zmiennoprzecinkowego, ≤2 miejsca),
  klucz idempotencji z okna (regex 16-64 znaków) wchodzi do klucza Stripe, `DISPUTED` zablokowany w panelu, komunikat błędu Stripe nie wycieka (`PAYMENT_PROVIDER_ERROR` ogólny), audyt `PAYMENT_REFUNDED` z przed/po. Powtórzony zwrot z tym samym kluczem
  Stripe zwraca ten sam zwrot (dokumentacja Stripe), a `handleRefund` jest idempotentny.
* **Eksport CSV**: step-up, limit 5/10 min, audyt bez treści wyszukiwania, odporność na formuły (`= + - @ TAB CR`), cudzysłowy, CRLF, BOM; test z e-mailem `+evil@x.pl` i powodem `=cmd|...`. Nagłówki `no-store`.
* **Sekrety i tryby**: `getStripeClient` zgłasza błąd bez klucza (nic nie startuje po cichu), klucz nigdy nie trafia do logów ani wyników (test integracji panelu), tryb klucza czytany z publicznego prefiksu, webhook ignoruje zdarzenia innego trybu,
  panel potrzebuje tylko klucza ograniczonego (Refunds zapis, Disputes/Charges/PaymentIntents odczyt); webhook i cron działają na stronie.
* **Skrypt ops `refund-payment`**: domyślnie podgląd, `--yes` wymaga `--expect-refunded`, powód, zgodność id/kwoty/waluty, porównanie zwrotów Stripe z bazą, ponowne sprawdzenie w `app-runner.ts`, audyt operatora.
* **Brak bramkowania treści wpłatą**: znacznik wspierającego to prywatny zapis, bez progu kwoty (`ensureSupporterGrant`), nic z niego nie odczytuje dostępu.
* **Cron**: `CRON_SECRET` porównywany `timingSafeEqual`, brak klucza Stripe to 500, porzucone intenty są anulowane także w Stripe.

## 5. Testy: co dodałem i co udowadniają

* `tests/unit/modules/payments/webhook-out-of-order.test.ts` (5): zwrot/spór przed zapisem wpłaty (3 padały przed poprawką), stary znacznik czasu, baza niedostępna (2 przechodziły od początku, więc to potwierdzenie istniejącego zachowania).
* `tests/postgres/payments.pg.test.ts` (10), **uruchomiony na jednorazowym Postgresie**: pełny zestaw `vitest.postgres.config.ts` = 8 plików, 46 testów zielone. Dowodzi tego, czego atrapa w pamięci nie może: blokady wierszy i exactly-once pod współbieżnością,
  SQL z clampem do zera, unikalności, blokady `StripeEvent`, rozjazdu przy równoległych zwrotach (PA-04).
* Poprawki: testy w `stripe-reconciliation.test.ts`, `payment-settings.test.ts`, `revenue.test.ts`, `env-validation.test.ts` (każdy padał przed poprawką).
* **Słabe testy**: `getReconciliation` i wiele testów panelu to atrapy Prismy (sprawdzają kształt zapytania, nie wynik); `fake-payments-db` ma `$executeRaw` zwracające 1 bez dekrementacji, więc testy jednostkowe zwrotów nie sprawdzają `UserPaymentTotal`
  (pokrywa to teraz test Postgres). Brak testu end-to-end z prawdziwym Stripe (nie do wykonania tutaj).

## 6. Czego nie dało się zweryfikować

Prawdziwego Stripe (czy endpoint ma właściwy `whsec_`, subskrypcję zdarzeń `payment_intent.succeeded/canceled/payment_failed`, `charge.refunded`, `charge.dispute.*`, wersję API endpointu równą `2026-02-25.clover`), przeglądarki
(3-D Secure, BLIK, P24, CSP `hooks.stripe.com`, wygląd okna zwrotu), produkcji (stan tabel, ustawione zmienne), ograniczonego klucza Stripe w panelu (czy ma dokładnie wymagane uprawnienia), Cloudflare Access przed panelem,
zachowania Stripe przy `refund.failed` dla BLIK/P24.

## 7. Zalecenia w kolejności

**P0 przed pierwszą prawdziwą wpłatą (robi właściciel):**
1. W Stripe (live) utworzyć endpoint `https://www.pawelperfect.com/api/webhooks/stripe` z wersją API równą kodowi, zdarzenia: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`,
   `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`; wpisać jego `whsec_` do `app.env`. Zrobić jedną wpłatę testową w trybie testowym i sprawdzić w panelu (Przychody > Stripe i webhooki), że `StripeEvent` ma wiersz `PROCESSED`.
2. Przy przełączeniu na klucze live: `sk_live`/`pk_live`/`whsec_` z tego samego trybu (walidacja z PA-07 to teraz wymusi), potem uruchomić `GET /api/cron/stripe-reconciliation?scope=recover` raz i sprawdzić liczniki.
3. Klucz panelu jako `rk_live_` z uprawnieniami: Refunds zapis, Disputes/Charges/PaymentIntents odczyt.

**P1:** PA-04 (rekonsyliacja zwrotów ze Stripe w cronie, `refund.failed`), decyzja PA-03 (A) i PA-10 (retencja), PA-09 (kolejność audytu).
**P2:** PA-08 (CHF/GBP), a po przejściu na live decyzja, co zrobić ze starymi wpłatami testowymi.

## 8. Źródła

* Minimalne kwoty i waluty bezdziesiętne: https://docs.stripe.com/currencies (PLN 2,00, EUR/USD/CHF 0,50, GBP 0,30; Stripe oczekuje kwot w najmniejszej jednostce).
* Kolejność zdarzeń nie jest gwarantowana, deduplikacja po id zdarzenia: https://docs.stripe.com/webhooks
* Klucze idempotencji: wynik (także błąd) jest zapisywany, klucze mogą być usuwane po 24 h, różne parametry z tym samym kluczem dają błąd: https://docs.stripe.com/api/idempotent_requests
* Tolerancja podpisu 300 s: kod `stripe-node` (`Webhooks.js`) w `node_modules`.
* Wstrzykiwanie formuł w CSV: https://owasp.org/www-community/attacks/CSV_Injection
