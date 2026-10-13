# B. Model wielotwórczy (UGC + napiwki przez Stripe Connect): obowiązki prawne platformy pawelperfect.com

**Stan na:** 2026-10-13. **Autor:** agent badawczy (research desk). **Charakter:** wyłącznie materiał roboczy. **To nie jest porada prawna ani podatkowa.**
**Oznaczenia:** **[FAKT: źródło]** to ustalenie zweryfikowane w źródle (głównie w tekście aktu lub u organu). **[WNIOSEK]** to moja interpretacja, której nie potwierdził organ ani sąd. **[LUKA]** oznacza, że czegoś nie udało się ustalić.
**Zakres:** dotyczy tylko zmian, które wynikają z przejścia z modelu „jeden twórca” na model „każdy może założyć kanał i dostawać napiwki”. Tematy z raportu z 2026-10-12 (VAT od płatnego dostępu, forma prawna, US sales tax, legalność napiwków dla jednego twórcy, C‑234/25, licencje okładek) powtarzam tylko tam, gdzie nowy model zmienia odpowiedź.

---

## Wnioski (TL;DR)

1. **Otwarcie rejestracji twórców zmienia status prawny serwisu.** Serwis staje się jednocześnie:
   - usługą hostingu i „platformą internetową” w rozumieniu DSA;
   - najpewniej „platformą udostępniania wideo” (VSP) w rozumieniu ustawy o radiofonii i telewizji (UoRiT), co oznacza obowiązek wpisu do wykazu KRRiT **co najmniej 14 dni przed startem**;
   - potencjalnie, ale raczej nie od pierwszego dnia, „dostawcą usług udostępniania treści online” (DUUTO) w rozumieniu art. 22¹–22⁸ prawa autorskiego.
2. **DSA a mikro/małe przedsiębiorstwo.** Duża część DSA nie dotyczy mikro- i małych platform (art. 15 ust. 2, art. 19, art. 29). Zostaje jednak twarde minimum, które obowiązuje każdego:
   - punkty kontaktowe (art. 11–12);
   - regulamin zgodny z art. 14;
   - mechanizm zgłoszeń (art. 16);
   - uzasadnienia decyzji moderacyjnych (art. 17), także przy blokowaniu wypłat napiwków;
   - zawiadamianie organów o podejrzeniu przestępstw zagrażających życiu lub bezpieczeństwu (art. 18);
   - przekazanie danych o liczbie użytkowników na żądanie (art. 24 ust. 3).
3. **Polska ustawa wdrażająca DSA już jest.** To ustawa z 4.09.2026 (Dz.U. 2026 poz. 1296), która wchodzi w życie **6.11.2026**. Podział kompetencji:
   - koordynator ds. usług cyfrowych: Prezes UKE;
   - **sprawy DSA dotyczące platform udostępniania wideo: Przewodniczący KRRiT**;
   - sekcja 4 DSA i interesy konsumentów: Prezes UOKiK.
   
   Kara wynosi do 6% światowego obrotu. Ustawa uchyla też dotychczasowy rozdział 3 u.ś.u.d.e. (wyłączenia odpowiedzialności), więc obowiązują bezpośrednio art. 4–6 DSA.
4. **UoRiT (rozdz. 6b, art. 47l–47w) nakłada konkretne obowiązki.** Trzeba mieć:
   - regulamin z treściami z art. 47r;
   - zakaz treści z art. 47o;
   - kontrolę rodzicielską i klasyfikację treści (art. 47p);
   - mechanizm zgłoszeń z odpowiedzią **w ciągu 48 h** (art. 47s);
   - procedurę wezwań, blokad i odwołań (art. 47t);
   - przechowywanie kopii usuniętych treści przez co najmniej 28 dni (art. 47v);
   - działania na rzecz edukacji medialnej (art. 47w).
   
   Kara wynosi do 20‑krotności przeciętnego wynagrodzenia (art. 53e). **Najprościej jest całkowicie zakazać pornografii i treści „18+”.** Wtedy nie trzeba budować weryfikacji wieku pod art. 47o.
5. **Prawo autorskie.** Mała, nowa platforma, która nie pobiera prowizji i nie ma reklam, ma mocny argument, że **nie jest DUUTO**, bo brakuje jej „znacznej liczby utworów” i „celu zarobkowego”. Wtedy korzysta ze zwykłego safe harbour hostingu (art. 6 DSA). Gdy zostanie DUUTO, przez pierwsze 3 lata przy obrocie poniżej 10 mln EUR obowiązuje reżim złagodzony (art. 22² ust. 2): staranne próby uzyskania licencji plus szybkie usuwanie treści po zgłoszeniu. Staydown wchodzi dopiero powyżej 5 mln średnich miesięcznych unikalnych odwiedzających.
6. **Treści terrorystyczne (TCO).** Organem właściwym jest **Szef ABW**. Nakaz usunięcia trzeba wykonać **w 1 godzinę**. Potrzebny jest punkt kontaktowy dostępny w praktyce 24/7.
7. **CSAM.** Platforma hostingowa nie ma ustawowego obowiązku aktywnego skanowania. Jest jednak art. 18 DSA. Do tego **osobisty** obowiązek denuncjacji z art. 240 k.k. obejmuje m.in. art. 197 § 3–4, 198 i 200 k.k., ale nie art. 202 k.k. Rekomendacje:
   - hash‑matching, np. Cloudflare CSAM Scanning Tool;
   - zgłoszenia do Dyżurnet.pl (NASK) i policji;
   - procedura zabezpieczania dowodów.
8. **Płatności.** Jeśli środki przechodzą wyłącznie przez Stripe (licencjonowaną instytucję), a platforma nigdy nie ma ich w posiadaniu, platforma co do zasady **nie świadczy usług płatniczych**. Model, w którym platforma jest MoR (destination charges bez `on_behalf_of`), jest jednak słabszy argumentacyjnie niż model z twórcą jako MoR (direct charges lub OBO). Wyłączenie „agenta handlowego” działa tylko wtedy, gdy platforma reprezentuje jedną stronę (EBA Q&A 2020_5355). Platforma **nie jest instytucją obowiązaną** w rozumieniu ustawy AML.
9. **VAT to największe ryzyko podatkowe nowego modelu.**
   - TSUE w sprawie Tolsma (C‑16/93) uznał, że dobrowolne datki bez ustalonej kwoty nie są wynagrodzeniem.
   - **KIS w 2025 r. uznała jednak donejty podczas streamów za wynagrodzenie za usługi** (0111‑KDIB3‑2.4012.227.2025.4.SR).
   - Jeśli napiwek zostanie uznany za wynagrodzenie za usługę elektroniczną twórcy, a platforma jest MoR, **art. 9a rozporządzenia 282/2011 (potwierdzony w Fenix C‑695/20) może uczynić platformę dostawcą całej kwoty brutto napiwku dla celów VAT**.
   - **Wniosek: model z twórcą jako MoR (direct charges) plus wyraźne wskazanie twórcy jako odbiorcy jest bezpieczniejszy**, choć nie eliminuje ryzyka z art. 9a. Przed startem warto rozważyć wniosek o interpretację indywidualną.
10. **DAC7.** Najpewniej brak „działalności podlegającej raportowaniu”: nagrane wcześniej materiały nie są „usługą świadczoną osobiście” (FAQ OECD), a napiwki niczego nie odblokowują. Trzeba to udokumentować w notatce. Zmieni się to, jeśli dojdą płatne prośby, shout‑outy lub treści na zamówienie.
11. **Małoletni.** Rekomendacja:
    - konto bez monetyzacji od **16 lat** (art. 8 RODO, Polska nie obniżyła progu);
    - **zakładanie kanału i odbieranie napiwków od 18 lat**.
    
    Uzasadnienie: Stripe Express i Custom co do zasady wymagają 18 lat (13–17 tylko z opiekunem i tylko w niektórych krajach), małoletni mają ograniczoną zdolność do czynności prawnych (art. 15–22 k.c.), a do tego dochodzi kwestia ryzyka i wizerunku.
12. **US LLC zarządzana z Polski.** Najpewniej i tak będzie uznana za mającą „jednostkę organizacyjną” w PL i UE (DSA, RODO, AVMSD). Nie usuwa to więc obowiązków unijnych, a dokłada amerykańskie: agenta DMCA, politykę wobec recydywistów, COPPA. W wariancie bez takiej jednostki trzeba wyznaczyć przedstawiciela z art. 13 DSA i art. 27 RODO.

---

## Lista obowiązków przed otwarciem rejestracji twórców

### A. MUST‑HAVE przed startem (dzień 0)

**Rejestracje i organizacja**
- [ ] **Wpis do wykazu VSP u Przewodniczącego KRRiT** najpóźniej 14 dni przed udostępnieniem funkcji „każdy może wgrać wideo” (art. 47n UoRiT). Zgłoszenie wymaga NIP i REGON, więc najpierw trzeba wybrać formę prawną.
- [ ] Na stronie, w łatwo dostępnym i stałym miejscu, informacje z art. 47m UoRiT: nazwa, dostawca, adres, kontakt, wspólnicy przy spółce, wskazanie KRRiT jako organu właściwego.
- [ ] **Punkt kontaktowy dla organów** (art. 11 DSA) i **punkt kontaktowy dla użytkowników** (art. 12 DSA). Może to być jeden adres e‑mail i formularz. Trzeba podać języki komunikacji (polski i angielski). Kontakt użytkownika nie może opierać się wyłącznie na automatach.
- [ ] **Punkt kontaktowy TCO**, czyli adres e‑mail monitorowany tak, żeby dało się zareagować na nakaz Szefa ABW w ciągu 1 h. Ten sam kanał może pełnić rolę kontaktu z art. 11 DSA.
- [ ] Wariant US LLC bez polskiej lub unijnej jednostki: przedstawiciel prawny z art. 13 DSA (pisemne umocowanie, zgłoszenie danych do koordynatora) oraz przedstawiciel z art. 27 RODO.

**Dokumenty**
- [ ] **Regulamin (ToS)** zgodny z art. 14 DSA oraz art. 47r UoRiT. Szczegóły w sekcji 13.
- [ ] **Regulamin twórcy (Creator Terms)** z wymogiem 18+ dla monetyzacji, oświadczeniami o prawach do treści, zasadami napiwków, prowizji i blokad oraz informacją o obowiązkach podatkowych twórcy.
- [ ] **Zasady społeczności**: zakaz treści z art. 47o UoRiT, **zakaz pornografii i nagości seksualnej**, zakaz treści terrorystycznych, CSAM i mowy nienawiści, zasady oznaczania reklam i lokowania produktu.
- [ ] **Polityka zgłoszeń i praw autorskich**: formularz z art. 16 DSA, ścieżka dla uprawnionych z praw autorskich, procedura odwołań (art. 22⁵ pr. aut., art. 47t UoRiT).
- [ ] **Polityka prywatności** obejmująca twórców, napiwkodawców i Stripe, rejestr czynności przetwarzania oraz DPIA dla moderacji i (jeśli będzie) weryfikacji wieku.
- [ ] **Warunki napiwków**: kto jest stroną transakcji, dobrowolność, brak świadczenia wzajemnego, brak zwrotów poza wyjątkami, informacja z art. 12a u.p.k.

**Procesy i narzędzia**
- [ ] Formularz zgłoszeń przy każdym filmie i kanale (art. 16 DSA, art. 47s UoRiT). Musi wysyłać potwierdzenie przyjęcia, a decyzja musi zapaść w ciągu **48 h**.
- [ ] Szablony **uzasadnień** (art. 17 DSA) dla usunięcia, ograniczenia widoczności, zawieszenia konta i **zawieszenia lub wstrzymania wypłat napiwków**.
- [ ] Mechanizm wezwania użytkownika do usunięcia treści, blokady wgrywania (do 3 miesięcy albo bezterminowo) i informowania o skardze do KRRiT (art. 47t UoRiT).
- [ ] Odwołania od decyzji: dla treści objętych prawem autorskim art. 22⁵ wymaga elektronicznej, bezpłatnej skargi rozpatrywanej z udziałem człowieka. Dobrowolnie warto wdrożyć też system wewnętrznych skarg jak w art. 20 DSA.
- [ ] Przechowywanie kopii usuniętych treści i przekazów handlowych przez **co najmniej 28 dni** (art. 47v UoRiT).
- [ ] Procedura **art. 18 DSA i art. 240 k.k.**: kto, kiedy i jak zawiadamia policję lub prokuraturę.
- [ ] Hash‑matching CSAM (np. Cloudflare CSAM Scanning Tool, jeśli wideo idzie przez cache Cloudflare) oraz procedura zgłoszeń do Dyżurnet.pl i policji.
- [ ] Narzędzia dla twórcy: **oznaczanie treści według kategorii wiekowych** i **oznaczanie przekazów handlowych** (art. 47p ust. 1, art. 47q UoRiT). Kontrola rodzicielska (art. 47p ust. 1) może w praktyce polegać na tym, że nie ma treści 18+, a jest tryb „ukryj treści 16+”.
- [ ] Stripe Connect: wybór typu konta (rekomendacja: Express lub v2 z minimum 18 lat), typu obciążenia (rekomendacja: direct charges albo destination z `on_behalf_of`, patrz sekcje 6–7) i lista krajów twórców.
- [ ] **Notatka o kwalifikacji podatkowej**: VAT (tips a art. 9a), DAC7 (brak działalności podlegającej raportowaniu), PIT (art. 42a). Najlepiej zatwierdzona przez doradcę.
- [ ] Notatka o statusie mikro/małego przedsiębiorcy (zalecenie 2003/361/WE, z uwzględnieniem przedsiębiorstw powiązanych), bo od niej zależą zwolnienia w DSA.

