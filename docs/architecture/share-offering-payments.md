# Płatności za zapisy na akcje: kto przyjmie pieniądze i jak zbliżyć się do "jak Stripe" (notatka badawcza, system NIEAKTYWNY)

Status: **INACTIVE, notatka badawcza (2026-10-19); nic z tego nie jest wdrażane, nie ma kodu, migracji ani zmian w produkcji.** Dokument rozwija §3 i §4.2 pkt 4 studium `share-offering-feasibility.md` (które zostaje nadrzędne) i nie zmienia zasad z CLAUDE.md §4.1, §4.2, §4.10, §4.14, §4.24, §4.25 ani wyłączników `sales`, `payouts`, `channelCreation` (zostają `off`). Nowy wyłącznik `shareOffering` z feasibility §4.1 pozostaje projektem (domyślnie `off`). Kontekst: `payments-resilience.md`, `crypto-gateway-plan.md`, `payments-and-tips.md`.

Pytanie właściciela: "znajdź NAJLEPSZY sposób przyjmowania tych płatności, żeby działało jak Stripe (szybko, płynnie, automatycznie)".

**To nie jest porada prawna ani podatkowa.** Dokument porządkuje fakty z dostępnych źródeł i listę pytań do licencjonowanego prawnika (rynek kapitałowy, KSH), księgowego i banku. Każde twierdzenie ma jedno z trzech oznaczeń:

- **[zweryfikowano]** = przeczytane w źródle pierwotnym (regulamin, lista branż zakazanych, strona produktu operatora lub banku, dokument KNF) w dniu 2026-10-19; podany URL.
- **[wtórne]** = z portalu prawniczego, prasy, bloga, opisu wyniku wyszukiwarki albo z dokumentu pierwotnego, którego treści nie otwarto w całości; do sprawdzenia przed decyzją.
- **[niezweryfikowano]** = z pamięci, wniosek własny albo brak źródła; traktować jako hipotezę.

Uwaga o narzędziach sesji: wyszukiwarka zwraca streszczenia, nie pełne strony; kilka stron było zablokowanych (Revolut: 403; część stron PDF dało się odczytać dopiero po pobraniu i ekstrakcji tekstu). Wersje dokumentów operatorów bywają stare (np. załącznik PayU jest z 2020 r.) i operatorzy zmieniają listy bez uprzedzenia. Przy każdym operatorze **ostateczną odpowiedzią jest pisemne stanowisko operatora** (szablon w §6).

## 0. Werdykt (szczerze)

1. **Doświadczenie "dokładnie jak Stripe" (karta lub BLIK w jednym kliknięciu, od razu rozliczone, z chargebackiem po stronie operatora) NIE jest dla tego produktu dostępne w uczciwy i bezpieczny sposób.** Stripe zakazuje w Polsce "equity crowdfunding" [zweryfikowano, §1.1], Paynow zakazuje sprzedaży udziałów i akcji [zweryfikowano], PayU i Autopay mają w publicznych listach zapisy, które wprost lub szeroko wyłączają ten rodzaj usług [zweryfikowano, ale PayU wg wersji z 2020 r.]. Pozostali (Przelewy24, Tpay, Adyen, Checkout.com, PayPal, Mollie) nie zakazują wprost, ale albo traktują branżę jako "ograniczoną" (wymagają zgody po dodatkowej weryfikacji), albo zostawiają decyzję do uznania operatora. **To oznacza: każda droga przez PSP wymaga pisemnej zgody konkretnego operatora, a jej brak = ryzyko zamrożenia środków i rozwiązania umowy w trakcie zbiórki.**
2. **Najbliższa legalna alternatywa to przelew bankowy na dedykowany numer rachunku wirtualnego przypisany do każdego zapisu, opakowany w "stripe'owy" interfejs**: kod QR i przycisk "kopiuj", natychmiastowy ekran "zlecono wpłatę", automatyczne dopasowanie wpłaty w minutach (nie w sekundach, jeśli bank nie ma kanału zdarzeń) i status, który sam zmienia się na "wpłata zaksięgowana". Płynność jest wtedy ok. 80% tego, co klient zna ze Stripe, a zgodność jest najlepsza z dostępnych, bo jedyną stroną wymagającą zgody jest bank spółki.
3. **Szybkość płatności nie jest wąskim gardłem tego produktu.** Akcje powstają po wpisie podwyższenia do KRS, wpis do rejestru akcjonariuszy następuje potem, a okno zapisów trwa co najmniej 2 tygodnie, jeśli art. 440 KSH ma zastosowanie (feasibility §0, §4.3). Różnica między "zaksięgowano w 5 sekund" a "zaksięgowano w 30 minut" nie zmienia momentu, w którym inwestor dostaje akcję. Dlatego **nie warto ryzykować konta ani reputacji dla szybszego zaksięgowania**; ciężar UX leży w tym, żeby klient w każdej chwili wiedział, co się stało i co będzie dalej.
4. **Rekomendacja w skrócie (§5):** Plan A = przelew na rachunek wirtualny per zapis na wydzielonym rachunku spółki (bez PSP); Plan B = dodanie pay-by-link/BLIK tylko u operatora, który dał pisemną zgodę (najpierw zapytać Przelewy24 i Tpay; PayU, Autopay, Paynow i Stripe odpadają z powodu własnych zapisów); Plan C = pośrednik z zezwoleniem (dom maklerski przyjmujący zapisy i wpłaty, albo licencjonowana platforma ECSP), jeśli bank lub prawnik wykluczy samodzielne przyjmowanie wpłat.
5. **Czego nie robić:** nie obchodzić zakazów przez "podstawioną" spółkę, cudzy rachunek, drugi sklep ani przez ukrywanie branży przy onboardingu (rozwiązanie umowy, zatrzymanie środków, ryzyko karne i AML); nie używać do tego konta Stripe z napiwkami (może zamrozić cały przychód z napiwków, feasibility §3.2); kryptowaluty nie rozwiązują problemu (to ta sama oferta akcji, te same przepisy KSH i AML; zob. `crypto-gateway-plan.md`).

## 1. Dostawcy płatności: kto przyjmuje, a kto odrzuca

Stan na 2026-10-19. "Branża" = emisja własnych akcji spółki niepublicznej przez samego emitenta (S.A.), na dokumencie z art. 37a, bez pośrednika i bez obrotu wtórnego. Treść zasad podaję w tłumaczeniu na polski; w cudzysłowie tylko krótkie nazwy kategorii.

### 1.1 Tabela dostawców

