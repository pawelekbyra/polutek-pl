# Sprzedaż akcji przez portal (PAWEŁ PERFECT S.A.): studium wykonalności, system NIEAKTYWNY

Status: **INACTIVE, studium wykonalności (2026-10-19); nic z tego nie jest wdrażane, nie ma kodu, migracji ani zmian w produkcji.** Dokument nie zmienia zasad z CLAUDE.md §4.1, §4.2, §4.10, §4.14, §4.24, §4.25 ani wyłączników `sales`, `payouts`, `channelCreation` (zostają `off`). Pytanie właściciela: "czy możemy wprowadzić na stronie (pawelperfect.com, Next.js + Postgres, własny serwer) bramkę, w której ludzie bardzo szybko kupują AKCJE, a akcje są przepustką do strefy patronackiej z dodatkowymi treściami". Kontekst: `payments-resilience.md`, `crypto-gateway-plan.md`, `payments-and-tips.md`, `multi-creator-platform.md`.

**To nie jest porada prawna ani podatkowa.** Dokument porządkuje fakty z dostępnych źródeł i pokazuje, o co zapytać licencjonowanego prawnika (rynek kapitałowy, KSH) i księgowego/doradcę podatkowego. Plan właściciela traktujemy jako dane wejściowe do sprawdzenia, nie jako ustalony fakt.

Oznaczenia: **[zweryfikowano]** = przeczytane w źródle w dniu pisania (podane URL); **[serwis wtórny]** = przeczytane na portalu prawniczym/archiwalnym, który sam zastrzega, że nie jest źródłem prawa (sprawdzić w Dz.U./ISAP); **[niezweryfikowano]** = z wyszukiwarki, z pamięci albo wniosek własny, sprawdzić przed decyzją. Uwaga o narzędziach: strony `eur-lex.europa.eu` i `isap.sejm.gov.pl` nie dały się w tej sesji odczytać automatycznie (blokada/JS), więc teksty ustaw i rozporządzeń pochodzą z portali wtórnych, a nie z Dziennika Ustaw.

## 0. Werdykt

**Technicznie: TAK.** To zwykła aplikacja: formularze, weryfikacja tożsamości przez zewnętrznego dostawcę, płatność, uzgadnianie wpłat, maszyna stanów, panel administratora, dokumenty z wersjonowaniem. Mieści się w naszym stosie (moduł `lib/modules/*`, wyłącznik, audyt). Szacunek w §6.

**Prawnie: "TAK, ale nie jako przycisk 'kup'", i dopiero po spełnieniu warunków, z których kilka plan właściciela pomija albo opisuje błędnie.** Własna oferta publiczna akcji spółki niepublicznej na własnej stronie, bez prospektu i bez domu maklerskiego, istnieje w polskim prawie: art. 37a ustawy o ofercie publicznej (dokument informacyjny dla ofert od 100 tys. do mniej niż 1 mln EUR w 12 miesiącach, wymagane zawiadomienie KNF na 7 dni roboczych przed publikacją, publikacja na stronie emitenta) [zweryfikowano, §2.1]. Ale:

1. **Blokada w planie: art. 431 § 3 KSH.** Podwyższenie kapitału jest możliwe dopiero po *całkowitym wpłaceniu co najmniej 9/10 dotychczasowego kapitału zakładowego* [serwis wtórny, §2.2]. Plan zakłada spółkę ze 100 tys. zł kapitału, z czego 75 tys. zł do wpłaty "do 31.12.2030". Jeśli to prawda, **przed pierwszą emisją trzeba wpłacić co najmniej ok. 65 tys. zł więcej (do 90 tys. zł), a nie w 2030 r.**, bo bez tego nie ma podwyższenia. To trzeba sprawdzić w pierwszej kolejności, razem z odpisem z KRS spółki TERKENA S.A. (nie znaleziono jej w wyszukiwarce, §2.10).
2. **"Kup i masz od razu" jest niemożliwe z samego prawa.** Akcje z podwyższenia powstają po wpisie podwyższenia do KRS, a wpis do rejestru akcjonariuszy następuje potem (do tygodnia od żądania) [§2.2, §2.3]. Realnie to tygodnie, nie sekundy (§4.5). Interfejs i płatność mogą być w sekundach; **przepustka do strefy nie może zostać wydana wcześniej niż akcja istnieje** (jeśli ma być "tylko dla akcjonariuszy").
3. **Zapis na akcje ma wymóg formy** (art. 437 KSH): formularz w dwóch egzemplarzach pisemnie albo formularz elektroniczny z podpisem kwalifikowanym, zaufanym lub osobistym [serwis wtórny]. Samo kliknięcie "akceptuję" prawdopodobnie nie wystarcza. To jest nieusuwalne tarcie (profil zaufany / e-dowód / podpis kwalifikowany).
4. **Przy ofercie na dokumencie z art. 37a prawdopodobnie obowiązuje pełna procedura subskrypcji otwartej** (ogłoszenie, termin zapisów nie krótszy niż 2 tygodnie, przydział w ciągu 2 tygodni od zamknięcia) [serwis wtórny, §2.2]; wyłączenia z art. 440 § 3 KSH dotyczą ofert z prospektem lub memorandum, a dokumentu informacyjnego w znalezionym brzmieniu nie wymieniają. To zabija model "sprzedaż ciągła"; zostają **serie z oknami zapisów**. Do potwierdzenia przez prawnika.
5. **Limit 1 mln EUR jest ostry i łączny:** poniżej 1 000 000 EUR razem z ofertami z poprzednich 12 miesięcy; powyżej jest memorandum (art. 37b), a KNF już karała spółkę za sumowanie serii i użycie niewłaściwego dokumentu (SkyCash, 2022, §2.1).
6. **Strefa patronacka "za akcje" łamie dzisiejszy model produktu** (CLAUDE.md §4.1: wspierający nie decydują o dostępie) i miesza produkt konsumencki z inwestycją. To wymaga osobnej decyzji właściciela, projektu prawnego (art. 20 KSH, statut) i opinii podatkowej (§2.8, §2.9).
7. **Koszty rejestru i obsługi inwestorów w planie są zaniżone** względem opublikowanego regulaminu i tabeli opłat DM Navigator (§2.3, §7).

**Czy "bardzo szybko" jest realistyczne?** Dla *wpłaty i zapisu* (jedna kampania, BLIK/przelew, zapis podpisany profilem zaufanym): tak, kilka minut, jeśli KYC i podpis są w jednym przepływie. Dla *posiadania akcji i dostępu*: nie, to zależy od okien subskrypcji, przydziału, aktu notarialnego zarządu i wpisu do KRS (tygodnie do miesięcy, §4.5). Najbezpieczniejszy sposób na "szybko" to **rozdzielić dwa produkty**: (A) strefa patronacka jako zwykła płatna subskrypcja (poza papierami wartościowymi, za wyłącznikiem `sales`) i (B) oferta akcji jako osobny, powolny, w pełni regulowany proces bez automatycznego "pasa" (§2.8, opcja C).

**Rekomendacja:** nie pisać kodu teraz. Najpierw faza 0 (§6): odpis KRS, opinia prawnika rynku kapitałowego, ustalenie kapitału, umowa z dostawcą rejestru, decyzja o modelu przepustki. Kod ma sens dopiero po pozytywnej opinii, a wtedy jest to ok. 6 do 10 tygodni pracy (§6).

## 1. Plan właściciela: ocena punkt po punkcie

| Założenie planu | Ocena | Gdzie |
|---|---|---|
| Przejęcie "czystej" spółki półkowej TERKENA S.A., zmiana nazwy na PAWEŁ PERFECT S.A. | Nie znaleziono spółki w wyszukiwarce; nie można potwierdzić "czystości", kapitału ani stanu wpłat. Wymagany odpis z KRS, sprawdzenie zobowiązań, rejestru akcjonariuszy i wpłat. **[niezweryfikowano]** | §2.10 |
| Kapitał 100 tys. zł, 75 tys. zł do wpłaty do 31.12.2030 | **Koliduje z art. 431 § 3 KSH** (9/10 kapitału musi być wpłacone przed podwyższeniem) [serwis wtórny] | §2.2 |
| Oferta publiczna własna, bez platformy crowdfundingowej i bez domu maklerskiego | Możliwa w modelu art. 37a: dokument informacyjny na stronie emitenta [zweryfikowano]. Nie wolno jednak pośredniczyć w obrocie wtórnym ani zlecać innym "oferowania" bez licencji (§2.4) | §2.1, §2.4 |
| "Limit do 1 mln EUR (ok. 4-4,5 mln zł) w 12 miesięcy" | Poprawny próg dla dokumentu informacyjnego: od 100 tys. do **mniej niż** 1 mln EUR, łącznie z ofertami z 12 miesięcy; przeliczenie po kursie wg ustawy (art. 4a, szczegół **[niezweryfikowano]**) | §2.1 |
| Własny "Publiczny Dokument Informacyjny" | Treść minimalna wskazana w art. 37a ust. 2-3 (emitent, finanse, papiery, warunki, cel środków, ryzyka, oświadczenie o odpowiedzialności). KNF w sprawie Canapharm ukarała m.in. brak podpisanego oświadczenia i nierzetelne informacje [zweryfikowano] | §2.1 |
| Rejestr akcjonariuszy u DM Navigator S.A. | Potwierdzone: Navigator prowadzi rejestry dla S.A., S.K.A., P.S.A. [zweryfikowano]. Nie znaleziono wzmianki o obsłudze ofert publicznych ani API; koszty wyższe niż w planie | §2.3 |
| Płatności BLIK / Open Banking / PIS "bezpośrednio na rachunek w PEKAO" | BLIK wymaga pośrednika (agent rozliczeniowy/PSP); część operatorów zakazuje sprzedaży akcji; PIS wymaga licencjonowanego PISP. Najlepsza dla zgodności jest wpłata przelewem z unikalnym numerem referencyjnym/rachunkiem wirtualnym | §3 |
| AML/KYC przed formularzem zapisu | Dobra praktyka i tak wymuszona przez rejestr (Navigator robi własne KYC akcjonariuszy). Czy emitent sam jest "instytucją obowiązaną" do AML: raczej nie, **[niezweryfikowano]**; pytanie do prawnika | §2.6 |
| "VAT 0%" (emisja akcji nie jest sprzedażą) | Intencja zbliżona do praktyki, ale sformułowanie błędne: emisja jest czynnością **poza zakresem VAT**, to nie jest stawka 0% [serwis wtórny]. Perk w postaci dostępu do treści może wprowadzić VAT od części wpłaty | §2.9 |
| "CIT 0%: wpłaty na kapitał nie są przychodem" | Zasada (art. 12 ust. 4 pkt 4 ustawy o CIT) jest szeroko cytowana, ale po zmianach z 2018 r. są wątpliwości co do wkładów pieniężnych; stanowisko MF w interpretacji ogólnej z 27.03.2018 **[niezweryfikowano treść]** | §2.9 |
| "PCC 0,5% od podwyższenia kapitału" | Stawka i podatnik (spółka) potwierdzone [serwis wtórny]; podstawa to wartość podwyższenia kapitału zakładowego, agio zwykle nie wchodzi do podstawy. Przy emisji 4,25 mln zł po wartości nominalnej to ok. **21 tys. zł** | §2.9 |
| "Komunikacja: brak obietnic dywidendy, pełne reinwestowanie" | Dobra linia, ale reklama oferty publicznej też podlega rygorom (art. 99 ust. 2 u.o.p. karze za nieprawidłową reklamę oferty) [serwis wtórny]; dodatkowo przepustka za akcję jest sama w sobie "korzyścią", którą trzeba ujawnić w dokumencie | §2.7, §2.8 |
| Koszty startowe 19 398 zł netto | Niekompletne: brak wpłat do 9/10 kapitału, kosztów dokumentu i prawnika, PCC, taksy za akt zarządu przy każdej serii, opłat KRS za serię, opłat Navigatora od liczby akcjonariuszy | §7 |
| Koszty roczne (rejestr 1 200-1 800 zł, ZWZA 500-1 000 zł, audyt 2 500-8 000 zł) | **Rejestr wg tabeli Navigatora z regulaminu 2026: 4 547 do 9 475 zł rocznie (pakiety S do XL) plus opłaty za czynności i akcjonariuszy.** ZWZA i audyt przy setkach lub tysiącach drobnych akcjonariuszy będą droższe **[niezweryfikowano]** | §2.3, §7 |
| Start zapisów w kwietniu 2027 | Ambitny, nie niemożliwy, ale zależny od czasu rejestracji zmian w KRS po przejęciu spółki i od terminu 7 dni roboczych na zawiadomienie KNF oraz minimum 2 tygodni na zapisy | §6 |