### B. Wkrótce po starcie (w pierwszych miesiącach)
- [ ] Rejestr decyzji moderacyjnych i zgłoszeń. Przyda się przy kontroli UKE lub KRRiT i przy utracie statusu mikro/małego.
- [ ] Wewnętrzny system skarg (art. 20 DSA): skargi przez 6 miesięcy od decyzji. Nie jest wymagany od mikro/małych, ale jest tani i ułatwia pracę.
- [ ] Polityka wobec nadużyć (art. 23 DSA, dobrowolnie): zawieszanie kont, które często publikują treści oczywiście nielegalne, i osób, które nagminnie składają bezzasadne zgłoszenia.
- [ ] Próby licencji „best efforts” u OZZ (ZAiKS, STOART, ZPAV, SAWP, ZAPA) z udokumentowaną korespondencją. Ma to znaczenie dopiero, gdy platforma zacznie spełniać definicję DUUTO.
- [ ] Mediacja przy sporach o zgłoszenia (art. 47u UoRiT): wpisanie tej możliwości do regulaminu.
- [ ] Analiza statusu VOD dla kanału właściciela i informacja dla twórców o ich możliwym obowiązku zgłoszenia VOD do KRRiT (sekcja 2).
- [ ] Monitorowanie projektu ustawy o ochronie małoletnich przed pornografią (druk 2697) i drugiej ustawy wdrażającej DSA (nakazy blokowania).

### C. Progi skali
| Próg | Co się włącza |
|---|---|
| Utrata statusu mikro/małego (≥ 50 osób lub > 10 mln EUR obrotu albo sumy bilansowej, łącznie z podmiotami powiązanymi) + 12 miesięcy | Pełna sekcja 3 DSA: art. 20–28 (skargi, ODS, zaufane podmioty sygnalizujące, dark patterns, reklamy, systemy rekomendacji, ochrona małoletnich), art. 24 ust. 2 (publikacja MAU co 6 mies.), art. 24 ust. 5 (**Transparency Database**), art. 15 (roczne raporty przejrzystości). Sekcja 4 (art. 30–32, identyfikowalność przedsiębiorców), jeśli jest się marketplace'em |
| Platforma zaczyna spełniać definicję DUUTO (znaczna liczba utworów i cel zarobkowy, np. prowizja lub reklamy) | Art. 22¹–22⁸ pr. aut.: odpowiedzialność bezpośrednia, best efforts licensing, notice‑and‑takedown, skargi |
| DUUTO dłużej niż 3 lata w UE albo obrót > 10 mln EUR | Pełny art. 22² ust. 1: także staydown (należyte starania, by uniemożliwić dostęp do zgłoszonych utworów, oraz zapobieganie ponownemu wgraniu) |
| DUUTO młodsze niż 3 lata, ale > 5 mln średnich miesięcznych unikalnych odwiedzających | Dodatkowo staydown (art. 22² ust. 2) |
| ≥ 45 mln MAU w UE | VLOP (nierealne) |
| Wprowadzenie płatnych próśb, shout‑outów lub treści na zamówienie | DAC7: najpewniej „usługa świadczona osobiście”, raport do 31 stycznia |
| Twórca (osoba fizyczna z PL) przekracza 10 813,50 zł przychodu w kwartale | Jego obowiązek: CEIDG w 7 dni. Platforma może tylko informować |

---

## 1. DSA (rozporządzenie 2022/2065)

### Ustalenia z cytowanych źródeł

**Kwalifikacja**
- **[FAKT: DSA art. 3 lit. g pkt iii i lit. i]**
  - Usługa hostingu polega na przechowywaniu informacji dostarczonych przez odbiorcę na jego żądanie.
  - „Platforma internetowa” to usługa hostingu, która na żądanie odbiorcy przechowuje i **rozpowszechnia publicznie** informacje, chyba że to drobna funkcja poboczna.
  - Serwis, na którym każdy publikuje filmy dostępne publicznie, jest platformą internetową.

**Obowiązki wszystkich dostawców usług pośrednich**
- **[FAKT: DSA art. 11]** Pojedynczy punkt kontaktowy dla organów państw członkowskich, Komisji i Rady. Informacje muszą być publiczne, łatwo dostępne i aktualne, ze wskazaniem języków.
- **[FAKT: DSA art. 12]** Pojedynczy punkt kontaktowy dla odbiorców usług, umożliwiający szybką, bezpośrednią i przyjazną komunikację elektroniczną. Odbiorca może wybrać środek komunikacji, który **nie opiera się wyłącznie na zautomatyzowanych narzędziach**.
- **[FAKT: DSA art. 13]** Dostawca **bez jednostki organizacyjnej w UE**, który oferuje usługi w UE, wyznacza na piśmie przedstawiciela prawnego w jednym z państw, w których oferuje usługi. Przedstawiciel może ponosić odpowiedzialność za naruszenia. Jego dane trzeba zgłosić koordynatorowi.
- **[FAKT: DSA art. 14]** Regulamin musi zawierać informacje o ograniczeniach nakładanych na treści, w tym o polityce, procedurach, narzędziach moderacji (także algorytmicznych i weryfikacji przez człowieka) oraz o zasadach wewnętrznego systemu skarg.
  - Język musi być jasny, prosty, zrozumiały, przyjazny i jednoznaczny, a dokument dostępny w formacie nadającym się do odczytu maszynowego.
  - O istotnych zmianach trzeba informować.
  - Usługi skierowane przede wszystkim do małoletnich lub głównie przez nich używane wymagają wyjaśnień zrozumiałych dla małoletnich (ust. 3).
  - Ograniczenia trzeba stosować z należytą starannością, obiektywnie i proporcjonalnie, z poszanowaniem praw podstawowych (ust. 4).
- **[FAKT: DSA art. 15 ust. 2]** Obowiązek corocznych raportów przejrzystości **nie dotyczy mikro- i małych przedsiębiorstw** w rozumieniu zalecenia 2003/361/WE, o ile nie są bardzo dużymi platformami.

**Obowiązki wszystkich dostawców hostingu (bez zwolnienia dla mikro i małych)**
- **[FAKT: DSA art. 16]** Mechanizm zgłaszania nielegalnych treści: łatwo dostępny, przyjazny, wyłącznie elektroniczny.
  - Zgłoszenie zawiera: uzasadnienie, dokładną lokalizację (URL), imię, nazwisko i e‑mail zgłaszającego (z wyjątkiem zgłoszeń dotyczących przestępstw z art. 3–7 dyrektywy 2011/93/UE, czyli wykorzystywania seksualnego dzieci) oraz oświadczenie o dobrej wierze.
  - Platforma potwierdza otrzymanie zgłoszenia i decyduje terminowo, z należytą starannością, w sposób niearbitralny i obiektywny. Informuje, czy użyła narzędzi zautomatyzowanych.
  - Kompletne zgłoszenie daje „faktyczną wiedzę” w rozumieniu art. 6, co oznacza utratę safe harbour, jeśli platforma nie zareaguje.
- **[FAKT: DSA art. 17]** Jasne i konkretne uzasadnienie dla każdego dotkniętego odbiorcy przy:
  - (a) ograniczeniu widoczności (usunięcie, zablokowanie, obniżenie pozycji);
  - **(b) zawieszeniu, zakończeniu lub innym ograniczeniu płatności pieniężnych**;
  - (c) zawieszeniu lub zakończeniu świadczenia usługi;
  - (d) zawieszeniu lub zamknięciu konta.
  
  Uzasadnienie zawiera m.in.: fakty, informację o automatyzacji, podstawę prawną albo podstawę w regulaminie oraz dostępne środki odwoławcze.
- **[FAKT: DSA art. 18]** Hosting, który poweźmie informację o przestępstwie stanowiącym zagrożenie dla życia lub bezpieczeństwa osób (popełnionym, popełnianym lub prawdopodobnym), niezwłocznie informuje organy ścigania danego państwa (gdy państwa nie da się ustalić, organy państwa siedziby lub przedstawiciela albo Europol).

**Platformy internetowe a mikro i małe przedsiębiorstwa**
- **[FAKT: DSA art. 19 ust. 1–2]** Sekcja 3 (art. 20–28) **nie ma zastosowania** do platform będących mikro- lub małymi przedsiębiorstwami, **z wyjątkiem art. 24 ust. 3**. Zwolnienie działa jeszcze przez 12 miesięcy po utracie statusu (nie dotyczy VLOP). Wyłączone są więc:
  - art. 20 (wewnętrzny system skarg);
  - art. 21 (pozasądowe rozstrzyganie sporów);
  - art. 22 (zaufane podmioty sygnalizujące);
  - art. 23 (środki przeciw nadużyciom);
  - art. 24 ust. 1, 2 i 5 (raporty, publikacja MAU, **Transparency Database**);
  - art. 25 (dark patterns);
  - art. 26 (reklamy);
  - art. 27 (systemy rekomendacji);
  - art. 28 (ochrona małoletnich).
- **[FAKT: Komisja, nota prawna DSA Transparency Database]** Art. 24 ust. 5 nie ma zastosowania do platform będących mikro- lub małymi przedsiębiorstwami, a baza nie zbiera ich uzasadnień.
- **[FAKT: DSA art. 24 ust. 3]** Na żądanie koordynatora lub Komisji platforma przekazuje informacje o średniej miesięcznej liczbie aktywnych odbiorców. **Dotyczy to także mikro i małych.**
- **[FAKT: DSA art. 29]** Sekcja 4 (art. 30–32: identyfikowalność przedsiębiorców, zgodność już na etapie projektowania, prawo do informacji) nie dotyczy mikro- i małych przedsiębiorstw (z tym samym 12‑miesięcznym buforem).
- **[FAKT: Komisja, wytyczne do art. 28 DSA z 14.07.2025, za Taylor Wessing i CMS]** Wytyczne w sprawie ochrony małoletnich nie są wiążące i wyłączają mikro- oraz małe przedsiębiorstwa.

**Wdrożenie w Polsce**
- **[FAKT: Dz.U. 2026 poz. 1296]** Ustawa z 4 września 2026 r. o zmianie ustawy o świadczeniu usług drogą elektroniczną oraz niektórych innych ustaw. Ogłoszona 6.10.2026, wchodzi w życie po 30 dniach, czyli **6.11.2026** (art. 8; ELI podaje datę 2026‑11‑06). Najważniejsze przepisy:
  - art. 15a ust. 1:
    - Prezes UOKiK odpowiada za sekcję 4 DSA i inne naruszenia DSA godzące w interesy konsumentów;
    - **Przewodniczący KRRiT odpowiada za sprawy platform udostępniania wideo** (z wyłączeniem sekcji 4);
    - Prezes UKE odpowiada za pozostałe sprawy;
  - art. 15b: koordynatorem jest Prezes UKE;
  - art. 22zh: skargi użytkowników do koordynatora;
  - rozdz. 4e: roszczenia cywilne z art. 54 DSA rozpatruje sąd okręgowy;
  - art. 22zzn: kary. Za naruszenie m.in. art. 11, 12, 13, 14, 15 ust. 1, 16, 17, 18, 20–28 i 30–32 DSA kara wynosi **do 6% światowego obrotu**. Za nieudzielenie informacji: do 1%. Kary okresowe: do 5% średniego dziennego obrotu;
  - **rozdział 3 u.ś.u.d.e. (dawne art. 12–15, wyłączenia odpowiedzialności) został uchylony**, bo w ich miejsce wchodzą art. 4–6 DSA;
  - zmieniony art. 47t ust. 8 UoRiT: w zakresie rozdz. 6b UoRiT **art. 6 DSA (safe harbour hostingu) nie ma zastosowania**;
  - zmieniony art. 22¹ ust. 3 pr. aut.: art. 6 DSA nie ma zastosowania do DUUTO.