| Dostawca | Wynik dla naszej branży | Co mówi polityka (skrót) | Jak traktuje podmiot bez licencji / czynność regulowaną | Źródło | Poziom |
|---|---|---|---|---|---|
| **Stripe** | **ZAKAZ (Polska)** | Kategoria "Equity crowdfunding": ograniczona dostępność, obsługiwana w Australii, Niemczech, Francji, Singapurze, Wielkiej Brytanii i USA, **zabroniona we wszystkich pozostałych krajach**. Osobno "Investment and brokerage services" = ograniczone (kontakt z działem sprzedaży). Nie ma pozycji o "sprzedaży akcji" jako takiej. | Stripe deklaruje, że jako firma finansowa musi przestrzegać przepisów finansowych; usługi finansowe wymagają kontaktu z działem sprzedaży. | https://stripe.com/legal/restricted-businesses | zweryfikowano |
| **Paynow (mBank)** | **ZAKAZ** | Pozycja 21 listy zakazanej: udziały w spółkach, akcje, obligacje i inne papiery wartościowe oferowane jako forma inwestowania lub lokowania środków; pozycja 26: crowdfunding z wyłączeniem organizacji pożytku publicznego. | Pozycja 27: inne niezgodne z przepisami prawa. | https://static.paynow.pl/docs/lista_towarów_i_uslug_zakazanych.pdf | zweryfikowano (tekst wyciągnięty z PDF) |
| **PayU** | **Wg listy prawdopodobnie ZAKAZ** | Załącznik 1 do regulaminu PayU (wersja z lipca 2020): zakazane "Crowdfunding" oraz produkty i usługi finansowe, jeśli są oferowane w ramach działalności nienadzorowanej przez właściwe organy nadzoru finansowego. Nasz emitent nie jest podmiotem nadzorowanym przez KNF (nadzór dotyczy dokumentu następczo), więc literalnie wpada w drugi zapis. | Wprost: nienadzorowane usługi finansowe są zakazane. | https://poland.payu.com/wp-content/uploads/sites/14/2020/07/annex_no_1_TC-of-the-PayU-System_List-of-types-of-goods-and-services-forbidden-to-trade-in.pdf | zweryfikowano treść; **wersja z 2020 r., aktualną sprawdzić** |
| **Autopay (Blue Media)** | **Wg listy prawdopodobnie ZAKAZ** | Lista branż i produktów zakazanych dla płatności online zawiera: "financial products and services, including financial services intermediation" oraz programy inwestycyjne/prezentowanie rozwiązań biznesowych/seminaria; płatności uruchamiane tylko dla towarów i usług zgodnych z prawem polskim. | Szeroki zakaz produktów finansowych. | https://developers.autopay.pl/en/online/list-of-prohibited-products-and-industries | zweryfikowano |
| **Przelewy24 (PayPro S.A.)** | **Brak zakazu w regulaminie; decyzja przy onboardingu** | Regulamin (§3 ust. 4) zakazuje obsługi płatności za nielegalne towary i usługi, towary niedopuszczone do obrotu w UE oraz za dostęp do treści pornograficznych; **nie wymienia papierów wartościowych ani crowdfundingu**. Operator ma też weryfikację transakcji pod kątem AML. Osobnej listy branż nie znaleziono. | Nieznane: pytać. | https://www.przelewy24.pl/en/regulations | zweryfikowano regulamin; polityka onboardingowa **niezweryfikowano** |
| **Tpay (Krajowy Integrator Płatności)** | **Brak zakazu na liście; decyzja przy onboardingu** | Załącznik 1 (13 pozycji: pornografia, nielegalny hazard, mowa nienawiści, prawa autorskie, chemikalia, narkotyki, materiały wybuchowe, broń, organy, podróbki, oprogramowanie do nielegalnych celów, bazy danych osobowych itd.) **nie zawiera papierów wartościowych ani crowdfundingu**. Beesfund (platforma zezwoleniowa) wskazuje inwestorom Tpay jako operatora wpłat (w opisie crowdfundingu pożyczkowego). | Nieznane: pytać. | https://tpay.com/user/assets/files_for_download/attachment-1-list-of-goods-and-services-for-which-it-is-forbidden-to-accept-payments-through-the-site.pdf ; Beesfund: https://beesfund.com/blog/crowdfunding-pozyczkowy/ (strona zwróciła 404 przy próbie odczytu; informacja z wyniku wyszukiwarki) | lista: zweryfikowano; użycie przez Beesfund: wtórne |
| **Dotpay** | Nie zbadano | Nie znaleziono aktualnej listy ani aktualnego właściciela (starsze doniesienia: właściciel Mobiltek/MCI 2016, potem Nets/Dotcard 2019). | - | wyniki wyszukiwarki | niezweryfikowano |
| **Adyen** | **OGRANICZONE (tylko po zgodzie), zakaz dla platform** | Lista (wersja polska): "Maklerzy papierów wartościowych/inwestycje wszelkiego rodzaju" = R dla sprzedawcy, P dla platformy; "Finansowanie społecznościowe" = R/R; papiery wartościowe wysokiego ryzyka (CFD, ICO, opcje) = R/P; usługi finansowe lub pieniężne = R/P. R wymaga dodatkowej dokumentacji przed akceptacją. Brak osobnej pozycji dla emisji własnych akcji. | **Niezależni lub nielicencjonowani doradcy finansowi = P (zakaz)**; akcje na okaziciela = P. | https://www.adyen.com/pl_PL/legal/list-restricted-prohibited | zweryfikowano |
| **Checkout.com** | **OGRANICZONE (dodatkowa weryfikacja)** | Strona "eligibility" (data na stronie 2026-05-18): wśród działalności objętych dodatkową weryfikacją jest sprzedaż akcji, obligacji, papierów wartościowych, opcji, kontraktów terminowych albo "udziału inwestycyjnego w jakimkolwiek podmiocie lub nieruchomości" oraz usługi escrow. | Restricted = można współpracować po dodatkowym due diligence. | https://support.checkout.com/hc/en-us/articles/15260165363602-Check-your-eligibility-to-become-a-customer | zweryfikowano |
| **PayPal** | **Wymaga zgody wstępnej (pre-approval)** | Polityka dopuszczalnego użytkowania (wersja US): w "Activities requiring approval" jest pozycja "Investments": kupno, sprzedaż lub pośrednictwo w obrocie akcjami, obligacjami, papierami wartościowymi, opcjami, towarami, CFD/forex, funduszami lub "udziałem inwestycyjnym w jakimkolwiek podmiocie". Wersji polskiej strony nie udało się odczytać. | Brak zgody = ograniczenie konta i wstrzymanie środków (do 180 dni wg streszczenia wyszukiwarki). Dodatkowo karta/konto = ryzyko sporów. | https://www.paypal.com/us/legalhub/paypal/acceptableuse-full | zweryfikowano (US); 180 dni: wtórne |
| **Mollie** | **Nie na liście odrzuceń, ale decyzja indywidualna** | Lista "nieakceptowanych" zawiera m.in. usługi powiernicze ("trust services"), schematy piramidowe/"get rich quick", aukcje z opłatą; **nie wymienia papierów wartościowych ani crowdfundingu**. Mollie ocenia każdy wniosek indywidualnie i może odrzucić działalność spoza listy. Niektóre branże wymagają rejestracji w Visa/Mastercard. Mollie nie jest dziś rozwiązaniem dla polskiego emitenta (brak potwierdzenia obsługi polskiej spółki; nie sprawdzano). | Może odrzucić poza listą. | https://help.mollie.com/hc/en-us/articles/115000939369-Which-products-and-services-does-Mollie-not-accept | zweryfikowano listę; dostępność dla PL **niezweryfikowano** |
| **SumUp** | Ograniczone / odpada | Wg streszczenia wyszukiwarki strona "Restricted Businesses": crowdfunding "nie może służyć do zakupu akcji lub udziałów", obrót papierami wartościowymi ograniczony, brokerzy i dealerzy ograniczeni. Strony nie udało się odczytać (renderowana skryptem), a wersja dotyczy rynku USA. | - | https://help.sumup.com/en-US/articles/5QRbkfSZrnJsxjG5tUfpO9-restricted-businesses | wtórne |
| **Revolut Business / Merchant** | Prawdopodobnie odrzuci | Wg streszczenia wyszukiwarki: w wersji strony dla niektórych krajów "Unsupported industries" są platformy crowdfundingowe i fundusze inwestycyjne; osobna strona dla Merchant Account ma dodatkowe wykluczenia i możliwość rezerwy na środki. Strona zwróciła 403. | - | https://help.revolut.com/en-PL/business/help/setting-up-an-account/is-my-business-eligible/what-industries-are-not-supported/ | wtórne |
| **Nuvei** | Nieznane | W polityce ryzyka UAB Nuvei znaleziono (w streszczeniu) zakaz nieregulowanych spółek inwestycyjnych zarządzających cudzymi środkami; nic o ofertach papierów wartościowych. Strony nie otwarto (404 z innego adresu). | - | https://www.nuvei.com/service-pages/uab-nuvei-risk-policy | wtórne |
| **Worldline / Polcard** | Nieznane | Nie znaleziono polityki Polcard. Publiczne wypowiedzi Worldline o przeglądzie portfela wysokiego ryzyka wymieniają m.in. internetowy handel papierami wartościowymi (stockbroking) jako kategorię podwyższonego ryzyka. | - | wyniki wyszukiwarki (prasa) | wtórne / niezweryfikowano |
| **GoCardless** (polecenie zapłaty / pay by bank) | **ZAKAZ** (w katalogu usług finansowych) | Strona "Restricted activities": zakazane są m.in. "Business opportunities or investment opportunities, including crowdfunding and advice or arrangement services relating to any such opportunities" oraz nieregulowane doradztwo finansowe i działanie jako instytucja płatnicza. | Wprost: nieregulowane usługi finansowe poza zakresem. | https://gocardless.com/legal/restrictions | zweryfikowano |
| **TrueLayer, Tink, Yapily, Salt Edge** (agregatory PIS/AIS) | Brak publicznej listy branż znalezionej w sesji | Nie znaleziono ich list zakazanych; treść umów z merchantami jest zwykle negocjowana. Yapily dokumentuje połączenia z polskimi bankami (m.in. Pekao, BNP Paribas, PKO BP) z wymogiem certyfikatów eIDAS. | Pytać; zwykle wymagają własnego licencjonowanego PISP/AISP po stronie dostawcy. | https://docs.yapily.com/institution-configurations/poland/Pekao | wtórne / niezweryfikowano |
| **Kontomatik** (polski AISP) | Nie dotyczy (tylko odczyt danych) | Licencjonowany dostawca usług informacji o rachunku (AISP), dokumentacja podaje obsługę ok. 30 polskich banków w trybie jednego dostępu, historię transakcji domyślnie do 90 dni, widżet logowania i API; fallback (screen scraping) gdy bank nie ma API PSD2. Nie przyjmuje płatności. | - | https://developer.kontomatik.com/coverage (z wyników wyszukiwarki, nie otwarto) | wtórne |
| **PISP oparte o PolishAPI** (np. integratorzy bankowi) | Zależnie od operatora | PolishAPI to standard ZBP dla inicjowania płatności, informacji o rachunku i potwierdzania środków; wiele polskich banków obsługuje też Berlin Group. | - | https://www.fiskil.com/open-finance-tracker/standard/polishapi | wtórne |

Wnioski z tabeli:

- **Stripe, Paynow, GoCardless: odpadają** (zakaz wprost). **PayU, Autopay: odpadają z dużym prawdopodobieństwem** (zapisy o crowdfundingu i nienadzorowanych usługach finansowych; PayU wg wersji 2020, więc warto zapytać, ale nie planować na tym).
- **Przelewy24 i Tpay: jedyni polscy agregatorzy bez zakazu w publicznych dokumentach**, ale to nie jest zgoda. Brak zapisu = decyzja po zgłoszeniu przez dział ryzyka. To pierwsi do zapytania w Planie B.
- **Adyen, Checkout.com, PayPal: "ograniczone"**: formalnie możliwe po dodatkowej weryfikacji, ale to ścieżka dla kart/portfeli, czyli dokładnie tej metody, której **odradzamy** przy zapisach na akcje (chargeback do miesięcy po wpłacie, §4.3). Nie rekomenduję kart nawet przy zgodzie.
- **Zasada generalna u wszystkich:** podmiot bez licencji świadczący czynność regulowaną albo "nadzorowaną" jest traktowany gorzej (PayU, Adyen, GoCardless). Nasz emitent nie jest instytucją finansową, a jego oferta podlega nadzorowi następczemu KNF; **w piśmie do operatora trzeba to powiedzieć wprost i dołączyć dokumenty (§6), zamiast liczyć, że system onboardingowy sklasyfikuje nas jako zwykły e-commerce.**

### 1.2 Czego nie wiemy (i jak to sprawdzić)

- Nie znaleziono publicznych zasad: Przelewy24 dla onboardingu branż regulowanych, Tpay (procedura "oceny merchanta"), Dotpay, Polcard, Nuvei, Mollie dla polskich spółek, TrueLayer, Tink, Salt Edge. Odpowiedź: pisemne zapytanie (§6) i telefon do działu sprzedaży.
- Czy ktokolwiek z powyższych **w praktyce** obsługuje emisje akcji emitentów niepublicznych (poza platformami z zezwoleniem): brak publicznych danych.

