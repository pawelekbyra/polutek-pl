# Struktura prawna dla jednoosobowej platformy wideo (Wyoming LLC vs JDG vs sp. z o.o.), stan na październik 2026

Uwaga ogólna: to analiza informacyjna, nie porada podatkowa. Liczby w sekcji 4 są ilustracyjne (założenia podane w sekcji). Kursy: USD/PLN ok. 3,91 (NBP 8.10.2026, [TVP Info](https://www.tvp.info/95820659/kursy-walut-nbp-8102026-eur-usd-chf-w-czwartek-8-pazdziernika-2026-euro-dolar-frank-szwajcarski)); do kalkulacji przyjęto 3,9.

Pliki źródłowe (tekst ustaw) pobrane z Sejm API i przeczytane w całości w odpowiednich artykułach: ryczałt [Dz.U. 2025 poz. 843](https://api.sejm.gov.pl/eli/acts/DU/2025/843/text.pdf), CIT [Dz.U. 2026 poz. 554](https://api.sejm.gov.pl/eli/acts/DU/2026/554/text.pdf), PIT [Dz.U. 2026 poz. 592](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf), VAT [Dz.U. 2026 poz. 1263](https://api.sejm.gov.pl/eli/acts/DU/2026/1263/text.pdf), ustawa zdrowotna [Dz.U. 2025 poz. 1461](https://api.sejm.gov.pl/eli/acts/DU/2025/1461/text.pdf).

---

## 1. Rezydencja podatkowa LLC zarządzanej z Polski, CIT/PIT, CFC, czy ryczałt 8,5% w ogóle jest możliwy

### Takeaway
Założenie „LLC + ryczałt 8,5%” jest najprawdopodobniej błędne: jednoosobowa LLC (domyślnie przezroczysta w USA) jest w Polsce traktowana jak spółka niebędąca osobą prawną, a jej właściciel rozlicza dochód w PIT jako działalność gospodarczą wg skali albo 19% liniowo, bez możliwości ryczałtu (art. 6 ust. 1 ustawy o ryczałcie nie wymienia zagranicznych spółek). Jeśli LLC wybierze w USA opodatkowanie jak korporacja (formularz 8832) i jest zarządzana z Polski, staje się polskim podatnikiem CIT od całości dochodów.

### Cited Findings
- Art. 3 ust. 1 CIT: podatnicy mający siedzibę lub zarząd w Polsce płacą CIT od całości dochodów; art. 3 ust. 1a: zarząd jest w Polsce m.in. gdy w sposób zorganizowany i ciągły prowadzone są tu bieżące sprawy podatnika (umowa, pełnomocnictwa, powiązania) — [CIT, Dz.U. 2026 poz. 554](https://api.sejm.gov.pl/eli/acts/DU/2026/554/text.pdf)
- Art. 1 ust. 3 pkt 2 CIT: ustawę stosuje się także do spółek niemających osobowości prawnej mających siedzibę lub zarząd w innym państwie, jeżeli wg prawa podatkowego tego państwa są traktowane jak osoby prawne i podlegają tam opodatkowaniu od całości dochodów — [CIT](https://api.sejm.gov.pl/eli/acts/DU/2026/554/text.pdf). Wniosek: LLC transparentna w USA (domyślnie dla jednoosobowej) nie jest podatnikiem CIT; LLC z wyborem „corporation” (8832) już tak.
- Art. 5a pkt 26 i 28 PIT oraz art. 8 PIT: przychody z udziału w spółce niebędącej osobą prawną określa się u wspólnika proporcjonalnie do udziału w zysku, art. 8 ust. 1a: dla podatku liniowego 19% nie łączy się ich z dochodami ze skali — [PIT, Dz.U. 2026 poz. 592](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf)
- KIS 15.12.2023, 0114-KDIP3-1.4011.819.2023.2.MS2: jedyny wspólnik LLC (domyślnie przezroczysta), polski rezydent, LLC bez biura i pracowników w USA, zarządzana w całości z Polski. KIS: LLC to w Polsce spółka bez osobowości prawnej, nie podatnik CIT; dochód to przychód z działalności gospodarczej (art. 10 ust. 1 pkt 3 PIT); wg umowy PL-USA (art. 8, 1974) zyski podlegają opodatkowaniu tylko w Polsce, bo brak zakładu w USA — [interpretacje.pl](https://www.interpretacje.pl/pit/9391719,ustalenie-czy-wnioskodawca-jako-jedyny-wspolnik-spolki-utworzonej-zg.html)
- KIS 4.08.2023, 0113-KDIPT2-3.4011.348.2023.2.KKA: LLC przezroczysta, e-commerce zarządzany z Polski; dochód z LLC to dochód z działalności gospodarczej, można go opodatkować 19% liniowo (art. 30c), nie trzeba prowadzić równolegle JDG; w PIT wystarczy PIT-36L + PIT/B (to nie dochód zagraniczny) — [interpretacje.pl](https://www.interpretacje.pl/pit/9277909,skutki-podatkowe-uczestnictwa-w-spolce-llc-w-stanach-zjednoczonych.html)
- KIS 24.01.2025, 0113-KDIPT2-3.4011.663.2024.2.SJ: polski rezydent, jedyny wspólnik LLC (bez wyboru korporacji), usługi programistyczne z Polski dla klientów w USA; LLC przezroczysta, na wspólniku nie ciąży obowiązek poboru podatku u źródła od dochodów LLC w USA — [Inforfk](https://inforfk.pl/dok/tresc,FOB0000000000006844394,Interpretacja-indywidualna-z-dnia-24-stycznia-2025-r-Dyrektor-Krajowej-Informacji-Skarbowej-sygn-0113-KDIPT2-3-4011-663-2024-2-SJ.html)
- KIS 12.08.2021, 0112-KDIL2-2.4011.501.2021.1.KP: LLC bez biura w USA zarządzana z Polski — brak zagranicznego zakładu w USA, dochód opodatkowany w PLN w PIT; komentarz DLA Piper: interpretacja nie wiąże IRS, który może ocenić sprawę niezależnie — [Rzeczpospolita (rp.pl)](https://pro.rp.pl/podatki/art18897241-fiskus-firma-w-usa-to-nie-zaklad-zaplaci-podatek-w-polsce) oraz zestawienie w [Akademia LTCA](https://akademialtca.pl/blog/spolka-llc-mozliwe-formy-opodatkowania-dla-polskiego-wspolnika)
- Ryczałt niedostępny dla wspólnika LLC: KIS 0112-KDIL2-2.4011.584.2024.1.AG (wg opisu Akademii LTCA z 8.11.2024): art. 6 ust. 1 ustawy o ryczałcie wskazuje podmioty, którym przysługuje ryczałt, a przezroczysta LLC nie jest wśród nich; dochód wg skali (domyślnie, art. 9a ust. 1) lub 19% liniowo (art. 9a ust. 2) — [Akademia LTCA](https://akademialtca.pl/blog/spolka-llc-mozliwe-formy-opodatkowania-dla-polskiego-wspolnika)
- Tekst art. 6 ust. 1 ustawy o ryczałcie: ryczałt dotyczy przychodów osób fizycznych z pozarolniczej działalności gospodarczej, „w tym również gdy działalność ta jest prowadzona w formie spółki cywilnej osób fizycznych … lub spółki jawnej osób fizycznych”; zagranicznych spółek nie wymienia — [ustawa o ryczałcie, tekst jedn. Dz.U. 2025 poz. 843](https://api.sejm.gov.pl/eli/acts/DU/2025/843/text.pdf)
- CFC (PIT art. 30f): „zagraniczna jednostka” obejmuje m.in. jednostki bez osobowości prawnej INNE niż „spółka niemająca osobowości prawnej” (lit. c) oraz spółkę niemającą osobowości prawnej z art. 1 ust. 3 pkt 2 CIT, czyli traktowaną za granicą jak korporacja (lit. d). Przezroczysta LLC nie jest więc „zagraniczną jednostką” w sensie CFC; LLC z wyborem corporation — jest, a testy CFC (m.in. faktycznie zapłacony podatek niższy o co najmniej 25% od 19% CIT, przychody pasywne ≥ 33%, kontrola >50%) trzeba policzyć. Stawka CFC 19% — [PIT art. 30f](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf)
- Brak odrębnych wyroków NSA/WSA o LLC z polskim wspólnikiem: wyszukiwanie zwróciło tylko interpretacje KIS (które nie wiążą sądów ani IRS) — wynik wyszukiwania z tej sesji.
- Formularze i rozliczenie: skala PIT-36, liniowy PIT-36L (+PIT/B, ew. PIT/ZG i PIT/O przy kredycie podatku USA); przeliczenie po średnim kursie NBP z ostatniego dnia roboczego przed uzyskaniem przychodu/poniesieniem kosztu; zaliczka z art. 20 ust. 1 umowy PL-USA (metoda proporcjonalnego odliczenia) — [Akademia LTCA, 3.03.2025](https://akademialtca.pl/blog/roczne-rozliczenie-dochodow-z-amerykanskiej-spolki-llc-w-polsce)
- Strona USA: zagraniczny właściciel domyślnie przezroczystej LLC musi złożyć „pro forma” Form 1120 z Form 5472 co roku; kara $25 000 za każdy brak/nieprawidłowość, a po upomnieniu IRS dodatkowo $25 000 za każde 30 dni po 90 dniach, bez górnego limitu; nie można składać elektronicznie — [IRS, International information reporting penalties](https://www.irs.gov/payments/international-information-reporting-penalties), [Instructions for Form 5472](https://www.irs.gov/instructions/i5472)
- FinCEN BOI: ostateczna reguła z 11.08.2026 (w mocy od 14.08.2026) trwale zwalnia krajowe spółki (w tym LLC założone w USA) i osoby z USA z raportowania BOI; w mocy zostają jedynie wymogi dla spółek zagranicznych zarejestrowanych w USA — [Sidley](https://whitecollarwatch.sidley.com/?p=1294)

### Inferences
- Dla polskiego rezydenta „LLC” nie daje żadnej korzyści podatkowej w PIT: wynik jest równy JDG na skali/liniowo, ale bez dostępu do ryczałtu (a ryczałt jest tym, co zwykle daje największą przewagę przy małych kosztach).
- Ryzyko pułapki 8,5%: nawet w JDG stawka 8,5% to stawka resztowa (art. 12 ust. 1 pkt 5 lit. a „z zastrzeżeniem pkt 1-4 oraz 6-8”); streaming wideo ma osobną stawkę 15% (patrz pkt 3/4).
- Zarządzanie z Polski jest dla organów oczywistą okolicznością (rezydent, żadnego biura w USA); wszystkie znalezione interpretacje opierają się właśnie na tym, że LLC jest „zarządzana z Polski” i dlatego nie ma zakładu w USA, a dochód jest opodatkowany tylko w Polsce.

### Gaps
- Nie udało się otworzyć oryginalnego tekstu interpretacji 0112-KDIL2-2.4011.584.2024.1.AG w bazie KIS (sygnaturę podaje Akademia LTCA; wyszukiwarki jej nie indeksują). Wniosek o niedostępności ryczałtu opiera się więc na tym opisie oraz na samym brzmieniu art. 6 ust. 1 ustawy o ryczałcie.
- Nie znaleziono źródła pierwotnego IRS potwierdzającego, że zagraniczny właściciel LLC bez „US trade or business” nie płaci federalnego podatku dochodowego od przychodów ze sprzedaży cyfrowej na świecie (kwestia ECI/źródła przychodu); wymaga potwierdzenia przez amerykańskiego CPA.
- Status umowy PL-USA: obowiązuje umowa z 1974 r.; nowa konwencja z 2013 r. nie weszła w życie wg starszych źródeł ([rp.pl](https://pro.rp.pl/podatki/art5364891-umowa-podatkowa-z-usa-rodem-z-prl-nadal-w-mocy)), czy status się zmienił do 2026 — nie sprawdzono.
- ZUS dla właściciela LLC: jedyna znaleziona interpretacja ZUS (Oddział w Lublinie, 30.09.2016, relacja [money.pl 28.10.2016](https://www.money.pl/firma/wiadomosci/ucieczka-przed-zus-em-do-wyoming-oto-nowy-sposob-by-nie-placic-skladek-6262650045839489a.html)) uznała, że wspólnictwo w LLC nie rodzi obowiązku składek; to jedno, 10-letnie rozstrzygnięcie dla konkretnego wnioskodawcy, eksperci ostrzegali przed kontrolą po kilku latach. Nie znalazłem nowszego stanowiska ZUS ani orzeczenia SN w tej sprawie. NFZ-owa decyzja 198/2022 (nfz.gov.pl) o składce zdrowotnej wspólnika LLC była w wynikach, ale jej nie otwierałem.

---

## 2. VAT: czy LLC zarządzana z Polski ma siedzibę działalności w Polsce, procedury VAT, limit 240 000 zł

### Takeaway
VAT nie zależy od formy dochodowej: podatnikiem jest sama LLC (art. 15 ust. 1: osoby prawne i jednostki bez osobowości prawnej), a jej „siedziba działalności gospodarczej” to miejsce, gdzie wykonywane są funkcje naczelnego zarządu (art. 10 rozp. 282/2011); przy właścicielu-jedynym zarządcy mieszkającym i pracującym w Polsce jest to prawie na pewno Polska, więc LLC jest w VAT jak polska firma (VAT-R, OSS unijny). JDG i sp. z o.o. mają te same reguły materialne; zwolnienie podmiotowe 240 000 zł przysługuje tylko podatnikowi „posiadającemu siedzibę działalności gospodarczej na terytorium kraju”.

### Cited Findings
- Art. 15 ust. 1 ustawy o VAT: podatnikami są osoby prawne, jednostki organizacyjne niemające osobowości prawnej oraz osoby fizyczne wykonujące samodzielnie działalność gospodarczą — [VAT, Dz.U. 2026 poz. 1263](https://api.sejm.gov.pl/eli/acts/DU/2026/1263/text.pdf)
- Art. 28b ust. 1 (B2B: miejsce świadczenia = siedziba nabywcy), art. 28c (B2C: siedziba usługodawcy), art. 28k (B2C usługi elektroniczne: miejsce siedziby/zamieszkania konsumenta; wyjątek ust. 2: usługodawca z siedzibą tylko w jednym państwie UE, sprzedaż do konsumentów w innych państwach UE do 10 000 euro, w zł 42 000 zł rocznie, wtedy opodatkowanie w kraju usługodawcy) — [VAT](https://api.sejm.gov.pl/eli/acts/DU/2026/1263/text.pdf)
- Art. 113 ust. 1 (od 1.01.2026): zwolnienie sprzedaży dokonywanej „przez podatnika posiadającego siedzibę działalności gospodarczej na terytorium kraju”, jeśli wartość sprzedaży bez VAT nie przekroczyła w poprzednim ani bieżącym roku 240 000 zł (limit podniesiony ustawą z 24.06.2025, Dz.U. 2025 poz. 896); art. 113 ust. 13: zwolnienia nie stosuje się m.in. do usług prawniczych, doradczych, jubilerskich, ściągania długów — [VAT](https://api.sejm.gov.pl/eli/acts/DU/2026/1263/text.pdf)
- Art. 113a: zwolnienie dla podatników z siedzibą w innym państwie członkowskim (z limitem 100 000 euro obrotu unijnego, numer EX) — [VAT](https://api.sejm.gov.pl/eli/acts/DU/2026/1263/text.pdf); LLC spoza UE bez siedziby w UE z tego zwolnienia nie skorzysta (wniosek z brzmienia przepisów).
- Art. 2 pkt 22: „sprzedaż” to odpłatna dostawa towarów i świadczenie usług na terytorium kraju, eksport i WDT — zwolnienie liczy więc tylko sprzedaż opodatkowaną w Polsce (usługi z miejscem świadczenia za granicą nie wchodzą do limitu) — [VAT](https://api.sejm.gov.pl/eli/acts/DU/2026/1263/text.pdf)
- Kryteria siedziby działalności (art. 10 rozp. wykonawczego 282/2011): miejsce wykonywania funkcji naczelnego zarządu; brane pod uwagę: gdzie zapadają istotne decyzje, adres siedziby statutowej, miejsce posiedzeń zarządu; sam adres pocztowy nie wystarcza — [Poradnik Przedsiębiorcy, 7.12.2023](https://poradnikprzedsiebiorcy.pl/-miejsce-swiadczenia-uslug-w-podatku-vat-a-siedziba-dzialalnosci)
- Podobny stan faktyczny z komentarzem (nie wyrok): spółka zagraniczna z jedynym wspólnikiem-prezesem mieszkającym w Polsce i pustym biurem za granicą może być uznana za mającą stałe miejsce prowadzenia działalności w Polsce — [rp.pl](https://pro.rp.pl/podatki/art1194761-vat-mala-skala-wystarczy-by-polski-fiskus-dostal-podatek-wyrok-wsa) (tytuł artykułu; pełnej treści nie czytałem, wynik z wyszukiwarki)
- Usługi elektroniczne B2C: poza UE nie ma polskiego VAT (art. 28k ust. 1); wewnątrz UE powyżej 10 000 euro VAT kraju konsumenta, rozliczany przez OSS — [Poradnik Przedsiębiorcy, 14.01.2025](https://poradnikprzedsiebiorcy.pl/-miejsce-opodatkowania-swiadczonych-uslug-elektronicznych-na-rzecz-osob-prywatnych-z-ue-i-spoza-ue)
- Stripe Managed Payments (Stripe jako merchant of record) „handles indirect tax compliance” w >80 krajach: wylicza, pobiera, składa i odprowadza VAT/sales tax; dla państw spoza listy sprzedawca pozostaje odpowiedzialny — [Stripe docs: How it works](https://docs.stripe.com/payments/managed-payments/how-it-works)

### Inferences
- Wniosek ostrożny: LLC prowadzona z Polski = podatnik VAT z siedzibą w Polsce (VAT-R, polski VAT 23% na sprzedaży B2C w PL, OSS unijny dla UE). Zwolnienie 240 000 zł byłoby formalnie dostępne tylko dla takiego „polskiego” podatnika; przy wizerunku „zagranicznej LLC bez siedziby w PL” byłoby niedostępne, a próba uznania siedziby za amerykańską jest sprzeczna z rzeczywistością zarządzania.
- Przy kwotach 30–450 tys. USD rocznie (≈ 117 tys.–1,75 mln zł) zwolnienie 240 000 zł przyda się najwyżej w najniższym paśmie i tylko dla sprzedaży opodatkowanej w Polsce; sprzedaż do konsumentów UE powyżej 10 000 euro (42 000 zł) wymaga VAT w kraju konsumenta i tak (OSS).
- Jeśli sprzedaż idzie przez Stripe Managed Payments (Stripe sprzedaje konsumentowi), to relacja sprzedawcy z Stripe jest B2B; jak ją klasyfikować w VAT i PIT (przychód brutto czy netto po prowizji), wymaga lektury umowy Stripe i opinii doradcy — nie znalazłem tego w dokumentacji Stripe.
- JDG i sp. z o.o.: te same reguły VAT (art. 28b, 28k, 113); różnica: JDG-osoba fizyczna z siedzibą w Polsce na pewno kwalifikuje się do art. 113; sp. z o.o. z siedzibą w Polsce również.

### Gaps
- Nie znaleziono interpretacji KIS ani wyroku dotyczących wprost VAT amerykańskiej LLC zarządzanej z Polski; wniosek jest oparty na art. 10 rozp. 282/2011 i na analogicznych sprawach spółek zagranicznych.
- Nie otwarto tekstu rozp. 282/2011 w EUR-Lex (serwer zwrócił kod 202); kryteria art. 10 cytowane za Poradnikiem Przedsiębiorcy.
- Nie sprawdzono skutków VAT: obowiązku VAT-UE/informacji podsumowującej przy usługach B2B do Stripe (Irlandia) oraz tego, czy podatnik zwolniony z VAT może świadczyć usługi B2B transgraniczne bez rejestracji VAT-UE.

---

## 3. Administracja i koszty, bankowość, Stripe, odpowiedzialność, umowa PL-USA, dywidendy

### Takeaway
LLC dokłada koszty i obowiązki w USA (registered agent, roczny raport, Form 5472, bank/Wise), a nic nie zmienia w polskim opodatkowaniu; sp. z o.o. ma najcięższą administrację i podwójne opodatkowanie (CIT + 19% od dywidendy), ale daje osobowość prawną i możliwość estońskiego CIT; JDG jest najtańsza i jedyna dopuszcza ryczałt. Stripe Managed Payments dostępne jest dla firm z Polski, więc konto w USA nie jest do tego potrzebne.

### Cited Findings
**JDG**
- Ryczałt: stawka 15% dla „przesyłania strumieni wideo przez Internet (PKWiU 59.11.25.0)” (art. 12 ust. 1 pkt 2 lit. i); 15% także dla usług nadawania programów (dział 60), licencji na gry i programy komputerowe (58.21.40.0, 58.29.50.0), usług kulturalnych i rozrywkowych (dział 90); 12% dla pakietów gier/oprogramowania i usług IT (pkt 2b, z wyłączeniem publikowania gier on-line i pobierania oprogramowania on-line); 8,5% dla pozostałej działalności usługowej „z zastrzeżeniem pkt 1-4 oraz 6-8” oraz m.in. edukacji (dział 85); 8,5%/12,5% (próg 100 000 zł) wyłącznie dla najmu i podobnych (pkt 4); przychód nie jest pomniejszany o koszty (art. 12 ust. 2) — [ustawa o ryczałcie](https://api.sejm.gov.pl/eli/acts/DU/2025/843/text.pdf)
- Klasyfikacja wg PKWiU z 2015 r. (Dz.U. poz. 1676) — art. 4 ust. 1 pkt 1 ustawy o ryczałcie — [tamże](https://api.sejm.gov.pl/eli/acts/DU/2025/843/text.pdf)
- Limit ryczałtu 2 mln euro przychodu w poprzednim roku (8 517 200 zł na 2026) — [Poradnik Przedsiębiorcy](https://poradnikprzedsiebiorcy.pl/-ryczalt-od-przychodow-ewidencjonowanych-dostepne-stawki-ryczaltu)
- Ryczałt: odliczenia od przychodu: składki społeczne (art. 11 ust. 1 w zw. z art. 26 ust. 1 pkt 2 PIT) i 50% zapłaconych składek zdrowotnych (art. 11 ust. 1a) — [ustawa o ryczałcie](https://api.sejm.gov.pl/eli/acts/DU/2025/843/text.pdf)
- Liniowy: 19% (art. 30c PIT), składka zdrowotna 4,9% dochodu, min. kwota odpowiadająca 9% minimalnego wynagrodzenia (art. 79a ustawy zdrowotnej); skala: 12% do 120 000 zł minus kwota zmniejszająca 3 600 zł, 32% powyżej (art. 27 PIT), składka 9%; danina solidarnościowa 4% od nadwyżki dochodu ponad 1 000 000 zł (skala/liniowy; ryczałt nie jest tam wymieniony; art. 30h PIT) — [PIT](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf), [ustawa zdrowotna](https://api.sejm.gov.pl/eli/acts/DU/2025/1461/text.pdf)
- Składka zdrowotna 2026: minimum 432,54 zł/mc (4 806 zł × 9%, minimalne wynagrodzenie 4 806 zł wg [ZUS](https://www.zus.pl/documents/10182/13364587/Sk%C5%82adki+przedsi%C4%99biorc%C3%B3w+w+2026+roku_DFF.pdf/c8d4e1dc-c80b-91d6-7453-02309976f713?t=1772712579703) i art. 79a ustawy zdrowotnej); limit odliczenia składki zdrowotnej od dochodu na liniowym 14 100 zł rocznie podaje wyłącznie wyszukiwarka (serwisy księgowe, nie sprawdzono w źródle pierwotnym; w tekście art. 30c PIT kwota nie występuje wprost); ryczałt: 498,35 / 830,58 / 1 495,04 zł miesięcznie dla przychodu do 60 000 / do 300 000 / powyżej 300 000 zł (60/100/180% przeciętnego wynagrodzenia 9 228,64 zł z IV kw. 2025) — [inFakt](https://www.infakt.pl/blog/?p=81460)
- ZUS 2026 (podstawa 5 652 zł): 1 788,29 zł/mc bez dobrowolnego chorobowego (1 926,76 z chorobowym); preferencyjny ZUS (podstawa 1 441,80 zł, 24 miesiące): 420,86 zł (456,18 zł z chorobowym); ulga na start: 6 miesięcy bez składek społecznych; mały ZUS plus: przychód poprzedni rok ≤ 120 000 zł, 36 z ostatnich 60 miesięcy; pełny ZUS to 21 459,48 zł rocznie — [ZUS, Analiza Wydziału Planowania Funduszy, luty 2026](https://www.zus.pl/documents/10182/13364587/Sk%C5%82adki+przedsi%C4%99biorc%C3%B3w+w+2026+roku_DFF.pdf/c8d4e1dc-c80b-91d6-7453-02309976f713?t=1772712579703)
- Księgowość JDG: ryczałt 150–350 zł/mc, KPiR 200–500 zł/mc; online od ok. 69 zł — [Cenauslug](https://cenauslug.pl/poradniki/ile-kosztuje-prowadzenie-ksiegowosci-porownanie-biur-rachunkowych-i-programow-online), [Freenance](https://freenance.io/ile-kosztuje/ile-kosztuje-ksiegowa-jdg-2026-biuro-rachunkowe-vs-samoobsluga/)

**Wyoming LLC**
- Opłata roczna Wyoming min. $60 (większa z $60 albo 0,0002 × aktywa w stanie), articles of organization $100, registered agent ok. $50–300/rok — [Zenind 2026](https://www.zenind.com/help/post/wyoming-llc-fees-licenses-and-filing-requirements-2026-guide), [StateBusinessCompliance](https://www.statebusinesscompliance.com/blog/wyoming-llc-annual-report-2026)
- Form 5472 + pro forma 1120 corocznie (patrz pkt 1); CPA zwykle kilkaset USD (brak źródła pierwotnego; koszt do potwierdzenia)
- Polska księgowość LLC: rozliczenie PIT-36/36L z PIT/B, przeliczenia kursowe z NBP; zaliczki miesięczne/kwartalne trudne wg źródła — [Akademia LTCA](https://akademialtca.pl/blog/roczne-rozliczenie-dochodow-z-amerykanskiej-spolki-llc-w-polsce)
- Konto Stripe w USA wymaga podmiotu z USA, EIN i amerykańskiego konta bankowego (Mercury/Relay/Wise Business otwierają je dla zagranicznych właścicieli), wg źródeł wtórnych — [terms.law](https://terms.law/Invest-USA/bank-compliance/stripe-for-foreign-llc.html); Stripe Atlas zakłada LLC dla nie-Amerykanów — [Stripe](https://stripe.com/en-fi/resources/more/how-to-start-an-llc-from-the-uk-what-uk-entrepreneurs-need-to-know-about-us-company-formation)
- Wypłaty z LLC do właściciela nie są odrębnie opodatkowane w Polsce (dochód LLC to dochód właściciela w PIT, dystrybucja jest tylko przepływem pieniędzy) — wniosek z interpretacji z pkt 1.
- Odpowiedzialność: LLC chroni przed zobowiązaniami wobec osób trzecich wg prawa Wyoming; skuteczność w polskim postępowaniu i wobec ZUS/US nie jest w żadnym ze znalezionych źródeł rozstrzygnięta (brak źródła)

**Stripe**
- Managed Payments (Stripe jako merchant of record): dostępne dla firm z siedzibą w m.in. PL i US (lista 39 lokalizacji obejmuje PL); tylko integracje bezpośrednie (Checkout, Payment Links), nie Connect/Express; produkty cyfrowe w tym streamowane wideo (kody podatkowe m.in. txcd_10402000, txcd_10402200); bez własnej domeny na stronie płatności; klient widzi „LINK.COM* …”; Stripe obsługuje spory i VAT w >80 krajach; kontrola kwalifikacji (typ działalności i geografia), wymóg niskiego współczynnika sporów — [Stripe: eligibility](https://docs.stripe.com/payments/managed-payments/eligibility), [Stripe: how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)
- Managed Payments nie obsługuje „embeddable web components”/zaawansowanych integracji (m.in. Elements) — [Stripe: Managed Payments](https://docs.stripe.com/payments/managed-payments)
- Opłata: dodatkowe 3,5% od każdej udanej transakcji (liczone od kwoty z podatkiem), ponad standardowe opłaty płatnicze — [Stripe Support: Managed Payments pricing](https://support.stripe.com/questions/managed-payments-pricing)

**Sp. z o.o.**
- CIT 9% dla podatnika z przychodem do 2 mln euro w roku podatkowym (art. 19 ust. 1 pkt 2), 19% pozostali — [CIT](https://api.sejm.gov.pl/eli/acts/DU/2026/554/text.pdf)
- Dywidenda: 19% PIT (art. 30a ust. 1 pkt 4 PIT) — [PIT](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf); łączne obciążenie klasyczne ok. 26,29% dla małego podatnika (1 − 0,91 × 0,81) — [Poradnik Przedsiębiorcy: estoński CIT a dywidenda](https://poradnikprzedsiebiorcy.pl/-estonski-cit-a-dywidenda)
- Estoński CIT (ryczałt od dochodów spółek): 10% dla małego podatnika i rozpoczynającego, 20% pozostali (art. 28o); warunki m.in. (art. 28j): mniej niż 50% przychodów z praw autorskich lub własności przemysłowej (!), zatrudnienie min. 3 osób na umowę o pracę (lub równoważne wydatki na umowy cywilne) — dla rozpoczynających zwolnienie z warunku w roku startu i 2 kolejnych latach, dla małego podatnika w pierwszym roku wystarczy 1 etat — udziałowcami wyłącznie osoby fizyczne, brak udziałów w innych spółkach; deklaracja do końca 1. miesiąca roku; wypłata dywidendy: 19% PIT pomniejszone o 90% (przy 10%) lub 70% (przy 20%) zapłaconego ryczałtu (art. 30a ust. 19 PIT); łączne obciążenie przy pełnej wypłacie 20% (mały) / 25% — [CIT art. 28j–28o](https://api.sejm.gov.pl/eli/acts/DU/2026/554/text.pdf), [PIT art. 30a ust. 19](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf), [Poradnik Przedsiębiorcy](https://poradnikprzedsiebiorcy.pl/-estonski-cit-a-dywidenda)
- Jedyny wspólnik sp. z o.o. podlega obowiązkowo ubezpieczeniom emerytalnemu, rentowym i wypadkowemu jak przedsiębiorca (art. 8 ust. 6 pkt 4 ustawy o s.u.s.), niezależnie od dywidendy; wg jednego serwisu 1 788,29 zł społecznych + 830,58 zł zdrowotnej miesięcznie w 2026; jako jedyny wspólnik praktycznie nie może mieć umowy o pracę ze spółką — [Poradnik Przedsiębiorcy](https://poradnikprzedsiebiorcy.pl/-wspolnik-jednoosobowej-spolki-z-o-o-musi-oplacac-zus), [Norman Finance](https://norman.finance/pl/blog/zus-wspolnika-jednoosobowej-spolki-z-o-o)
- Koszty założenia przez S24: 250 zł opłata sądowa + PCC ok. 24 zł (wg jednego źródła ogłoszenie w MSiG 100 zł nie jest już pobierane od 29.11.2025); kapitał min. 5 000 zł — [Norman Finance, 9.10.2026](https://norman.finance/pl/blog/jak-zalozyc-spolke-z-o-o)
- Księgowość spółki (pełna księgowość): 600–1 500 zł netto/mc przy małej liczbie dokumentów; sprawozdanie finansowe 500–1 500 zł (inne źródła do 3 600 zł) rocznie — [Cenauslug](https://cenauslug.pl/poradniki/koszty-prowadzenia-pelnej-ksiegowosci-ile-zaplacisz-za-spolke-z-o-o), [Norman Finance](https://norman.finance/pl/blog/ile-kosztuje-prowadzenie-spolki-z-o-o)
- IP Box: 5% od kwalifikowanego dochodu z kwalifikowanych praw IP, dostępny w PIT (art. 30ca, tylko skala/liniowy, nie ryczałt) i w CIT (art. 24d); wymaga m.in. ewidencji B+R i wskaźnika nexus — [PIT art. 30ca](https://api.sejm.gov.pl/eli/acts/DU/2026/592/text.pdf), [CIT art. 24d](https://api.sejm.gov.pl/eli/acts/DU/2026/554/text.pdf)

### Inferences
- Tabela różnic (szczegóły w finalnej odpowiedzi): JDG ma najniższy koszt stały (ok. 3–6 tys. zł/rok księgowości), LLC ok. 9–12 tys. zł/rok (PL księgowa + USA ok. $600–800: $60 + RA $100–300 + CPA/5472), sp. z o.o. ok. 13–20 tys. zł/rok (księgowość + sprawozdanie).
- LLC nie poprawia dostępu do Stripe/Managed Payments: oba kraje (PL i US) są na liście; Stripe PL jest wystarczający.
- „Prestiż USA” i dostęp do Paddle/Lemon Squeezy/Stripe US nie wymaga LLC; Paddle i inni MoR działają z polskimi firmami (nie weryfikowano w tej sesji).
- Ustawowe pułapki estońskiego CIT w tym modelu: przychód „z praw autorskich” może obejmować sprzedaż dostępu do utworów audiowizualnych (do oceny doradcy), warunek zatrudnienia ≥ 3 osób wyklucza typową jednoosobową firmę po 3. roku.

### Gaps
- Nie pobrano cenników Stripe PL vs US (opłaty za transakcję, FX, wypłaty); ceny księgowych pochodzą z serwisów komercyjnych (cenauslug, freenance, norman), nie z cenników biur.
- Brak źródła pierwotnego na koszt CPA za Form 5472 i bank US.
- Nie ustalono (źródło pierwotne) podstawy składki zdrowotnej jedynego wspólnika sp. z o.o. (830,58 zł wg Norman Finance), ani czy przysługuje mu ulga na start/preferencyjny ZUS.
- Status Stripe Managed Payments (prywatny podgląd vs GA): wyszukiwarka wspominała „private preview”, strony docs.stripe.com otwarte w sesji tego nie mówiły; do sprawdzenia w panelu Stripe.
- Przejście z PKWiU 2015 na nową klasyfikację: ustawa o ryczałcie w tekście z 2025 r. odsyła do PKWiU 2015; nie sprawdzono, czy nowelizacje 2026 to zmieniły (Dz.U. 2026 poz. 779 dotyczy księgi przychodów i pełnomocnictw, nie stawek).

---

## 4. Rekomendacja i ilustracje netto dla trzech progów przychodu

### Takeaway
Dla polskiego rezydenta prowadzącego z Polski jednoosobową platformę wideo, JDG (ryczałt 15%, lub liniowy 19% jeśli koszty realne są wysokie) wygrywa nad LLC na każdym progu, a sp. z o.o. zaczyna mieć sens dopiero powyżej ok. $100–150 tys. i jeśli właściciel chce reinwestować zysk, odpowiedzialność ograniczać albo wejść w estoński CIT. LLC w Polsce nie ma przewagi podatkowej.

### Cited Findings
Założenia kalkulacji (ILUSTRACYJNE):
- Kurs 3,9 PLN/USD; przychód = przychód brutto 30 tys./100 tys./450 tys. USD (117 tys./390 tys./1 755 tys. zł).
- Koszty operacyjne (prowizje płatnicze, hosting, narzędzia, reklama) = 15% przychodu; nie są odliczalne na ryczałcie.
- Księgowość: JDG ryczałt 3 000 zł/rok, JDG skala/liniowy (KPiR) 4 800 zł, LLC 7 200 zł + USA 2 300 zł (ok. $600), sp. z o.o. 13 500 zł/rok.
- ZUS: pełny 21 459 zł/rok (preferencyjny 5 050 zł/rok w pierwszych 24 miesiącach po 6 miesiącach ulgi na start); składka zdrowotna wg progów 2026 z tabeli powyżej (ryczałt) lub 4,9%/9% dochodu po odliczeniu składek społecznych, min. 5 190 zł/rok.
- Sp. z o.o.: CIT 9% (przychód ≤ 2 mln euro), cała zysk wypłacana jako dywidenda, 19% PIT; właściciel płaci pełny ZUS i składkę zdrowotną 830,58 zł/mc (wg Norman Finance; niepotwierdzone); wariant estoński tylko jeśli spełnione warunki art. 28j.
- Pominięto: IP Box, ulgi, koszty wynagrodzeń, VAT (przyjęto, że VAT jest neutralny dla właściciela; Stripe jako MoR może zmieniać sposób ujęcia przychodu).

Formuły:
- Ryczałt: podatek = stawka × (przychód − składki społeczne − 0,5 × składki zdrowotne); netto = przychód − koszty operacyjne − księgowość − podatek − ZUS − zdrowotna.
- Liniowy: dochód = przychód − koszty − księgowość; zdrowotna = max(4,9% × (dochód − składki społeczne), 5 190 zł); podatek = 19% × (dochód − społeczne − min(zdrowotna, 14 100)) (+4% od nadwyżki ponad 1 mln zł).
- Skala: zdrowotna = max(9% × (dochód − społeczne), 5 190 zł); podatek = 12% × baza − 3 600 zł do 120 tys. zł, 32% powyżej (+4% daniny).
- Sp. z o.o.: CIT = 9% × (przychód − koszty − księgowość); dywidenda = zysk po CIT; PIT = 19% × dywidenda; netto = dywidenda − PIT − ZUS − zdrowotna.

Wyniki (zł rocznie, „w kieszeni” właściciela po podatkach, ZUS i kosztach; pełny ZUS):

| Przychód | JDG ryczałt 15% | JDG ryczałt 8,5% (jeśli się uda) | JDG liniowy 19% | JDG skala | LLC liniowy | LLC skala | sp. z o.o. CIT 9% + 19% | sp. z o.o. estoński 10% (jeśli warunki) |
|---|---|---|---|---|---|---|---|---|
| $30k (117 tys. zł) | 51 440 (44%) | 57 326 (49%) | 55 080 (47%) | 61 421 (53%) | 51 273 (44%) | 57 708 (49%) | 31 927 (27%) | 37 334 (32%) |
| $100k (390 tys. zł) | 235 164 (60%) | 258 537 (66%) | 234 967 (60%) | 207 692 (53%) | 231 390 (59%) | 204 919 (53%) | 202 971 (52%) | 222 974 (57%) |
| $450k (1 755 tys. zł) | 1 190 664 (68%) | 1 302 762 (74%) | 1 099 862 (63%) | 873 620 (50%) | 1 096 473 (62%) | 871 035 (50%) | 1 058 192 (60%) | 1 151 174 (66%) |

Z preferencyjnym ZUS (pierwsze 24 miesiące po ulgi na start; zysk ok. 14–17 tys. zł rocznie): np. $30k JDG skala 74 384 zł (64%), ryczałt 15% 65 388 zł (56%); $100k ryczałt 15% 249 112 zł (64%).

Skrypt kalkulacji (`calc.py`, wynik `calc_out.txt`) nie został zachowany w repo; wzory i założenia są wyżej, więc tabelę da się odtworzyć.

### Inferences
- $30k: JDG na skali wygrywa (kwota wolna 30 tys. zł, niski dochód po kosztach); ryczałt 15% przegrywa z liniowym przy kosztach 15%; ulga na start + preferencyjny ZUS daje +14 tys. zł rocznie; sp. z o.o. i LLC są tu nieopłacalne (koszty stałe).
- $100k: ryczałt 15% ≈ liniowy 19% (koszty 15%); ryczałt wygrywa jeśli rzeczywiste koszty < ok. 15% przychodu; jeśli stawka 8,5% jest możliwa (np. klasyfikacja jako edukacja), przewaga ok. 23 tys. zł rocznie. Sp. z o.o. na CIT 9% przegrywa z JDG o ok. 30 tys. zł rocznie, chyba że zysk zostaje w spółce.
- $450k: ryczałt 15% daje najwyższy netto (pozostawia 68%) i unika daniny solidarnościowej; liniowy 19% o ok. 90 tys. zł gorszy; estoński CIT w sp. z o.o. może dogonić (66%) tylko przy spełnieniu warunków (zatrudnienie, <50% przychodów z IP) i bez ryzyka kwalifikacji.
- Przy ryczałcie nie wolno odliczyć żadnych kosztów, więc jeśli platforma ma realne koszty (np. wynagrodzenia, reklama) > 25–30% przychodu, liniowy lub sp. z o.o. mogą się opłacać.
- Czynniki nieliczone: ryzyko, że stawka 15% nie zostanie utrzymana przy kontroli (np. 12,5%? nie istnieje dla usług; 17% dla wolnych zawodów nie dotyczy), a także ewentualne wejście Stripe Managed Payments (zmienia ujęcie przychodu i 3,5% prowizji).

### Gaps
- Brak potwierdzonych kosztów rzeczywistych platformy właściciela (hosting, R2, kodowanie) — zakładane 15%.
- Nie uwzględniono skutków niedokładnej klasyfikacji PKWiU (8,5% vs 15%) ani opinii klasyfikacyjnej GUS (nie sprawdzano procedury).
- Estoński CIT: nie przeliczono dokładnie mechanizmu ryczałtu od dochodu „do wypłaty” w niepełnym wypłaceniu i nie uwzględniono wymogu zatrudnienia.

---

## 5. Pytania do polskiego doradcy podatkowego

### Takeaway
Najważniejsze do rozstrzygnięcia: klasyfikacja PKWiU usługi (15% vs 8,5% vs 12%), sposób ujęcia przychodu przy Stripe MoR, czy zakładać LLC w ogóle, oraz ZUS/VAT dla ewentualnej LLC.

### Cited Findings
- Interpretacje indywidualne wiążą tylko wnioskodawcę, a organ może zmienić stanowisko; IRS nie jest związane polską interpretacją — [Rzeczpospolita (rp.pl)](https://pro.rp.pl/podatki/art18897241-fiskus-firma-w-usa-to-nie-zaklad-zaplaci-podatek-w-polsce)

### Inferences
Lista pytań (do przekazania doradcy):
1. Jaki kod PKWiU (2015, ewent. nowy) pasuje do sprzedaży dostępu do filmów (VOD/streaming 59.11.25.0 → 15%; edukacja dział 85 → 8,5%; subskrypcje, kursy online)? Czy warto wnioskować o opinię klasyfikacyjną GUS lub interpretację indywidualną (ryczałt, art. 12 ust. 1)?
2. Jak ujmować przychód przy Stripe Managed Payments (przychód brutto z VAT i prowizją 3,5% vs kwota należna po potrąceniu)? Jaki to rodzaj świadczenia dla Stripe (VAT B2B, miejsce świadczenia, VAT-UE)?
3. Czy właściciel nie będzie miał problemu z art. 8 ust. 2 ustawy o ryczałcie (usługi na rzecz byłego pracodawcy) i innymi przesłankami wyłączającymi ryczałt (wydatki, wybór formy do 20 lutego)?
4. Czy limit 240 000 zł zwolnienia VAT jest opłacalny wobec sprzedaży UE (OSS) i B2B do Stripe; czy rejestrować VAT-R od razu?
5. Jak traktować darowizny/napiwki (obecnie model niekomercyjny: tipy) w PIT i VAT — przychód, czy darowizna, i czy zmiana na sprzedaż dostępu wymaga zmiany rejestracji?
6. Jeśli LLC: czy właściciel musi odprowadzać ZUS i zdrowotną z tytułu LLC (interpretacja ZUS Lublin 2016 vs aktualna praktyka), jak prowadzić księgi LLC (KPiR?), jak rozliczać zaliczki (miesięczne/kwartalne), jaki amerykański CPA do Form 5472 i oceny ECI?
7. Jeśli sp. z o.o.: czy warunki estońskiego CIT są do spełnienia (≥ 3 etaty, przychody z praw autorskich < 50%), jaka podstawa składki zdrowotnej dla jedynego wspólnika, czy wynagrodzenie z kontraktu menedżerskiego jest opłacalne, i jaki wpływ ma zasada „ukrytych zysków”?
8. IP Box 5%: czy autorskie prawa do własnego oprogramowania platformy kwalifikują i jaki udział przychodu z filmów można do nich przypisać?
9. Rekomendowana kolejność: JDG z ulgą na start → przeniesienie do sp. z o.o. przy określonym obrocie? Koszty przekształcenia, sukcesja podatkowa, ZUS po przekształceniu.

### Gaps
- Nie sprawdzono konkretnych biur/doradców ani ich stawek za interpretację indywidualną (opłata KIS 40 zł od stanu faktycznego, wg wiedzy ogólnej, bez źródła w tej sesji).