- **[FAKT: wirtualnemedia.pl, ZAPA, wnp.pl]** Wcześniejszą wersję ustawy prezydent zawetował 9.01.2026. Druga ustawa (nakazy blokowania nielegalnych treści) jest nadal w Sejmie.

### Wnioski
- **[WNIOSEK]** Na starcie serwis będzie mikroprzedsiębiorstwem. Uwaga na **przedsiębiorstwa powiązane** (zalecenie 2003/361): jeśli właściciel kontroluje inne firmy, ich dane się sumuje.
- **[WNIOSEK]** Wymóg uzasadnień z art. 17 obejmuje także blokowanie napiwków, np. wyłączenie przycisku „Napiwek” na kanale albo wstrzymanie transferów Stripe do twórcy. Trzeba mieć na to szablon uzasadnienia.
- **[WNIOSEK]** Art. 30–32 i „przedsiębiorcy”:
  - Platforma umożliwiająca napiwki prawdopodobnie **nie jest** platformą „umożliwiającą konsumentom zawieranie umów na odległość z przedsiębiorcami”. Napiwek to nieodpłatne przysporzenie, a nie zakup, a większość twórców nie będzie przedsiębiorcami (test z C‑105/17 Kamenova).
  - Kwestię zamyka i tak art. 29: platforma mikro lub mała jest zwolniona.
  - Przy prowizji i twórcach, którzy prowadzą działalność gospodarczą, sytuacja może wyglądać inaczej. To temat na przyszłość.
- **[WNIOSEK]** Mimo zwolnienia z art. 25 (dark patterns) przy przycisku napiwku obowiązują zakazy z dyrektywy o nieuczciwych praktykach handlowych (UCPD). Nie wolno wywierać presji ani udawać, że napiwek coś odblokowuje.

### Luki
- **[LUKA]** Nie analizowałem całego tekstu ustawy z 4.09.2026 pod kątem dodatkowych obowiązków krajowych, poza karami i właściwością organów, np. wymogów językowych. W przejrzanych fragmentach takich obowiązków nie znalazłem.
- **[LUKA]** Nie sprawdziłem, czy UKE wydał już formularze lub procedurę zgłaszania punktów kontaktowych i przedstawicieli.

---

## 2. Ustawa o radiofonii i telewizji: platforma udostępniania wideo (VSP) i VOD

### Ustalenia z cytowanych źródeł
- **[FAKT: UoRiT art. 4 pkt 22a–22c, za standardyprawa.pl]** Ustawa definiuje „platformę udostępniania wideo”, „wideo stworzone przez użytkownika” i „dostawcę platformy”. Definicja wdraża art. 1 ust. 1 lit. aa AVMSD:
  - główny cel usługi, jej rozdzielna część lub zasadnicza funkcja to udostępnianie publiczności audycji lub wideo tworzonych przez użytkowników, za które dostawca nie ponosi odpowiedzialności redakcyjnej;
  - dostawca decyduje o organizacji treści, także algorytmicznie.
- **[FAKT: UoRiT art. 1a ust. 5–6]** Dostawcę VSP uważa się za ustanowionego w PL, jeśli ma tu siedzibę. Dostawca bez siedziby w PL też podlega polskiej jurysdykcji, jeśli ma w Polsce podmiot dominujący, oddział, przedstawicielstwo albo podmiot zależny (chyba że ma odpowiednie powiązania z innym państwem UE).
- **[FAKT: rozdz. 6b UoRiT, art. 47l–47w, za arslege.pl]**
  - **art. 47m**: obowiązki informacyjne na stronie (nazwa, dane dostawcy, adres, kontakt, struktura właścicielska, wskazanie KRRiT);
  - **art. 47n**: zgłoszenie do wykazu prowadzonego przez Przewodniczącego KRRiT **„nie później niż 14 dni przed dniem rozpoczęcia”** dostarczania platformy, w systemie teleinformatycznym. Zgłoszenie zawiera dane dostawcy, NIP, REGON, wskazanie platformy i państw odbioru. Wpis następuje postanowieniem, a zmiany trzeba zgłaszać w 14 dni. Wzór określa rozporządzenie KRRiT z 21.10.2021 (Dz.U. 2021 poz. 1970);
  - **art. 47o**: zakaz treści szkodliwych dla małoletnich (w tym pornografii i nieuzasadnionej przemocy) **„bez stosowania skutecznych zabezpieczeń technicznych”**, nawoływania do przemocy i nienawiści, treści terrorystycznych, pornografii dziecięcej itp. Dostawca stosuje środki przeciwdziałania;
  - **art. 47p**: skuteczne zabezpieczenia techniczne, w tym **„systemy kontroli rodzicielskiej”**, możliwość klasyfikowania treści przez użytkowników, kategorie wiekowe i symbole graficzne określone przez KRRiT. **Danych małoletnich zebranych w tym celu nie wolno wykorzystywać komercyjnie** (marketing bezpośredni, profilowanie, reklama behawioralna);
  - **art. 47q**: przekazy handlowe, które dostawca sam umieszcza, promuje lub sprzedaje, podlegają odpowiednio art. 16, 16b, 16c, 17, 17a (zasady reklamy i sponsorowania);
  - **art. 47r**: regulamin musi określać m.in. klasyfikację i oznaczanie treści, zasady przekazów handlowych, procedurę i terminy rozpatrywania zgłoszeń, kryteria oceny, tryb odwołań oraz przetwarzanie danych;
  - **art. 47s**: przejrzyste i przyjazne mechanizmy zgłaszania treści naruszających art. 47o. Odpowiedź **„niezwłocznie, lecz nie później niż w terminie 48 godzin”**;
  - **art. 47t**: po wezwaniu użytkownika i bezskutecznym upływie terminu dostawca uniemożliwia dostęp do treści. Przy uporczywych naruszeniach może zablokować wgrywanie na **do 3 miesięcy**, a przy treściach z art. 47o ust. 1 pkt 3 **bezterminowo**. Decyzja wymaga uzasadnienia, użytkownik może złożyć skargę do KRRiT, a Przewodniczący KRRiT może nakazać blokadę albo przywrócenie;
  - **art. 47u**: mediacja;
  - **art. 47v**: przechowywanie kopii usuniętych treści i przekazów handlowych **przez co najmniej 28 dni** i udostępnianie ich KRRiT;
  - **art. 47w**: edukacja medialna, czyli informowanie o prawach i obowiązkach.
- **[FAKT: UoRiT art. 53e, za lexlege/arslege]** Kara za naruszenie m.in. art. 47m ust. 1–6, 47n ust. 1–2, 47p ust. 1, 47q ust. 1, 47r, 47s ust. 1–2 i 47w wynosi **do 20‑krotności przeciętnego miesięcznego wynagrodzenia** w sektorze przedsiębiorstw. Nakłada się ją po bezskutecznym wezwaniu z 14‑dniowym terminem i można ją ponowić po 30 dniach.
- **[FAKT: Dz.U. 2026 poz. 1296, art. 3]** Przewodniczący KRRiT jest też organem właściwym z art. 49 ust. 1 DSA dla platform VSP (nowy art. 10a UoRiT).

**VOD a pojedynczy twórcy**
- **[FAKT: UoRiT art. 4 pkt 6a]** Audiowizualna usługa medialna na żądanie to usługa medialna świadczona **w ramach działalności gospodarczej**, oparta na katalogu ustalonym przez dostawcę.
- **[FAKT: KRRiT, informator dla influencerów z 26.02.2026]** Twórca jest dostawcą VOD, jeśli:
  - prowadzi działalność gospodarczą;
  - udostępnia publicznie materiały wideo do oglądania w dowolnym momencie;
  - **„tworzy i porządkuje katalog treści”** (kanał, serie, playlisty).
  
  Wyłączeni są twórcy, którzy publikują prywatnie, hobbystycznie lub nieregularnie, oraz działalność nierejestrowana poniżej progów.
- **[FAKT: KRRiT, „Pytania i odpowiedzi”]** O obowiązku decyduje charakter działalności, a nie liczba obserwujących. Zgłoszenie jest bezpłatne, a za jego brak grozi postępowanie i kara.

### Wnioski
- **[WNIOSEK]** Po otwarciu uploadu dla wszystkich serwis spełnia definicję VSP: głównym celem jest udostępnianie wideo tworzonego przez użytkowników, bez odpowiedzialności redakcyjnej, z organizacją przez dostawcę (kanały, listy, rekomendacje).
  - Ustawa nie przewiduje progu de minimis.
  - AVMSD wymaga jednak, by była to „usługa” w rozumieniu art. 56–57 TFUE, czyli zwykle świadczona za wynagrodzeniem. Przy napiwkach i ewentualnej prowizji ten element raczej jest spełniony.
  - **Rekomendacja: zgłosić się do wykazu, najlepiej ≥ 14 dni przed startem.**
- **[WNIOSEK]** Najmniej kosztowny sposób spełnienia art. 47o i 47p:
  - zakazać w regulaminie pornografii i treści przeznaczonych wyłącznie dla dorosłych;
  - dać twórcom pole „kategoria wiekowa”, np. „bez ograniczeń” / 12+ / 16+;
  - zapewnić tryb rodzicielski lub filtr dla zalogowanych kont oraz ukrywanie treści 16+ przed niezalogowanymi albo przed użytkownikami, którzy zadeklarowali wiek poniżej 16 lat.
  
  Rozporządzenie KRRiT o kategoriach wiekowych należy sprawdzić **[LUKA]**.
- **[WNIOSEK]** Uchylenie safe harbour w zakresie rozdz. 6b UoRiT (art. 47t ust. 8) zwiększa wagę 48‑godzinnego terminu z art. 47s.
- **[WNIOSEK] Status VOD twórców na pawelperfect.com:**
  - KRRiT stosuje te same kryteria niezależnie od platformy, więc twórca z PL, który prowadzi działalność gospodarczą i utrzymuje uporządkowany kanał, może mieć **własny** obowiązek wpisu do wykazu VOD.
  - Platforma nie ma obowiązku tego egzekwować, ale warto poinformować o tym w Creator Terms.
  - **Kanał właściciela** po rejestracji JDG lub spółki prawdopodobnie też jest VOD, bo jest katalog i działalność gospodarcza. Ten punkt nie wynika jednak z poprzedniego raportu, więc trzeba go zweryfikować.
- **[WNIOSEK] US LLC zarządzana z Polski:**
  - Według art. 1a UoRiT i art. 28a AVMSD liczy się siedziba lub obecność podmiotu powiązanego.
  - LLC bez polskiego oddziału formalnie mogłaby wypaść poza jurysdykcję VSP któregokolwiek państwa UE.
  - Faktyczne zarządzanie z Polski i polski rezydent jako jedyny członek tworzą jednak realne ryzyko, że organ uzna polską „jednostkę” (np. stałe miejsce prowadzenia działalności).
  - Nie należy traktować LLC jako sposobu na uniknięcie tych obowiązków.

### Luki
- **[LUKA]** Nie zweryfikowałem treści aktualnych rozporządzeń KRRiT wydanych na podstawie art. 47p ust. 2–3, 47q ust. 2 i 47s ust. 3 (czy zostały wydane i co zawierają).
- **[LUKA]** Nie sprawdziłem, czy wykaz VSP prowadzony przez KRRiT obejmuje obecnie małe polskie platformy (praktyka organu).

---

## 3. Prawo autorskie: art. 17 dyrektywy DSM i art. 22¹–22⁸ pr. aut.