## 2. Co robi rynek: platformy crowdfundingu udziałowego, domy maklerskie, notariusze

### 2.1 Co ustaliłem

- **Platformy crowdfundingu inwestycyjnego w Polsce działają na zezwoleniu KNF** (rozporządzenie UE 2020/1503 i polska ustawa o finansowaniu społecznościowym). Komunikat KNF z 9.11.2023: od 10.11.2023 prowadzenie crowdfundingu inwestycyjnego lub pożyczkowego przez podmiot z siedzibą w Polsce możliwe jest tylko na podstawie zezwolenia KNF; do 9.11.2023 zezwolenia dostały jedna platforma pożyczkowa i dwie inwestycyjne (nazw w odczytanym tekście nie ma). [zweryfikowano: pierwotny PDF KNF https://www.knf.gov.pl/knf/pl/komponenty/img/Korzystanie_z_uslug_platform_crowdfundingowych_na_cele_gospodarcze_86773.pdf ; wynik wyszukiwarki podaje, że jednym z licencjonowanych podmiotów jest GPW Private Market, wtórne: https://strefainwestorow.pl/wiadomosci/20231027/knf-zezwolila-gpw-private-market-na-dzialalnosc-jako-dostawca-uslug-finansowania]
- **Ważne ostrzeżenie z tego samego komunikatu KNF:** świadczenie usług finansowania społecznościowego bez zezwolenia **albo prowadzenie działalności "identycznej co do celu" (ale w sposób inny niż jako dostawca)** to przestępstwo zagrożone grzywną do 5 mln zł. Usługa to "kojarzenie inwestorów z właścicielami projektów przy użyciu platformy". [zweryfikowano, ten sam PDF] **Dla nas:** portal emitenta, który sprzedaje wyłącznie akcje samego emitenta i nie łączy nikogo z cudzymi projektami, nie powinien być "platformą", ale **granica jest cienka, gdy (a) operatorem portalu jest inny podmiot niż emitent, (b) pojawią się oferty drugiej spółki, (c) portal bierze prowizję od wpłat.** Pytanie nr 1 do prawnika (§7.2). Zgodnie z feasibility §2.4 to samo dotyczy art. 69 ust. 2 pkt 6 ustawy o obrocie instrumentami finansowymi (oferowanie).
- **Jak platformy zbierają pieniądze (dane wtórne, bez regulaminów platform):**
  - Artykuł z 2026 r.: inwestor przechodzi KYC (dokument, PESEL, czasem wideo lub weryfikacja przelewem), test wiedzy, zapis i wpłatę; środki trafiają na **rachunek powierniczy (escrow) prowadzony przez platformę lub agenta emisji**, a spółka dostaje je dopiero po osiągnięciu progu minimalnego; w razie niepowodzenia zwrot bez odsetek i opłat. [wtórne: https://freenance.io/inwestowanie/crowdfunding-udzialowy-2026-beesfund-crowdway-emisje-akcji-ryzyko-podatki/ ; artykuł nie nazywa konkretnej platformy jako licencjonowanej]
  - Beesfund (opis crowdfundingu pożyczkowego): wpłata przelewem "za pośrednictwem operatora płatności" na konto spółki; dla inwestorów z UE wskazany wybór kanału SEPA w tPay. Katalogowa informacja: prowizja platformy 6,9% plus VAT i dodatkowe ok. 2% dla operatora płatności. [wtórne, stare: wynik wyszukiwarki dla beesfund.com/blog/crowdfunding-pozyczkowy/ (404 przy próbie otwarcia); katalog opłat niezweryfikowany]
  - Crowdway, Ventures, Emiteo, FUNDER i inni: **nie znaleziono ich regulaminów ani opisów wpłat** w tej sesji. Nie twierdzę, jak zbierają pieniądze. [niezweryfikowano]
- **Oferta publiczna przez firmę inwestycyjną (dom maklerski):** art. 5a ustawy o ofercie publicznej: wpłaty z zapisów na papiery wartościowe objęte ofertą, dla których udostępniono **prospekt**, gromadzi się **na wydzielonym rachunku (rachunkach) bankowym firmy inwestycyjnej**; środki nie mogą trafić do emitenta przed zarejestrowaniem przez sąd podwyższenia kapitału (a przy zamiarze dopuszczenia do obrotu: przed dopuszczeniem, co nastąpi później); przy braku dopuszczenia w terminie ważności prospektu: zwrot i umorzenie akcji. [wtórne: https://www.arslege.pl/wplaty-z-zapisow-na-akcje-w-ofercie-publicznej-dokonywanej-za-posrednictwem-firmy-inwestycyjnej/k383/a68719/ , Dz.U. 2025 poz. 592 t.j.; strona nie wspomina o dokumencie z art. 37a; **art. 5a nie obejmuje wprost naszej konfiguracji** (oferta własna, dokument informacyjny, bez firmy inwestycyjnej)]. Traktuję go jako **wzorzec dobrowolny**: rachunek wydzielony, zakaz wydawania przed wpisem, zwrot przy niepowodzeniu.
- **Prospekty dużych emisji** (np. oferty z biurem maklerskim) wskazują zapisy składane przez rachunek maklerski u oferującego [wtórne: wyniki wyszukiwarki, mBank Of-Publ]. To inny reżim niż nasz.
- **Rachunek powierniczy dla mieszkań (deweloperzy):** ING nadaje każdemu nabywcy indywidualny 26-cyfrowy numer rachunku i identyfikuje wpłaty usługą masową. [zweryfikowano: https://www.ing.pl/spolki/konta/rachunki-powiernicze-i-zastrzezone] To **ustawowy produkt deweloperski**, nie dla emisji akcji, ale pokazuje, że technika (numer per nabywca + rachunek zastrzeżony) w polskich bankach istnieje.
- **Notariusz / escrow notarialny:** nie badano; w polskim obrocie używany głównie przy transakcjach nieruchomości i zbyciu udziałów. Do emisji wielu drobnych zapisów jest zbyt wolny i kosztowny. [niezweryfikowano]

### 2.2 Co zmieniłby pośrednik (Plan C)

| Aspekt | Własna oferta (art. 37a) | Dom maklerski jako podmiot przyjmujący zapisy | Licencjonowana platforma ECSP |
|---|---|---|---|
| Kto przyjmuje wpłaty | Spółka (jej rachunek) | Firma inwestycyjna (rachunek wydzielony) | Platforma lub agent (escrow) |
| Operator płatności | Bank spółki (ew. PSP po zgodzie) | Bank firmy inwestycyjnej | Wybrany przez platformę |
| UX "Stripe-like" | Pełna kontrola nad naszym interfejsem | Ograniczony: zwykle rachunek maklerski u oferującego | Interfejs platformy, nie nasz |
| Koszt | Nasz kod i bank | Prowizja oferującego (wg wtórnych danych kilka do kilkunastu procent; niezweryfikowano) | Prowizja platformy (np. katalogowe 6,9% plus VAT, wtórne) |
| Ryzyko regulacyjne | Pytania z feasibility §2.4 | Niższe (podmiot licencjonowany) | Niższe (podmiot licencjonowany) |
| Zgodność z naszym modelem produktu | Pełna kontrola | Zmniejszona (zapisy pod egidą DM) | Zmniejszona; portal staje się reklamą oferty na cudzej platformie |

Zmiana modelu na (b) lub (c) **likwiduje pytanie "czy wolno przyjmować wpłaty samemu" za cenę prowizji i utraty kontroli nad interfejsem**. To jest Plan C (§5).

## 3. Model: przelew z rachunkami wirtualnymi (szczegóły)

### 3.1 Czym jest "rachunek wirtualny" w polskich bankach

Numer w formacie NRB (26 cyfr), w którym część jest identyfikatorem klienta (spółki), a część (u niektórych banków 12 cyfr) wolna do zagospodarowania; wpłata na taki numer księguje się na jednym rachunku rzeczywistym lub technicznym i jest rozpoznawana po numerze. Płatnik nie musi pisać tytułu przelewu. Poniżej to, co banki opisują na stronach produktowych (stan 2026-10-19):

| Bank | Produkt | Co opisuje strona | Raporty / formaty | Czas | Opłaty | Uwagi dla nas | Poziom |
|---|---|---|---|---|---|---|---|
| **Pekao** | Pekao Collect | Każdemu kontrahentowi unikalny numer rachunku wirtualnego; wpłaty ze wszystkich kanałów. | Raport z wpłat w dni robocze w PekaoBiznes24 lub na dedykowanej stronie; układ i częstość księgowania do uzgodnienia. **Strona nie wspomina o MT940, API ani webhookach.** | Raport dzienny; brak deklaracji czasu rzeczywistego. | Brak na stronie. | Pekao to bank z feasibility §3. Indywidualne rachunki można blokować. | zweryfikowano: https://www.pekao.com.pl/korporacje/zarzadzanie-finansami/pekao-collect.html |
| **mBank** | Collect (2 warianty) | Format NRB: 12 cyfr w dyspozycji klienta (np. NIP, telefon, własny id). **Księgowanie analityczne** (jeden numer specjalny, każda wpłata osobno, na bieżąco) albo **zbiorcze** (indywidualny numer per płatnik, księgowanie sumą w ustalonych godzinach; dla >10 000 transakcji miesięcznie). | Wariant analityczny: **wyciągi MT940 lub MT942** w mBank CompanyNet. Brak wzmianki o API i powiadomieniach. | Na bieżąco (analityczny). | Brak na stronie (odsyłacz do taryfy). | MT942 sugeruje wyciąg śróddzienny. Nasz wolumen (setki do tysięcy zapisów) pasuje do wariantu analitycznego. | zweryfikowano: https://www.mbank.pl/msp-korporacje/obsluga-biezaca/zarzadzanie-naleznosciami/collect/ |
| **ING** | SIMP (System Identyfikacji Masowych Płatności) | Każdemu kontrahentowi jeden numer wirtualny, część numeru identyfikuje płatnika; pliki elektroniczne ze szczegółami wpłat do pobrania z ING Business lub wysyłane do systemu księgowego; SIMP Matching dopasowuje wpłaty do faktur według reguł. | Pliki (formaty nie podane). | Nie podano. | Odsyłacz do tabeli opłat. | Strona kieruje do spółdzielni, samorządów, dostawców mediów; emitent akcji nie jest w jej opisie, **zapytać o zgodę na branżę.** | zweryfikowano: https://www.ing.pl/spolki/karty-platnosci/system-identyfikacji-platnosci |
| **ING** | Rachunki zastrzeżone i powiernicze | Rachunek zastrzeżony: bank jako arbiter uruchamia środki po spełnieniu warunków; e-Rachunek zastrzeżony online; rachunek mieszkaniowy z numerem per nabywca (produkt deweloperski). | - | - | Strona bez cen; w wyniku wyszukiwarki (stara taryfa): otwarcie 100 zł, 25 zł miesięcznie, 0,1% wpływów miesięcznie. | Kandydat na "rachunek wydzielony do czasu wpisu"; **liczy się warunek wypłaty "wpis podwyższenia w KRS"** (do uzgodnienia z bankiem). | zweryfikowano stronę; ceny: wtórne |
| **Bank Millennium** | AIPP (Automatyczna Identyfikacja Płatności Przychodzących) | Klient generuje NRB per płatnik (identyfikator + numer płatnika); wpłaty przelewem lub gotówką; wszystko trafia na **rachunek techniczny** i raz dziennie (lub inaczej) jest przelewane zbiorczo na rachunek bieżący. | Raporty elektroniczne w formacie dla systemu księgowego. | Przelew zbiorczy dzienny. | Brak na stronie. | Dzienny sweep gorzej pasuje do "szybkiego" statusu. | zweryfikowano: https://www.bankmillennium.pl/przedsiebiorstwa/produkty/obsluga-biezaca/platnosci-i-rozliczenia/automatyczna-identyfikacja-platnosci-przychodzacych-aipp |
| **Credit Agricole** | Identyfikacja Płatności Masowych | Numer wirtualny (RW) per kontrahent lub fakturę; format PLCC 1940 1210 RRRR UUUUUUUUUUUU z 12 znakami do dyspozycji klienta. | Cyfry płatnika widoczne w historii rachunku w CA24 Biznes, eksport do systemu księgowego; opcja księgowania sumą z raportem. | Strona mówi, że rachunek rzeczywisty jest uznawany w chwili otrzymania płatności, a wpłata widoczna od razu w CA24 Biznes. | Brak na stronie. | Jedyna strona z deklaracją niemal natychmiastowej widoczności. | zweryfikowano: https://www.credit-agricole.pl/przedsiebiorstwa/obsluga-biezaca/platnosci/identyfikacja-platnosci-masowych |
| **Alior Bank** | Masowe przetwarzanie transakcji (BusinessPro) | Wirtualne numery z identyfikatorem rachunku (3 do 10 cyfr) i płatnika (3 do 6 cyfr); techniczny rachunek, przekazanie na rachunek główny co najmniej raz dziennie; obsługa od kilkunastu do milionów transakcji miesięcznie. | - | Co najmniej raz dziennie. | Nie sprawdzono. | wtórne (opis wyniku wyszukiwarki; regulamin otwierania i prowadzenia rachunków rozliczeniowych Alior zawiera zapisy o generatorze NRB). | wtórne |
| **BNP Paribas** | "Identyfikacja płatności (Mass Collect)" | W taryfie dla korporacji jest sekcja z opłatami za identyfikację płatności; opisu usługi nie czytano. | - | - | W taryfie. | Do zapytania. | wtórne |
| **Santander Bank Polska** | - | Nie znaleziono strony produktu w sesji. | - | - | - | Do zapytania. | niezweryfikowano |
| **Fintech / dostawcy IBAN** (np. Banking Circle dla PL, Danske Bank Poland, Revolut, wirtualne IBAN dla PSP) | Wirtualne IBAN | Banking Circle ogłosił (2022) polskie wirtualne IBAN dla PSP; Danske Bank Poland oferuje rachunki wirtualne per płatnik (do 12 cyfr dowolnego kodu). Wyniki wyszukiwarki ostrzegają, że część "vIBAN" to tylko aliasy routingu. | - | - | - | Dostawcy działają przez PSP i także stosują własne polityki branżowe. | wtórne |

**Ważna cecha techniczna:** według omówienia w prasie prawniczej bank księguje środki na jednym rachunku rzeczywistym, a rachunki wirtualne nie mają odrębnego salda ani odrębnych wyciągów. [wtórne: https://pro.rp.pl/prawo-w-firmie/art17045881-rachunki-wirtualne-nie-znajda-sie-na-bialej-liscie-vat] **To znaczy, że rachunek wirtualny sam z siebie nie izoluje środków inwestorów**; izolację daje osobny rachunek rzeczywisty (rachunek pomocniczy lub zastrzeżony), na którym ma zostać uruchomiona usługa rachunków wirtualnych (pytanie do banku: czy rachunki wirtualne mogą wskazywać na rachunek zastrzeżony).

### 3.2 Powiadomienie o wpłacie: co jest realne

Żadna z odczytanych stron produktowych banków nie obiecuje **webhooka ani API powiadomień**; opisują raporty dzienne, pliki i wyciągi MT940/MT942. To najważniejsze ograniczenie "jak Stripe". Opcje, od najwolniejszej:

1. **Raport dzienny / MT940 (dzień roboczy następny):** wystarcza do księgowości, nie do ekranu "zapłacono".
2. **MT942 (wyciąg śróddzienny) lub odświeżany plik / SFTP, jeśli bank to oferuje** (mBank: MT942 wymieniony na stronie Collect [zweryfikowano]; inne banki: pytać). Realnie co kilka do kilkunastu minut, zależnie od ustawień banku. [niezweryfikowano częstość]
3. **PSD2 AIS (odczyt rachunku spółki przez licencjonowanego AISP, np. Kontomatik, Tink, Yapily):** możliwe, jeśli bank udostępnia rachunki firmowe przez API PSD2 (nie każdy). Zgoda wymaga odnawiania SCA (w polskich opisach 90 dni, po zmianach unijnych 180 dni, niezweryfikowano), a dostęp bez obecności użytkownika jest ograniczony liczbą wywołań na dobę (z pamięci 4 na 24 h wg RTS, **niezweryfikowano**), więc to zła podstawa dla odpytywania co kilka sekund. Dobra do uzgadniania co kilkanaście minut lub kilka razy dziennie. [Kontomatik: wtórne, dokumentacja z wyników wyszukiwarki]
4. **API/Host-to-host banku z powiadomieniem push (jeśli istnieje):** nie znaleziono publicznego opisu w polskich bankach; pytać wprost (Pekao, mBank, ING, CA, Santander). Zakładam brak, dopóki bank nie potwierdzi na piśmie.
5. **PIS (inicjowanie płatności) przez PSP/PISP (Plan B):** daje natychmiastowy status "zlecona" w sekundach i powiadomienie z PSP, ale to znów wymaga zgody PSP (§1) i **nie** jest potwierdzeniem uznania rachunku spółki.

### 3.3 Co znaczy "natychmiast" w Polsce

- **Express Elixir (KIR):** przelewy natychmiastowe 24/7/365, uznanie odbiorcy w **kilka sekund**, standardowy limit pojedynczego przelewu do 100 000 zł (limity ustala bank nadawcy; w regulaminach banków spotyka się 5 000 do 50 000 zł dla bankowości internetowej), bez dziennego limitu liczby transakcji; wdrożyło go ponad 25 banków komercyjnych i ok. 450 spółdzielczych, a dostępność zależy od banku nadawcy i odbiorcy. [zweryfikowano: https://www.kir.pl/nasza-oferta/klient-indywidualny/rozliczenia/express-elixir ; limity w regulaminach banków: wtórne]
- **Zwykły Elixir / SORBNET:** sesje rozliczeniowe w dni robocze (zaksięgowanie w ciągu dnia roboczego lub następnego); SORBNET to system wysokowartościowy RTGS NBP. [niezweryfikowano, z pamięci]
- **Rozporządzenie UE 2024/886 (instant payments):** dla banków poza strefą euro (Polska) obowiązek **odbierania** przelewów natychmiastowych ma obowiązywać od 9.01.2027, **wysyłania** od 9.07.2027, weryfikacja odbiorcy od 9.07.2027 (otwarte pytanie, czy w PLN). [wtórne: streszczenia z ECB, prezentacja ZBP z 2026; sprawdzić w tekście rozporządzenia] Dziś instant w PLN jest więc dobrowolny, ale powszechny.
- **BLIK:** wymaga agenta rozliczeniowego/PSP po stronie odbiorcy (nie "wpłaca się BLIKiem na numer rachunku" firmy). Przy zapisach na akcje BLIK to Plan B (zgoda PSP), nie opcja bankowa. [niezweryfikowano szczegółów oferty "BLIK dla firm" poszczególnych banków]
- **Czy bank księguje Express Elixir na rachunek wirtualny natychmiast?** Strony produktowe tego nie opisują (CA mówi tylko o chwili otrzymania płatności). Pytanie do każdego banku.

### 3.4 Jak to ma "wyglądać jak Stripe" (UX bez PSP)

Cel: klient po kliknięciu "Zapisz się i zapłać" nie ma wrażenia "robię ręczny przelew".

1. **Ekran "Zapłać przelewem"** (po podpisie zapisu i pozytywnym KYC): kwota (liczba akcji x cena emisyjna), **unikalny numer rachunku** (rachunek wirtualny przypisany do tego zapisu, nie do osoby), nazwa odbiorcy, tytuł przelewu wstępnie wypełniony, **termin ważności** (np. 3 dni robocze lub do końca okna), przyciski "kopiuj numer", "kopiuj kwotę".
2. **Kod QR z danymi przelewu** (standard ZBP "kod QR do płatności" czytany przez część aplikacji bankowych; wspierane pola: NRB, kwota, nazwa, tytuł) [niezweryfikowano szczegółów standardu i listy banków; do sprawdzenia przed projektem]. Na telefonie to ekwiwalent "zapłać w aplikacji".
3. **Deep link do aplikacji banku:** w Polsce brak jednego uniwersalnego deep linka do przelewu w każdej aplikacji bankowej [niezweryfikowano]; realny odpowiednik to **PIS** (przekierowanie do banku z gotową płatnością), czyli Plan B, albo link "Otwórz aplikację" bez parametrów. Nie obiecywać w kopii marketingowej.
4. **Przycisk "Zrobiłem przelew":** dodaje po stronie użytkownika sygnał (znacznik czasu, opcjonalnie numer rachunku nadawcy), uruchamia **częstsze sprawdzanie** wyciągu dla tego zapisu i zmienia ekran na "Czekamy na wpłatę".
5. **Strona statusu**, która sama się odświeża (krótkie odpytywanie co 3 do 5 s z wykładniczym wydłużaniem, SSE później): `Oczekuje na wpłatę` → `Wykryto wpłatę` → `Zaksięgowano` → dalsze etapy (przydział, rejestracja, wpis do rejestru). Powiadomienie e-mail po zaksięgowaniu.
6. **Uczciwa kopia:** "Zaksięgowanie zwykle trwa kilka minut do jednego dnia roboczego. Akcje zostaną wydane po wpisie podwyższenia do KRS; przewidywany termin: X" (feasibility §4.3).
7. **Stany błędów, jak w Stripe:** za mała lub za duża kwota, wpłata z innego rachunku niż zadeklarowany, wpłata po terminie, podwójna wpłata: każdy ma osobny, zrozumiały komunikat i ścieżkę (zwrot lub dopłata po decyzji; nigdy cicha zmiana liczby akcji, feasibility §3.4).

Realistycznie, bez zdarzeń push z banku: ekran "zlecono" w sekundach (klient klika "Zrobiłem przelew"), "zaksięgowano" w minutach do dnia roboczego. Dopiero MT942 co kilka minut, AIS lub PIS skracają to do "kilku minut". **Sekundy są osiągalne tylko przez PIS u zgodnego PSP lub przez bank z kanałem push, o czym trzeba zapytać.**

### 3.5 Automatyczne dopasowanie wpłaty do zapisu

Klucz główny dopasowania = **numer rachunku wirtualnego** (jedna subskrypcja = jeden numer). Dodatkowo:

- **Kwota:** dokładnie liczba akcji x cena emisyjna (w groszach, liczby całkowite).
- **Rachunek nadawcy:** porównanie z rachunkiem zadeklarowanym lub potwierdzonym w KYC (mojeID / AIS po stronie inwestora, feasibility §4.2 pkt 2). Rozbieżność = `HELD_FOR_REVIEW`, nie `PAID`.
- **Tytuł przelewu:** pole pomocnicze (nie klucz).
- **Okno ważności** i status zapisu w chwili wpłaty.

Wyniki: `MATCHED`, `UNDERPAID`, `OVERPAID`, `UNMATCHED`, `DUPLICATE`, `LATE`, `THIRD_PARTY` (zgodnie z feasibility §3.5). Identyfikator w 12 cyfrach rachunku wirtualnego powinien być **losowym, nieprzewidywalnym kluczem z cyfrą kontrolną**, nie kolejnym numerem zapisu ani numerem PESEL/NIP (ujawnia dane, ułatwia pomyłki i nadużycia). Mapowanie klucz do zapisu trzymamy tylko u nas. Banki podają długości pola: mBank 12 cyfr, CA 12 znaków, Alior 3 do 6 cyfr płatnika, więc długość klucza zależy od banku.

## 4. Środki przed rejestracją, zwroty, chargebacki, AML, podatki

### 4.1 Środki przed rejestracją podwyższenia

- **Zasada projektowa:** wpłaty zapisów leżą na **osobnym rachunku rzeczywistym** (rachunek pomocniczy lub zastrzeżony/powierniczy) i **nie są przychodem ani kapitałem** do chwili wpisu serii do KRS. Brak przesunięć na rachunek operacyjny przed wpisem; ewidencja jako rozliczenie/zobowiązanie (do potwierdzenia księgowego, feasibility §2.9).
- **Podstawa prawna:** art. 431 § 5 KSH (zwrot wkładów, gdy podwyższenie nie dojdzie do skutku w terminach), art. 441 (zgłoszenie do KRS, wpis jako moment podwyższenia), art. 437 (forma zapisu), art. 440 (okno min. 2 tygodnie, przydział w ciągu 2 tygodni, zwrot wpłat osobom bez przydziału) [serwis wtórny wg feasibility §2.2; **nie czytano tekstów w Dz.U.**]. Art. 311 i 312 KSH (wpłaty, wymóg rachunku): **niezweryfikowano**.
- **Odpowiednik z ustawy o ofercie publicznej (dla prospektu przez firmę inwestycyjną):** rachunek wydzielony firmy inwestycyjnej, zakaz przekazania emitentowi przed wpisem, zwrot przy niepowodzeniu [wtórne, art. 5a, §2.1]. Przyjmujemy go dobrowolnie jako standard ostrożności i wpisujemy do dokumentu informacyjnego.
- **Rachunek zastrzeżony/powierniczy w banku:** ING oferuje rachunek zastrzeżony, w którym bank decyduje o uruchomieniu środków po spełnieniu warunków [zweryfikowano]; wersja "e-" wymaga, żeby sprzedający był klientem ING, a kupujący akceptuje wypłatę (model dwustronny, nie wiele osób). **Wielu drobnych inwestorów to inny kształt niż w opisie produktu**, więc to temat do negocjacji (czy bank zgodzi się na warunek "wpis podwyższenia w KRS" i na wielu wpłacających). Koszt z wyniku wyszukiwarki (stara taryfa): 100 zł otwarcie, 25 zł miesięcznie, 0,1% wpływów miesięcznie [wtórne]; przy 4,25 mln zł wpływów 0,1% to ok. 4 250 zł.
- **Terminy:** uchwała o podwyższeniu nie może być zgłoszona do sądu po 6 miesiącach od powzięcia (art. 431 § 4, wtórne), więc harmonogram serii (okno, przydział, akt zarządu, wniosek do KRS) musi mieścić się w tym terminie; w przeciwnym razie zwrot (art. 431 § 5). Zwrot w praktyce wymaga **masowego przelewu zwrotnego** (plik do banku) na rachunki nadawców, z kosztem po stronie spółki.
- **Oprocentowanie środków na rachunku** i czy w dokumencie informacyjnym wolno obiecywać brak odsetek dla inwestora: **niezweryfikowano**, pytanie do księgowego i prawnika.

### 4.2 Zwroty i odwracalność płatności

| Metoda | Czy płatnik może cofnąć po fakcie | Okno | Kto ponosi ryzyko | Źródło |
|---|---|---|---|---|
| **Karta (Visa/Mastercard)** | Tak, chargeback | Typowo do 120 dni, w niektórych przypadkach dłużej (do 540 wg jednego opisu) | Sprzedawca (strata plus opłata) | wtórne: https://stripe.com/en-br/resources/more/chargeback-time-limits-in-the-uk i inne blogi |
| **BLIK (przez PSP)** | Wg źródeł popularnych brak klasycznego chargebacku; płatnik może reklamować transakcję w banku i dochodzić zwrotu od sprzedawcy | Zależne od banku i operatora | Sprzedawca (spór/reklamacja), mniejsze niż karta | wtórne (portale konsumenckie), **niezweryfikowano reguł BLIK** |
| **Przelew (zwykły/Express Elixir)** | Nie ma chargebacku, ale płatnik może zgłosić **transakcję nieautoryzowaną** (konto przejęte, oszustwo): bank płatnika zwraca niezwłocznie (do końca następnego dnia roboczego po zgłoszeniu, wg komentarzy) i **ma roszczenie zwrotne**; zgłoszenie możliwe do 13 miesięcy; dotyczy też przelewów natychmiastowych i BLIK-a | do 13 miesięcy | Odbiorca może zostać obciążony roszczeniem zwrotnym banku, ryzyko niskie ale realne | wtórne: https://pro.rp.pl/nawigator-prawny-poradnik/art42635131-odpowiedzialnosc-za-nieautoryzowane-platnosci-nowa-rola-dowodowa-instytucji-finansowych (zacytowane w wyniku wyszukiwarki; ustawa o usługach płatniczych, art. 46, nie czytana) |

Wniosek: **przelew jest najmniej odwracalny, ale nie ma ryzyka zerowego**; dla akcji istotne jest to, że okno rejestracji (tygodnie do miesięcy) nakłada się na okno chargebacku karty (do 120 dni): inwestor mógłby dostać akcje, a pieniądze zostałyby cofnięte. To kolejny powód, by **nie przyjmować kart**. Dla przelewu mitygacją są: KYC właściciela rachunku nadawcy (mojeID/AIS), dopasowanie nadawcy do zapisanego inwestora, trzymanie środków na rachunku wydzielonym do wpisu i zakaz wydawania "przepustki" przed wpisem do rejestru.

### 4.3 AML / KYC: punkty kontrolne w przepływie

| Punkt | Co sprawdzamy | Kto | Uwagi |
|---|---|---|---|
| 1. Przed wydaniem numeru rachunku | KYC (dokument/mojeID/profil zaufany), rezydencja, osoby prawne i beneficjenci rzeczywiści, zakaz dla sankcjonowanych (lista sankcyjna u dostawcy KYC) | dostawca KYC plus nasz kod | feasibility §4.2 pkt 2; zakres uzgodnić z bankiem i operatorem rejestru, żeby nie weryfikować trzy razy |
| 2. Zadeklarowany rachunek nadawcy | Numer rachunku, z którego inwestor zapłaci (albo wynik AIS/mojeID) | inwestor + KYC | Podstawa reguły "płatnik = inwestor" |
| 3. Wpłata | Zgodność rachunku nadawcy, kwoty, nazwy; wpłata od osoby trzeciej = wstrzymanie | nasz kod, kolejka w panelu | `THIRD_PARTY` -> przegląd |
| 4. Limity | Minimalna i maksymalna kwota na inwestora, próg wymagający pogłębionej weryfikacji (wartość progu ustala AML/prawnik; nie zgaduję) | polityka | niezweryfikowano progów ustawowych |
| 5. Bank spółki | Bank sam monitoruje wpływy; wiele drobnych wpłat na nowy rachunek spółki to wzorzec analizowany (feasibility §2.6, §3.3) | bank | Rozmowa z bankiem **przed** otwarciem okna zapisów |
| 6. Zwrot | Tylko na rachunek, z którego przyszła wpłata (nie na inny) | nasz kod | Ogranicza pranie przez "wpłać i cofnij" |
| 7. Retencja | Dokumentacja AML i ofertowa na wymagany czas | `privacy` | feasibility §4.2 pkt 9 |

Status AML samej spółki-emitenta (instytucja obowiązana?): nadal pytanie do prawnika (feasibility §2.6).

### 4.4 VAT i PCC: neutralność opłat

- Opłaty bankowe i PSP (prowizje, opłaty za rachunki wirtualne, przelewy zwrotne) są **kosztem spółki**. VAT: usługi płatnicze co do zasady są zwolnione z VAT (art. 43 ust. 1 pkt 40 ustawy o VAT, z pamięci), więc faktury mają zwykle bez VAT lub z niskim VAT [niezweryfikowano; do księgowego].
- **PCC 0,5%** liczone od wartości podwyższenia kapitału zakładowego (feasibility §2.9): opłaty płatnicze **nie zmieniają podstawy**. Ważne: **nie doliczamy prowizji płatniczej inwestorowi do ceny emisyjnej**; cena akcji jest ceną emisyjną, a ewentualna dopłata za "płatność" byłaby dodatkiem do wkładu, z niejasną kwalifikacją podatkową i prawną (art. 309 KSH: cena nie niższa niż nominalna; dodatkowe świadczenia). [niezweryfikowano; pytanie do księgowego i prawnika]
- Prowizja PSP liczona od wpłat to nadal koszt serii (nie pomniejsza kapitału zakładowego; wchodzi do kosztów emisji, których traktowanie podatkowe opisuje feasibility §2.9).
- Koszty zwrotów (opłata za masowy przelew, ewentualna prowizja) ponosi spółka (feasibility §3.4).

## 5. Porównanie i rekomendacja

### 5.1 Tabela porównawcza

Skala: 1 (słabo/ryzykownie) do 5 (dobrze). Oceny są **moje, opisowe, nie pomiarowe**.

| Droga | Szybkość statusu "zapłacono" | UX (jak Stripe) | Koszt | Ryzyko zgodności | Nakład integracji | Czyja pisemna zgoda | Uwaga |
|---|---|---|---|---|---|---|---|
| **A. Przelew + rachunek wirtualny per zapis (bank spółki)** | 2 do 3 (minuty do dnia; sekundy z push) | 3 do 4 z QR, kopiuj, status | 4 (opłaty bankowe; ceny niepublikowane) | 4 (jedyny wymóg: bank) | 3 (parser MT940/MT942, dopasowanie, panel) | **Bank** (rachunek, usługa Collect/SIMP/AIPP, branża, AML) | Rekomendowany start |
| **B1. Pay-by-link/PIS u Przelewy24 lub Tpay (po zgodzie)** | 4 do 5 (sekundy do "zlecono") | 4 do 5 | 3 (prowizja % niepublikowana) | 2 do 3 (zależy od zgody, ryzyko późniejszej zmiany polityki) | 3 do 4 (znany wzorzec webhook) | **Operator płatności** (pismo wyraźne) | Tylko jako dodatek do A |
| **B2. BLIK u tego samego operatora** | 5 | 5 | 3 | 2 do 3 (spory/reklamacje) | j.w. | j.w. | Tak samo wymaga zgody |
| **B3. Karta (Adyen/Checkout/PayPal/Stripe)** | 5 | 5 | 2 | 1 (chargeback do 120 dni+, zakaz/ograniczenia) | 3 | Operator (Stripe: zakaz) | **Odradzam** |
| **C. Dom maklerski jako podmiot przyjmujący / platforma ECSP** | 2 do 3 | 2 do 3 (cudzy interfejs) | 2 (prowizje) | 5 (pośrednik z zezwoleniem) | 2 (umowa, integracja plików) | **Pośrednik** + prawnik | Fallback |
| **D. Obejście zakazów (podstawiona spółka, cudzy sklep, krypto jako maskowanie)** | - | - | - | **0** | - | - | **Nie robić** |

### 5.2 Rekomendacja z planami

**Plan A (wdrożyć pierwszy, po decyzjach z fazy 0 feasibility): przelew bankowy z rachunkiem wirtualnym per zapis na wydzielonym rachunku spółki, w "stripe'owym" interfejsie.**
- Bank: zacząć od banku spółki (feasibility zakłada Pekao). Jeśli Pekao nie da Collect na rachunku wydzielonym albo nie zaakceptuje branży, równolegle zapytać mBank (Collect analityczny, MT940/MT942 potwierdzone), ING (SIMP i rachunek zastrzeżony), Credit Agricole (deklaracja natychmiastowej widoczności), Millennium (AIPP, ale dzienny sweep).
- O co pytać bank: (1) czy branża "emisja własnych akcji przez emitenta, art. 37a" jest akceptowana, (2) czy usługę rachunków wirtualnych można uruchomić na rachunku wydzielonym/zastrzeżonym, (3) czy jest śróddzienny kanał (MT942, API, SFTP, push) i jego opóźnienie, (4) czy Express Elixir księguje się na rachunku wirtualnym natychmiast, (5) liczba i format numerów (długość klucza), (6) cennik (otwarcie, abonament, za numer, za wpłatę, za zwrot), (7) wymagania AML i dokumenty, (8) czy bank pozwoli na warunek uwolnienia "wpis w KRS", (9) czy rachunek zwrotów zbiorczych (plik) jest możliwy.
- Wynik: najwyższa zgodność i najmniej zależności; UX zbliżony (~80% odczucia Stripe) i szczerze opisany.

**Plan B (opcjonalny dodatek, tylko po piśmie operatora): pay-by-link/BLIK u Przelewy24 lub Tpay.**
- Najpierw wysłać szablon z §6 do obu; Autopay, PayU, Paynow i Stripe nie zapraszać (wprost zakazy lub szerokie wyłączenia). Adyen/Checkout/PayPal tylko jeśli właściciel świadomie chce karty (odradzam).
- Warunki wejścia: zgoda na piśmie obejmująca konkretne metody (PIS/BLIK, bez kart), rozliczenie na rachunek wydzielony, brak rolling reserve lub znana, zasady zwrotów (zwrot na rachunek źródłowy), wyłączenie z zapisów o zmianie polityki bez wypowiedzenia na czas zbiórki.
- Ryzyko: operator może wycofać zgodę w trakcie zbiórki (zamrożenie środków). Mitygacja: Plan A zawsze dostępny jako zapas; nie uzależniać serii od jednego PSP.

**Plan C (fallback): pośrednik z zezwoleniem.**
- Gdy: bank odmówi branży, prawnik uzna, że samodzielne przyjmowanie zapisów i wpłat wymaga licencji, albo ryzyko z komunikatu KNF o "działalności identycznej co do celu" okaże się realne.
- Kształt: dom maklerski jako podmiot przyjmujący zapisy i wpłaty (art. 437, 440 KSH; rachunek wydzielony firmy inwestycyjnej wzorem art. 5a) albo licencjonowana platforma ECSP. Traci się kontrolę UX i płaci prowizję; zyskuje się klarowność prawną.

**Co jest "najlepsze" dla "jak Stripe" przy zachowaniu bezpieczeństwa:** A (jako baza) + B1 (jeśli Przelewy24 lub Tpay dadzą zgodę na piśmie). Bez B1 doświadczenie to "szybki przelew z QR i statusem na żywo", z B1 dochodzi "wybierz bank i zapłać w kilku kliknięciach". Kart i Stripe w tym produkcie nie używać.

## 6. Szablon e-maila do PSP / banku (do wysłania po akceptacji prawnika)

Zasady: pisać z adresu spółki, nie ukrywać branży, prosić o **odpowiedź pisemną** (e-mail z kategorią zgody lub aneks do umowy), nie zaczynać zbiórki bez niej. Treść poniżej to szkic, nie wysyłać bez weryfikacji prawnej. Dane w nawiasach kwadratowych uzupełnia spółka.

Temat: Zapytanie o akceptację branży: przyjmowanie wpłat z zapisów na akcje własnej oferty publicznej emitenta (S.A., dokument informacyjny art. 37a)

> Szanowni Państwo,
>
> w imieniu [PEŁNA FIRMA SPÓŁKI] S.A. (KRS [numer], NIP [numer], REGON [numer], siedziba: [adres], strona internetowa: [https://...]) zwracamy się z prośbą o **pisemne potwierdzenie**, czy w ramach Państwa usługi [nazwa usługi: np. rachunek rozliczeniowy z usługą rachunków wirtualnych / płatności internetowe / pay-by-link / BLIK] możliwe jest przyjmowanie wpłat z tytułu zapisów na akcje **własnej oferty publicznej emitenta**, na warunkach opisanych niżej.
>
> **1. Charakter działalności.** Spółka jest emitentem akcji i jedynym podmiotem sprzedającym własne akcje nowej emisji (podwyższenie kapitału zakładowego). Nie pośredniczymy w ofertach innych podmiotów, nie prowadzimy obrotu wtórnego, nie zestawiamy zleceń kupna i sprzedaży, nie doradzamy inwestycyjnie. Nie jesteśmy dostawcą usług finansowania społecznościowego w rozumieniu rozporządzenia 2020/1503 i nie świadczymy usługi oferowania instrumentów finansowych na rzecz innych emitentów. [Prawnik potwierdzi to zdanie.]
>
> **2. Podstawa oferty.** Oferta jest oferta publiczną w rozumieniu ustawy o ofercie publicznej, prowadzoną na podstawie **dokumentu informacyjnego z art. 37a** (wpływy brutto emitenta w UE w okresie 12 miesięcy poniżej 1 000 000 EUR; planowana wartość serii: [kwota]), opublikowanego na stronie emitenta w dniu [data], po zawiadomieniu KNF w dniu [data] (potwierdzenie w załączniku). Uchwała o emisji: [numer, data]. Akcje powstają z chwilą wpisu podwyższenia kapitału do KRS; rejestr akcjonariuszy prowadzi [podmiot, np. dom maklerski].
>
> **3. Przepływ środków.** Inwestor składa zapis na formularzu wymagającym podpisu kwalifikowanego, zaufanego lub osobistego, przechodzi weryfikację tożsamości, następnie wpłaca kwotę równą liczbie akcji x cenie emisyjnej ([cena] zł). Wpłaty trafiają **wyłącznie na wydzielony rachunek spółki** [typ: pomocniczy/zastrzeżony], nie są wydatkowane do dnia wpisu podwyższenia do KRS i **są zwracane w całości na rachunek, z którego dokonano wpłaty**, jeśli seria nie dojdzie do skutku, zapis zostanie odrzucony lub nie będzie przydziału. Spółka nie pobiera od inwestorów dodatkowych opłat za płatność.
>
> **4. Skala.** Planowana liczba inwestorów w serii: [od-do]; kwota minimalna zapisu: [kwota]; średnia: [kwota]; maksymalna: [kwota]; łączna wartość serii: [kwota]; przewidywany szczyt: [liczba wpłat/godzinę]; okno zapisów: [od-do]; planowany start: [data].
>
> **5. Zgodność i AML.** Weryfikacja tożsamości inwestora przed wydaniem danych do płatności: [dostawca/metoda]. Zwroty tylko na rachunek źródłowy. Spółka prowadzi rejestr zapisów i wpłat z audytem zmian. Źródła pochodzenia środków: wpłaty własne osób fizycznych [oraz prawnych] z rachunków prowadzonych w [kraje].
>
> **6. Prosimy o odpowiedź na pytania:**
> a) Czy opisana działalność jest dopuszczalna w ramach Państwa polityk (listy branż zakazanych i ograniczonych)? Prosimy o wskazanie konkretnego zapisu i kategorii (zakazana/ograniczona/dopuszczalna po weryfikacji).
> b) Jakie dokumenty i informacje dodatkowe są potrzebne do oceny?
> c) Które metody płatności mogą być użyte (przelew z rachunkiem wirtualnym, pay-by-link/PIS, BLIK, karty) i które wykluczają Państwo dla tej branży?
> d) Na jakie rachunki następuje rozliczenie (czy możliwe rozliczenie na rachunek wydzielony), w jakim terminie, z jakimi rezerwami lub limitami?
> e) Zasady zwrotów, reklamacji, zwrotów obciążeń i sporów oraz koszty.
> f) Opłaty (uruchomienie, abonament, za numer rachunku wirtualnego, prowizja, zwrot).
> g) Dostępne kanały powiadamiania o wpłacie (webhook, API, MT942/MT940, SFTP) i opóźnienie.
> h) Czy zastrzegają Państwo prawo zmiany lub wypowiedzenia w trakcie trwającej oferty i z jakim okresem wypowiedzenia?
> i) Czy możliwe jest wydanie pisemnego potwierdzenia (e-mail z kategorią zgody lub aneks do umowy) przed uruchomieniem zapisów?
>
> Załączniki: patrz lista poniżej.
>
> Z poważaniem,
> [imię i nazwisko, funkcja, członek zarządu], [telefon], [e-mail]

