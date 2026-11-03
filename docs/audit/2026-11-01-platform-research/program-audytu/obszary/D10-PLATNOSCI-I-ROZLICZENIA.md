# D10 — płatności, dostęp i rozliczenia

Partia 09, 1 listopada 2026. Polutek `c397b9e548ca2c628e21457ac69d66e54b12ddbd`; PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. **W_TRAKCIE**, bez zmian aplikacji, produkcji, kont Stripe i przepływu prawdziwych pieniędzy. [Zakres i hashe](../evidence/batch09-review.json), [scenariusze](../SCENARIUSZE-PLATNOSCI.csv), [walidacja materiału](../evidence/validation-batch09.json).

## Wniosek dla właściciela

W kodzie istnieją sensowne zabezpieczenia potwierdzania płatności. W wykonanym modelu zmieniona kwota, waluta, identyfikator płatności Stripe lub użytkownik nie przyznały dostępu; powtórzenie potwierdzenia nie przedłużyło go drugi raz. Rzeczywisty Stripe SDK odrzucił zmienione podpisane body. To konkretne atuty badanych funkcji.

Znaleziono także dwa nowe problemy: **R31 — zwrot jednej wpłaty może odebrać dostęp opłacony inną**, **R32 — kolejność sporu i uzgadniania zwrotu może zaniżyć sumę wpłat użytkownika**. W przyszłym marketplace wzmocniono dowód wcześniejszego R17: lokalna odmowa po konflikcie następuje już po wywołaniu operatora. Nie zmienia to istniejącego Stripe refund w dowiedziony podwójny zwrot.

Nie zakończono audytu finansowego ani testu całej kasy. Wszystkie sześć wybranych istniejących plików Vitest zostało zablokowanych przed rejestracją przez brak wygenerowanego Prisma/enumów: **zero wykonanych testów**, globalny exit 1. Wyniki z odrębnych skryptów mają jawnie inny poziom dowodu.

## Trzy różne produkty i trzy ewidencje

| Ścieżka | Cena i księgowanie | Dostęp / stan |
|---|---|---|
| Napiwek | Payment, UserPaymentTotal, prywatny PatronGrant | Znacznik wspierającego nie uprawnia do oglądania. Okno napiwku według dokumentacji jest ukryte; nie sprawdzano aktywnego UI/konfiguracji produkcji |
| Strefa patrona | Payment z metadata.purpose=premium_pass; kwota z serwerowej tabeli produktów i walut | AppSetting `xp.premium_pass:<userId>` przechowuje zbiorczy JSON dostępu, nie Order/Entitlement. Tryby demo, Stripe test i Stripe live wymagają odrębnej oceny |
| Przyszły marketplace wielu twórców | Order, LedgerEntry, Entitlement; split groszowy VAT/netto/prowizja/udział twórcy | Moduł sales domyślnie wyłączony. Dokumentacja deklaruje brak kompletnego adaptera zakupu/zwrotu oraz wypłat. Nie uruchamiano go na produkcji |