### Ustalenia z cytowanych źródeł
- **[FAKT: KPMG, Legal Alert; legeartis]** Nowelizacja wdrażająca dyrektywę DSM obowiązuje od **20.09.2024**. DUUTO zdefiniowano w art. 6 ust. 1 (według druku 406 pkt 25; numer do potwierdzenia w tekście jednolitym, Dz.U. 2025 poz. 24) jako usługodawcę, którego głównym celem jest przechowywanie i udostępnianie publiczne **„znacznej liczby utworów”** zamieszczanych przez użytkowników, **organizowanych i promowanych w celach zarobkowych**. Definicja wyłącza m.in. niekomercyjne encyklopedie, repozytoria, platformy open source, internetowe platformy handlowe i chmury na użytek własny.
- **[FAKT: arslege.pl, art. 22¹–22⁸]**
  - **art. 22¹**: udostępnienie utworu wgranego przez użytkownika jest **publicznym udostępnieniem przez dostawcę**. Zgoda (licencja) dostawcy obejmuje użytkowników działających niezarobkowo lub bez znacznych przychodów. Wyłączenie hostingowe nie ma zastosowania (po nowelizacji z 2026 r.: nie stosuje się art. 6 DSA);
  - **art. 22² ust. 1**: dostawca odpowiada, chyba że wykaże:
    - (1) należyte starania o uzyskanie zgody;
    - (2) należyte starania, by uniemożliwić dostęp do utworów, o których uprawniony przekazał istotne informacje;
    - (3) niezwłoczne zablokowanie lub usunięcie po należycie uzasadnionym żądaniu oraz starania, by zapobiec ponownemu wgraniu;
  - **art. 22² ust. 2 (nowy dostawca)**: usługa dostępna w UE lub EOG **krócej niż 3 lata** i roczny obrót **nie wyższy niż 10 mln EUR** (liczony według zalecenia 2003/361). Wystarczą wtedy należyte starania o zgodę i niezwłoczne działanie po zgłoszeniu. **Gdy średnia miesięczna liczba unikalnych odwiedzających w poprzednim roku przekracza 5 mln**, trzeba też wykazać starania z pkt 2 (blokowanie zgłoszonych utworów);
  - **art. 22² ust. 3**: proporcjonalność (rodzaj i skala usługi, widownia, rodzaj utworów, dostępność i koszt środków);
  - **art. 22³**: współpraca z uprawnionymi nie może blokować legalnych treści (dozwolony użytek). Użytkownika trzeba niezwłocznie powiadomić o blokadzie;
  - **art. 22⁴**: informacje dla uprawnionych o praktykach i wykorzystaniu;
  - **art. 22⁵**: **elektroniczna, bezpłatna skarga** użytkownika. Rozstrzygnięcie zapada „bez zbędnej zwłoki”, **nie może być automatyczne przy odrzuceniu**, a odmowa wymaga uzasadnienia faktycznego i prawnego. Przy uwzględnieniu skargi treść trzeba niezwłocznie przywrócić;
  - **art. 22⁶**: brak identyfikacji użytkowników ponad potrzebę. Regulamin informuje o dozwolonym użytku;
  - **art. 22⁷**: brak ogólnego obowiązku monitorowania;
  - **art. 22⁸**: wyłączenie dla serwisów nastawionych na naruszenia.
- **[FAKT: Komisja, konsultacje 2024 dot. art. 17 ust. 6]** Reżim złagodzony obejmuje usługi dostępne w UE krócej niż 3 lata i z obrotem poniżej 10 mln EUR.

### Wnioski
- **[WNIOSEK] Czy pawelperfect.com będzie DUUTO?**
  - Na starcie raczej **nie**: nie ma „znacznej liczby utworów”, a przy prowizji 0% i braku reklam brakuje „organizowania i promowania w celach zarobkowych”.
  - Wtedy działa safe harbour z art. 6 DSA (hosting): odpowiedzialność dopiero po uzyskaniu wiedzy, np. ze zgłoszenia z art. 16 DSA.
  - Wprowadzenie prowizji od napiwków, reklam albo subskrypcji i wzrost biblioteki może przesunąć serwis do reżimu DUUTO.
- **[WNIOSEK] Minimalny zgodny setup już na starcie**, który działa w obu reżimach:
  1. formularz zgłoszeń naruszeń praw autorskich (pola jak w art. 16 DSA plus oświadczenie o posiadaniu praw);
  2. szybkie usuwanie (cel: 24–48 h, co pokrywa się z 48 h z UoRiT);
  3. powiadomienie twórcy z uzasadnieniem (art. 17 DSA, art. 22³ ust. 2);
  4. bezpłatna skarga rozpatrywana przez człowieka (art. 22⁵);
  5. polityka wobec powtarzających się naruszeń (3 ostrzeżenia, potem zamknięcie kanału), wymagana również w US przez DMCA §512(i);
  6. rejestr zgłoszeń;
  7. udokumentowana próba kontaktu z OZZ (ZAiKS dla muzyki, ZAPA dla audiowizualnych, STOART/ZPAV/SAWP dla wykonań i fonogramów) w sprawie licencji dla UGC, gdy platforma zbliży się do statusu DUUTO;
  8. opcjonalnie: lista hashy filmów zgłoszonych i usuniętych, by blokować identyczne ponowne wgrania (tani „staydown light”). **Bez automatycznego odrzucania skarg.**
- **[WNIOSEK]** Rozsądną praktyką jest zakazać w Creator Terms wgrywania muzyki komercyjnej bez licencji i wymagać od twórców oświadczenia o prawach.

### Luki
- **[LUKA]** Nie potwierdziłem numeru pozycji Dz.U. ustawy nowelizującej z 2024 r. (według mojej wiedzy to ustawa z 26.07.2024, Dz.U. 2024 poz. 1254) ani numeru punktu definicji w art. 6 ust. 1.
- **[LUKA]** Nie sprawdziłem, czy OZZ mają standardowe oferty licencyjne dla małych platform UGC.

---

## 4. Treści terrorystyczne (TCO, rozporządzenie 2021/784)

### Ustalenia z cytowanych źródeł
- **[FAKT: rozporządzenie 2021/784, art. 3]** Dostawca hostingu usuwa treść terrorystyczną albo uniemożliwia do niej dostęp we wszystkich państwach członkowskich **jak najszybciej, a w każdym razie w ciągu 1 godziny** od otrzymania nakazu.
- **[FAKT: rozporządzenie 2021/784, art. 15]** Hosting wyznacza lub ustanawia **punkt kontaktowy** do odbioru nakazów, z informacją publicznie dostępną.
- **[FAKT: rozporządzenie 2021/784, art. 5]** Obowiązki „środków szczególnych” i raportów przejrzystości dotyczą dostawców, których organ uznał za **narażonych** na treści terrorystyczne (art. 5 ust. 4), na przykład po co najmniej 2 ostatecznych nakazach w ciągu 12 miesięcy.
- **[FAKT: rozporządzenie 2021/784, art. 6 i 14 ust. 5]** Przez 6 miesięcy trzeba przechowywać usunięte treści i powiązane dane. Jeśli treść wskazuje na zagrożenie życia, trzeba niezwłocznie zawiadomić organy.
- **[FAKT: Dz.U. 2024 poz. 1684; BIP ABW]** W Polsce **organem właściwym jest Szef ABW** (nowelizacja ustawy o działaniach antyterrorystycznych z 18.10.2024, rozdz. 5a). Punkt kontaktowy ABW działa całodobowo dla dostawców, do których kierowane są nakazy.

### Wnioski
- **[WNIOSEK] Praktycznie:**
  - adres e‑mail w rodzaju abuse@ i legal@ z alertem na telefon;
  - wpis w regulaminie i na stronie kontaktowej „Punkt kontaktowy (DSA art. 11, TCO art. 15)”;
  - procedura wykonania nakazu w 1 h (superadmin może sam ukryć treść);
  - przechowywanie usuniętej treści przez 6 miesięcy w osobnym, zabezpieczonym magazynie;
  - zastępca na czas nieobecności.
- **[WNIOSEK]** Jedna osoba nie zagwarantuje fizycznie 24/7. Ryzyko sankcji przy pojedynczym opóźnieniu jest niewielkie, ale **pierwszy nakaz** wymaga szybkiej reakcji.

### Luki
- **[LUKA]** Nie zweryfikowałem wysokości kar krajowych za naruszenie TCO w polskiej ustawie.

---

## 5. CSAM (materiały przedstawiające wykorzystywanie seksualne dzieci)

### Ustalenia z cytowanych źródeł
- **[FAKT: eucrim, CADE, EDPS]** Tymczasowe rozporządzenie 2021/1232 pozwala **dobrowolnie** wykrywać CSAM, ale tylko w łączności interpersonalnej, czyli w komunikatorach.
  - Wygasło 3.04.2026.
  - Przywrócono je rozporządzeniem (UE) 2026/1881 z 24.07.2026, z zastosowaniem **do 3.04.2028**.
  - Wyłączono łączność szyfrowaną end‑to‑end.
  
  Docelowe rozporządzenie o CSA nadal nie jest przyjęte.
- **[FAKT: art. 240 § 1 k.k., za BRPO i prawo.pl]** Każdy, kto ma wiarygodną wiadomość o przygotowaniu, usiłowaniu lub dokonaniu przestępstw z katalogu, ma obowiązek niezwłocznie zawiadomić organ ścigania, pod groźbą kary do 3 lat. Katalog obejmuje m.in. art. 197 § 3–4 (zgwałcenie małoletniego poniżej 15 lat), 198 i **200** (czynności seksualne z osobą poniżej 15 lat, w tym prezentowanie pornografii małoletniemu poniżej 15 lat, art. 200 § 3) oraz przestępstwa terrorystyczne. **Art. 202 k.k. (pornografia z udziałem małoletnich) nie jest w katalogu.**
- **[FAKT: DSA art. 16 ust. 2 lit. c, art. 18]** Zgłaszający CSAM nie musi podawać danych. Przy zagrożeniu życia lub bezpieczeństwa platforma zawiadamia organy.
- **[FAKT: Cloudflare docs]** Cloudflare CSAM Scanning Tool porównuje treści serwowane przez cache Cloudflare z listami organizacji takich jak NCMEC.
  - Codziennie wysyła e‑mail z wykryciami.
  - Próbuje zablokować serwowanie.
  - **Obowiązki zgłoszeniowe zostają po stronie właściciela strony** (np. formularz CyberTipline NCMEC).
- **[FAKT: dyzurnet.pl]** Dyżurnet.pl to zespół NASK, który przyjmuje zgłoszenia nielegalnych i szkodliwych treści, szczególnie zagrażających dzieciom (formularz online).

### Wnioski
- **[WNIOSEK]** W Polsce i UE nie ma dziś ustawowego obowiązku aktywnego skanowania przez platformę hostingową. Są natomiast:
  - obowiązek reakcji na zgłoszenia (art. 16 DSA, art. 47o i 47s UoRiT);
  - zawiadomienie z art. 18 DSA;
  - **osobisty** obowiązek superadmina z art. 240 k.k., gdy materiał świadczy o czynie z art. 197 § 3–4 lub 200 (CSAM niemal zawsze dokumentuje taki czyn).
- **[WNIOSEK] Rekomendowana procedura:**
  1. hash‑matching przy uploadzie lub w cache (Cloudflare albo usługi typu PhotoDNA, Thorn Safer);
  2. po trafieniu natychmiast blokada, **bez oglądania** materiału ponad niezbędne minimum i bez pobierania kopii poza zabezpieczony magazyn dowodowy (samo posiadanie jest przestępstwem z art. 202 § 4a k.k.);
  3. zgłoszenie do Dyżurnet.pl i na policję (np. CBZC), a przy podejrzeniu zagrożenia życia także art. 18 DSA;
  4. zabezpieczenie metadanych i danych konta (IP, e‑mail, Stripe ID);
  5. zamknięcie konta i wstrzymanie wypłat (uzasadnienie z art. 17 DSA może zostać wstrzymane, jeśli tak zażądają organy, por. art. 17 ust. 5 w związku z wyłączeniami).
- **[WNIOSEK]** Raporty do NCMEC są obowiązkowe dla amerykańskich dostawców (18 U.S.C. §2258A). Przy US LLC ten obowiązek dotyczy także platformy (sekcja 14).

### Luki
- **[LUKA]** Nie sprawdziłem, czy Cloudflare udostępnia CSAM Scanning Tool na planie darmowym w 2026 r. ani jak traktuje treści serwowane z R2 lub Stream.

---

## 6. Regulacja płatności (PSD2 / ustawa o usługach płatniczych) i AML

### Ustalenia z cytowanych źródeł
- **[FAKT: PSD2 art. 3 lit. b; u.u.p. art. 6 pkt 2]** Z zakresu wyłączone są transakcje przez **agenta handlowego** upoważnionego do negocjowania lub zawierania umów sprzedaży towarów lub usług **wyłącznie w imieniu płatnika albo wyłącznie w imieniu odbiorcy**.
- **[FAKT: EBA Q&A 2020_5354]** Platforma e‑commerce, która przyjmuje płatność w imieniu odbiorcy, **nie jest domyślnie wyłączona** z PSD2.
- **[FAKT: EBA Q&A 2020_5355]** Platforma B2C może być wyłączona, jeśli jest upoważniona przez odbiorcę do negocjowania lub zawierania sprzedaży i **nie działa jednocześnie w imieniu płatnika**. O tym rozstrzyga organ na podstawie modelu biznesowego.
- **[FAKT: Sidley, Freshfields o opinii EBA z 23.06.2022]** EBA wskazała na niejasność wyłączenia agenta, zwłaszcza na platformach e‑commerce, i zaproponowała jego doprecyzowanie w PSD3.
- **[FAKT: Stripe docs „Connect charges”]**
  - **Direct charges**: płatność trafia na saldo konta połączonego. Zwroty i obciążenia zwrotne obciążają konto połączone. Klient często nie wie o platformie.
  - **Destination charges**: płatność trafia na saldo platformy i od razu jest przekazywana do konta połączonego. **Zwroty i chargebacki obciążają saldo platformy**. Opłaty Stripe pobiera się od platformy.
  - **`on_behalf_of`** czyni konto połączone „business of record”: rozliczenie w kraju konta połączonego, jego deskryptor na wyciągu, jego opłaty krajowe. Przy destination z OBO spory nadal obciążają platformę.
  - **Ograniczenia regionalne:** destination charges i separate charges & transfers obsługują przepływy między regionami tylko w niektórych regionach. W pozostałych platforma i konto połączone muszą być w tym samym regionie, chyba że używa się `on_behalf_of`.