**Lista faktów i dokumentów do załączenia (checklista):**

- [ ] Odpis aktualny z KRS spółki, NIP, REGON, PKD, adres, reprezentacja, beneficjenci rzeczywiści (CRBR).
- [ ] Uchwała WZA o podwyższeniu kapitału (lub podstawa kapitału docelowego) wraz ze statutem; potwierdzenie spełnienia art. 431 § 3 KSH (wpłacone co najmniej 9/10 dotychczasowego kapitału, feasibility §0).
- [ ] Dokument informacyjny z art. 37a (wersja opublikowana) i potwierdzenie zawiadomienia KNF (data, numer).
- [ ] Opinia prawnika rynku kapitałowego (samodzielna oferta na stronie, brak potrzeby zezwolenia, status portalu wobec ECSP i oferowania).
- [ ] Umowa z podmiotem prowadzącym rejestr akcjonariuszy (np. DM Navigator) lub korespondencja.
- [ ] Regulamin zapisów, wzór formularza zapisu, procedura zwrotów i terminy.
- [ ] Opis przepływu środków (rachunek wydzielony, brak wydatkowania do wpisu, zwroty).
- [ ] Polityka AML/KYC spółki i dostawca weryfikacji; informacja o braku obrotu wtórnego.
- [ ] Prognoza wolumenu (liczba inwestorów, kwoty, szczyty), harmonogram okna.
- [ ] Wyjaśnienie struktury podmiotów: kto jest operatorem portalu, kto emitentem, kto administratorem danych (musi być spójne).
- [ ] Adres strony zapisów w trybie podglądu (bez możliwości płatności) lub makiety ekranów.

