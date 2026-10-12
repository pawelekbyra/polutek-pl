# Legalnosc i zgodnosc dobrowolnych napiwkow/donacji (Stripe, PL) dla kanalu wideo jednego tworcy

Stan badania: PRZERWANE przed ukonczeniem (limit sesji narzedzi WebFetch/WebSearch). Data dostepu do wszystkich zrodel: 2026-10-12. Nie jest to porada prawna. Pozycje oznaczone "niezweryfikowane" nie maja zrodla w tej sesji.

## 1. Stripe: polityka (Restricted Businesses, Services Agreement, tips/donations)

### Takeaway
Stripe nie zakazuje wprost napiwkow dla tworcy: "content-related tips" to kategoria RESTRICTED (wymaga dodatkowej weryfikacji), a strona wymagan mowi, ze napiwek musi dotyczyc swiadczenia juz wykonanego (np. tresci). Natomiast "donacja" na wlasny, niesprecyzowany cel i zbiorka z paskiem postepu wchodzi w obszar crowdfundingu/fundraisingu, ktory Stripe traktuje ostrzej (i wymaga "konkretnego celu charytatywnego"), wiec to najwiekszy punkt ryzyka.

### Cited Findings
- Lista Restricted Businesses (aktualizacja 2026-09-22) w sekcji "Content creation platforms" zawiera pozycje "Receive content-related tips and other payments in exchange for their content" (kategoria restricted, wymaga dodatkowej due diligence) — [Stripe Restricted Businesses](https://stripe.com/legal/restricted-businesses)
- W sekcji "Crowdfunding and fundraising" restricted: "Fundraising conducted by non-profits, charities, political organisations and businesses offering a reward"; "Crowdfunding platforms"; "Organisations fundraising for a charitable purpose" (wsparte tylko w Australii, Kanadzie, UK i USA wg adnotacji) — [Stripe Restricted Businesses](https://stripe.com/legal/restricted-businesses)
- W sekcji Prohibited: "Processing where there is no bona fide good or service sold, or donation accepted; card testing" — [Stripe Restricted Businesses](https://stripe.com/legal/restricted-businesses)
- W sekcji prohibited jest tez "Peer-to-peer money transmission" — [Stripe Restricted Businesses](https://stripe.com/legal/restricted-businesses)
- Japonia: "Donations to individuals" jest prohibited (nie dotyczy PL, ale pokazuje podejscie Stripe do darowizn na rzecz osob fizycznych) — [Stripe Restricted Businesses](https://stripe.com/legal/restricted-businesses)
- Strona "Requirements for accepting tips or donations": napiwek "must be given for a good or service that has been provided" (np. tresc); donacja "must be tied to a specific charitable purpose that you're committing to accomplish"; nie wolno przyjmowac donacji "on behalf of someone other than yourself"; srodki "must be used for the charitable purpose described to the donor"; Stripe "does not support payment processing for personal or peer-to-peer money transmission"; trzeba uwzglednic "relevant restrictions relating to donations to non-registered entities" — [Stripe: Requirements for accepting tips or donations](https://support.stripe.com/questions/requirements-for-accepting-tips-or-donations)
- FAQ Stripe: konto moze byc ograniczone m.in. za "crowdfunding without approval"; zatwierdzona platforma crowdfundingowa to taka, ktora Stripe zatwierdzil do uzywania Stripe Connect; "direct crowdfunding or fundraising" jest traktowany inaczej; wiekszosc zarejestrowanych organizacji charytatywnych moze zbierac srodki przez Stripe — [Stripe FAQ: Prohibited and Restricted Businesses](https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs)
- FAQ Stripe: osoby fizyczne sprzedajace wlasne tresci bezposrednio klientom (bez bycia platforma) nie potrzebuja wstepnej zgody, ale podlegaja Stripe Services Agreement, liscie Restricted Businesses i "monitoring by Stripe" — [Stripe FAQ](https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs)
- FAQ Stripe: o wsparciu decyduje "Stripe's review upon account activation"; konto moze byc ograniczone z powodu zobowiazan prawnych/regulacyjnych/partnerow finansowych — [Stripe FAQ](https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs)
- Stripe Services Agreement: pkt 1.2(a)(ix) zakaz uzywania Uslug do Prohibited/Restricted Business bez zgody Stripe; pkt 7.2(c) i sekcja 12: Stripe moze utrzymywac Reserve ("collateral funds which Stripe holds and controls"); pkt 10.1(b)(i): zawieszenie natychmiast przy naruszeniu lub uzasadnionym podejrzeniu dzialalnosci niezgodnej z prawem; pkt 10.1(b)(ii)(1): "Stripe may terminate this Agreement or close User's Stripe Account at any time"; pkt 10.1(b)(i)(7) zawieszenie przy braku odpowiedzi na prosbe o informacje — [Stripe Services Agreement](https://stripe.com/legal/ssa)
- SSA sekcja 12: dla Polski podmiotem kontraktujacym jest Stripe Payments Europe, Limited; sekcja 13: prawo irlandzkie, arbitraz ICC w Dublinie — [Stripe Services Agreement](https://stripe.com/legal/ssa)
- Strona docs.stripe.com/payment-links/customer-chooses-price zwrocila 404 (nie zweryfikowano dokumentacji "customers choose what to pay") — proba 2026-10-12.
- Strona stripe.com/legal/prohibited-businesses zwrocila 404 (aktualna lista jest scalona w stripe.com/legal/restricted-businesses) — proba 2026-10-12.
- Anegdotycznie: uzytkownicy zglaszali, ze Stripe zamykal konta pod hasłem crowdfundingu (np. Liberapay); to relacje niezweryfikowane — [Techlore](https://blog.techlore.tech/stripe-liberapay)

### Inferences
- "Dobrowolny napiwek za juz udostepnione, darmowe tresci" miesci sie w tekscie wymagan Stripe dla tipow (swiadczenie "provided"), co sprzyja przedstawianiu wplat jako napiwkow za filmy, a nie darowizn na przyszly cel.
- Tekst "zbieram na tajny projekt" + pasek postepu do celu wyznaczanego recznie przypomina klasyczny crowdfunding bez nagrody; Stripe wymaga dla donacji konkretnego celu, ktory "committing to accomplish". Cel "tajny" / niesprecyzowany moze byc odczytany przez Stripe jako brak "bona fide" celu albo jako niezatwierdzony direct crowdfunding -> ryzyko ograniczenia konta, rezerwy lub offboardingu.
- Pasek postepu przy NADCHODZACYM filmie sugeruje, ze wplaty sa "na przyszla tresc" (przedplata), co jest bardziej crowdfundingowe niz klasyczny napiwek za gotowa tresc.
- Roznica osoba fizyczna vs firma: FAQ Stripe nie rozroznia wprost; zrodlo zwraca uwage na monitoring i review przy aktywacji. Konkretne roznice (np. wymogi KYC dla osoby fizycznej, opis dzialalnosci) — niezweryfikowane.

### Gaps
- Nie zweryfikowano: statement descriptor, wymog polityki zwrotow, wymog opisu dzialalnosci (strona SSA zostala przeczytana tylko w 100 tys. znakow z 143 tys.).
- Nie zweryfikowano dokumentacji Stripe "Payment Links: customers choose what to pay" (404 pod probowanym adresem).
- Nie zweryfikowano, czy Stripe wymaga ujawnienia celu zbiorki lub zatwierdzenia dla "donacji dla osoby fizycznej" w Polsce w praktyce (brak zrodla poza ogolnymi zasadami).
- Brak zrodla dot. "Stripe Terms: payments for which no goods or services are delivered" jako odrebnej klauzuli; najblizsza znaleziona pozycja to "no bona fide good or service sold, or donation accepted" (Prohibited uses).

## 2. Prawo polskie: kwalifikacja cywilnoprawna, zbiorki publiczne, PIT, VAT, ksiegowosc

### Takeaway
Zbiorka online z wplatami elektronicznymi zwykle NIE jest "zbiorka publiczna" w rozumieniu ustawy z 2014 r. (definicja wymaga "miejsca publicznego" i gotowki/natury). Organy podatkowe (KIS) w licznych interpretacjach traktuja anonimowe "donejty" jako przychod (nie darowizne), wiec opodatkowanie PIT jest realne; VAT zalezy od tego, czy wplata jest czysto dobrowolna i bez swiadczenia wzajemnego (brak jednoznacznej interpretacji KIS potwierdzajacej brak VAT dla streamera).

### Cited Findings
- Art. 1 ust. 1 ustawy z 14.03.2014 o zasadach prowadzenia zbiorek publicznych: zbiorka publiczna to "zbieranie ofiar w gotowce lub w naturze w miejscu publicznym" na cel zgodny z prawem, w ramach zadan publicznych lub cele religijne — [ustawa, api.sejm.gov.pl](https://api.sejm.gov.pl/eli/acts/DU/2014/498/text.html) (tekst z 2014 r., bez wersji ujednoliconej; nie sprawdzono nowelizacji)
- Art. 2: wylaczenia m.in. zbiorki wsrod znajomych prowadzone osobiscie przez organizatora; art. 3: organizatorzy to organizacje pozytku publicznego, podmioty z art. 3 ust. 3 ustawy o dzialalnosci pozytku publicznego i komitety spoleczne; art. 4: komitet = co najmniej 3 pelnoletnie osoby; art. 5-6: zgloszenie elektroniczne na portalu; art. 23: kara grzywny za wykroczenie (kodeks wykroczen art. 56) przy zbiorce bez zgloszenia, z przepadkiem — [ustawa, api.sejm.gov.pl](https://api.sejm.gov.pl/eli/acts/DU/2014/498/text.html)
- Wg komentarzy, uzasadnienie ustawy: obowiazek zgloszenia nie obejmuje form, w ktorych zostaje slad przeplywu pieniedzy (przelewy, wplaty online); crowdfunding przez internet nie miesci sie w pojeciu zbiorki publicznej — [e-prawnik, opinia prawna](https://e-prawnik.pl/artykuly/organizowanie-zbiorek-publicznych-w-internecie-opinia-prawna.html) oraz [Prawnokarne aspekty nielegalnych zbiorek w Internecie, apcz.umk.pl](https://apcz.umk.pl/TSP-W/article/download/66100/43842/208029) (zrodla wtorne, komentarze; streszczenie wyszukiwarki, strony nie przeczytane w calosci)
- MSWiA porzucilo prace nad nowelizacja dajaca ministrowi prawo blokowania zbiorek (wg infor.pl; data nie potwierdzona) — [infor.pl](https://www.infor.pl/prawo/nowosci-prawne/774360,MSWiA-zaprzestaje-prac-nad-nowelizacja-przepisow-o-zbiorkach-publicznych.html). Nie znaleziono zrodla o uchwalonej nowelizacji "2025" dot. zbiorek internetowych.
- KIS, interpretacja z 9.05.2024, sygn. 0111-KDIB2-2.4015.34.2024.3.MM (youtuber): anonimowosc wplacajacych wyklucza darowizne, wplaty podlegaja PIT jako przychod; KIS 9.07.2025, sygn. 0111-KDIB2-2.4015.65.2025.3.MM (streamer): wplaty od anonimowych lub nieidentyfikowalnych (e-mail, nick, login, samo imie) nie sa darowiznami w rozumieniu art. 888 KC; u tworcow z dzialalnoscia gospodarcza rozlicza sie je jak kazdy przychod, u pozostalych jako przychody z innych zrodel — wg streszczenia wyszukiwarki (opisy na infor.pl, akademialtca.pl); same interpretacje (eureka.mf.gov.pl) nie zostaly otwarte.
- KIS 16.09.2024, sygn. 0115-KDIT1.4011.389.2024.6.ASZ: wplaty dla tworczyni internetowej to przychod z innych zrodel, bo nie zna tozsamosci darczyncow — wg streszczenia wyszukiwarki; interpretacja nieotwarta.
- KIS 9.01.2023, sygn. 0111-KDIB2-2.4015.119.2022.3.PB: stanowisko wnioskodawczyni (donejty = darowizny) uznane za prawidlowe, bo oparte na stanie faktycznym przedstawionym we wniosku — wg streszczenia wyszukiwarki.
- Wyrok o sygn. I SA/Bd 488/25 opisywany jako wskazujacy, ze anonimowy donejt moze byc darowizna (wyroki NSA/WSA: sygnatura I SA/Bd oznacza zwykle WSA w Bydgoszczy; sad nie zweryfikowany) — [podatki.biz](https://www.podatki.biz/artykuly/anonimowy-donejt-moze-byc-darowizna-wazny-wyrok-nsa-i-jego-skutki-podatkowe_64_63510.htm) (tytul tylko; tresci nie otwarto)
- Kwota wolna dla darowizn od osob niespokrewnionych (III grupa): 5733 zl wg komentarza prasowego — [artykul cytowany przez wyszukiwarke, ksiegowosc.infor.pl](https://ksiegowosc.infor.pl/wiadomosci/6620550,skarbowka-donejty-dla-youtuberow-i-innych-tworcow-internetowych-to-nie-darowizny-nie-ma-zwolnienia-podatkowego.html) (nie otwarto strony, wartosc ze streszczenia)
- VAT: brak znalezionej interpretacji KIS wprost stwierdzajacej, ze donejty dla streamera sa poza VAT; komentarz mowi, ze gdy za wplata ida konkretne korzysci, to transakcja VAT-owa — [Spidersweb](https://spidersweb.pl/2025/08/donejty-opodatkowane-urzed-skarbowy.html) (zrodlo popularne, stanowisko komentatora). Napiwki w gastronomii: calkowicie dobrowolne kwoty niepobierane przez sprzedawce nie stanowia obrotu — wg streszczenia, zrodlo konkretne nieotwarte.
- TSUE C-16/93 Tolsma: nie zweryfikowano tresci wyroku w tej sesji (wyszukiwarka nie zwrocila EUR-Lex).

### Inferences
- Kwalifikacja: przy anonimowych, masowych wplatach przez Stripe organy podatkowe najpewniej uznaja je za przychod (PIT), a nie darowizne z art. 888 KC; do art. 888 KC potrzebna jest identyfikowalna strona i zgodne oswiadczenia woli. Stripe zna dane platnika (e-mail, czesto imie), ale KIS wprost uznaje e-mail/nick/login za niewystarczajace.
- Dla osoby fizycznej bez dzialalnosci: ryzyko kwalifikacji jako przychod z "innych zrodel" (skala 12/32% wg stawek PIT — niezweryfikowane w tej sesji) albo, gdy dzialanie ma cechy stalosci i zorganizowania, jako dzialalnosc gospodarcza (art. 5a pkt 6 ustawy o PIT — niezweryfikowane).
- Wnioskowanie o VAT: wplata bez swiadczenia wzajemnego i bez bezposredniego powiazania z konkretna usluga jest zasadniczo poza VAT wg linii TSUE (Tolsma), ale przy platformie tresci, w ktorej tworca regularnie publikuje i prosi o wsparcie, organ moze dowodzic zwiazku; ryzyko niewielkie, ale nie zerowe. To wniosek z zasad, nie z przeczytanego orzeczenia.
- Pasek postepu i slowa "zbieram na projekt" zwiekszaja ryzyko, ze wplaty zostana uznane za zaplate z gory za przyszla tresc/projekt (swiadczenie wzajemne), czyli VAT i przychod.

### Gaps
- Nie sprawdzono tekstu jednolitego ustawy o zbiorkach (Dz.U. 2014 poz. 498 w wersji obowiazujacej) ani zadnych nowelizacji 2025; nie potwierdzono, ze w 2025 wprowadzono zmiany dot. zbiorek internetowych (wyszukiwarka nic nie znalazla).
- Nie otwarto pelnych tekstow interpretacji na eureka.mf.gov.pl ani wyroku I SA/Bd 488/25 (sad, data, teza).
- Nie zweryfikowano: art. 888 KC (tresc), art. 4a, art. 9, art. 2 ustawy o podatku od spadkow i darowizn (progi, darczyncy zagraniczni, SD-Z2 w 6 miesiecy), art. 5 Prawa przedsiebiorcow (dzialalnosc nierejestrowana: limit 75% minimalnego wynagrodzenia), art. 113 ustawy o VAT (limit 200 000 zl), wymiar stawek PIT.
- Nie zweryfikowano TSUE C-16/93 (Tolsma) w EUR-Lex ani pozniejszych wyrokow (np. C-498/99 Town & County Factors, C-174/00 Kennemer Golf).
- Nie znaleziono interpretacji KIS dla WLASCIWEGO przypadku (platforma wideo z dobrowolnymi wplatami + pasek postepu).

## 3. UE: konsument, RODO, AML

### Takeaway
Nie zdazono zbadac tej czesci. Poniżej jedynie ogolne ustalenia z wywiadu, bez zrodel.

### Cited Findings
- Brak (nie zbadano).

### Inferences
- Do ustalenia (niezweryfikowane): prawo odstapienia od umowy zawartej na odleglosc (dyrektywa 2011/83/UE, ustawa o prawach konsumenta) dotyczy umow odplatnych z przedsiebiorca; czysta darowizna bez swiadczenia raczej poza zakresem, ale przy firmie wystawiajacej "napiwek" stanowisko niepewne. Stripe i tak umozliwia zwroty; polityka zwrotow wymaga decyzji wlasciciela.
- RODO: dane platnika (e-mail, imie, kraj, metadane platnosci) to dane osobowe; administratorem jest operator serwisu (wspolnie/odrebnie ze Stripe); potrzebna polityka prywatnosci, podstawa prawna (art. 6 ust.1 lit. b/c/f), retencja (obowiazki ksiegowe). Niezweryfikowane zrodlami w tej sesji.
- AML: operator nie jest instytucja obowiazana w rozumieniu ustawy o AML tylko z powodu otrzymywania napiwkow; KYC robi Stripe. Niezweryfikowane.

### Gaps
- Pozostawione do dalszego badania: UOKiK, ustawa o prawach konsumenta (art. 38), RODO (art. 6, 13), ustawa AML (2018), wymagania Stripe KYC dla osoby fizycznej w PL.

## 4. Ryzyka i zmiany (do wlaczenia w odpowiedz koncowa)

### Takeaway
Najwieksze ryzyko to Stripe (kwalifikacja jako crowdfunding na "tajny projekt") oraz podatek (przychod, a nie darowizna). Zbiorki publiczne i VAT sa mniejszym ryzykiem, jesli mechanika zostanie utrzymana jako czysty napiwek za udostepnione tresci.

### Cited Findings
- Patrz sekcje 1 i 2.

### Inferences
- Zmiany tekstu: "dobrowolny napiwek za tresci, bez swiadczenia wzajemnego, bezzwrotny"; unikac "zbieram na projekt/cel", "inwestycja", "zbiorka"; nie obiecywac przeznaczenia ani celu; ewentualnie opisac ogolnie "wsparcie tworczosci i utrzymania kanalu".
- Pasek postepu: rozwazyc usuniecie lub zastapienie ogolnym podziekowaniem; w obecnej formie zwieksza ryzyko Stripe (crowdfunding) i VAT/przychod (przedplata za tresc).
- Formalnie: rozwazyc JDG (przychod z dzialalnosci gospodarczej, ryczalt/liniowy), wniosek o indywidualna interpretacje KIS w sprawie wlasnego stanu faktycznego, konsultacja z doradca podatkowym przed wiekszymi kwotami; poinformowac Stripe o charakterze dzialalnosci przy weryfikacji konta.
- Przy spolce z USA zarzadzanej z Polski: ryzyko "zarzadu" w Polsce (rezydencja podatkowa, CIT, stale miejsce prowadzenia dzialalnosci) — niezweryfikowane, wymaga doradcy.

### Gaps
- Calosc tej sekcji jest wnioskowaniem; wymaga weryfikacji prawnika/doradcy podatkowego.