### Wnioski
- **[WNIOSEK] Dlaczego Stripe co do zasady rozwiązuje problem licencji:**
  - W obu modelach środki są przyjmowane, przechowywane i wypłacane przez Stripe, czyli licencjonowaną instytucję. Na EOG jest to Stripe Technology Europe Ltd, instytucja pieniądza elektronicznego nadzorowana przez Central Bank of Ireland **[do weryfikacji w umowie Stripe]**.
  - „Saldo platformy” to rachunek w Stripe, a platforma nie kontroluje pieniędzy klientów na własnym rachunku bankowym.
  - Na tym opiera się standardowe stanowisko, że platforma Connect nie świadczy usług płatniczych i nie potrzebuje licencji KIP ani MIP.
- **[WNIOSEK] Różnica między MoR‑platforma a MoR‑twórca:**
  - **Direct charges (twórca MoR):** platforma jest dostawcą oprogramowania, a pieniądze nie przechodzą przez jej saldo. Najsłabsze ryzyko PSD2.
  - **Destination bez OBO (platforma MoR):** platforma jest stroną transakcji z kartą. Środki chwilowo zasilają jej saldo w Stripe, a ona decyduje o transferach.
    - Jeśli w umowie z twórcą platforma „przyjmuje napiwki w imieniu twórcy”, mamy schemat z EBA 2020_5354, czyli przyjmowanie środków w imieniu odbiorcy.
    - Wyłączenie agenta wchodzi w grę tylko przy reprezentowaniu wyłącznie twórcy. Platforma ustala jednak warunki dla obu stron, a napiwek nie jest „sprzedażą”, więc wyłączenie jest wątpliwe.
    - Argument „środki są wyłącznie w Stripe” pozostaje mocny.
  - **Rekomendacja:** dla minimalizacji ryzyka regulacyjnego (PSD2, VAT art. 9a, konsumenckie, chargebacki) wybrać **direct charges** albo co najmniej destination z `on_behalf_of`. W umowie wskazać, że platforma nie przyjmuje środków na własny rachunek, a ewentualna prowizja jest `application_fee`.
- **[WNIOSEK] AML:**
  - Lista instytucji obowiązanych w art. 2 ust. 1 ustawy z 1.03.2018 o przeciwdziałaniu praniu pieniędzy obejmuje m.in. banki, instytucje płatnicze, dostawców usług walut wirtualnych i notariuszy. **Nie obejmuje platform UGC ani pośredników napiwków**, którzy nie świadczą usług płatniczych.
  - Przy modelu opartym na Stripe platforma **nie jest instytucją obowiązaną**. KYC twórców przeprowadza Stripe.
  - Rozporządzenie AMLR 2024/1624 (stosowane od lipca 2027 r.) również nie obejmuje takich platform. **[Do weryfikacji]**
- **[WNIOSEK]** Ryzyko praktyczne to nie licencja, ale **nadużycia**: pranie pieniędzy przez „napiwki” od skradzionych kart i wyłudzenia. Warto wdrożyć:
  - limity kwoty napiwku;
  - opóźnienie wypłat dla nowych twórców (Stripe `delay_days`);
  - Radar;
  - zakaz napiwków dla samego siebie.

### Luki
- **[LUKA]** Nie znalazłem stanowiska KNF wprost o art. 6 pkt 2 u.u.p. i platformach.
- **[LUKA]** Status PSD3 i PSR na październik 2026 nie został zweryfikowany. Według mojej wiedzy porozumienie polityczne zawarto pod koniec 2025 r., a nowe przepisy mają zawęzić wyłączenie agenta.

---

## 7. VAT od przepływów napiwkowych

### Ustalenia z cytowanych źródeł
- **[FAKT: TSUE C‑16/93 Tolsma, 3.03.1994]** Gra muzyka na ulicy, za którą nie ustalono wynagrodzenia, nie jest odpłatnym świadczeniem usług, nawet jeśli muzyk prosi o pieniądze i je otrzymuje. Między stronami nie ma umowy, a wpłaty są dobrowolne, a ich wysokość nie jest ustalona i nie da się jej ustalić. Brak więc bezpośredniego związku. Sentencja według mojej wiedzy; strona EUR‑Lex nie wczytała się w narzędziu, więc **sentencję należy zweryfikować**.
- **[FAKT: rp.pl za interpretacją 0111‑KDIB3‑2.4012.227.2025.4.SR]** KIS uznała, że dobrowolne wpłaty widzów podczas streamów na YouTube **„są wynagrodzeniem za wykonywane na rzecz widzów usługi i podlegają VAT”**. Wlicza się je do limitu zwolnienia podmiotowego.
- **[FAKT: podatki.biz, 13.02.2025]** W interpretacji o modelce prowadzącej sesje na żywo napiwki „za interakcję” potraktowano jako odpłatne świadczenie usług. Usługi świadczone na rzecz podmiotów niebędących podatnikami.
- **[FAKT: KPMG, interpretacja 0111‑KDIB2‑2.4015.59.2022.12.PB z 6.10.2025]** Na gruncie k.c. i podatku od spadków i darowizn wpłaty „patronów” od **zidentyfikowanych** darczyńców (imię i nazwisko) mogą być darowiznami. Wpłaty anonimowe lub pod pseudonimem nie mogą. Interpretacja nie dotyczy VAT.
- **[FAKT: art. 9a ust. 1 rozporządzenia 282/2011; TSUE C‑695/20 Fenix z 28.02.2023]**
  - Gdy usługi elektroniczne świadczone są przez portal lub platformę, uczestniczący podatnik działa we własnym imieniu, ale na rzecz dostawcy. Jest więc **domniemanym dostawcą**, chyba że wyraźnie wskazano dostawcę i odzwierciedlają to umowy.
  - Platforma, która **autoryzuje obciążenie klienta**, zleca dostawę albo ustala ogólne warunki, **nie może** wskazać innego dostawcy.
  - TSUE potwierdził ważność art. 9a. Spór dotyczył OnlyFans, gdzie HMRC żądał VAT od całości kwot płaconych przez fanów, a nie tylko od 20% prowizji. Według BDO Fenix ustalał minimalne kwoty subskrypcji i **napiwków**.
- **[FAKT: TSUE C‑101/24 Xyrality, 9.10.2025, za MDDP]** Podobne zasady dotyczyły platform także przed wejściem art. 9a.
- **[FAKT: Dz.U. 2025 poz. 896]** Od 1.01.2026 limit zwolnienia podmiotowego w VAT wynosi **240 000 zł**.

### Wnioski

**(a) Czy napiwek jest wynagrodzeniem?**
- **[WNIOSEK]** Według Tolsmy napiwek, który niczego nie odblokowuje, ma dowolną kwotę i nie wynika z żadnej umowy, **nie jest wynagrodzeniem**.
- Polska praktyka KIS z 2025 r. idzie jednak w przeciwną stronę przy streamingu (interakcja na żywo).
- Ryzyko jest mniejsze przy nagranych wcześniej filmach dostępnych za darmo dla wszystkich. Wzmacniają tę pozycję:
  - brak minimalnej kwoty ustalanej przez platformę (Fenix ją ustalał);
  - brak „nagród” za napiwek (odznak, wyróżnień, odczytania na antenie);
  - komunikat „napiwek nie daje żadnych korzyści”.
- Każda gratyfikacja za napiwek wzmacnia argument, że jest to wynagrodzenie.

**(b) Art. 9a**
- **[WNIOSEK]** Art. 9a zakłada istnienie świadczenia usług elektronicznych. **Jeśli napiwek nie jest wynagrodzeniem, nie ma świadczenia i art. 9a nie działa.**
- **Jeśli organ uzna napiwek za wynagrodzenie** za usługę elektroniczną twórcy (udostępnianie wideo jest usługą elektroniczną według załącznika I do rozporządzenia 282/2011), to:
  - **platforma jako MoR (destination bez OBO)**:
    - platforma autoryzuje obciążenie i ustala warunki, więc **nie może przerzucić statusu dostawcy** na twórcę;
    - staje się dostawcą wobec widza od **całej kwoty brutto napiwku**;
    - VAT B2C należy się według miejsca widza (art. 28k ustawy o VAT): PL 23%, inne państwa UE przez OSS (po przekroczeniu 10 000 EUR sprzedaży B2C do innych państw UE), państwa spoza UE według ich przepisów;
    - przy cenie „brutto” VAT zjada 18,7% napiwku;
    - twórca świadczy wtedy usługę na rzecz platformy;
  - **twórca jako MoR (direct charges)**:
    - mocniejsza pozycja, bo to twórca obciąża klienta;
    - ryzyko nie znika: platforma hostuje treść, uruchamia płatność przez API i ustala ogólne warunki;
    - art. 9a ust. 3 (wyłączenie dla podmiotów, które tylko przetwarzają płatności) **nie pomoże**, bo platforma uczestniczy w świadczeniu.
    
    Warunki obrony:
    - regulamin i potwierdzenie płatności wyraźnie wskazują twórcę jako odbiorcę lub dostawcę (art. 9a ust. 1 lit. a–b: wskazanie w umowach i na rachunku);
    - deskryptor na wyciągu należy do twórcy;
    - platforma nie ustala kwot.
- **[WNIOSEK]** Przy twórcach spoza UE i modelu MoR‑platforma platforma może stać się podatnikiem VAT od napiwków dla widzów z UE także wtedy, gdy twórca w ogóle nie podlega VAT w UE.

**(c) Prowizja platformy**
- **[WNIOSEK]** To usługa platformy na rzecz twórcy, prawdopodobnie elektroniczna (zautomatyzowana).
  - **B2C** (twórca nie jest przedsiębiorcą): miejsce świadczenia to miejsce zamieszkania twórcy (art. 28k).
    - Twórca z PL: 23% VAT, ewentualnie zwolnienie podmiotowe platformy do 240 tys. zł.
    - Twórca z innego państwa UE: do progu 10 000 EUR VAT polski, powyżej VAT kraju twórcy przez OSS.
    - Twórca spoza UE: poza zakresem VAT UE, ale możliwe lokalne obowiązki, np. w UK, Norwegii czy Szwajcarii.
  - **B2B** (twórca z numerem VAT lub prowadzący działalność): art. 28b. Twórca z UE lub spoza UE rozlicza odwrotne obciążenie. Twórca z PL dostaje fakturę z 23% VAT.
  - Fakturowanie B2B w PL: KSeF (obowiązkowy od 2026 r.; harmonogram do weryfikacji).
  - Prowizja jako `application_fee` w Stripe jest wygodnym dowodem kwoty.
  - Przy prowizji 0% problem znika.

**(d) Podatek dochodowy przy MoR**
- **[WNIOSEK, z dużą ostrożnością]** W modelu destination bez OBO kwota brutto wpływa na saldo platformy i jest przekazywana dalej.
  - Polska praktyka (KIS, CIT/PIT) zwykle wyłącza z przychodu pośrednika kwoty pobierane **w imieniu i na rzecz** zleceniodawcy, jeśli umowa to jasno przewiduje.
  - Przy działaniu **we własnym imieniu** (jak komis) istnieje ryzyko, że przychodem będzie kwota brutto, a kosztem transfer do twórcy. Dochód będzie podobny, ale zmieniają się podstawy limitów (np. ryczałt i ewidencja, status mikro/małego według obrotu w DSA!).
  - Model direct charges eliminuje ten problem.
- **[WNIOSEK] Rekomendacja:** **direct charges** (lub destination z OBO) plus regulamin z wyraźnym wskazaniem: „Napiwek trafia bezpośrednio do Twórcy. Platforma nie jest stroną ani odbiorcą napiwku”. Platforma nie ustala minimalnych kwot, a jedynie limity techniczne. Brak gratyfikacji za napiwki. Przed startem warto rozważyć **wniosek o interpretację indywidualną** (VAT: czy platforma jest dostawcą z art. 9a; CIT lub PIT: przychód brutto czy netto).