## 7. Szkic integracji w naszym stosie (bez implementacji)

Nic z tego nie jest budowane teraz. To uzupełnienie feasibility §4.

### 7.1 Zasady

- **Moduł `lib/modules/share-offering`** (wzorzec jak `sales`/`patron`: `domain`, `application`, `infrastructure`, `index.ts`), wyłącznik `shareOffering` (domyślnie `off`, nieznana wartość = `off`), sprawdzany na wejściu każdego use case'u i **każdej trasy webhooka/crona**. Gdy wyłącznik jest `off`: brak numerów rachunków, brak importu, brak ekranu płatności.
- **Osobny tor od napiwków:** nie `Payment`, nie `fulfillPayment()`, nie `PatronGrant` (feasibility §4.4). Własne modele `ShareSubscription` i `SubscriptionPayment`.
- **Port z abstrakcją dostawcy** (analogicznie do `PaymentProvider` z `crypto-gateway-plan.md` §3.2, ale odrębny):

```
ShareSubscriptionPayments (port, lib/modules/share-offering/domain)
  issuePaymentInstructions(subscriptionId) -> { accountNumber, amountMinor, reference, qrPayload, expiresAt }
  ingestBankEvents(batch | event)         -> BankTransaction[]     // plik MT940/MT942, AIS, webhook (jeśli istnieje)
  parseAndVerifyWebhook(rawBody, headers) -> ProviderEvent         // tylko dla adapterów PIS/BLIK
  fetchBookedTransactions(since)          -> BankTransaction[]     // do uzgadniania
  refund(subscriptionPaymentId, reason)   -> RefundInstruction     // przelew zwrotny do pliku/API banku
```