Źródła: [cykl płatności i napiwków](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/CLAUDE.md#L78), [patron-zone](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/architecture/patron-zone.md#L83), [sales](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/sales/application/sales.use-cases.ts), [wyłączniki](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/platform-gates.ts). To opis kodu i dokumentacji, nie nowy odczyt konfiguracji serwera lub konta Stripe.

Strefa demo zapisuje DEMO i nie tworzy wpłaty. Tryb Stripe wymaga zgodności kluczy i sekretu webhooka; live dodatkowo otwartej bramki sales. Osobne klucze premium i znacznik zestawu na płatności zapobiegają odpytywaniu testowej płatności kluczem innego zestawu. W tej partii nie wykonano całej macierzy trybów, przełączania konfiguracji, resetowania demo ani produkcyjnego rozdzielenia kluczy.

## Co wykonano i czego dotyczą wyniki

| Badanie | Wynik | Ograniczenia |
|---|---|---|
| [Sześć istniejących plików Vitest](../evidence/payment-targeted-vitest.json) / [log](../evidence/payment-targeted-vitest.log) | 6 zablokowanych, 0 zarejestrowanych testów, exit 1 | Cztery pliki nie odczytały PaymentStatus.PENDING, dwa importowały niewygenerowany klient. Nie są to potwierdzone defekty produkcji; nie zmieniano importów ani nie instalowano fałszywego klienta |
| [Rzeczywiste komponenty płatności](../evidence/payment-boundaries-experiment.json) | 18 obserwacji, exit 0 | Rzeczywiste repozytorium, use case, grant, parser i signer SDK; jawna atrapa DB, model transakcji i GREATEST, atrapowe Stripe API/audyt/poczta. Bez dispatchu tras HTTP, Prisma, realnych blokad i Stripe API |
| [Osobny PostgreSQL 17.11](../evidence/payment-total-sql-experiment.json) | 2 sekwencyjne protokoły R32, exit 0 | Prawdziwe zmigrowane Payment/UserPaymentTotal i SQL/CAS, bez wywołania TypeScript/Prisma/webhooka. Własne losowe fixture wycofano ROLLBACK; nie badano współbieżnej izolacji |

Skrypty: [komponenty](../tools/payment-boundaries-experiment.cjs), [SQL](../tools/payment-total-sql-experiment.py). Kontrolują hashe bazowych źródeł. Harness komponentów używa również istniejącej atrapy testowej, lecz dodaje odczyty zwracające migawki, model rollback i jawny model SQL decrement; pierwotna atrapa ma `$executeRaw` zwracający tylko 1, co nie sprawdza arytmetyki odejmowania. Nadal nie zastępuje to prawdziwej DB. Oba skrypty od pierwszego uruchomienia zakończyły się exit 0, logi puste. Nie powtarzano pełnego Vitest ani generowania Prisma przy tej samej blokadzie.

## R31 — zwrot starego pakietu kasuje nowszy opłacony dostęp

Rzeczywisty łańcuch w skrypcie: `fulfillPayment → PaymentRepository CAS → grantPatronAccessForPayment → read/writePass`, następnie `syncRefundsFromStripe → applyRefundedTotal → revokePatronAccessForPayment`. Stripe refunds.list i baza są jawnie atrapowe; sam algorytm i walidacja JSON pozostają niezmienione.

1. Wpłata A kupuje 30 dni od 1 stycznia do 31 stycznia.
2. Po wygaśnięciu, 1 marca wpłata B kupuje nowy okres do 31 marca. A pozostaje na liście paymentIds, co zachowuje pamięć idempotencji.
3. Pełny zwrot A odejmuje 30 dni od **bieżącego wspólnego expiresAt** i ogranicza datę do teraz: 1 marca.
4. B pozostaje SUCCEEDED, na liście pozostaje B i suma 1499 gr, ale `passStateOf` zwraca **expired**.

Nie ma w rekordzie informacji, które okresy były już zużyte i jaki fragment bieżącej daty wynika z konkretnej wpłaty. Blokada advisory serializuje zapis, lecz nie naprawia tego błędu sekwencyjnego. Stan expired dotyczy grantu dla nowych decyzji dostępu; wcześniej wydany token może jeszcze działać zgodnie z osobno zbadanym R07. Nie wykonano tu odmowy pełnego planu/HTTP ani przerwania odtwarzania. Kontrola dodatnia: dwa zakupy aktywnych okresów w marcu dają 60 dni; zwrot jednego pozostawia 30 dni, a replay zwrotu niczego ponownie nie odejmuje.

Drugi wariant tego samego R31: dwa opłacone zakupy lifetime zapisują oba paymentIds, ale tylko ostatni lifetimePaymentId. Zwrot ostatniego usuwa lifetime pomimo nadal opłaconego wcześniejszego. Zwrot starszego prawidłowo pozostawia nowszy lifetime. Testowe powtórzenia zakupów są jawnie dozwolone; dla live potrzebne są dwie opłacone próby rozpoczęte przed przyznaniem pierwszego lifetime. Źródłowo `startPatronPayment` sprawdza aktualny grant przed stworzeniem próby; dispatchu dwóch kas ani rzeczywistych wpłat nie wykonano.

Źródła: [grant i revoke](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/patron-zone/application/patron-grant.ts), [applyProduct / parsePassRecord](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/patron-zone/domain/pass-state.ts), [blokada/check przed checkout](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/patron-zone/application/patron-checkout.use-case.ts#L45), [istniejące testy](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/tests/unit/modules/patron-zone/premium-pass-fulfilment.test.ts#L171).

**Ocena:** potwierdzony błąd komponentów, P1 przed szerszą obsługą płatnych pakietów i refundów, niezależny przegląd PENDING. Nie dowiedziono incydentu na produkcji. Sposób rozliczenia zwrotu już zużytej usługi wymaga polityki produktu; obecny automat bezwarunkowo zmienia udział innej, nadal opłaconej wpłaty.

**Kierunek poprawy:** osobna, odtwarzalna ewidencja wkładu każdej płatności do dostępu, z regułą refundu konkretnego okresu i ponownym wyliczeniem uprawnienia. Nie wystarczy mutex ani zmiana kolejności eventów. Odbiór: wygasły A → nowy B → zwrot A, dwa lifetime, refund starszego/nowszego, ponowienie i odwrócenie refundu; wszystkie przez DB/HTTP po określeniu polityki.

## R32 — kolejność zdarzeń zmniejsza sumę innej wpłaty

Kontrolowana historia ma dwie wcześniej opłacone wpłaty: A=1000 gr i B=500 gr; UserPaymentTotal=1500 gr. U operatora A ma częściowy zwrot 400 gr oraz przegrany spór dotyczący pozostałej wartości. Nie tworzono takiej operacji w Stripe; to założona historia wejścia wymagająca późniejszej weryfikacji w sandboxie operatora.

| Kolejność przetwarzania w aplikacji | Wynik sumy | Stan A na końcu |
|---|---|---|
| Najpierw uzgodnienie zwrotu 400, następnie lost odejmujący lokalne netto 600 | **500 gr**, prawidłowo zachowana B | CHARGEBACK_LOST, refunded=400 |
| Najpierw lost przy lokalnym refunded=0 odejmujący 1000, następnie spóźnione uzgodnienie zwrotu odejmujące kolejne 400 | **100 gr**, B zaniżona o 400 | Ten sam CHARGEBACK_LOST, refunded=400 |

Wynik jest zgodny w rzeczywistych komponentach z modelem DB oraz w osobnym SQL na prawdziwych tabelach PostgreSQL. [handleDispute](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/payments/application/handle-dispute.use-case.ts) odejmuje amountMinor minus lokalne refundedAmountMinor. [applyRefundedTotal](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/payments/application/handle-refund.use-case.ts) zachowuje CHARGEBACK_LOST, lecz dodatni deltaRefundMinor ponownie odejmuje sumę. Tylko ujemna delta ma warunek pomijający tę korektę po CHARGEBACK_LOST. [Repozytorium](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/payments/infrastructure/payment.repository.ts) ogranicza wynik GREATEST(0,...), co chroni przed liczbą ujemną, ale nie przed zabraniem wartości innej wpłaty.

**Wpływ:** nieprawidłowa agregacja UserPaymentTotal; nie pokazano drugiego obciążenia karty, podwójnego refundu ani straty wypłaty twórcy. Podstawowe rekordy obu wpłat pozostają dostępne. [Panel getReconciliation](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/admin-revenue/queries.ts#L117) porównuje sumy z Payment i UserPaymentTotal i może wykazać różnicę; nie uruchomiono panelu i nie dowiedziono automatycznej naprawy agregatu przez cron. Potwierdzone w granicach historii aplikacji i SQL, P2, niezależny przegląd PENDING; prawdziwy przebieg refund/dispute u operatora pozostaje niewykonany.

**Kierunek poprawy:** korekty agregatu wyliczać ze zmiany rzeczywistego wkładu płatności, uwzględniając refund i stratę w sporze łącznie. Odbiór: wszystkie kolejności i powtórzenia refund/open/lost/won, częściowe kwoty, druga wpłata użytkownika i inne waluty; zgodność z agregacją kanonicznych Payment po każdej historii.

## R17 — mocniejszy dowód ryzyka przyszłego marketplace

Wywołano niezmienione `refundOrder` z jawną zgodą atrapy authorize, otwartą wyłącznie w modelu bramką sales oraz **operatorem-atrapą bez deduplikacji**. Dwie równoległe prośby po 300 gr najpierw doszły do operatora. Po zwolnieniu kontrolowanej bariery jedna zapisała lokalne 300 gr i jeden wpis księgi, druga odpadła na CAS. Operator-atrapa zarejestrował łącznie **600 gr**, lokalne zamówienie **300 gr**. Interfejs IssueRefund nie przekazuje obowiązkowego klucza operacji. Nie testowano prawdziwego adaptera, bo dokumentowany moduł nie ma kompletnej integracji.

Kontrole: zamknięta bramka nie wywołuje operatora; odmowa operatora nie zmienia lokalnej kwoty i księgi. Nie sprawdzano autoryzacji tą atrapą. Ta próba wzmacnia istniejący R17, bez nowego ID i bez twierdzenia o podwójnym refundzie aktualnej kasy Stripe.

Obecny [adminRefund](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/payments/application/admin-refund.use-case.ts) źródłowo ma znacznie pełniejszy protokół: pre-sync z operatorem, klucz idempotencji, audit zamiaru przed operacją, post-sync i best-effort audit po operacji. [Akcja panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/app/%28panel%29/przychody/actions.ts) ma gate/step-up, walidację, ponowny odczyt kwoty i odmawia zwrotu DISPUTED. W tej partii nie uruchomiono tej ścieżki ani nie uznano obecności gate za zamknięcie wcześniejszego R13 o świeżości tożsamości.

R17 pozostaje ryzykiem P1 **przed uruchomieniem sprzedaży wielu twórców**. Docelowy protokół wymaga trwałej tożsamości operacji, uzgadniania nieznanego wyniku i spójnych wpisów księgi; sam retry SDK nie nadaje tożsamości biznesowej dwóm osobnym żądaniom.

## Poprawne granice i świadomie ręczna obsługa

- W wykonanym fulfillPayment kwota, waluta, intent i zgodność użytkownika są porównywane z lokalnym Payment przed CAS. Powtórzenie potwierdzenia nie zwiększa sumy ani okresu. Nie badano tu wszystkich błędów granicznych zapisu/rollback na rzeczywistej DB.
- Refund przed zapisem sukcesu został odrzucony jako wymagający ponowienia; nie obniżył sumy, której wcześniej nie podniesiono.
- Realny SDK Stripe 20.4.1 odrzucił body zmienione po podpisaniu; poprawny event przeszedł, a ten sam event ponownie dał duplicate. W pamięci przechowywano syntetyczny sekret, nie drukowano go. Nie wykonywano prawdziwego dostarczenia HTTP ani całej macierzy kluczy i czasu podpisu.
- Źródłowo webhook czyta surowe body z limitem 1 000 000 B przed podpisem, zapisuje StripeEvent i rozróżnia in-progress/duplicate/failed. Przejęcie blokady po 10 minutach i własność zakończenia wymagają osobnej próby; nie zaliczono ich samą nazwą klasy LockService.
- Sync refundów pobiera bieżącą listę podczas blokady wiersza i ma ograniczenia czasu/paginacji. W skrypcie lista jest atrapowa, blokady nie są prawdziwe; zakres ten nie jest zakończony.
- Częściowy zwrot nie zmienia dostępu. Po cofnięciu pełnego zwrotu Payment wraca do SUCCEEDED, dostęp nie wraca sam. To **znana ręczna polityka**, opisana w [wcześniejszym audycie patron-zone](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/architecture/patron-zone-audit.md#L73); nie dodano jej jako nowego odkrycia. Spory także mają opisaną ręczną obsługę dostępu; nie oznacza to zakończonej decyzji o docelowej polityce.

Źródłowo cron ma rutynowy/recovery tryb sprawdzania wpłat, okresowy sync refundów i autoryzację tokenem. Timer deklaruje 15 minut. Nie sprawdzano działania timera, endpointu dostawcy, subskrypcji eventów, wersji API ani alertów na produkcji. Wcześniejsze odczyty Stripe zawarte w patron-zone-audit są historyczne, nie aktualnie potwierdzone.

## Porównanie i źródła z internetu

W wybranym rdzeniu PeerTube znaleziono pole support i [modal wsparcia renderujący treść Markdown](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/src/app/shared/shared-support-modal/support-modal.component.ts). Przegląd tych plików i wyszukiwanie w server/core oraz packages/models nie dostarczyły odpowiednika kas Polutka, refundów i księgi marketplace. Nie jest to audyt wszystkich pluginów PeerTube ani dowód braku każdej integracji płatniczej. Nie wystawiamy mu fikcyjnej przewagi finansowej; w tym obszarze punktem odniesienia jest protokół dostawcy i spójność księgowania.

Pobrano online oficjalny [README stripe-node v20.4.1](../sources/stripe-node-20.4.1-README.md), dokładnie zainstalowanej wersji, i [licencję MIT](../sources/stripe-node-20.4.1-LICENSE). [HTTP 200, adresy i hashe](../sources/fetch-stripe-batch09.json). Przeczytano podpis na raw body, testowy generator podpisu, retry/idempotency i timeout; nie całą dokumentację Stripe. README opisuje automatyczne klucze przy odpowiednich retry; nie dowodzi deduplikacji dwóch odrębnych refundów biznesowych. Kopie niezmienione, atrybucja Stripe, Inc. / Ask Bjørn Hansen, [SOURCES](../SOURCES.md). Nie pobierano prywatnych zdarzeń ani kluczy i nie łączono się z API Stripe.

## Otwarte przed oceną gotowości finansowej

Pełna kasa i Stripe sandbox, 3DS/BLIK/P24/metody/waluty, klucze i webhooki, wyjątki przed/po każdym COMMIT i skutku operatora, rzeczywiste blokady i równoległość, utracone/poza kolejnością eventy oraz starsze konfiguracje. W szczególności: migawka sporu pobrana przed transakcją, utrata właściciela blokady eventu, współbieżna zmiana próby zakupu, ograniczenie historii paymentIds i mieszane waluty zbiorczego dostępu pozostają pytaniami do dalszych prób, bez nowych ID na podstawie samego podejrzenia.

Wypłaty, VAT/podmiot prawny, dokumenty sprzedaży i potwierdzenia, chargeback i koszty operatora, zgody, obsługa reklamacji, panel dostępu i audyt operacji wymagają odrębnego rozliczenia. Czytelny ekran checkout nie dowodzi kompletności tych funkcji. R05 powiadomień nie odtwarzano ponownie i nie uznano za naprawiony. Ta partia nie przeprowadza zmian prawnych, konfiguracji usług ani napraw aplikacji. Następny obszar programu: **D12 — prywatność, eksport, usunięcie i retencja danych**.