### Luki
- **[LUKA]** Nie przeczytałem pełnych tekstów interpretacji KIS (dostęp przez serwisy prasowe). Nie znalazłem też interpretacji dotyczącej platformy‑pośrednika napiwków od nagranych wcześniej filmów.
- **[LUKA]** Nie zweryfikowałem harmonogramu KSeF na 2026 r.

---

## 8. DAC7 (dyrektywa 2021/514; Dział IIIA ustawy o wymianie informacji podatkowych)

### Ustalenia z cytowanych źródeł
- **[FAKT: Grant Thornton, KPMG, akademialtca]** Polska wdrożyła DAC7 w Dziale IIIA ustawy z 9.03.2017 o wymianie informacji podatkowych z innymi państwami.
  - Raportowane są: najem nieruchomości, **usługi świadczone osobiście**, sprzedaż towarów, najem środków transportu.
  - Raport składa się za rok kalendarzowy do **31 stycznia** (pierwszy raz w 2025 r. za lata 2023–2024).
  - Przy usługach raportuje się od pierwszej transakcji. Próg 30 transakcji lub 2000 EUR dotyczy tylko sprzedaży towarów.
- **[FAKT: Kluwer International Tax Blog, 6.02.2024]** Definicja „usługi osobistej” obejmuje pracę wykonywaną **na żądanie użytkownika**, czyli przynajmniej częściowo dostosowaną do niego.
  - Według FAQ OECD (nr 11) **nagrane wcześniej treści cyfrowe nie są usługą osobistą**.
  - Standardowe transmisje na żywo według autorów również nie.
  - Treści na zamówienie, porady 1:1 i płatne akcje na żądanie w trakcie streamu mogą już być usługą osobistą.
  - Napiwki autorzy wymieniają jako przychód twórców, ale nie analizują ich osobno.

### Wnioski
- **[WNIOSEK]** W modelu „napiwek do darmowego filmu, nic nie odblokowuje” brakuje:
  - (i) usługi świadczonej osobiście na żądanie użytkownika;
  - (ii) moim zdaniem także „wynagrodzenia” za działalność podlegającą raportowaniu.
  
  **Platforma nie raportuje.** Zgodnie z dobrą praktyką warto mieć notatkę wewnętrzną (memo DAC7) z opisem modelu, FAQ OECD nr 11 i warunkiem ponownej oceny przy każdej nowej funkcji (płatne prośby, zamówione wideo, konsultacje, sprzedaż merchu).
- **[WNIOSEK]** Platforma zarejestrowana w PL nie ma obowiązku składania „zerowego” raportu, jeśli nie jest operatorem raportującym. Do weryfikacji, bo niektóre państwa wymagają powiadomień.
- **[WNIOSEK]** Stripe nie składa DAC7 za platformę. Obowiązek DAC7 spoczywa na operatorze platformy. Niezależnie od tego Stripe jako PSP raportuje w ramach **CESOP** (odbiorcy ponad 25 płatności transgranicznych na kwartał), więc administracja skarbowa i tak może widzieć przepływy do twórców.

### Luki
- **[LUKA]** Nie przeczytałem polskiego brzmienia definicji „usługi świadczonej osobiście” w Dziale IIIA ani ewentualnych objaśnień MF lub KAS.

---

## 9. Obowiązki samych twórców (do komunikowania, nie egzekwowania)

### Ustalenia z cytowanych źródeł
- **[FAKT: rp.pl za KIS 2025]** Anonimowe donejty nie są darowiznami, tylko przychodem w PIT:
  - z innych źródeł, jeśli nie ma działalności;
  - z działalności gospodarczej, jeśli streamy są jej elementem.
- **[FAKT: KPMG za KIS 0111‑KDIB2‑2.4015.59.2022.12.PB]** Wpłaty od zidentyfikowanych darczyńców mogą być darowiznami (podatek od spadków i darowizn, SD‑3).
- **[FAKT: money.pl, fakturownia]** Działalność nierejestrowana w 2026 r.: limit **10 813,50 zł przychodu na kwartał** (225% płacy minimalnej 4806 zł). Warunek: brak działalności gospodarczej w ostatnich 60 miesiącach. Po przekroczeniu limitu trzeba się wpisać do CEIDG w 7 dni.
- **[FAKT: MF, objaśnienia do PIT‑11]** Informację PIT‑11 sporządzają płatnicy oraz **„inne podmioty”, które nie są płatnikami, na podstawie art. 42a ust. 1 ustawy o PIT**, czyli podmioty wypłacające należności m.in. z „innych źródeł”.
- **[FAKT: KRRiT]** Twórca prowadzący działalność gospodarczą z uporządkowanym katalogiem może mieć obowiązek wpisu do wykazu VOD.

### Wnioski
- **[WNIOSEK] PIT‑11 / PIT‑8C:**
  - **Direct charges:** platforma nie dokonuje wypłaty, bo pieniądze trafiają od widza bezpośrednio na konto twórcy w Stripe. Platforma nie jest płatnikiem ani podmiotem z art. 42a.
  - **Destination bez OBO:** platforma mogłaby zostać uznana za podmiot „dokonujący wypłaty należności” z innych źródeł wobec polskich twórców bez działalności. **To realne ryzyko obowiązku PIT‑11** dla każdego twórcy, co oznacza zbieranie PESEL i adresów. Kontrargument: platforma tylko przekazuje cudze środki, a „wypłaty” dokonuje widz.
  - **Pytanie do doradcy (wysoki priorytet).** Model direct charges ponownie upraszcza sprawę.
- **[WNIOSEK] Treść Creator Terms:**
  - twórca sam odpowiada za podatki (PIT lub CIT, VAT, ZUS, CEIDG), za ewentualny wpis VOD do KRRiT i za oznaczanie reklam;
  - platforma nie doradza podatkowo;
  - link do informacji ogólnych (np. podatki.gov.pl);
  - zgoda na przekazanie danych organom na ich żądanie.

### Luki
- **[LUKA]** Nie znalazłem interpretacji art. 42a PIT dla platform typu Patronite lub Zrzutka.

---

## 10. Małoletni

### Ustalenia z cytowanych źródeł
- **[FAKT: k.c. art. 12, 14, 15, 17, 20, 22]**
  - Osoba poniżej 13 lat nie ma zdolności do czynności prawnych.
  - Osoba w wieku 13–18 lat ma ograniczoną zdolność. Umowy zobowiązujące wymagają zgody przedstawiciela ustawowego, z wyjątkiem umów powszechnie zawieranych w drobnych bieżących sprawach życia codziennego (art. 20) i rozporządzania zarobkiem (art. 21).
- **[FAKT: RODO art. 8]** Zgoda dziecka w usługach społeczeństwa informacyjnego jest ważna od 16 lat, o ile państwo członkowskie nie obniżyło granicy (minimum 13). **Polska nie obniżyła progu, więc obowiązuje 16 lat.** To moja wiedza, którą warto potwierdzić w ustawie o ochronie danych osobowych z 2018 r., gdzie takiego przepisu nie ma.
- **[FAKT: Stripe Support]**
  - Konto Standard: od 13 lat, ale poniżej 18 lat opiekun musi przejąć rolę właściciela, zanim konto przyjmie płatności lub wypłaci środki.
  - Konta Express i Custom: osoby w wieku 13–17 lat tylko z opiekunem, **tylko w niektórych krajach**, przy czym opiekun akceptuje umowę konta połączonego.
  - W Brazylii obowiązuje 18 lat.
- **[FAKT: UoRiT art. 47p ust. 4]** Danych małoletnich zebranych w celach ochrony małoletnich nie wolno wykorzystywać komercyjnie.
- **[FAKT: DSA art. 28 i wytyczne z 14.07.2025]** Obowiązek „wysokiego poziomu prywatności, bezpieczeństwa i ochrony” małoletnich nie dotyczy mikro i małych platform. Wytyczne wyłączają mikro i małe.
- **[FAKT: legeartis 06/2026, tabletowo]** Projekt ustawy o ochronie małoletnich (druk 2697) przewiduje obowiązkową weryfikację wieku tylko dla usługodawców udostępniających **treści pornograficzne**. Pierwsze czytanie odbyło się 1.07.2026, a vacatio legis ma wynosić 12 miesięcy.

### Wnioski i rekomendacja
- **[WNIOSEK] Konto widza:** od **16 lat** samodzielnie. Osoby w wieku 13–15 lat tylko ze zgodą rodzica, ale prościej ustawić minimum 16 lat. Poniżej 13 lat brak kont.
- **[WNIOSEK] Kanał i upload:** od **18 lat**. Alternatywnie 16+ bez monetyzacji, ale wtedy dochodzą ryzyka wizerunkowe i ochrony małoletnich (grooming, publikacja wizerunku dziecka). Dla jednoosobowej moderacji **18+ jest rekomendowane**.
- **[WNIOSEK] Napiwki dla twórcy:** **wyłącznie 18+**, z weryfikacją wieku przez KYC Stripe (data urodzenia w onboardingu). Uzasadnienie:
  - ograniczona zdolność do czynności prawnych;
  - ograniczenia Stripe;
  - ryzyko wykorzystywania;
  - podatki.
- **[WNIOSEK] Wysyłanie napiwków:** od 18 lat albo ze zgodą rodzica. Napiwek o wysokiej kwocie nie jest „drobną sprawą życia codziennego”, więc warto wprowadzić deklarację 18+ przy płatności i limit kwoty.
- **[WNIOSEK]** Zakaz treści seksualnych i 18+ wyłącza projekt ustawy (druk 2697) i art. 47o UoRiT w zakresie weryfikacji wieku.

---

## 11. RODO: role i przepływy danych

### Wnioski (głównie **[WNIOSEK]**, oparte na tekście RODO)
- **Platforma jest administratorem** danych kont, treści, logów, moderacji, zgłoszeń, skarg i danych transakcyjnych, które otrzymuje od Stripe (art. 4 pkt 7 RODO).
  - Podstawy przetwarzania:
    - art. 6 ust. 1 lit. b (umowa);
    - lit. c (obowiązki z DSA, UoRiT, TCO, art. 18 DSA);
    - lit. f (bezpieczeństwo, fraud).
- **Twórca:**
  - **Stripe** jest dla swoich usług **odrębnym administratorem** (KYC, AML, przetwarzanie płatności). W modelu direct charges konto twórcy w Stripe przetwarza dane płatnika na rzecz twórcy jako sprzedawcy.
  - Jeśli twórca widzi dane napiwkodawców (imię, e‑mail), staje się **odrębnym administratorem** tych danych. Wspólne administrowanie (art. 26, por. C‑210/16 Wirtschaftsakademie, C‑40/17 Fashion ID) wchodzi w grę, gdy platforma i twórca wspólnie ustalają cele, np. „lista wspierających” do marketingu twórcy.
- **Rekomendacja: minimalizacja.**
  - Domyślnie twórca widzi tylko pseudonim lub „Anonim” i kwotę.
  - Prawdziwe imię lub e‑mail tylko wtedy, gdy napiwkodawca świadomie zaznaczy opcję „pokaż twórcy moje imię” (np. żeby twórca mógł wykazać darowiznę na SD‑3, por. KIS z 6.10.2025).
  - Przy przekazywaniu danych twórcy: informacja w polityce prywatności, a w Creator Terms zakaz wykorzystywania danych do celów innych niż podziękowanie i rozliczenia podatkowe.
- **Transfery:** Stripe (USA) działa na podstawie EU‑US DPF lub SCC. Hosting, CDN, e‑mail: umowy powierzenia (art. 28).
- **Moderacja i art. 22 RODO:** decyzje o blokadzie podejmuje człowiek (superadmin), co spełnia też art. 22⁵ pr. aut.
- **DPIA:** rekomendowane, bo dochodzi moderacja treści, możliwy udział małoletnich i ewentualne hash‑matching CSAM.
- **Przechowywanie danych:**
  - usunięte treści: 28 dni (UoRiT) i 6 miesięcy (TCO, tylko dla treści terrorystycznych);
  - dane transakcyjne: 5 lat (podatki);
  - logi: według polityki.
- **US LLC bez jednostki w UE:** przedstawiciel z art. 27 RODO. Faktyczne zarządzanie z Polski przemawia jednak za istnieniem jednostki organizacyjnej w PL w rozumieniu art. 3 ust. 1 RODO (C‑230/14 Weltimmo), a wtedy przedstawiciel nie jest potrzebny, za to właściwy jest PUODO.

---

## 12. Prawo konsumenckie przy napiwkach

### Ustalenia z cytowanych źródeł
- **[FAKT: u.p.k. art. 12a, wprowadzony przez Dz.U. 2022 poz. 2581, dyrektywa Omnibus]** Dostawca internetowej platformy handlowej informuje konsumenta najpóźniej w chwili wyrażenia woli związania się umową o:
  - tym, czy oferent jest przedsiębiorcą (na podstawie jego oświadczenia);
  - braku ochrony konsumenckiej, gdy oferent nie jest przedsiębiorcą;
  - podziale obowiązków między oferenta a platformę.
  
  Definicja platformy jest w art. 2 pkt 8–9 u.p.k.