Adaptery: (1) `bank-virtual-account` (Plan A: import wyciągów, parser MT940/MT942 i opcjonalnie CAMT.053, ewentualnie AIS i push, jeśli bank udostępni); (2) `pis-provider` (Plan B, osobny adapter per operator, włączany osobnym kluczem konfiguracji tylko po piśmie operatora); (3) `intermediary-file` (Plan C: pliki od domu maklerskiego).

### 7.2 Dane (tylko do dopisywania tam, gdzie finansowe)

- `ShareSubscription` (id, seriesId, userId, shares, amountMinor, state, virtualAccountNumber UNIQUE, declaredPayerIban, expiresAt, createdAt).
- `BankTransaction` (**append-only, wyzwalacz blokujący UPDATE/DELETE** jak `LedgerEntry`): `source` (`mt940`|`ais`|`webhook`), `externalId` (jeśli jest) lub `fingerprint` = sha256(rachunek, data księgowania, kwota, rachunek kontrahenta, referencja, numer pozycji w wyciągu), `rawPayload` (zaszyfrowany, retencja wg AML), `receivedAt`. **UNIQUE(source, fingerprint)** = idempotencja importu i webhooków.
- `SubscriptionPayment` (powiązanie transakcji z zapisem: `transactionId`, `subscriptionId`, `matchResult`, `matchedAt`, `matchedBy` = `system`|`admin:id`, powód).
- `Refund` (id, subscriptionId, amountMinor, toIban = rachunek źródłowy, state, bankFileId).
- Migracje addytywne (CLAUDE.md §4.0).