## 2. Prawo

### 2.1 Próg oferty i dokument informacyjny (ustawa o ofercie publicznej)

- **Art. 37a ust. 1 [zweryfikowano]:** oferta publiczna papierów wartościowych, której zakładane wpływy brutto emitenta w UE (liczone po cenie emisyjnej z dnia jej ustalenia) wynoszą od 100 000 EUR do mniej niż 1 000 000 EUR, i **wraz z wpływami z ofert takich papierów z poprzednich 12 miesięcy** mieszczą się w tym przedziale, wymaga udostępnienia dokumentu z informacjami o ofercie. https://arslege.pl/dokument-informacyjny-o-ofercie-papierow-wartosciowych/k383/a127085/ (t.j. Dz.U. 2025 poz. 592), https://prawnik.cc/laws/ustawa-o-ofercie-publicznej-i/art-37a-dokument-informacyjny-o
- **Treść (ust. 2-3):** po polsku; podstawowe informacje o emitencie (w tym finansowe), papierach i warunkach oferty; plan wykorzystania środków; istotne czynniki ryzyka; oświadczenie emitenta, że według najlepszej wiedzy i z należytą starannością informacje są prawdziwe, rzetelne i zgodne ze stanem faktycznym [zweryfikowano].
- **Zawiadomienie KNF (ust. 4):** najpóźniej na 7 dni roboczych przed udostępnieniem dokumentu [zweryfikowano]. KNF dokumentu nie zatwierdza (w odróżnieniu od prospektu); pozostaje nadzór następczy.
- **Udostępnienie (ust. 5):** przy ofercie do nieoznaczonego adresata: na stronie internetowej emitenta, oferującego lub firmy inwestycyjnej pośredniczącej [zweryfikowano]. To jest podstawa, na której własna strona jest dopuszczalnym kanałem.
- **Powyżej 1 mln EUR:** art. 37b, memorandum informacyjne. W informacji KNF z 2022 r. przedział to od 1 do 2,5 mln EUR [zweryfikowano w publikacji KNF poniżej]; starsze/inne serwisy podają 5 mln EUR [serwis wtórny, archiwalny]. **Aktualny próg sprawdzić w tekście jednolitym**, bo nie jest nam potrzebny, dopóki trzymamy się poniżej 1 mln EUR.
- **Próg unijny:** rozporządzenie 2017/1129 (prospekt) nie stosuje się do ofert o łącznej wartości w UE poniżej 1 mln EUR w 12 miesiącach (art. 1 ust. 3), a państwa członkowskie mogą zwolnić z obowiązku prospektu oferty do 8 mln EUR (art. 3 ust. 2); Polska korzysta z tej opcji przez art. 37a-37b. [zweryfikowano w streszczeniach kancelarii: https://www.reedsmith.com/de/perspectives/2018/07/eu-prospectus-regulation-new-thresholds-for-small-fundraisings , https://www.simmons-simmons.com/en/publications/ck0a76zitcqq70b59oyfhjzpi/110718-prospectus-regulation-increase-in-exempt-offers-threshold-to-8-million ; tekst rozporządzenia na eur-lex nie był dostępny w sesji]
- **Definicja "oferty publicznej":** komunikat do co najmniej 150 osób lub nieoznaczonego adresata (art. 3, wg UKNF liczy się też limit 149 osób dla ofert od 30.11.2019). Oferta na stronie dostępnej dla każdego jest ofertą do nieoznaczonego adresata, więc jest publiczna. [zweryfikowano pośrednio w publikacjach KNF i w art. 37a ust. 5]
- **Sankcje (art. 99) [serwis wtórny, archiwalny]:** oferta publiczna bez wymaganego dokumentu (m.in. dokumentu z art. 37a) lub nieprawidłowa reklama oferty: grzywna do 10 mln zł i/lub do 2 lat pozbawienia wolności (w mniejszej wadze grzywna do 2,5 mln zł); odpowiedzialność obejmuje też działanie w imieniu spółki. https://standardyprawa.pl/akt/437/art/51132
- **Praktyka KNF (publikacje "informacja o niezgodnym z prawem działaniu", art. 16 ust. 1 pkt 3 u.o.p.) [zweryfikowano, pierwotne PDF-y KNF]:**
  - **SkyCash Poland SA (1.12.2022):** oferta serii M przeprowadzona na dokumencie z art. 37a, ale po zsumowaniu z serią L z okresu krótszego niż 12 miesięcy wpływy przekroczyły 1 mln EUR, więc wymagane było memorandum. Wniosek dla nas: **kolejne serie liczą się razem w oknie 12 miesięcy; przekroczenie progu zmienia reżim.** https://intranet.knf.gov.pl/knf/pl/komponenty/img/Informacja_o_niezgodnym_z_prawem_dzialaniu_SkyCash_Poland_SA_80461.pdf
  - **Canapharm P.S.A. (7.6.2022):** oferta publiczna akcji serii B przez platformę crowdfundingową bez uchwały o emisji (brak podstawy prawnej oferty), dokument ofertowy bez podpisanego oświadczenia emitenta i z niezgodnymi lub niekompletnymi informacjami (naruszenie art. 37a ust. 2 i 3), a platforma, jak podejrzewa KNF, świadczyła usługę oferowania bez zezwolenia (art. 69 ust. 1 w zw. z ust. 2 pkt 6 ustawy o obrocie instrumentami finansowymi). Wniosek: **uchwała o emisji musi poprzedzać ofertę, a dokument musi być prawdziwy i podpisany.** https://intranet.knf.gov.pl/knf/pl/komponenty/img/Informacja_publikowana_na_podstawie_art_16_ust_1_pkt_3_ustawy_o_ofercie_o_niezgodnym_z_prawem_dzialaniu_Canapharm_78521.pdf
- KNF publikuje te informacje **na koszt spółki** (reputacja przy ofercie do fanów to realny koszt).

### 2.2 Mechanika w KSH (spółka akcyjna)

Źródło tekstów: standardyprawa.pl i arslege.pl (portale wtórne, wersje archiwalne, np. Dz.U. 2024 poz. 18). **Wszystko poniżej do potwierdzenia przez prawnika w aktualnym tekście jednolitym.**

- **Art. 431 § 2:** objęcie nowych akcji: subskrypcja prywatna (oznaczony adresat, nie oferta publiczna), zamknięta (prawo poboru) albo **otwarta** (ogłoszenie do osób bez prawa poboru). Oferta publiczna na stronie to subskrypcja **otwarta**. [serwis wtórny] https://standardyprawa.pl/akt/37/art/8179
- **Art. 431 § 3:** podwyższenie dopiero po *całkowitym wpłaceniu co najmniej 9/10 dotychczasowego kapitału zakładowego*. [serwis wtórny] To jest kluczowe ryzyko planu (§0 pkt 1). Wniosek dla modelu "75 tys. zł do 2030": **niedopuszczalny jako harmonogram, jeśli kapitał to 100 tys. zł, a wpłacono tylko 25 tys. zł**.
- **Art. 309 (stosowany odpowiednio, art. 431 § 7):** akcje nie mogą być obejmowane poniżej wartości nominalnej; agio wpłacane w całości przed rejestracją; wkłady pieniężne opłacone przed rejestracją co najmniej w 1/4 wartości nominalnej. [serwis wtórny] https://standardyprawa.pl/akt/37/art/8036
- **Art. 432:** uchwała WZA o podwyższeniu (suma podwyższenia, cena emisyjna lub upoważnienie, rodzaj akcji, uprawnienia). Zmiana statutu = akt notarialny/protokół notarialny. Alternatywa: **kapitał docelowy** (zarząd podwyższa kapitał w granicach upoważnienia statutowego; limity i okres do sprawdzenia, z pamięci do 3 lat i do 3/4 kapitału) **[niezweryfikowano]**: ułatwia powtarzalne serie, ale każda seria i tak wymaga wpisu do KRS.
- **Art. 431 § 4:** uchwały nie zgłasza się do sądu rejestrowego po upływie 6 miesięcy od jej powzięcia (przy ofercie z prospektem/memorandum biegną terminy od zatwierdzenia dokumentu). [serwis wtórny]
- **Art. 431 § 5:** zarząd zwraca wkłady osobom, które objęły akcje, w terminach zależnych od upływu 6 miesięcy albo prawomocnej odmowy rejestracji. [serwis wtórny] To jest podstawa **zwrotu**, gdy seria nie dojdzie do skutku (§3.4).
- **Art. 437 (zapis na akcje):** formularz przygotowany przez spółkę, w co najmniej 2 egzemplarzach, pisemnie; wariant elektroniczny: formularz w systemie teleinformatycznym i podpis kwalifikowany, zaufany lub osobisty; przyjęcie zapisu elektronicznego wymaga poświadczenia przez podmiot przyjmujący; zapis warunkowy lub z zastrzeżeniem terminu jest nieważny; brak wymaganych danych (lub podpisu przy zapisie elektronicznym) = nieważność; dodatkowe postanowienia spoza formularza nie wywołują skutków. [serwis wtórny] https://standardyprawa.pl/akt/37/art/8185
- **Art. 440 (subskrypcja otwarta):** ogłoszenie wzywające do zapisów, **termin zapisów nie krótszy niż 2 tygodnie od ogłoszenia**; podmiot przyjmujący zapisy i wpłaty może być wskazany; § 3: wymogi § 1 i art. 434 nie stosuje się do subskrypcji w ramach oferty z prospektem lub memorandum. [serwis wtórny] https://standardyprawa.pl/akt/37/art/8188 **Dokument z art. 37a nie jest w tym wyłączeniu wymieniony** w znalezionym brzmieniu; stąd ostrzeżenie w §0 pkt 4.
- **Przydział i zwrot (art. 438-439):** przydział w ciągu 2 tygodni od zamknięcia subskrypcji (przy zebraniu minimum), wezwanie osób bez przydziału do odbioru wpłat w ciągu 2 tygodni [serwis wtórny, wynik wyszukiwania; nie czytano pełnego tekstu].
- **Art. 441:** zarząd zgłasza podwyższenie do KRS, z uchwałą, ogłoszeniem, wzorem zapisu, spisem nabywców i wpłat. **Podwyższenie następuje z chwilą wpisu do KRS** [serwis wtórny; wprost potwierdzone w regulaminie Navigatora: wpis do rejestru po prawomocnym wpisie podwyższenia, §7 ust. 14]. Oświadczenie zarządu o wysokości objętego kapitału w formie aktu notarialnego (art. 310 w zw. z 431 § 7) **[niezweryfikowano w tej sesji]**.
- **Co z "cyklicznym zamykaniem serii":** każda seria = uchwała lub decyzja zarządu w kapitale docelowym, zawiadomienie KNF i dokument, okno zapisów (min. 2 tygodnie, jeśli art. 440 ma zastosowanie), przydział, akt zarządu, wniosek do KRS, rejestracja przez sąd, wpis w rejestrze akcjonariuszy. Częstotliwość ogranicza czas sądu rejestrowego (**[niezweryfikowano]**, tygodnie do miesięcy).
- **Spółka publiczna:** definicja z ustawy o ofercie (akcje dopuszczone do rynku regulowanego lub wprowadzone do ASO) [wynik wyszukiwania], więc oferta na art. 37a **sama nie czyni S.A. spółką publiczną**. Do potwierdzenia.

### 2.3 Dematerializacja, rejestr akcjonariuszy i DM Navigator

- Od 1.3.2021 dokumenty akcji straciły moc, a akcje spółek niepublicznych są zapisane w **rejestrze akcjonariuszy** prowadzonym przez uprawniony podmiot; własność akcji przechodzi z wpisem. [wynik wyszukiwania + regulamin Navigatora, zweryfikowano w części: wpis jest warunkiem skuteczności nabycia, z wyjątkiem objęcia akcji z podwyższenia, §7 ust. 12-13]
- **Navigator rzeczywiście oferuje usługę** [zweryfikowano]: prowadzi rejestry S.A., S.K.A., P.S.A.; rejestr prowadzą domy maklerskie i banki powiernicze z zezwoleniem KNF, w prostych spółkach akcyjnych także notariusze; wybór podmiotu następuje uchwałą WZA. https://dmnavigator.pl/rejestr-akcjonariuszy-faq/ , https://dmnavigator.pl/rejestr-akcjonariuszy/
- **Regulamin (obowiązuje od 1.3.2026) i tabela opłat [zweryfikowano, pierwotny PDF Navigatora]:** https://dmnavigator.pl/wp-content/uploads/DMN_Regulamin_SA-i-SKA_2026.pdf
  - Otwarcie rejestru: 0 zł. **Opłata roczna: pakiet S 4 547 zł, M 5 690 zł, L 6 834 zł, XL 9 475 zł** (kwoty z tabeli; VAT doliczany wg FAQ pyt. 90). Plan zakłada 1 200-1 800 zł rocznie i 1 750 zł rozliczenia startowego: **rozbieżność, do wyjaśnienia z Navigatorem** (może istnieć inna oferta indywidualna).
  - **Obsługa podwyższenia kapitału (emisja nowych akcji): 1 000 zł za każdą nową serię plus 25 zł od każdego akcjonariusza obejmującego akcje nowej emisji ponad 10; gdy akcjonariuszy jest więcej niż 149, opłata "może być ustalana indywidualnie".** Przykład (orientacyjny, nie oferta): 500 inwestorów w serii to ok. 1 000 + 490 x 25 = 13 250 zł; 2 000 inwestorów to ok. 50 750 zł.
  - Wpis do rejestru: niezwłocznie, nie później niż w tydzień od żądania (FAQ pyt. 26, 43; regulamin). Wypłata dywidendy 1 000 zł plus opłaty za przelewy. Zmiana podmiotu prowadzącego rejestr 2 000 zł.
  - **KYC/AML akcjonariuszy robi sam rejestr** (ankieta GIIF, weryfikacja tożsamości; FAQ pyt. 16, 56), więc inwestor przejdzie weryfikację dwa razy, chyba że ustalimy z Navigatorem współpracę (pytanie do niego).
  - Aplikacja WEB dla spółki i akcjonariuszy; dyspozycje z podpisem kwalifikowanym lub ePUAP. **Brak informacji o API/integracjach i o obsłudze ofert publicznych/crowdfundingu** [zweryfikowano brak na stronie FAQ]. Zakładamy import ręczny (plik/formularz) i trzeba zapytać o format.
- Akcjonariusze są ujawnieni w rejestrze; **listę akcjonariuszy mają prawo oglądać inni akcjonariusze** (art. 407 KSH, **[niezweryfikowano]**). Dla produktu, który dziś obiecuje brak publicznych odznak i prywatność wspierających (CLAUDE.md §4.1), to istotna zmiana, o której inwestor musi być poinformowany.

### 2.4 Licencja domu maklerskiego, MiFID, crowdfunding UE

- **Emitent sprzedający własne akcje.** Art. 37a ust. 5 wprost przewiduje publikację na stronie emitenta [zweryfikowano]; UKNF w komentarzach do crowdfundingu zakłada, że strona emitenta jest właściwym miejscem informacji o emisji (artykuł sprzed nowej ustawy, aktualność do sprawdzenia: https://bank.pl/uknf-w-sprawie-crowdfundingu-moze-bedzie-latwiej/ ). Nie znaleziono w sesji przepisu ani stanowiska KNF, że sama sprzedaż własnych akcji przez emitenta wymaga zezwolenia; **nie znaleziono też potwierdzenia, że nie wymaga**, więc to pytanie nr 3 do prawnika.
- **Usługa "oferowania instrumentów finansowych" (art. 69 ust. 2 pkt 6 ustawy o obrocie instrumentami finansowymi)** wymaga zezwolenia; KNF w sprawie Canapharm podejrzewa jej świadczenie przez platformę bez zezwolenia [zweryfikowano]. **Wniosek projektowy: portal nie może pełnić roli pośrednika dla innych emitentów, nie może doradzać, nie może prowadzić obrotu wtórnego ani zestawiać zleceń kupna i sprzedaży między użytkownikami** (to byłoby maklerstwo/ASO). Cena i zbycie akcji poza portalem: poza zakresem.
- **Rozporządzenie (UE) 2020/1503 (ECSP):** dotyczy dostawców usług finansowania społecznościowego (platform) i ofert o wartości do 5 mln EUR w 12 miesiącach; "usługa" to łączenie inwestorów z właścicielami projektów za pomocą platformy, "dostawca" to osoba prawna świadcząca takie usługi. [zweryfikowano w wersji brytyjskiej tekstu: https://www.legislation.gov.uk/eur/2020/1503/chapter/I/data.htm ; ESMA Q&A 2437 o sumowaniu progów: https://www.esma.europa.eu/publications-data/questions-answers/2437 ; oryginał z eur-lex niedostępny w sesji] Samodzielny emitent bez platformy nie jest dostawcą, więc ECSP i polska ustawa o finansowaniu społecznościowym (art. 37c u.o.p. i arkusz KID) go wprost nie dotyczą. **Uwaga:** jeśli portal zacznie przyjmować zapisy *w imieniu* spółki zależnej/innych projektów albo działać jako "platforma" dla kogokolwiek poza emitentem, wchodzimy w ECSP i zezwolenie KNF. Pytanie nr 4.
- **Dom maklerski jako podmiot "przyjmujący zapisy i wpłaty"** (art. 437, 440 KSH) jest opcją, nie obowiązkiem; jeśli spółka sama przyjmuje, musi poświadczać zapisy elektroniczne (art. 437).

### 2.5 Co o tym sądzi KNF

- Pierwotne publikacje (SkyCash, Canapharm) pokazują trzy typowe zarzuty: brak właściwego dokumentu, zły próg/sumowanie, brak uchwały o emisji; plus zarzut wobec platformy o brak zezwolenia. Narzędzia: informacja o niezgodnym z prawem działaniu na koszt spółki (art. 16 ust. 1 pkt 3), możliwość zakazu/zawieszenia oferty (art. 16 ust. 1 pkt 1-2; tekst **[niezweryfikowano]**). Strona KNF o crowdfundingu: https://www.knf.gov.pl/dla_rynku/crowdfunding (nie czytana w sesji). Nie wyszukiwano ostrzeżeń publicznych KNF dotyczących konkretnych podmiotów podobnych do naszego modelu.
- **Wniosek:** KNF patrzy na formalności i na rzetelność dokumentu. Oferta do dużej liczby drobnych inwestorów (fani twórcy, korelacja marketingowa z treściami) przyciąga zainteresowanie bardziej niż niszowa emisja do kilkudziesięciu osób **[opinia własna]**.

### 2.6 AML/CFT i KYC

- Ustawa z 1.3.2018 o przeciwdziałaniu praniu pieniędzy: zamknięty katalog instytucji obowiązanych (m.in. banki, domy maklerskie, instytucje płatnicze, notariusze); **zwykła spółka akcyjna jako emitent własnych akcji raczej nie jest instytucją obowiązaną** **[niezweryfikowano, katalog art. 2 ust. 1 nie został przeczytany]**. Obowiązki AML mają za to: bank spółki (PEKAO), operator rejestru (Navigator robi KYC akcjonariuszy, a jego regulamin wśród przyczyn rozwiązania umowy wymienia wpisanie spółki na listę ostrzeżeń publicznych KNF) i operator płatności.
- Konsekwencje praktyczne niezależnie od statusu prawnego: (a) bank może zażądać od spółki udokumentowania źródła wpływów od tysięcy osób (dużo drobnych wpłat z zewnątrz na świeżo przejętą spółkę to wzorzec, który banki oznaczają do analizy), (b) rejestr wymaga danych tożsamości i dla osób prawnych beneficjentów rzeczywistych, (c) CRBR dotyczy spółki jako podmiotu (zgłoszenie beneficjentów rzeczywistych samej spółki), nie inwestorów. **Opinia: KYC inwestorów u nas ma sens głównie po to, by dane do rejestru były kompletne i by wpłata pochodziła z rachunku zapisanego inwestora; zakres trzeba uzgodnić z bankiem i Navigatorem, żeby nie robić trzeciej weryfikacji.**
- Okres przechowywania danych AML (z pamięci 5 lat od końca relacji) i zgodność z RODO (§4.2 poz. 9) **[niezweryfikowano]**.

### 2.7 Reklama, konsumenci, praktyki rynkowe

- Reklama oferty publicznej jest regulowana (u.o.p.; sankcja art. 99 ust. 2 [serwis wtórny]; rozporządzenie 2017/1129 art. 22 dla ofert z prospektem). Dla oferty z art. 37a **zakres obowiązków reklamowych do potwierdzenia** (pytanie nr 8). Praktyczne minimum: każda reklama wskazuje dokument informacyjny i jego adres, zawiera ostrzeżenie o ryzyku utraty całości i braku płynności, nie obiecuje dywidendy ani zysku, nie jest sprzeczna z dokumentem.
- Inwestorzy-konsumenci: ustawa o prawach konsumenta (sprzedaż na odległość, informacje, odstąpienie) a papiery wartościowe i usługi finansowe; wyłączenia i odrębne reżimy (usługi finansowe na odległość) **[niezweryfikowano]**. Dla treści cyfrowych (strefa) obowiązuje inny reżim niż dla akcji (§2.8). Zasada ostrożności: **nie używać języka sprzedaży produktu ("kup dostęp za akcję") w odniesieniu do akcji**; UOKiK (nieuczciwe praktyki rynkowe) jako drugi organ ryzyka **[niezweryfikowano]**.
- ECSP wprowadza dla platform test wiedzy inwestora, symulację zdolności do poniesienia straty i 4-dniowy okres do namysłu dla nieprofesjonalnych inwestorów (art. 21-22) **[niezweryfikowano szczegóły]**. Nas nie obowiązują, ale to dobry wzorzec dobrowolny (ochrona przed zarzutem żerowania na lojalności fanów).

### 2.8 Równe traktowanie akcjonariuszy a przepustka do strefy patronackiej

- **Art. 20 KSH:** akcjonariusze powinni być traktowani jednakowo w takich samych okolicznościach; wg SN i doktryny nie jest to równość arytmetyczna, lecz zakaz arbitralnej dyskryminacji; wyjątki: m.in. akcje uprzywilejowane (art. 351, wymagają statutu; uprzywilejowanie może dotyczyć głosu, dywidendy, majątku likwidacyjnego) i uprawnienia osobiste (art. 354, dla oznaczonego akcjonariusza, wygasają z utratą statusu). [wynik wyszukiwania: https://pro.rp.pl/prawo-w-firmie/art5375471-spolka-zasada-rownego-traktowania-udzialowcow-nie-jest-bezwzgledna , https://prawnik.cc/laws/kodeks-spolek-handlowych/art-351-akcje-o-szczegolnych ; **niezweryfikowano w tekście ustawy**]
- Trzy sposoby zaprojektowania przepustki (do wyboru z prawnikiem):
  - **A. Prawo z akcji (statut, art. 351 lub osobiste uprawnienie):** twarde, ale ujawniane w dokumencie jako cecha papieru, zmienia charakter oferty (akcje uprzywilejowane), trudne do zmiany, widoczne dla rejestru. Ryzyko: kwalifikacja świadczenia jako elementu ceny (VAT/CIT).
  - **B. Świadczenie umowne spółki wobec akcjonariuszy (regulamin programu lojalnościowego):** elastyczne, odwołalne; warunek "każdy akcjonariusz od N akcji" musi mieć obiektywne uzasadnienie (art. 20), a nie premiować pojedynczych osób. Ryzyko: zmiana lub likwidacja programu w trakcie, roszczenia inwestorów, "wprowadzenie w błąd" co do tego, za co płacą.
  - **C. Rozdzielenie:** dostęp do strefy kupuje się osobno (subskrypcja), a akcje nie dają dostępu albo dają jedynie niezobowiązujący gest marketingowy. Najmniejsze ryzyko prawne i podatkowe, ale to inny produkt niż w planie.
- **Dostęp "po wpisie", nie "po wpłacie".** Jeśli przepustka ma być niezależna od instrumentu, nie wolno jej udzielać przed istnieniem akcji (osoba mogłaby wpłacić, uzyskać treści i żądać zwrotu, albo seria nie dojdzie do skutku). Jeśli ma być "tylko za posiadanie", dostęp ustaje po zbyciu akcji, co wymaga cyklicznego uzgadniania z rejestrem (Navigator wydaje wypisy/świadectwa rejestrowe; **brak API**, §2.3).
- **Własność i zbywalność.** Akcje można zbyć poza portalem (wpis w rejestrze). Statut może ograniczyć zbywalność akcji imiennych (art. 337, **[niezweryfikowano]**), co jest narzędziem przeciwko handlowi "przepustkami". Brak obrotu wtórnego na portalu (§2.4).
- **Substancja ekonomiczna.** Dokument musi uczciwie mówić, za co inwestor płaci: spółka ma mieć prawa do treści/marki (umowy licencyjne z autorem), plan wykorzystania środków i model przychodów. Jeśli praktycznie "akcja = bilet bez dywidendy i bez płynności", pojawia się ryzyko zarzutu wprowadzania w błąd i oceny, że to sprzedaż usługi (konsumenckiej) pod płaszczem emisji. **To największe ryzyko reputacyjne i regulacyjne całego pomysłu** **[opinia własna, do weryfikacji prawnika]**.

### 2.9 Podatki (do księgowego/doradcy)

- **PCC 0,5%:** podatnikiem jest spółka (art. 4 pkt 9), stawka 0,5% (art. 7 ust. 1 pkt 9), podstawa to wartość, o którą podwyższono kapitał zakładowy (art. 6 ust. 1 pkt 8 lit. b); interpretacje i poradniki wskazują, że agio nie powiększa podstawy [serwis wtórny: https://ksiegowosc.infor.pl/podatki/pcc/2751442,Podwyzszenie-kapitalu-zakladowego-jak-ustalic-podstawe-opodatkowania-PCC.html ; https://poradnikprzedsiebiorcy.pl/-podwyzszenie-kapitalu-zakladowego-spolki-a-podatki ]. Płatne od każdej serii (termin deklaracji **[niezweryfikowano]**).
- **VAT:** emisja akcji uznawana przez organy za czynność niepodlegającą VAT (TSUE C-437/06 Securenta jest cytowany), co oznacza także, że VAT naliczony od kosztów stricte emisyjnych nie podlega odliczeniu, a sądy bywają przychylne spółkom [serwis wtórny: https://pro.rp.pl/podatki/art8536201-spolka-moze-odliczyc-vat-od-uslug-zwiazanych-z-emisja-akcji ]. **Sformułowanie "VAT 0%" w planie jest nieprecyzyjne** (0% to stawka dająca prawo do odliczenia, a tu mówimy o braku opodatkowania). Perk w postaci dostępu do treści: jeśli ma wartość i jest świadczeniem wzajemnym za część wpłaty, może powstać VAT od tej części, a spółka staje się podatnikiem z częściowym odliczeniem (struktura proporcji). **[niezweryfikowano, kluczowe pytanie do doradcy]**
- **CIT:** art. 12 ust. 4 pkt 4 ustawy o CIT wyłącza z przychodów wartość otrzymanych wkładów; koszty typowo emisyjne (bez których nie da się podwyższyć kapitału) nie są kosztami uzyskania przychodów (uchwała NSA II FPS 6/10), pozostałe wydatki na zasadach ogólnych [serwis wtórny]. Po zmianach z 2018 r. omawiane są wątpliwości co do wkładów pieniężnych, a MF zajął stanowisko w interpretacji ogólnej z 27.03.2018 [wynik wyszukiwania, **treści nie zweryfikowano**]. **Perk jako świadczenie wzajemne może zmienić kwalifikację części wpłaty na przychód.**
- **Bilansowo:** wpłaty przed rejestracją serii to zobowiązanie/rozliczenie do dnia wpisu, nie kapitał ani przychód; zwrot przy niepowodzeniu (§3.4). **[niezweryfikowano, do księgowego]**
- **Dla inwestora:** podatek od dochodów z akcji (dywidenda, zbycie) po stronie inwestora; spółka nie ma obowiązku doradzać, ale dokument informacyjny powinien zawierać ostrzeżenie. **[niezweryfikowano]**

### 2.10 Spółka półkowa TERKENA S.A.

- Wyszukiwanie nie znalazło wpisu "TERKENA S.A." (ani oferty sprzedaży spółki). To nie dowodzi, że spółka nie istnieje; trzeba pobrać **aktualny odpis pełny z KRS** (ekrs.ms.gov.pl), sprawdzić: wysokość i **stan wpłat na kapitał**, historię zmian, zarząd, zaległe sprawozdania, wpisy w KRZ/KRD, rejestr akcjonariuszy (kto go dziś prowadzi i czy akcje są w nim wpisane), umowy i zobowiązania. "Czysta półka" bez historii to rzadkość; zakup wymaga due diligence i gwarancji sprzedawcy.
- Alternatywa: **założyć spółkę akcyjną od zera** (akt notarialny, wpis do KRS). Czas podobny, brak ryzyka cudzej historii; kapitał nadal minimum 100 tys. zł. **Prosta spółka akcyjna (PSA)** nie była badana: jej akcje nie mogą być dopuszczone do obrotu zorganizowanego (art. 300^36 § 2 KSH, wynik wyszukiwania), a status PSA wobec oferty publicznej trzeba sprawdzić **[niezweryfikowano]**.

## 3. Płatności

### 3.1 Co wchodzi w grę

| Metoda | Zalety | Problemy dla subskrypcji akcji |
|---|---|---|
| **Przelew z unikalnym numerem rachunku wirtualnego/referencją** na rachunek spółki w PEKAO | Brak pośrednika, brak polityk PSP, brak chargebacków, widać rachunek nadawcy (łatwiej parować z KYC), tani | Wolniejszy UX (przelew, potwierdzenie po stronie banku: ewidencja w sekundach-minutach przy Express Elixir, inaczej do dnia roboczego), uzgadnianie ręczne/półautomatyczne (plik MT940/CAMT lub API banku **[niezweryfikowano czy PEKAO udostępnia]**) |
| **Open Banking / PIS** (inicjowanie płatności) | Szybki UX, płatnik wybiera bank i potwierdza | Wymaga **licencjonowanego PISP** (my nie mamy; korzystamy z agregatora: Tpay, P24, PayU, Paynow itp.), środki mogą przechodzić przez rachunek operatora; zasady branżowe (poniżej) |
| **BLIK** | Najszybszy, najpowszechniejszy (w e-commerce ok. 71% w IV kw. 2025 wg [android.com.pl, niezweryfikowano]) | Dostępny przez agenta rozliczeniowego/PSP, nie "bezpośrednio na rachunek"; zwykle brak danych rachunku płatnika, więc nie ma parowania "płatnik = inwestor" **[niezweryfikowano]**; ścisłe zasady operatora |
| **Karty (Stripe)** | Najlepszy UX | Chargeback do wielu miesięcy po wpłacie, a akcje/rejestr nie cofają się łatwo; Stripe zabrania lub ogranicza tę branżę (poniżej). **Odradzamy.** |

### 3.2 Polityki dostawców (zweryfikowano w dokumentach pierwotnych, wersje z dnia sesji)

- **Stripe:** lista "Prohibited and Restricted Businesses" (https://stripe.com/legal/restricted-businesses): "Investment and brokerage services" w sekcji produktów i usług finansowych wymaga kontaktu z działem sprzedaży; **"Equity crowdfunding" ma ograniczoną dostępność (Australia, Niemcy, Francja, Singapur, Wielka Brytania, USA) i jest zabronione w pozostałych krajach, w tym w Polsce**; "Crowdfunding platforms" są w sekcji ograniczonych. Nie znaleziono pozycji "sale of equity"/"securities" jako takiej. **Wniosek: konta Stripe (i napiwki!) nie wolno używać do zbierania wpłat na akcje bez pisemnej zgody Stripe; ryzyko zamrożenia całego konta napiwków przy próbie.** Ta ścieżka zagraża istniejącemu przychodowi.
- **Paynow (mBank):** lista towarów i usług zakazanych, poz. 21: "Udziały w spółkach, akcje, obligacje i inne papiery wartościowe ... oferowane jako forma inwestowania lub lokowania środków pieniężnych"; poz. 26: "Crowdfunding z wyłączeniem organizacji pożytku publicznego". **Zakaz wprost.** https://static.paynow.pl/docs/lista_towarów_i_uslug_zakazanych.pdf
- **Tpay (Krajowy Integrator Płatności):** załącznik 1 (lista zakazanych towarów i usług, 13 pozycji: pornografia, nielegalny hazard, mowa nienawiści, prawa autorskie, chemikalia, narkotyki, materiały wybuchowe, broń, organy, podróbki itd.) **nie zawiera papierów wartościowych ani crowdfundingu**. To nie znaczy, że akcje są dozwolone: ocena merchant po stronie operatora (onboarding, polityka ryzyka). https://tpay.com/user/assets/files_for_download/attachment-1-list-of-goods-and-services-for-which-it-is-forbidden-to-accept-payments-through-the-site.pdf
- **Adyen (polska strona):** "Maklerzy papierów wartościowych": ograniczone dla sprzedawców, zabronione dla platform; "Finansowanie społecznościowe": ograniczone; "Papiery wartościowe wysokiego ryzyka" (CFD, ICO itp.): ograniczone/zabronione. Brak osobnej pozycji dla emisji własnych akcji. https://www.adyen.com/pl_PL/legal/list-restricted-prohibited
- **Przelewy24, PayU:** **nie sprawdzono** (nie znaleziono ich list zakazanych w sesji). Przed wyborem prosić o pisemne stanowisko operatora na temat "emisja własnych akcji spółki niepublicznej przez emitenta na podstawie art. 37a".
- **Rekomendacja:** pierwsza i domyślna metoda = **przelew na rachunek spółki z unikalnym rachunkiem wirtualnym/referencją**, druga = PIS/BLIK u operatora, który **pisemnie** zaakceptuje branżę. Stripe poza zakresem.

### 3.3 Kto trzyma środki przed rejestracją podwyższenia

- Wpłata trafia na rachunek spółki (PEKAO) i do wpisu serii **nie jest jeszcze kapitałem**; spółka nie powinna jej wydawać, bo przy niedojściu serii do skutku musi zwrócić (art. 431 § 5, 436). Szczegóły (np. wymóg rachunku wydzielonego, wypłaty przed rejestracją, art. 311/312) **[niezweryfikowano]**. **Rekomendacja:** osobny rachunek pomocniczy lub rachunek powierniczy/escrow, polityka "nie dotykamy do wpisu", zapisana w dokumencie informacyjnym, sprawdzona z bankiem.
- Przyjmowanie wpłat od osób, które nie zostały przydzielone lub nie przeszły KYC: musi być jasna reguła zwrotu (na rachunek nadawcy, w terminie, bez potrąceń) i nie może powstać "wolne saldo" mylone z przychodem.

### 3.4 Zwroty

- **Seria nie dojdzie do skutku / odmowa rejestracji / brak przydziału:** zwrot na rachunek, z którego dokonano wpłaty; terminy z art. 431 § 5, 436, 438-439 [serwis wtórny]. Koszt zwrotu (opłata bankowa, ewentualnie operatora) ponosi spółka; to wymaga w kodzie niezawodnego strumienia "zwrot" w maszynie stanów (§4.3).
- **Odstąpienie inwestora:** jeśli w dokumencie nie przewidzimy prawa do odstąpienia, nie obiecywać go; konsumenckie 14 dni nie dotyczy automatycznie papierów wartościowych, ale prawnik ma to potwierdzić **[niezweryfikowano]**.
- **Nadpłaty, niedopłaty, wpłaty po terminie, wpłaty od osoby trzeciej:** polityka zapisana z góry (jak w `crypto-gateway-plan.md` §3.7): domyślnie zwrot, nigdy cicha zmiana liczby akcji.

### 3.5 Uzgadnianie

Codzienny import wyciągu (plik lub API), parowanie po numerze referencyjnym/rachunku wirtualnym, kwota, waluta, rachunek nadawcy, data; wyniki: `MATCHED`, `UNDERPAID`, `OVERPAID`, `UNMATCHED`, `DUPLICATE`; każda zmiana ręczna zapisywana w audycie. Cron uzgadniania obok istniejącego (`CLAUDE.md` §6). **Nie wolno** przepuszczać tych wpłat przez `fulfillPayment()` napiwków (to uruchamia `PatronGrant`, e-mail dziękujący i statystyki wsparcia): potrzebny osobny tor (§4.2).

## 4. Technicznie: co trzeba zbudować w naszym stosie

### 4.1 Zasady

- Nowy moduł `lib/modules/share-offering` (wzorzec jak `sales`/`patron`: `domain`, `application` use case'y, `infrastructure`, `index.ts`; autoryzacja w use case'ie; wyjątki na `AUTHZ_EXEMPT` z uzasadnieniem), nowy panel w `apps/admin`, nowy wyłącznik **`shareOffering`** w `lib/platform-gates.ts` (`off`/`on`, domyślnie `off`, nieznana wartość = `off`, zmienna `PLATFORM_GATE_SHARE_OFFERING`; sprawdzenie na wejściu każdego use case'u). Wyłączniki `sales`, `payouts`, `channelCreation` zostają `off` i nie są częścią tego studium.
- Migracje addytywne (CLAUDE.md §4.0). Tabele finansowe i zgody tylko do dopisywania (jak `LedgerEntry`: wyzwalacz blokujący `UPDATE/DELETE`).
- Spółka emitent to **podmiot prawny inny niż osoba prowadząca dziś serwis**. Przed kodem trzeba ustalić, kto jest administratorem danych, stroną regulaminu i stroną umów z dostawcami (decyzja o podmiocie: `docs/audit/2026-10-13/`).

### 4.2 Elementy

1. **Onboarding inwestora.** Konto (Better Auth) to za mało: profil inwestora (imię, nazwisko, adres, data urodzenia, obywatelstwo, rezydencja podatkowa, PESEL lub inny identyfikator **tylko jeśli rejestr tego wymaga**, osoby prawne i beneficjenci rzeczywiści), zgody i oświadczenia (zapoznanie z dokumentem informacyjnym w wersji X, świadomość ryzyka, brak płynności, status konsumenta/inwestora). Dane szyfrowane na poziomie pól, dostęp tylko dla roli prawnej w panelu.
2. **KYC.** Opcje (ceny **[niezweryfikowano]**, większość dostawców nie publikuje cenników; zebrać oferty):
   - **Dostawcy weryfikacji dokumentu + selfie/liveness:** Sumsub, Veriff, IDnow (model: opłata za udaną weryfikację, zwykle od kilku do kilkunastu zł/EUR, plus minimalne abonamenty). Zalety: pokrycie dowodów i paszportów, anty-fraud. Wady: RODO (przekazanie danych biometrycznych, DPA, lokalizacja), koszt na inwestora, odmowy.
   - **Weryfikacja bankowa "mojeID" (KIR):** użytkownik potwierdza tożsamość logowaniem do banku; w ofercie m.in. PKO BP, Pekao, ING, mBank (dane z 2020-2021, **aktualną listę sprawdzić**); dla osób fizycznych. https://bank.pl/mojeid-w-mbanku/ Szybkie i tanie, ale ograniczone do klientów uczestniczących banków; pytanie, czy zastępuje obowiązek identyfikacji **[niezweryfikowano]**.
   - **Profil zaufany/e-dowód (mObywatel)** jako podpis zapisu i jednocześnie potwierdzenie tożsamości (art. 437 dopuszcza podpis zaufany i osobisty). Może jednym ruchem załatwić KYC i podpis, jeśli prawnik i rejestr to uznają.
   - **Rekomendacja:** KYC jako port (`IdentityVerifier`) z jedną implementacją na start po rozmowie z bankiem i Navigatorem (§2.3, §2.6), by nie robić trzech weryfikacji.
3. **Zapis (oświadczenie o objęciu akcji).** Generowanie dokumentu PDF z formularza spółki (liczba i rodzaj akcji, wpłata, zgoda na statut, adres podmiotu przyjmującego zapisy, §2.2), wersjonowany szablon, hash dokumentu, znacznik czasu, dane podpisującego. **Podpis:** kwalifikowany, zaufany lub osobisty (art. 437 [serwis wtórny]) — **zaawansowany podpis (np. SMS/OTP, kliknięcie) prawdopodobnie nie spełnia wymogu**, więc "prosty podpis" odpada, chyba że prawnik potwierdzi inaczej. Integracja z dostawcą usługi zaufania (np. Szafir/KIR, Autenti, Podpis.gov.pl/ePUAP) **[niezweryfikowano oferty i kosztów]**. Przechowywanie podpisanego pliku (R2/dysk) i dowodu doręczenia spółce.
4. **Płatności.** Port `ShareSubscriptionPayments` z implementacją "przelew z referencją" na start (unikalny numer/rachunek wirtualny, instrukcja w interfejsie, czas ważności, import wyciągów, uzgadnianie §3.5). Następnie PIS/BLIK u operatora z pisemną zgodą. **Osobny tor od napiwków**: nie `fulfillPayment()`, nie `PatronGrant`, osobny model `ShareSubscription` + `SubscriptionPayment` z własną idempotencją po `providerRef`/referencji bankowej. Stripe nieużywany.
5. **Maszyna stanów subskrypcji:**
   `DRAFT` (formularz) → `KYC_PENDING` → `KYC_OK` → `SIGNED` (podpisany zapis) → `AWAITING_PAYMENT` → `PAID` → `ALLOTTED` (przydział po zamknięciu okna) → `BOARD_DECLARED` (oświadczenie zarządu) → `FILED_KRS` → `REGISTERED_KRS` → `ENTERED_REGISTER` (wpis u operatora rejestru) → `ENTITLED` (przepustka aktywna).
   Boczne: `REJECTED`, `REFUND_PENDING`, `REFUNDED`, `EXPIRED`, `CANCELLED`. Przejścia tylko przez use case'y (CAS jak `fulfillPayment()`), każde z wpisem w `AuditLog` (aktor, powód, `requestId`, ip) i dopisywanym dziennikiem zdarzeń subskrypcji.
6. **Serie i dokumenty.** Model `Offering`/`ShareSeries` (nazwa serii, liczba akcji, cena, wartość nominalna, okno zapisów, zamknięcie, limity minimalne/maksymalne), tabela sumowania 12 miesięcy w EUR (kurs wg ustawy, §2.1) z **blokadą otwarcia serii przekraczającej próg 1 mln EUR**, wersje dokumentu informacyjnego (publikacja, hash, data zawiadomienia KNF), uchwały i akty. Strona publiczna z dokumentem (polska, odnośnik w każdej reklamie).
7. **Portal inwestora.** Ekrany: moje zapisy i statusy, pobranie podpisanego zapisu, potwierdzenie wpłaty, historia zwrotów, dokumenty spółki, komunikaty zarządu, link do aplikacji Navigatora po wpisie. Powiadomienia e-mail przez istniejący moduł `email`.
8. **Panel administratora (`apps/admin`):** kolejka KYC, wpłaty do uzgodnienia, serie, przydziały, eksport do rejestru (plik dla Navigatora w ustalonym formacie), raporty dla zarządu i księgowości, ręczne korekty z powodem. Zgodnie z §4.20 CLAUDE.md: trasy administratora tylko w `apps/admin`.
9. **Audyt i RODO.** Rozszerzyć `AuditLog` (akcje `share.*`), dziennik zgód z wersją dokumentu, retencja: dane AML i dokumentacja ofertowa na czas wynikający z przepisów (z pamięci AML 5 lat po zakończeniu relacji, księgi 5 lat, rejestr bezterminowo po stronie operatora) **[niezweryfikowano]**, sprzeczność z prawem do usunięcia rozstrzygana w module `privacy` (zakaz usuwania danych objętych obowiązkiem, anonimizacja reszty). Dostawca KYC jako procesor, DPA i lista podprocesorów.
10. **Przepustka (strefa patronacka).** Osobna przestrzeń, **nie** `PatronGrant` (CLAUDE.md §4.1: `PatronGrant` jest prywatną ewidencją napiwków i nie gra roli w dostępie). Nowy poziom dostępu (np. `SHAREHOLDER`) wymaga decyzji właściciela o odwróceniu modelu niekomercyjnego, rozszerzenia `checkVideoAccess()`/`PlaybackPlan` (uwaga z §4.4: poziomy czyta się przez `parseVideoAccessTier()`, `PAID` z surowej kolumny) i **uprawnienia wyprowadzanego wyłącznie ze stanu `ENTERED_REGISTER`**, nie z płatności. Nowa ścieżka w `authz` i test, że brak wpisu = brak dostępu, a zbycie akcji (rejestr) = wygaszenie. Dopóki wyłącznik `shareOffering` jest `off`, żaden kod nie sprawdza nowego poziomu.

### 4.3 Co jest szybkie, a co nie

| Krok | Realny czas | Skąd |
|---|---|---|
| Wyświetlenie oferty, formularz, wybór liczby akcji | sekundy | UI |
| KYC dokumentem + selfie | minuty; odrzucenia/ręczna weryfikacja godziny-dni | dostawca |
| KYC mojeID/bank | minuty | bank |
| Podpis zapisu (profil zaufany/e-dowód/kwalifikowany) | minuty | dostawca podpisu; użytkownicy bez profilu zaufanego odpadają lub drukują |
| Płatność BLIK/PIS | sekundy-minuty | PSP/bank |
| Płatność przelewem | minuty-dzień roboczy | bank |
| Okno zapisów | **min. 2 tygodnie** (jeśli art. 440 ma zastosowanie) | KSH |
| Przydział | do 2 tygodni od zamknięcia | KSH |
| Akt notarialny zarządu, wniosek do KRS | dni | notariusz |
| Rejestracja podwyższenia w KRS | tygodnie-miesiące **[niezweryfikowano]** | sąd rejestrowy |
| Wpis w rejestrze akcjonariuszy | do 7 dni od żądania | Navigator |
| Nadanie przepustki | sekundy po wpisie | nasz kod |

**Wniosek:** UI może być "natychmiast", ale to, co kupujący dostaje, pojawia się po tygodniach. W produkcie trzeba to mówić uczciwie ("Twój zapis jest przyjęty, akcje zostaną wydane po rejestracji w KRS, przewidywany termin X"), z paskiem postępu i powiadomieniami. Ukrywanie tego jest ryzykiem prawnym (wprowadzanie w błąd) i wizerunkowym.

### 4.4 Czego nie robić

- Nie używać `Payment`/`fulfillPayment()`/`PatronGrant` do akcji.
- Nie wiązać dostępu do treści z samą płatnością.
- Nie budować obrotu wtórnego, tablicy ogłoszeń kupna-sprzedaży ani zestawiania zleceń.
- Nie przechowywać skanów dokumentów inwestorów u nas, jeśli dostawca KYC może je przechowywać i zwracać tylko wynik i identyfikator weryfikacji.
- Nie włączać wyłączników ani nie wystawiać strony zapisów, dopóki fazy 0-1 (§6) nie są zamknięte.

## 5. Ryzyka i blokery

**Blokery (bez ich usunięcia nie ruszamy):**

1. Art. 431 § 3 KSH: 9/10 kapitału musi być wpłacone przed podwyższeniem (§2.2). Potencjalnie ok. 65 tys. zł wpłaty więcej niż w planie i przed pierwszą emisją.
2. Brak potwierdzonej spółki półkowej (§2.10).
3. Brak opinii prawnika, że samodzielna oferta na stronie bez licencji jest dopuszczalna w naszej konfiguracji (w tym przy przepustce) i że procedura subskrypcji otwartej (art. 437, 440) obowiązuje lub nie przy dokumencie z art. 37a.
4. Brak operatora płatności zgodnego z branżą (Stripe, Paynow zakazują; reszta nieznana) i brak potwierdzenia z bankiem (§3).
5. Brak decyzji właściciela o modelu przepustki (A/B/C, §2.8) i o odwróceniu zasady z CLAUDE.md §4.1.

**Ryzyka:**

| Ryzyko | Skutek | Mitygacja |
|---|---|---|
| Przekroczenie progu 1 mln EUR przez sumowanie serii | memorandum zamiast dokumentu, kary, informacja KNF na koszt spółki | licznik 12 miesięcy w kodzie, blokada serii, bufor (np. 80% limitu) |
| Dokument nierzetelny/niepodpisany | art. 99, publikacja KNF | prawnik pisze dokument, zarząd podpisuje, audyt źródeł liczb |
| Brak uchwały o emisji przed ofertą | j.w. (Canapharm) | harmonogram: uchwała, zawiadomienie KNF, publikacja, zapisy |
| Zapis bez wymaganej formy | nieważność zapisu | tylko podpis wg art. 437 |
| Wpłaty bez przydziału/zwroty | spory, koszty | maszyna stanów, rachunek wydzielony, automatyczny zwrot |
| Postrzeganie "bilet za akcje" jako sprzedaży usługi | VAT/CIT od części wpłaty, zarzut wprowadzania w błąd | model C albo precyzyjne A/B z opinią podatkową |
| Setki-tysiące drobnych akcjonariuszy | koszty rejestru (25 zł/akcjonariusza/serię), WZA, obsługa praw akcjonariuszy, spory, ochrona danych (lista akcjonariuszy) | minimalna kwota zapisu (np. >= 500-1000 zł), limit liczby akcjonariuszy, WZA online (art. 406^5, **niezweryfikowano**) |
| Blokada rachunku/banku przez AML | zamrożenie środków serii | wcześniejsza rozmowa z bankiem, dokumentacja źródeł, mała próba |
| Zamrożenie konta Stripe (napiwki) przy kontakcie z akcjami | utrata istniejących przychodów | Stripe tylko dla napiwków, osobna spółka i konta |
| RODO: tożsamość inwestorów, lista akcjonariuszy, KYC biometryczny | skargi UODO | DPIA, DPA, minimalizacja, jasna informacja |
| Reputacja: oferta do fanów twórcy bez dywidendy | krytyka, fala skarg do KNF/UOKiK | uczciwy język, ostrzeżenia, test wiedzy, limit zaangażowania na osobę |
| Termin KRS wydłuża się | opóźnienie dostępu i frustracja | komunikacja, harmonogram z rezerwą, brak obietnicy terminu |

### 5.1 Pytania do prawnika rynku kapitałowego

1. Czy emitent niepubliczny może przeprowadzić ofertę publiczną akcji na swojej stronie na podstawie art. 37a u.o.p. bez firmy inwestycyjnej i bez zezwolenia, jeśli sam przyjmuje zapisy i wpłaty? Jakie warunki dodatkowe?
2. Czy dokument z art. 37a mieści się w wyłączeniu z art. 431 § 4 i 440 § 3 KSH (czy obowiązuje pełna procedura subskrypcji otwartej: ogłoszenie, 2 tygodnie, przydział)? Gdzie i jak ogłaszać?
3. Czy sama sprzedaż własnych akcji przez emitenta za pomocą portalu może być "oferowaniem instrumentów finansowych" (art. 69 ust. 2 pkt 6 uoif) lub "przyjmowaniem i przekazywaniem zleceń"? Jak odróżnić od czynności emitenta?
4. Gdzie jest granica między samodzielną ofertą emitenta a usługą finansowania społecznościowego (ECSP, art. 37c)? Czy np. zbieranie zapisów w imieniu spółki-córki zmienia kwalifikację?
5. Jaki formalnie wymóg formy zapisu (art. 437) przy zapisie przez internet: czy wystarczy podpis zaufany/osobisty, czy dopuszczalny prostszy mechanizm (zaawansowany podpis, kliknięcie z OTP)? Kto poświadcza przyjęcie?
6. Czy przy kapitale 100 tys. zł i wpłaconych 25 tys. zł art. 431 § 3 wprost blokuje podwyższenie? Czy dopłata do 90 tys. zł wystarcza? Czy można skorzystać z kapitału docelowego, nie omijając tego warunku?
7. Czy seria kolejna może być otwarta, gdy poprzednia nie została jeszcze zarejestrowana? Jak sumować limit 12 miesięcy i kurs EUR/PLN (art. 4a u.o.p.)? Aktualny próg memorandum?
8. Zakres obowiązków reklamowych i informacyjnych dla oferty na art. 37a (reklama w social media, wymóg wskazania dokumentu, ostrzeżenia). Co z komunikacją twórcy na kanałach?
9. Czy przepustka do strefy treści może być związana z posiadaniem akcji, i w której formie (statut/art. 351, osobiste uprawnienie art. 354, program lojalnościowy)? Co z art. 20 KSH przy progu "od N akcji"? Jak ją opisać w dokumencie informacyjnym?
10. Czy takie świadczenie zmienia charakter oferty (korzyść wzajemna), a przez to zakres odpowiedzialności za informację, ochronę konsumencką lub zakres reklamy?
11. Ograniczenie zbywalności akcji (akcje imienne, art. 337), prawo pierwszeństwa, zakaz obrotu na portalu: co zabezpiecza przed obrotem "przepustkami" i przed zarzutem prowadzenia ASO?
12. Czy sama oferta czyni spółkę "publiczną" w jakimkolwiek zakresie (obowiązki informacyjne, KDPW)? Czy KNF nakłada dodatkowe obowiązki?
13. AML: czy emitent jest instytucją obowiązaną? Kto robi KYC inwestora (spółka, bank, rejestr) i czy dopuszczalne poleganie na weryfikacji strony trzeciej? Zakres i okres przechowywania danych.
14. Odpowiedzialność członków zarządu za dokument i za kampanię (art. 99 u.o.p., KSH), ubezpieczenie D&O, oświadczenia zarządu.
15. Zwrot wpłat i ochrona środków przed rejestracją: wymóg rachunku wydzielonego/powierniczego, terminy, odsetki, status wpłat wobec wierzycieli spółki.
16. Prawo do odstąpienia i ochrona konsumenta przy zapisie przez internet (usługi finansowe na odległość). Czy trzeba je przewidzieć?

### 5.2 Pytania do księgowego/doradcy podatkowego

1. Czy wpłaty na akcje (nominał i agio) są poza przychodem w CIT po zmianach 2018 r. i interpretacji ogólnej MF z 27.03.2018? Czy przy świadczeniu dodatkowym (dostęp do treści) część wpłaty staje się przychodem?
2. VAT: poza zakresem przy emisji, ale co z przepustką? Czy potrzebna wycena świadczenia i odrębna faktura? Odliczenie VAT od kosztów emisji (prawnik, notariusz, KYC, marketing) oraz od kosztów ogólnych (współczynnik)?
3. PCC: podstawa przy agio, termin, kto składa, koszty pomniejszające podstawę. Przykład: seria 4,25 mln zł.
4. Rozliczenie wpłat przed rejestracją (zobowiązanie, rachunek wydzielony), wpłat zwróconych, kosztów pozyskania kapitału (koszty emisji: CIT).
5. Czy badanie sprawozdania biegłym jest obowiązkowe dla S.A. poniżej progów i jaki koszt realny przy tysiącach akcjonariuszy (plan zakłada 2,5-8 tys. zł)?
6. Obowiązki inwestora i spółki jako płatnika (dywidenda, rezydencja podatkowa, inwestorzy zagraniczni).
7. Wpływ na status podatnika VAT i ewentualną strukturę (S.A. jako sprzedawca strefy, umowy licencyjne z twórcą, ceny transferowe).
8. Wycena i księgowanie kosztów przejęcia spółki półkowej i ewentualnych zobowiązań historycznych.

## 6. Mapa drogi, nakład, koszty

**Faza 0: wyjaśnienia (bez kodu), 4-8 tygodni czasu kalendarzowego.**
- Odpis KRS TERKENA S.A., due diligence, ustalenie kapitału i wpłat (art. 431 § 3).
- Opinia prawnika rynku kapitałowego (pytania §5.1) i doradcy podatkowego (§5.2). Decyzja o podmiocie, strukturze, modelu przepustki (A/B/C).
- Rozmowa z DM Navigator: oferta indywidualna, format importu wpisów, KYC akcjonariuszy, sposób obsługi serii, czas, zasady dla ponad 149 akcjonariuszy.
- Rozmowa z PEKAO: rachunek wirtualny/wydzielony, eksport wyciągów, polityka wobec masowych wpłat.
- Pisemne stanowiska operatorów płatności (jeśli PIS/BLIK).
- Budżet realny (poniżej).

**Faza 1: przygotowanie spółki i dokumentów, 6-10 tygodni.** Przejęcie, zmiany w KRS (nazwa, statut, zarząd, kapitał docelowy?), wpłaty do 9/10, uchwała WZA o rejestrze i o emisji, umowa z Navigatorem, rachunek, dokument informacyjny, zawiadomienie KNF (7 dni roboczych), regulamin i polityka prywatności.

**Faza 2: kod, nakład szacunkowy (**[niezweryfikowano]**, sama praca wytwórcza, bez integracji z procesami zewnętrznymi i bez poprawek po opinii prawnej):**

| Zakres | Nakład (dni robocze) |
|---|---|
| Moduł `share-offering`, schemat, maszyna stanów, wyłącznik, audyt, testy | 6-8 |
| Onboarding inwestora, KYC (port + 1 dostawca), zgody, RODO | 6-10 |
| Zapis PDF, podpis zaufany/kwalifikowany (integracja dostawcy), archiwum | 6-10 |
| Płatności przelewem: rachunek wirtualny/referencja, import wyciągów, uzgadnianie, zwroty | 6-9 |
| Portal inwestora, strona oferty, dokument, statusy, powiadomienia | 5-8 |
| Panel administratora: kolejki, przydziały, eksport do rejestru, raporty | 5-8 |
| Przepustka: poziom dostępu, `authz`, `access`, testy negatywne | 3-5 |
| Testy end-to-end, bezpieczeństwo, pilotaż z małą kwotą | 4-6 |
| **Razem** | **ok. 41-64 dni roboczych (8-13 tygodni jednej osoby)**, nie licząc oczekiwania na dostawców i odpowiedzi organów |

**Faza 3: pilotaż.** Mała seria (np. kilkudziesięciu znanych osób, subskrypcja prywatna lub bardzo mała publiczna), pełny cykl do wpisu w rejestrze i przepustki, ocena czasów i kosztów.

**Faza 4: seria publiczna** po pozytywnym pilotażu i zamknięciu listy kontrolnej (wszystkie bloker-y z §5 zamknięte, opinie w repozytorium dokumentów, wyłącznik włącza tylko właściciel).

**Koszty (orientacyjne, wszystko poza pozycjami Navigatora i stawkami ustawowymi jest [niezweryfikowane]):**

| Pozycja | Kwota |
|---|---|
| Plan właściciela (zakup, KRS, notariusz, rejestr, zaświadczenia, raporty) | ok. 19 400 zł netto |
| Wpłata do 90 tys. zł kapitału (jeśli wpłacone 25 tys. zł) | ok. 65 000 zł (zwrotne tylko jako majątek spółki) |
| Opinia prawnika + dokument informacyjny + regulamin + statut | kilkanaście do kilkudziesięciu tys. zł (wycena u kancelarii) |
| Doradca podatkowy (opinia, ewent. interpretacja indywidualna) | kilka tys. zł |
| Rejestr akcjonariuszy (Navigator) | 4 547-9 475 zł rocznie + 1 000 zł za serię + 25 zł od akcjonariusza ponad 10 w serii (powyżej 149 osób indywidualnie) |
| Notariusz (akt zarządu, uchwały) i opłaty sądowe/ogłoszenia KRS za każdą serię | wg taksy notarialnej i opłat sądowych **[niezweryfikowano]** |
| PCC 0,5% | np. 21 250 zł przy podwyższeniu o 4,25 mln zł |
| KYC | kilka do kilkunastu zł za inwestora **[niezweryfikowano]** |
| Podpis kwalifikowany/zaufany dostawcy | wg cennika dostawcy **[niezweryfikowano]**; profil zaufany dla użytkownika bezpłatny |
| Bank (PEKAO) | opłaty za rachunek, przelewy, rachunki wirtualne **[niezweryfikowano]** |
| Audyt, WZA, administracja przy dużej liczbie akcjonariuszy | wyżej niż w planie **[niezweryfikowano]** |
| Utrzymanie (serwer, backup, monitoring) | w ramach istniejącej infrastruktury; KYC/podpis w modelu SaaS |

**Harmonogram z planu (kwiecień 2027 start zapisów):** wykonalny tylko, jeśli styczeń-luty obejmą przejęcie, wpis zmian w KRS, wpłaty do 9/10, uchwały i umowę z Navigatorem, marzec: dokument i zawiadomienie KNF (7 dni roboczych), a kod będzie gotowy równolegle. Przy braku pewności co do czasu KRS **rekomendujemy datę "kwiecień 2027 = start zapisów" traktować jako cel, nie zobowiązanie wobec publiczności, i nie ogłaszać jej dopóki spółka i rejestr nie są gotowe.**

## 7. Decyzje potrzebne od właściciela

1. Czy przyjmujemy rozdzielenie na dwa produkty: (A) strefa patronacka jako płatna subskrypcja (poza papierami wartościowymi) i (B) oferta akcji jako osobny proces. Czy zachowujemy ideę "akcja = przepustka" mimo ryzyk z §2.8?
2. Zgoda na wydatek na prawnika rynku kapitałowego i doradcę podatkowego (faza 0) **zanim** powstanie kod. Wybór kancelarii.
3. Potwierdzenie danych spółki: kapitał zakładowy, wpłaty, odpis z KRS TERKENA S.A.; zgoda na wpłatę do 9/10 kapitału lub zmianę podejścia (nowa spółka).
4. Decyzja o odwróceniu modelu niekomercyjnego (CLAUDE.md §4.1) w zakresie dostępu "za akcje" oraz o nowym poziomie dostępu `SHAREHOLDER`.
5. Maksymalna liczba inwestorów, minimalna i maksymalna kwota zapisu na osobę, struktura serii (jednorazowa czy kilka), cena i wartość nominalna akcji. Czy ograniczamy ofertę do osób pełnoletnich i rezydentów PL/UE.
6. Wybór metody płatności: przelew z rachunkiem wirtualnym na start; PIS/BLIK dopiero po pisemnej zgodzie operatora. Stripe nie dla akcji.
7. Wybór rejestru: DM Navigator (po ofercie indywidualnej) czy alternatywa; zasady KYC (czy akceptujemy podwójną weryfikację).
8. Kto jest administratorem danych inwestorów i stroną umów z dostawcami (spółka emitent a podmiot prowadzący serwis), oraz umowa licencyjna na treści/markę między twórcą a spółką.
9. Zakres komunikacji publicznej (kanały, język, ostrzeżenia) i kto zatwierdza każdą reklamę oferty.
10. Moment włączenia: nowy wyłącznik `shareOffering` pozostaje `off`, dopóki lista kontrolna z §5 nie jest zamknięta, a właściciel nie zdecyduje pisemnie; wyłączniki `sales`/`payouts`/`channelCreation` bez zmian.

## 8. Źródła (otwarte w dniu pisania)

Pierwotne (przeczytane):
- KNF, informacja o niezgodnym z prawem działaniu SkyCash Poland SA (1.12.2022): https://intranet.knf.gov.pl/knf/pl/komponenty/img/Informacja_o_niezgodnym_z_prawem_dzialaniu_SkyCash_Poland_SA_80461.pdf
- KNF, informacja o niezgodnym z prawem działaniu Canapharm P.S.A. (7.6.2022): https://intranet.knf.gov.pl/knf/pl/komponenty/img/Informacja_publikowana_na_podstawie_art_16_ust_1_pkt_3_ustawy_o_ofercie_o_niezgodnym_z_prawem_dzialaniu_Canapharm_78521.pdf
- DM Navigator, FAQ rejestru akcjonariuszy: https://dmnavigator.pl/rejestr-akcjonariuszy-faq/ ; strona usługi: https://dmnavigator.pl/rejestr-akcjonariuszy/ ; regulamin i tabela opłat (od 1.3.2026): https://dmnavigator.pl/wp-content/uploads/DMN_Regulamin_SA-i-SKA_2026.pdf
- Stripe, lista działalności zabronionych/ograniczonych: https://stripe.com/legal/restricted-businesses
- Paynow, lista towarów i usług zakazanych: https://static.paynow.pl/docs/lista_towarów_i_uslug_zakazanych.pdf
- Tpay, lista towarów i usług zakazanych: https://tpay.com/user/assets/files_for_download/attachment-1-list-of-goods-and-services-for-which-it-is-forbidden-to-accept-payments-through-the-site.pdf
- Adyen, lista ograniczonych/zabronionych: https://www.adyen.com/pl_PL/legal/list-restricted-prohibited
- ECSP w wersji brytyjskiej (retained): https://www.legislation.gov.uk/eur/2020/1503/chapter/I/data.htm ; ESMA Q&A 2437: https://www.esma.europa.eu/publications-data/questions-answers/2437

Wtórne (portale prawnicze, sprawdzić w Dz.U./ISAP):
- Art. 37a u.o.p. (t.j. Dz.U. 2025 poz. 592): https://arslege.pl/dokument-informacyjny-o-ofercie-papierow-wartosciowych/k383/a127085/ , https://prawnik.cc/laws/ustawa-o-ofercie-publicznej-i/art-37a-dokument-informacyjny-o
- Art. 37b i art. 99 u.o.p. (archiwalne): https://standardyprawa.pl/akt/437/art/51020 , https://standardyprawa.pl/akt/437/art/51132
- KSH art. 309, 431, 437, 440: https://standardyprawa.pl/akt/37/art/8036 , https://standardyprawa.pl/akt/37/art/8179 , https://standardyprawa.pl/akt/37/art/8185 , https://standardyprawa.pl/akt/37/art/8188
- Próg 1 mln EUR (art. 1 ust. 3) i do 8 mln EUR (art. 3 ust. 2) rozporządzenia 2017/1129: https://www.reedsmith.com/de/perspectives/2018/07/eu-prospectus-regulation-new-thresholds-for-small-fundraisings , https://www.simmons-simmons.com/en/publications/ck0a76zitcqq70b59oyfhjzpi/110718-prospectus-regulation-increase-in-exempt-offers-threshold-to-8-million
- PCC przy podwyższeniu kapitału: https://ksiegowosc.infor.pl/podatki/pcc/2751442,Podwyzszenie-kapitalu-zakladowego-jak-ustalic-podstawe-opodatkowania-PCC.html
- VAT/CIT przy emisji akcji: https://pro.rp.pl/podatki/art8536201-spolka-moze-odliczyc-vat-od-uslug-zwiazanych-z-emisja-akcji , https://akademialtca.pl/blog/wklady-pieniezne-do-spolek-kapitalowych-w-swietle-nowelizacji-ustawy-o-cit
- Art. 20 KSH: https://pro.rp.pl/prawo-w-firmie/art5375471-spolka-zasada-rownego-traktowania-udzialowcow-nie-jest-bezwzgledna
- mojeID (KIR): https://bank.pl/mojeid-w-mbanku/
- Stanowisko UKNF ws. crowdfundingu (artykuł): https://bank.pl/uknf-w-sprawie-crowdfundingu-moze-bedzie-latwiej/

Do przeczytania w oryginale przed decyzją (nie otwarto w sesji): tekst jednolity ustawy o ofercie publicznej (Dz.U. 2025 poz. 592), KSH (Dz.U. 2024 poz. 18 i późniejsze), rozporządzenie (UE) 2017/1129 i 2020/1503 na eur-lex, ustawa o obrocie instrumentami finansowymi (art. 69), ustawa o przeciwdziałaniu praniu pieniędzy (art. 2 ust. 1), ustawa o PCC, ustawa o CIT (art. 12), strona KNF o crowdfundingu.