### Wnioski
- **[WNIOSEK] Kto jest kontrahentem napiwkodawcy:**
  - przy **direct charges** napiwek trafia do twórcy, a stosunek prawny to raczej darowizna lub nieodpłatne przysporzenie;
  - przy **destination bez OBO** wobec banku i organizacji kartowej „sprzedawcą” jest platforma, a cywilnoprawnie zależy to od regulaminu (np. platforma jako odbiorca w imieniu twórcy).
- **[WNIOSEK]** Napiwek bez świadczenia wzajemnego **nie jest umową sprzedaży ani świadczenia usług**. Prawo odstąpienia (art. 27 u.p.k.) i obowiązki z art. 12 dotyczą umów z przedsiębiorcą, w których konsument otrzymuje świadczenie. Przy darowiźnie najpewniej nie mają zastosowania. Mimo to warto, **na wszelki wypadek, jeśli organ uzna napiwek za odpłatną usługę cyfrową**:
  - w checkoutcie jasno informować o dobrowolności, braku świadczenia wzajemnego i braku zwrotu;
  - podać tożsamość odbiorcy (twórcy) i operatora platformy;
  - podać informację z art. 12a („Twórca zadeklarował, że [jest / nie jest] przedsiębiorcą”);
  - przy umowie z przedsiębiorcą o treści cyfrowe zbierać zgodę na natychmiastowe spełnienie (art. 38 ust. 1 pkt 13 u.p.k.).
- **[WNIOSEK]** Przepis o przycisku „zamówienie z obowiązkiem zapłaty” (art. 17 u.p.k.) przy darowiźnie nie ma bezpośredniego zastosowania. Przycisk „Wyślij napiwek X zł” jest jednak bezpiecznym standardem.
- **[WNIOSEK]** Pełne wnioski co do C‑234/25 i informacji przy płatnym dostępie zawiera raport z 2026‑10‑12. Nowy model dokłada wyłącznie art. 12a (marketplace) i ustalenie stron.
- **[WNIOSEK]** Chargebacki: przy destination charges koszt ponosi platforma (Stripe docs), więc regulamin powinien przewidywać prawo do cofnięcia transferu od twórcy (transfer reversal).

---

## 13. Struktura dokumentów platformy