### 7.3 Przetwarzanie zdarzeń i idempotencja

1. **Wejście zdarzeń:** (a) cron `GET /api/cron/share-bank-import` (Bearer `CRON_SECRET`, jak istniejące) co 5 do 15 minut dla śróddziennego pliku/AIS i raz dziennie dla pełnego MT940; (b) webhook `POST /api/webhooks/share-bank` tylko jeśli bank/PSP go oferuje: podpis na surowym ciele (jak Stripe), trasa publiczna w `middleware.ts`, 401 bez podpisu, **blokada po identyfikatorze zdarzenia** (jak `StripeEvent.id`).
2. **Dopasowanie w transakcji bazy:** `INSERT BankTransaction ... ON CONFLICT DO NOTHING`; jeśli wstawiono wiersz, `SELECT ... FOR UPDATE` na `ShareSubscription` po numerze rachunku, reguły z §3.5, **CAS** na stanie (`AWAITING_PAYMENT -> PAID` tylko z `AWAITING_PAYMENT`; przy nietypowym wyniku `HELD_FOR_REVIEW`), wpis do `AuditLog` (`share.payment.matched`, aktor `system`).
3. **Pipeline statusów** (rozszerza maszynę z feasibility §4.2 pkt 5): `SIGNED` -> `PAYMENT_INSTRUCTED` -> `AWAITING_PAYMENT` -> (`PAYMENT_DETECTED`, opcjonalnie, dla sygnału niepotwierdzonego, np. PIS "zlecona") -> `PAID` | `UNDERPAID` | `OVERPAID` | `HELD_FOR_REVIEW`; dalej `ALLOTTED` -> `BOARD_DECLARED` -> `FILED_KRS` -> `REGISTERED_KRS` -> `ENTERED_REGISTER` -> `ENTITLED`. Boczne: `EXPIRED`, `REFUND_PENDING`, `REFUNDED`, `REJECTED`. Przejścia tylko przez use case'y.
4. **Status dla klienta:** `GET /api/share/subscriptions/[id]/status` (autoryzacja: tylko właściciel zapisu) odpytywany co 3 do 5 s z backoffem; w tle (po wciśnięciu "Zrobiłem przelew") częstszy import dla tego zapisu. Zdarzenie `PAID` wysyła e-mail przez moduł `email`.
5. **Uzgadnianie (reconcile):** dzienny cron zestawia saldo rachunku wydzielonego z sumą `PAID` minus zwroty; różnice -> alert; sprawdza zapisy `AWAITING_PAYMENT` po terminie (`EXPIRED`), wykrywa wpłaty bez zapisu (`UNMATCHED`) i duplikaty.
6. **Przepustka** wyłącznie ze stanu `ENTERED_REGISTER` (feasibility §4.2 pkt 10), nigdy z `PAID`.

### 7.4 Wyłączniki i konfiguracja

`PLATFORM_GATE_SHARE_OFFERING=off` (domyślnie), osobny klucz dla każdego adaptera płatności (`SHARE_PAYMENTS_BANK=off`, `SHARE_PAYMENTS_PIS=off`), brak sekretów w repozytorium, numery rachunków i klucze API w zmiennych środowiskowych serwera. Niewłączone w produkcji do czasu zamknięcia faz 0 i 1 z feasibility §6.

### 7.5 Nakład (szacunek, dodatkowy do ok. 6 do 10 tygodni z feasibility)

| Element | Szacunek | Zależności |
|---|---|---|
| Plan A: modele, numery rachunków, parser MT940/MT942, dopasowanie, panel uzgadniania, status, QR | 3 do 4 tygodni | decyzja banku, format plików, wzór numeru |
| Plan A+: AIS lub push banku | dodatkowo 1 do 2 tygodni | dostępność AIS dla rachunków firmowych, umowa z AISP |
| Plan B: adapter PIS/BLIK, webhook, zwroty | dodatkowo 2 do 3 tygodni | pisemna zgoda operatora, sandbox |
| Plan C: plik/API pośrednika, uzgadnianie | 1 do 2 tygodni | umowa z pośrednikiem |
| Testy (reguły dopasowania, idempotencja, wyścigi, zwroty), przegląd bezpieczeństwa | 1 do 2 tygodni | - |

Szacunek niepewny (±50%), bez rozpoznania formatów banku.

### 7.6 Pytania otwarte do prawnika, księgowego i banku

**Do prawnika rynku kapitałowego:**
1. Czy samodzielne przyjmowanie zapisów i wpłat przez emitenta (bez domu maklerskiego) jest dopuszczalne? Jak wygląda granica "działalności identycznej co do celu" z komunikatu KNF, gdy portal obsługuje tylko jednego emitenta, a operatorem jest ten sam podmiot (lub inny)?
2. Czy do oferty z art. 37a stosuje się art. 440 KSH (okno, przydział, zwrot) i art. 5a u.o.p. lub jego odpowiednik (rachunek wydzielony, zakaz wydawania do wpisu)? Jeśli nie, to czy rachunek wydzielony i zasada "nie ruszamy" są jednak zalecane?
3. Czy wpłaty mogą leżeć na rachunku spółki przed wpisem (art. 311 i 312 KSH i orzecznictwo), a jeśli tak, to jaki rachunek (pomocniczy czy zastrzeżony)?
4. Czy forma przelewu i potwierdzenie wpłaty wystarczają jako "wpłata" przy zapisie elektronicznym, i kto "poświadcza" zapis (art. 437)?
5. Czy wolno wyróżnić w komunikacji "szybki przelew z QR" bez ryzyka wprowadzenia w błąd co do momentu powstania akcji?
6. Czy brak prawa odstąpienia dla inwestora jest dopuszczalny i jak go ująć w dokumencie?
7. Zakres obowiązków AML spółki jako emitenta i obowiązek identyfikacji płatnika.

**Do księgowego / doradcy podatkowego:**
8. Ewidencja wpłat przed wpisem (rozliczenia/zobowiązanie), oprocentowanie rachunku, koszty emisji i ich status w CIT.
9. VAT od opłat bankowych i PSP, PCC od serii, ewentualna "przepustka" jako świadczenie wzajemne.
10. Czy można doliczać koszty płatności do ceny (zakładamy: nie).

**Do banku / PSP (każdego z osobna, zob. §6):** branża, rachunek wydzielony, kanały zdarzeń, Express Elixir na rachunku wirtualnym, cennik, zwroty zbiorcze, wypowiedzenie w trakcie zbiórki.

## 8. Źródła (otwarte lub przeszukane 2026-10-19)

Źródła pierwotne (poziom zweryfikowano):

- Stripe, Prohibited and Restricted Businesses: https://stripe.com/legal/restricted-businesses
- Paynow, lista towarów i usług zakazanych: https://static.paynow.pl/docs/lista_towarów_i_uslug_zakazanych.pdf
- PayU, Załącznik 1 do regulaminu (wersja 2020): https://poland.payu.com/wp-content/uploads/sites/14/2020/07/annex_no_1_TC-of-the-PayU-System_List-of-types-of-goods-and-services-forbidden-to-trade-in.pdf
- Autopay, lista branż i produktów zakazanych: https://developers.autopay.pl/en/online/list-of-prohibited-products-and-industries
- Przelewy24, regulamin (EN): https://www.przelewy24.pl/en/regulations
- Tpay, załącznik 1: https://tpay.com/user/assets/files_for_download/attachment-1-list-of-goods-and-services-for-which-it-is-forbidden-to-accept-payments-through-the-site.pdf
- Adyen (PL), lista ograniczonych i zakazanych: https://www.adyen.com/pl_PL/legal/list-restricted-prohibited
- Checkout.com, eligibility: https://support.checkout.com/hc/en-us/articles/15260165363602-Check-your-eligibility-to-become-a-customer
- PayPal, Acceptable Use Policy (US): https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- Mollie, produkty niedopuszczone: https://help.mollie.com/hc/en-us/articles/115000939369-Which-products-and-services-does-Mollie-not-accept
- GoCardless, Restricted activities: https://gocardless.com/legal/restrictions
- Millennium PAY, wykaz branż zakazanych i wysokiego ryzyka (brak pozycji papierów wartościowych): https://www.bankmillennium.pl/delegate/managedfiles/2107/latest
- KNF, komunikat 9.11.2023 o platformach crowdfundingowych: https://www.knf.gov.pl/knf/pl/komponenty/img/Korzystanie_z_uslug_platform_crowdfundingowych_na_cele_gospodarcze_86773.pdf
- Pekao Collect: https://www.pekao.com.pl/korporacje/zarzadzanie-finansami/pekao-collect.html
- mBank Collect: https://www.mbank.pl/msp-korporacje/obsluga-biezaca/zarzadzanie-naleznosciami/collect/
- ING SIMP: https://www.ing.pl/spolki/karty-platnosci/system-identyfikacji-platnosci
- ING rachunki zastrzeżone i powiernicze: https://www.ing.pl/spolki/konta/rachunki-powiernicze-i-zastrzezone
- Bank Millennium AIPP: https://www.bankmillennium.pl/przedsiebiorstwa/produkty/obsluga-biezaca/platnosci-i-rozliczenia/automatyczna-identyfikacja-platnosci-przychodzacych-aipp
- Credit Agricole, Identyfikacja Płatności Masowych: https://www.credit-agricole.pl/przedsiebiorstwa/obsluga-biezaca/platnosci/identyfikacja-platnosci-masowych
- KIR, Express Elixir: https://www.kir.pl/nasza-oferta/klient-indywidualny/rozliczenia/express-elixir

Źródła wtórne i niezweryfikowane (poziom wtórne): freenance.io (crowdfunding udziałowy 2026), arslege.pl (art. 5a u.o.p.), pro.rp.pl (rachunki wirtualne a biała lista VAT; odpowiedzialność za nieautoryzowane płatności), beesfund.com (blog o crowdfundingu pożyczkowym, 404 przy odczycie), docs.yapily.com (Polska), developer.kontomatik.com (coverage, FAQ), fiskil.com (PolishAPI), ECB i bank.pl (rozporządzenie o płatnościach natychmiastowych), strefainwestorow.pl (GPW Private Market), strony blogów o chargebackach, wyniki wyszukiwarki dla SumUp, Revolut, Nuvei, Worldline, Dotpay, Alior i BNP.

Podsumowanie luk: nie zweryfikowano polityk onboardingowych Przelewy24 i Tpay (kluczowe dla Planu B), cenników żadnego banku ani PSP, kanałów push w polskich bankach, formatu kodu QR ZBP i wsparcia w aplikacjach, reguł BLIK dla sprzedawców, treści art. 311, 312, 436 i 441 KSH oraz art. 46 ustawy o usługach płatniczych w tekstach z Dz.U., aktualnych terminów rozporządzenia 2024/886. Przed decyzją wszystko to trzeba potwierdzić pisemnie u operatora lub u prawnika.