### Ustalenia z cytowanych źródeł
- **[FAKT: strony Ko‑fi]** Ko‑fi deklaruje, że nigdy nie przetwarza ani nie przechowuje środków twórców. Wspierający płacą bezpośrednio na konto PayPal lub Stripe twórcy, a to twórca jest sprzedawcą i odpowiada za dostawę i zwroty.
- **[FAKT: Patreon Help Center]** Patreon w wielu jurysdykcjach sam pobiera i odprowadza VAT od płatności członków, więc twórcy z UE nie pobierają VAT od członków. Zastrzega przy tym obowiązki VAT od opłat pobieranych od twórców.
- **[WNIOSEK, z mojej wiedzy o praktyce rynkowej]**
  - YouTube: Terms of Service + Community Guidelines + YouTube Partner Program Terms + Copyright (formularz zgłoszeń, kontranotyfikacje, strike'i) + Privacy Policy.
  - Twitch: ToS + Community Guidelines + Monetization Agreement + DMCA Guidelines + Terms of Sale.
- **Wzorzec rynkowy dla pawelperfect.com:**
  - Ko‑fi (twórca MoR) jest prostszy podatkowo.
  - Patreon (platforma MoR) wymaga pełnej infrastruktury VAT po stronie platformy.

### Rekomendowany zestaw dokumentów i klauzule obowiązkowe (**[WNIOSEK]**)

1. **Regulamin serwisu (ToS)**: jednocześnie regulamin z art. 8 u.ś.u.d.e., art. 14 DSA i art. 47r UoRiT. Zawiera:
   - dane usługodawcy (art. 47m UoRiT), punkty kontaktowe (art. 11–12 DSA), punkt TCO;
   - wymagania techniczne, wiek (16+ konto, 18+ kanał i napiwki);
   - zasady treści i odesłanie do zasad społeczności, zakaz treści z art. 47o, zakaz pornografii;
   - **opis moderacji**: narzędzia (hash‑matching, ręczna weryfikacja), kto decyduje, sankcje (ograniczenie widoczności, usunięcie, blokada wgrywania do 3 miesięcy lub bezterminowo, zawieszenie wypłat, zamknięcie konta);
   - procedura zgłoszeń i terminy (48 h), kryteria oceny;
   - procedura odwołań lub skarg, mediacja (art. 47u), skarga do KRRiT (art. 47t ust. 5), skarga do koordynatora (art. 22zh u.ś.u.d.e.), sąd;
   - klasyfikacja wiekowa treści, kontrola rodzicielska, oznaczanie przekazów handlowych;
   - licencja dla platformy na hosting i wyświetlanie treści (niewyłączna, ograniczona do świadczenia usługi);
   - wyłączenia odpowiedzialności w granicach prawa (bez klauzul abuzywnych wobec konsumentów);
   - zmiany regulaminu (informowanie z wyprzedzeniem), prawo właściwe, sądy, ODR;
   - informacja o przetwarzaniu danych (odesłanie do polityki prywatności).
2. **Regulamin twórcy (Creator Agreement)**:
   - 18+, prawdziwa tożsamość przez Stripe, kraj z listy obsługiwanej przez Stripe;
   - oświadczenie o statusie przedsiębiorcy (art. 12a u.p.k.);
   - oświadczenia i gwarancje dotyczące praw (muzyka, wizerunek osób, zgody osób na nagraniu), zwolnienie platformy z roszczeń;
   - **napiwki**: dobrowolność, zakaz obiecywania świadczeń, zakaz zbiórek publicznych lub celowych z naruszeniem prawa, zakaz napiwków dla siebie i zmów, **prowizja** (X% jako `application_fee`, zmiana z wyprzedzeniem 30 dni), opóźnienie wypłat, prawo do wstrzymania transferów przy podejrzeniu nadużyć (z uzasadnieniem z art. 17 DSA), cofnięcie transferu przy chargebacku;
   - **podatki i obowiązki administracyjne po stronie twórcy** (PIT, VAT, CEIDG, ewentualny wpis VOD do KRRiT, oznaczanie reklam);
   - repeat‑infringer policy;
   - dane napiwkodawców: zasady wykorzystywania.
3. **Zasady społeczności**: katalog treści zabronionych (przemoc, nienawiść, terroryzm, CSAM, seks, nękanie, doxxing, spam, dezinformacja zagrażająca zdrowiu, oszustwa), zasady oznaczania wiekowego, reklam i lokowania produktu (art. 47q UoRiT, informator KRRiT dla influencerów).
4. **Polityka zgłoszeń i praw autorskich**: formularz z art. 16 DSA, ścieżka dla uprawnionych z praw autorskich, kontranotyfikacja i skarga (art. 22⁵), ścieżka anonimowa dla CSAM, informacja o Dyżurnet.pl. W wariancie US: sekcja DMCA z agentem.
5. **Polityka prywatności i cookies**.
6. **Warunki napiwków**, krótkie i wyświetlane w checkoutcie: kto otrzymuje, dobrowolność, brak świadczenia wzajemnego, brak zwrotu, Stripe jako procesor płatności, informacja z art. 12a.
7. **Strona „Informacje prawne / DSA”**: punkty kontaktowe, języki, informacja o wpisie do wykazu VSP KRRiT, punkt kontaktowy TCO, informacja o statusie mikroprzedsiębiorcy (zwolnienia).

---

## 14. Wariant US LLC (Wyoming) zarządzanej z Polski

### Ustalenia z cytowanych źródeł i wnioski
- **[FAKT: DSA art. 13]** Bez jednostki organizacyjnej w UE potrzebny jest **przedstawiciel prawny** w UE (pisemne umocowanie, dane do koordynatora, możliwa odpowiedzialność przedstawiciela).
- **[FAKT: RODO art. 27]** Administrator spoza UE, który oferuje towary lub usługi osobom w UE, wyznacza przedstawiciela, z wyjątkami dla przetwarzania okazjonalnego.
- **[WNIOSEK] Ryzyko „ustanowienia w Polsce”:**
  - Jedyny członek LLC mieszka w PL i zarządza z PL.
  - Dla RODO (Weltimmo), DSA i AVMSD (stała jednostka, art. 1a UoRiT) oraz podatków (miejsce faktycznego zarządu, art. 3 ust. 1 i art. 4a pkt 11 ustawy o CIT) organ prawdopodobnie uzna jednostkę w Polsce.
  - Wtedy przedstawiciele z art. 13 DSA i art. 27 RODO nie są potrzebni, ale **cały polski reżim dalej obowiązuje** (KRRiT, UKE, PUODO).
  - LLC **nie zmniejsza** obowiązków UE, a dodaje amerykańskie.
- **[WNIOSEK, prawo USA, z mojej wiedzy; do potwierdzenia u prawnika US]**
  - **DMCA §512(c)**: aby korzystać z safe harbour, trzeba zarejestrować **wyznaczonego agenta** w U.S. Copyright Office (rejestracja elektroniczna, odnawiana co 3 lata) i podać jego dane na stronie.
  - **DMCA §512(i)**: trzeba wdrożyć i rozsądnie egzekwować **politykę zamykania kont osób wielokrotnie naruszających prawa**.
  - Trzeba też obsługiwać kontranotyfikacje (§512(g)).
  - **Section 230 (47 U.S.C. §230)**: immunitet za treści użytkowników i za moderację w dobrej wierze. Nie obejmuje prawa własności intelektualnej ani federalnego prawa karnego.
  - **COPPA**: zbieranie danych dzieci poniżej 13 lat wymaga weryfikowalnej zgody rodzica. Najprościej ustawić minimum wieku 16+ i nie kierować serwisu do dzieci.
  - **FOSTA‑SESTA (2018)**: wyłącza immunitet z §230 dla ułatwiania prostytucji i handlu ludźmi w celach seksualnych. Zakaz treści seksualnych i ogłoszeń towarzyskich ogranicza to ryzyko.
  - **18 U.S.C. §2258A**: **obowiązek** zgłaszania CSAM do NCMEC dla „providers” z USA. Ustawa REPORT Act z 2024 r. wydłużyła przechowywanie danych do 1 roku. **[do weryfikacji]**
  - **US sales tax i podatki od LLC**: patrz raport z 2026‑10‑12.

---

## Pytania do prawnika i doradcy podatkowego

**Regulacyjne (prawnik od mediów i nowych technologii)**
1. Czy pawelperfect.com po otwarciu uploadu jest VSP w rozumieniu art. 4 pkt 22a UoRiT już od pierwszego dnia, jeszcze bez ruchu? Jaka jest praktyka KRRiT wobec małych platform? Czy zgłoszenie musi nastąpić 14 dni przed beta‑testami z zamkniętą grupą twórców?
2. Jakie rozporządzenia KRRiT (kategorie wiekowe, zabezpieczenia techniczne, procedura zgłoszeń) obowiązują dziś VSP? Czy model „zakaz 18+, kategorie do 16+ i filtr” spełnia art. 47p ust. 1?
3. Czy kanał właściciela (i kanały twórców z działalnością gospodarczą) wymagają wpisu do wykazu VOD?
4. Czy status mikroprzedsiębiorcy dla zwolnień DSA ocenia się z uwzględnieniem innych firm właściciela? Jak go udokumentować?
5. Czy ustawa z 4.09.2026 (Dz.U. 2026 poz. 1296) nakłada obowiązki krajowe poza DSA, np. językowe? Jak zgłosić punkt kontaktowy do Prezesa UKE?
6. Przy jakiej skali i przy jakim modelu przychodów (prowizja, reklamy) platforma staje się DUUTO? Czy przy prowizji od napiwków spełnione jest „w celach zarobkowych”?
7. Czy przy US LLC zarządzanej z PL organy uznają polską jednostkę organizacyjną (DSA, RODO, UoRiT)? Czy mimo to warto formalnie wyznaczyć przedstawicieli?
8. Czy model „destination charges bez OBO” wymaga analizy PSD2 lub u.u.p. (świadczenie usług płatniczych, art. 6 pkt 2)? Czy direct charges eliminuje ryzyko?
9. Jak sformułować procedurę superadmina wobec art. 240 k.k. i art. 18 DSA? Jak legalnie przechowywać dowody CSAM (art. 202 § 4a k.k.)?
10. Czy dopuszczalne jest 16+ dla konta i 18+ dla kanału oraz napiwków? Jaki poziom weryfikacji wieku jest „wystarczający”?

**Podatkowe (doradca podatkowy)**

11. Czy dobrowolny napiwek do bezpłatnego, nagranego wcześniej filmu, bez żadnej gratyfikacji, jest wynagrodzeniem w rozumieniu art. 8 ustawy o VAT (Tolsma kontra KIS 0111‑KDIB3‑2.4012.227.2025.4.SR)? Czy warto złożyć wniosek o interpretację indywidualną przed startem?
12. Czy w modelu MoR‑platforma (destination bez OBO) platforma jest domniemanym dostawcą z art. 9a rozporządzenia 282/2011 od kwoty brutto napiwku? Czy model direct charges z wyraźnym wskazaniem twórcy wystarcza, by uniknąć art. 9a?
13. Jaki VAT od prowizji (jeśli X% > 0) wobec twórców z PL, UE i spoza UE w relacji B2C i B2B? OSS, KSeF, faktury dla konsumentów?
14. Czy w modelu MoR przychodem platformy (CIT lub PIT) jest kwota brutto napiwku czy tylko prowizja? Jak to wpływa na limity (ryczałt, VAT 240 tys. zł, status mikro/małego w DSA)?
15. **Czy platforma ma obowiązek sporządzać PIT‑11 (art. 42a ustawy o PIT) dla polskich twórców bez działalności?** Czy zależy to od typu obciążenia w Stripe?
16. Potwierdzenie, że platforma nie jest operatorem raportującym DAC7. Czy trzeba coś zgłaszać do KAS?
17. Czy zwolnienie podmiotowe z VAT (240 tys. zł) obejmuje usługi elektroniczne platformy na rzecz konsumentów z innych państw UE poniżej progu 10 000 EUR?

---

## Źródła (dostęp: 2026‑10‑13)

**UE (akty i organy)**
- DSA, rozporządzenie 2022/2065: https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- Rozporządzenie TCO 2021/784: https://eur-lex.europa.eu/eli/reg/2021/784/oj
- Rozporządzenie wykonawcze 282/2011 (art. 9a): https://eur-lex.europa.eu/eli/reg_impl/2011/282/oj
- AVMSD 2010/13/UE po zmianach z 2018/1808: https://eur-lex.europa.eu/eli/dir/2018/1808/oj
- Dyrektywa DSM 2019/790: https://eur-lex.europa.eu/eli/dir/2019/790/oj
- TSUE C‑16/93 Tolsma: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:61993CJ0016 (nie wczytało się w narzędziu; sentencja z wiedzy własnej)
- TSUE C‑695/20 Fenix: komunikat CURIA https://curia.europa.eu/jcms/upload/docs/application/pdf/2022-09/cp220151en.pdf ; omówienie https://www.europeanlawblog.eu/pub/cjeu-strips-it-down-for-onlyfans-c-695-20-fenix-international-v-hmrc ; BDO https://www.bdo.lu/getattachment/95fc1791-cbe5-473d-a38e-abf4bca359b2/BDO-Luxembourg-VAT-Newsletter-Fenix-C-695_20.pdf
- TSUE C‑101/24 Xyrality (MDDP): https://www.mddp.pl/cjeu-judgment-in-the-xyrality-case-c-101-24/
- DSA Transparency Database, nota prawna: https://transparency.dsa.ec.europa.eu/page/legal-information
- Komisja, FAQ Transparency Database: https://digital-strategy.ec.europa.eu/en/faqs/dsa-transparency-database-questions-and-answers
- Komisja, konsultacje art. 17 ust. 6 DSM: https://digital-strategy.ec.europa.eu/pl/consultations/targeted-stakeholder-consultation-lighter-liability-regime-under-article-176-directive-eu-2019790
- Wytyczne art. 28 DSA (omówienia): https://www.taylorwessing.com/en/insights-and-events/insights/2025/07/rd-european-commission-guidelines-on-protection-of-minors-under-the-digital-services-act ; https://dsa-observatory.eu/2025/07/30/do-the-dsa-guidelines-on-protecting-minors-online-strike-the-right-balance/
- Rejestr organów TCO (Komisja): https://home-affairs.ec.europa.eu/policies/internal-security/counter-terrorism-and-radicalisation/prevention-radicalisation/terrorist-content-online/list-national-competent-authority-authorities-and-contact-points_en
- EBA Q&A 2020_5354: https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5354
- EBA Q&A 2020_5355: https://eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5355
- Opinia EBA z 2022 r. (omówienia): https://www.sidley.com/en/insights/newsupdates/2022/07/psd3-what-to-expect-based-on-the-european-banking-authority-opinion ; https://paytechlaw.com/en/commercial-agent-exemption-zag/
- Przedłużenie rozporządzenia 2021/1232: https://eucrim.eu/news/interim-rules-on-voluntary-csam-detection-reinstated-until-2028/pdf/ ; https://cadeproject.org/updates/eu-extends-interim-rules-for-voluntary-detection-of-online-child-sexual-abuse-material-until-2028/ ; https://www.edps.europa.eu/press-publications/press-news/press-releases/2026/extension-interim-rules-combat-child-sexual-abuse-online-must-address-shortcomings-and-prevent-indiscriminate-scanning
- DAC7 i twórcy (Kluwer): https://legalblogs.wolterskluwer.com/international-tax-law-blog/dac7-and-digital-content-creators-opaque-transparency-for-influencers-streamers-and-other-content-creators/

**Polska (akty, organy)**
- Ustawa z 4.09.2026 wdrażająca DSA, Dz.U. 2026 poz. 1296 (ELI, tekst PDF): https://api.sejm.gov.pl/eli/acts/DU/2026/1296 ; https://api.sejm.gov.pl/eli/acts/DU/2026/1296/text/O/D20261296.pdf
- UKE o uchwaleniu ustawy: https://uke.gov.pl/uslugi-cyfrowe/aktualnosci/sejm-uchwalil-ustawe-wdrazajaca-przepisy-aktu-o-uslugach-cyfrowych-prezes-uke-koordynatorem-ds-uslug-cyfrowych,26.html
- Legeartis o publikacji (10.2026): https://czasopismo.legeartis.org/2026/10/koordynator-spraw-uslug-cyfrowych-urzad-komunikacji-elektronicznej-rozporzadzenie-dsa/
- Weto i ponowne uchwalenie: https://www.wirtualnemedia.pl/prezydent-karol-nawrocki-podpis-dsa-prezes-uke-krrit-koordynator-uslug-cyfrowych,7333236099541216a ; https://zapa.org.pl/aktualnosci/ustawa-wdrazajaca-dsa-zawetowana-przez-prezydenta
- UoRiT, rozdz. 6b (art. 47l–47w): https://arslege.pl/ustawa-o-radiofonii-i-telewizji/k667/s14976/
- UoRiT, art. 47n: https://standardyprawa.pl/akt/291/art/55052 ; definicje i art. 1a: https://standardyprawa.pl/akt/291
- UoRiT, art. 53e (kary VSP): https://arslege.pl/naruszenie-przepisow-przez-dostawce-platformy-udostepniania-wideo/k667/a134370/ ; https://lexlege.pl/ustawa-o-radiofonii-i-telewizji/art-53e/
- Rozporządzenie KRRiT w sprawie wzoru wykazu VSP, Dz.U. 2021 poz. 1970: https://api.sejm.gov.pl/eli/acts/DU/2021/1970/text.html
- KRRiT, informator dla influencerów (26.02.2026): https://www.gov.pl/web/krrit/odpowiedzialnosc-transparentnosc-wiarygodnosc--nowy-informator-krrit-dla-influencerow (PDF: https://www.gov.pl/attachment/0197e419-6a2f-4495-8ace-5ef75eb5a518)
- KRRiT, pytania i odpowiedzi: https://www.gov.pl/web/krrit/pytania-i-odpowiedzi
- Prawo autorskie, art. 22¹–22⁸: https://arslege.pl/ustawa-o-prawie-autorskim-i-prawach-pokrewnych/k442/s16772/ ; KPMG: https://kpmg.com/pl/pl/wiedza/prawo/legal-alert-nowelizacja-prawa-autorskiego.html ; druk 406: https://api.sejm.gov.pl/sejm/term10/prints/406/406-ustawa.docx
- TCO w PL, Dz.U. 2024 poz. 1684: https://eli.gov.pl/eli/DU/2024/1684/ogl/pol/pdf ; BIP ABW, punkt kontaktowy: https://bip.abw.gov.pl/bip/punkt-kontatowy-tco/525,Punkt-kontaktowy-TCO.pdf
- Art. 240 k.k. (BRPO, prawo.pl): https://sprawy-generalne.brpo.gov.pl/pdf//2018/3/II.501.1.2018/1289418.pdf ; https://www.prawo.pl/prawnicy-sady/czy-mozna-karac-za-brak-denuncjacji-o-wykorzystaniu-dziecka,514201.html
- Dyżurnet.pl (NASK): https://dyzurnet.pl/
- Projekt ustawy o ochronie małoletnich (druk 2697): https://czasopismo.legeartis.org/2026/06/weryfikacji-wieku-uzytkownikow-serwisow-pornograficznych-blokowanie-dostepu-maloletnim-internecie-projekt/ ; https://www.tabletowo.pl/pornografia-blokada-nowa-ustawa-kiedy/
- u.p.k., art. 12a: https://lexlege.pl/ustawa-o-prawach-konsumenta/art-12a/ ; Dz.U. 2022 poz. 2581: https://api.sejm.gov.pl/eli/acts/DU/2022/2581/text.html
- Ustawa o usługach płatniczych, tekst jednolity Dz.U. 2026 poz. 623: https://www.infor.pl/akt-prawny/DZU.2026.131.0000623,ustawa-o-uslugach-platniczych.html
- KIS, donejty (PIT i VAT): https://www.rp.pl/podatki/art42872661-od-anonimowych-donejtow-trzeba-placic-podatek-fiskus-bez-litosci-dla-streamerow ; https://www.prawo.pl/podatki/donejty-otrzymywane-przez-streamerow-darowizna-czy-przychod-podlegajacy-pit,1553267.html
- KIS, darowizny od patronów (KPMG): https://kpmg.com/pl/en/blogs/home/posts/2025/10/wiecej-pewnosci-podatkowej-dla-tworcow-internetowych-blog-podatkowy.html
- KIS, transmisja na żywo i napiwki (podatki.biz): https://www.podatki.biz/artykuly/vat-transmisja-na-zywo-nie-jest-usluga-elektroniczna_4_57872.htm
- Limit VAT 240 tys. zł (Dz.U. 2025 poz. 896): https://akademialtca.pl/blog/prezydent-podpisal-ustawe-zmieniajaca-limit-zwolnienia-podmiotowego-w-vat ; https://www.infakt.pl/blog/limit-vat-
- Działalność nierejestrowana 2026: https://direct.money.pl/artykuly/porady/dzialalnosc-nierejestrowana-2026-limit-10-813,50-zl,-po-przekroczeniu-7-dni-na-ceidg ; https://fakturownia.pl/aktualnosci/dzialalnosc-nierejestrowana-2026-nowe-zasady-i-nowe-limity
- DAC7 w PL: https://grantthornton.pl/publikacja/dac7-nowe-obowiazki-dla-operatorow-platform/ ; https://kpmg.com/pl/pl/wiedza/podatki/polski-ustawodawca-wdraza-dyrektywe-dac7-blog-podatkowy.html ; https://akademialtca.pl/blog/dyrektywa-dac7-w-praktyce
- PIT‑11 i art. 42a (objaśnienia MF, omówienie): https://www.podatki.biz/artykuly/formy-i-sposoby-przekazywania-pit-11-przez-platnikow-objasnienia-podatkowe-mf_60_59121.htm

**Dostawcy i praktyka rynkowa**
- Stripe Connect, typy obciążeń: https://docs.stripe.com/connect/charges
- Stripe, wymogi wiekowe: https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18
- Cloudflare CSAM Scanning Tool: https://developers.cloudflare.com/cache/reference/csam-scanning/
- Ko‑fi: https://ko-fi.com/ ; https://prod.ko-fi.com/features
- Patreon VAT: https://support.patreon.com/hc/en-us/articles/205259549 ; https://support.patreon.com/hc/en-us/articles/360047578411-EU-Creator-Frequently-Asked-Tax-Questions

*Część treści oznaczonych jako fakty (np. brzmienie art. 3, 5, 6, 14, 15 rozporządzenia TCO, art. 11–29 DSA, art. 8 RODO, przepisy k.c.) opiera się na mojej znajomości tekstu aktów, a pełny tekst EUR‑Lex nie był ponownie pobierany w tej sesji. Przed użyciem w dokumentach należy je sprawdzić w tekście źródłowym.*
