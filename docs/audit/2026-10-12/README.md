# Badania z 2026-10-12: płatny dostęp, VAT, napiwki, koszty, pozycjonowanie, covery

**Status: badania (research), nie decyzje.** Nic z tego katalogu nie zmienia kodu ani obowiązujących zasad
(`CLAUDE.md` §1, §4.1, §4.14: serwis jest niekomercyjny, dostęp do filmów jest darmowy, napiwek niczego nie odblokowuje).
Raporty powstały w jednej sesji 2026-10-12 jako materiał dla właściciela i przyszłych agentów; źródła (strony organów,
cenniki, komentarze prawne) były pobierane tego samego dnia. **To nie jest porada podatkowa ani prawna.** Wszystko,
co dotyczy statusu LLC, VAT i konsumentów, wymaga potwierdzenia przez polskiego doradcę podatkowego i prawnika (lista niżej).

Sposób czytania: każdy plik ma sekcje „Takeaway / Cited Findings / Inferences / Gaps". Cytaty ze źródeł oddzielono od
wniosków własnych badacza; to, co „niezweryfikowane" albo „wtórne", jest tak oznaczone w treści. Pliki są wiernymi kopiami
notatek z sesji (poprawiono tylko ścieżki względne). Pozycje oznaczone „Gaps" to realne luki, nie ozdobnik.

## Indeks: który plik odpowiada na jakie pytanie

| Plik | Odpowiada na pytanie |
|---|---|
| [`platny-dostep-vat-i-narzedzia.md`](platny-dostep-vat-i-narzedzia.md) | **Raport główny.** Jak sprzedawać dostęp dożywotni na całym świecie: ranking dróg (MoR vs własny sprzedawca), VAT i sales tax, narzędzia, ryzyka prawne, architektura, fazy, 12 decyzji właściciela, pytania do doradców |
| [`vat-ue.md`](vat-ue.md) | VAT w UE dla sprzedaży filmów konsumentom: usługa elektroniczna, OSS nieunijny i unijny, progi, dowody lokalizacji klienta, faktury, B2B, KSeF, scenariusz „LLC ustanowiona w Polsce" |
| [`vat-swiat.md`](vat-swiat.md) | VAT/GST poza UE (UK, Norwegia, Szwajcaria, Kanada, Australia, Azja, Ameryka Łacińska, Afryka), progi rejestracji, sankcje OFAC |
| [`sales-tax-usa.md`](sales-tax-usa.md) | Sales tax w USA: nexus ekonomiczny, opodatkowanie wideo cyfrowego per stan, rola „dożywotni" jako „trwałego" prawa, Wyoming, Form 5472 |
| [`narzedzia-platnosci.md`](narzedzia-platnosci.md) | Stripe Tax / Managed Payments, Paddle, Creem, Polar, Lemon Squeezy, FastSpring i inne: opłaty, kto jest sprzedawcą, punkty opłacalności, rekomendacja |
| [`zgodnosc-prawo-konsumenckie-llc.md`](zgodnosc-prawo-konsumenckie-llc.md) | Prawo odstąpienia (wyrok TSUE C-234/25), „dożywotni" jako pojęcie, zgody i dokumenty przy zakupie, geoblokowanie, RODO, Stripe/spory, administracja LLC w Wyoming i USA |
| [`architektura-platnego-dostepu.md`](architektura-platnego-dostepu.md) | Jak to wbudować w repo: poziom `PAID`, `Order`/`Entitlement`, ścieżki integracji, bezpieczeństwo tokenu HLS, panel, e-maile, plan wdrożenia i testów (po angielsku, z odwołaniami do plików repo) |
| [`llc-jdg-spzoo.md`](llc-jdg-spzoo.md) | Wyoming LLC vs JDG vs sp. z o.o. dla polskiego rezydenta: rezydencja podatkowa, ryczałt 8,5/15%, VAT, ZUS, koszty, ilustracja netto przy 30/100/450 tys. USD, pytania do doradcy |
| [`napiwki-legalnosc.md`](napiwki-legalnosc.md) | Czy obecny model napiwków jest zgodny z polityką Stripe i prawem PL (zbiórki publiczne, PIT, VAT). **Badanie przerwane przed końcem** (sekcja o UE/RODO/AML niezbadana) |
| [`koszty-skalowania.md`](koszty-skalowania.md), [`cost_model.py`](cost_model.py), [`cost_model_output.md`](cost_model_output.md) | Ile kosztuje skalowanie od 1 kanału do 50 tys.: parametry potoku z repo, aktualne ceny R2/Workers/Hetzner, model S0-S4, co pęka pierwsze, porównanie z Stream/Mux/Bunny, koszty ludzi i prawa |
| [`pozycjonowanie-platformy.md`](pozycjonowanie-platformy.md) | Jak radziły sobie alternatywy dla YouTube, po co twórca miałby przejść, realistyczne zakłady dla małej platformy, domena `polutek.com`, bramki decyzyjne |
| [`covery-licencje.md`](covery-licencje.md) | Licencje na covery (własne wykonanie cudzych piosenek) na własnym serwisie: sync, mechaniczne, ZAiKS/PRS/GEMA, usługi licencyjne, koszty, ścieżki alternatywne (po angielsku) |

Model kosztów można odtworzyć: `python -I docs/audit/2026-10-12/cost_model.py` (założenia i etykiety `[REPO]`/`[PRICE]`/`[ASSUME]` są w nagłówku skryptu).

## Najważniejsze wnioski (10-15 punktów)

1. **Płatny dostęp to odwrócenie decyzji właściciela z 2026-09-22**, nie włączenie funkcji: `CLAUDE.md` §1/§4.1/§4.14 i dokumenty prawne serwisu (`LegalDocs.tsx` §1.2, §2.1, §4) mówią, że dostęp nigdy nie wymaga płatności. Dziś jest beta, `noindex`, tylko napiwki; do czasu pisemnej decyzji właściciela nic w kodzie się nie zmienia.
2. **VAT od pierwszej sprzedaży.** Filmy na żądanie to usługa świadczona drogą elektroniczną. Sprzedawca spoza UE nie ma progu: konsument z UE jest opodatkowany od pierwszego euro w kraju zamieszkania (stawki 17-27%, brak obniżonych dla wideo), Wielka Brytania też od pierwszej sprzedaży. Rozliczenie: OSS nieunijny (np. przez Irlandię), kwartalnie, nawet deklaracje zerowe.
3. **Kluczowe, nierozstrzygnięte pytanie: czy LLC zarządzana z Polski jest „ustanowiona" w Polsce dla VAT** (art. 10 rozp. 282/2011: miejsce centralnej administracji, adres agenta rejestrowego nie wystarcza). Jedyny wspólnik i zarządca w Polsce czyni to ryzyko wysokim; nie znaleziono interpretacji KIS ani wyroku o dokładnie takim stanie. Od odpowiedzi zależy schemat (OSS nieunijny vs polski VAT 23% + OSS unijny) i błędny wybór grozi domiarem z odsetkami.
4. **LLC nie daje polskiemu rezydentowi przewagi podatkowej.** Przezroczysta jednoosobowa LLC jest w PIT działalnością gospodarczą (skala albo 19% liniowo), **bez ryczałtu** (art. 6 ust. 1 ustawy o ryczałcie); LLC z wyborem „corporation" (8832) zarządzana z Polski jest polskim podatnikiem CIT. Dochodzi US: Form 5472 + pro forma 1120 papierowo/faksem, kara 25 000 USD. Ryczałt w JDG dla streamingu wideo (PKWiU 59.11.25.0) to **15%**, a 8,5% jest stawką resztową wymagającą klasyfikacji (do potwierdzenia u doradcy). Sp. z o.o. zaczyna mieć sens dopiero powyżej ok. 100-150 tys. USD przychodu.
5. **Przy małym wolumenie najprościej przez MoR** (pośrednika będącego sprzedawcą): Stripe Managed Payments (+3,5% ponad opłaty Stripe, ta sama integracja Checkout; niepewna kwalifikacja, brak kodu podatkowego „streamed, permanent") lub Paddle (5% + 0,50 USD). Własny sprzedawca ze Stripe Tax jest najtańszy i najbardziej kontrolowany, ale opłaca się dopiero od ok. 850-1 900 sprzedaży rocznie i zostawia odpowiedzialność za VAT po stronie sprzedawcy; Tax Complete przy 100 sprzedażach po 30 USD kosztuje 40,8% obrotu.
6. **Wyrok TSUE C-234/25 *Sky Österreich* (9.07.2026)** zmienia zabezpieczenie przed zwrotami: streaming „dynamicznej" oferty to usługa, więc 14-dniowe prawo odstąpienia nie wyłącza się checkboxem; planować 14 dni zwrotu bez dyskusji i zgodę na natychmiastowy start z proporcjonalną zapłatą. Od 19.06.2026 obowiązuje „przycisk odstąpienia" (art. 11a). „Dożywotni" nie ma definicji prawnej; bezpieczniej „na czas działania serwisu, nie krócej niż N lat".
7. **USA:** próg nexusu zwykle 100 000 USD na stan; wideo cyfrowe jest opodatkowane w wielu stanach; „dożywotni" może być „trwałym" prawem opodatkowanym w WY, ID, IN, GA (wniosek, nie ustalenie). Przy MoR ten wątek w większości znika. Kraje objęte sankcjami (Kuba, Iran, Korea Płn., Krym/Donieck/Ługańsk) trzeba wyłączyć niezależnie od narzędzia.
8. **Technicznie zmiana jest umiarkowanie duża** (ok. 3-5 tygodni pracy agenta, szacunek nie pomiar): nowy poziom `PAID`, tabele `Order` i `Entitlement`, `Payment.kind`, hostowany Checkout zamiast okna napiwku. Największe ryzyko to **kolejność wdrożeń**: dziś nieznana wartość poziomu mapuje się na `LOGGED_IN` (fail-open), więc kod musi znać `PAID` przed pierwszym płatnym filmem, a rollback obrazu otwiera te filmy. Token HLS (6 h, bez wiązania z użytkownikiem) dla `PAID` trzeba skrócić do 15-30 min.
9. **Napiwki:** polityka Stripe dopuszcza napiwki za treści (kategoria „restricted", wymaga weryfikacji); ryzykowny jest wyłącznie pasek zbiórki z „Zbieram hajs na mój Tajny Projekt": wygląda na crowdfunding bez konkretnego celu, a przy nadchodzącym filmie sugeruje przedpłatę (więcej ryzyka dla Stripe i VAT). W PL zbiórka online przez przelewy zwykle nie jest „zbiórką publiczną"; KIS traktuje anonimowe wpłaty jako przychód (PIT), nie darowiznę. Badanie przerwane: UE/RODO/AML niezbadane.
10. **Koszty skalowania:** obecny serwer wystarcza na S0; pierwszym twardym limitem jest Workers Free (100 tys. żądań/dobę, ok. 2,2 tys. odtworzeń/dobę), potem pojedynczy encoder i niepodcinane tabele odtwarzania. Od ok. 2 mln odtworzeń/mies. dominuje składowanie w R2 (oryginał + 5 rendycji ok. 1,3 GB/film), koszt spada z ok. 2,3 do ok. 0,25 USD/1000 odtworzeń. DIY jest ok. 4-14x tańsze niż Cloudflare Stream i ok. 3-10x niż Mux; od S3 dominują ludzie i prawo (moderacja, DSA), nie infrastruktura.
11. **Pozycjonowanie:** alternatywy dla YouTube przeżywały tylko z przyniesioną publicznością (Nebula, Dropout) albo kapitałem (Rumble, Kick); „lepszy podział" bez publiczności nigdy nie wystarczył (Vessel, LBRY). Rekomendacja badania: wąski, zamknięty pilotaż „płatny dom dla fanów" z ok. 10 zaproszonymi twórcami i sondowanie ZAiKS; bez otwartej rejestracji, reklam, algorytmu i aplikacji mobilnych, dopóki dane nie przekroczą bramek. Platforma UGC ma obowiązki (wykaz KRRiT, DSA art. 16, DSM art. 17).
12. **Covery:** na własnym serwisie potrzebna jest zgoda wydawcy/autora na synchronizację (sync) per piosenka, plus prawa mechaniczne i publiczne udostępnianie; licencja przymusowa nie obejmuje wideo, a licencje YouTube i Content ID nie działają poza YouTube. Same licencje mechaniczne (Easy Song, Songfile) problemu wideo nie rozwiązują. Szacunek własny badacza: 500-2 000 USD za 10 coverów rocznie przy wydawcach indie, 3 000-10 000+ USD z majorsami, 2-12 tygodni na piosenkę i realne odmowy. Najłatwiejsza ścieżka: utwory własne, w domenie publicznej (autor zmarł w 1955 lub wcześniej), za zgodą, a popularne covery na YouTube.
13. **Domena:** `polutek.com` jest zaparkowana na sprzedaż na GoDaddy (stała cena 799 USD wg sesji; w raporcie pozycjonowania ceny nie dało się odczytać); `polutek.pl` zarejestrował 2026-09-25 ktoś inny i nie jest w koncie Cloudflare właściciela (to koryguje przypuszczenie z pozycjonowania, że może być jego); `polutek.com.mx` jest wolna. Zmiana domeny ma koszt operacyjny: RP ID kluczy dostępu (`pawelperfect.com`), reputacja nadawcy e-mail, przekierowania 301, ponowna indeksacja w 8 językach.
14. **Dokumentacja repo ma dryf:** `CLAUDE.md` §1 pisze, że `PATRON` jest jeszcze w enumie, a `prisma/schema.prisma` ma tylko `PUBLIC` i `LOGGED_IN` (migracja `20261005210000`). Do poprawienia przy najbliższej zmianie tych dokumentów.

## Otwarte decyzje właściciela

Żadna z poniższych nie jest rozstrzygnięta. Propozycje domyślne z raportów są w `platny-dostep-vat-i-narzedzia.md` (sekcja „Decyzje właściciela", 12 pozycji).

1. Czy w ogóle odwrócić model niekomercyjny (płatny dostęp), i co wtedy z napiwkami.
2. Droga sprzedaży: MoR (Stripe Managed Payments, Paddle) czy własny sprzedawca ze Stripe Checkout + Stripe Tax.
3. Kto jest sprzedawcą na koncie Stripe i w dokumentach: LLC, osoba prywatna, JDG czy sp. z o.o. (porównanie w `llc-jdg-spzoo.md`).
4. Produkt: jeden pakiet „wszystko" czy pojedyncze filmy; znaczenie „dożywotni" (życie konta, kanału, serwisu; przyszłe filmy; co po zamknięciu serwisu).
5. Ceny i waluty (brutto/netto, ceny regionalne), polityka zwrotów (14 dni bez pytań czy tylko ustawowo).
6. Zakres: które filmy płatne, czy komentarze czytelne/pisalne bez zakupu, brak odznaki (§4.9), B2B/VAT-ID/prezenty/zakup bez konta w v1 czy nie.
7. Los dostępu po usunięciu konta i okres przechowywania zapisów zakupu.
8. Wykluczenia krajów (sankcje, kraje poza pokryciem MoR) i języki regulaminu (dziś tylko PL/EN).
9. Budżet: prowizja MoR (1,2-3,3 pkt), doradca podatkowy i prawnik (obowiązuje „nic za pieniądze na tym etapie").
10. **Pasek zbiórki i tytuł „Zbieram hajs na mój Tajny Projekt"**: zostawić, usunąć sam pasek, albo usunąć pasek i tytuł (patrz `napiwki-legalnosc.md`).
11. Domena: czy kupować `polutek.com` (799 USD), co z `polutek.pl` (cudza), czy w ogóle zmieniać markę/domenę.
12. Covery: czy licencjonować (pilotaż jednej piosenki), czy publikować tylko utwory własne/domena publiczna, czy popularne covery zostają na YouTube.
13. Pozycjonowanie: czy w ogóle kierować się w stronę wielu kanałów (platforma) i czy robić zamknięty pilotaż z zaproszonymi twórcami.
14. Plan trwałości projektu (propozycja, nie z raportów): `WAKE-UP.md`, `ACCOUNTS.md`, zimna kopia; patrz `docs/operations/STATUS.md`, sekcja „Stan 2026-10-12".

## Do potwierdzenia u polskiego doradcy podatkowego i prawnika

Pełna tabela jest w `platny-dostep-vat-i-narzedzia.md` (sekcja „Co zweryfikować…") i w `llc-jdg-spzoo.md` (sekcja 5). Skrót:

**Doradca podatkowy**
- Czy LLC zarządzana z Polski jest „ustanowiona" w Polsce (art. 10 rozp. 282/2011); czy wnioskować o interpretację indywidualną KIS. To rozstrzyga OSS nieunijny vs polski VAT.
- Struktura: LLC vs JDG vs sp. z o.o.; potwierdzenie, że ryczałt 8,5% nie jest dostępny dla LLC, oraz klasyfikacja PKWiU usługi (15% vs 12% vs 8,5%) i ewentualna opinia klasyfikacyjna GUS.
- Jak ujmować przychód i VAT przy MoR (Stripe/Paddle jako nabywca usługi LLC: VAT-UE, JPK, KSeF; brutto vs netto po prowizji 3,5%).
- Czy podmiot spoza UE może korzystać ze zwolnienia 240 000 zł; skutki retroaktywne wcześniejszego użycia niewłaściwego schematu.
- Podatek dochodowy: miejsce faktycznego zarządu, CFC, umowa PL-USA, ECI; ZUS/zdrowotna właściciela LLC (jedyna interpretacja ZUS z 2016 r.).
- Napiwki w PIT i VAT: przychód czy darowizna, czy wnosić o interpretację KIS w sprawie własnego stanu faktycznego; czy zmiana na sprzedaż dostępu wymaga zmiany rejestracji.
- Faktury B2C i okresy przechowywania (art. 106b ustawy o VAT).

**Prawnik**
- Tekst żądania natychmiastowego startu i formularz odstąpienia; kwalifikacja pakietu jako usługi (C-234/25); klauzule „dożywotni", zmiany oferty (art. 19 dyrektywy 2019/770), wyboru prawa; przycisk odstąpienia (art. 11a).
- Regulamin i Polityka prywatności (`LEGAL_DOCUMENTS_VERSION`), przedstawiciel RODO (art. 27) i tożsamość administratora; analityka bez zgody (EDPB 2/2023).
- Obowiązki platformy UGC, gdyby serwis stał się wielokanałowy: wykaz KRRiT (rozdz. 6b ustawy o radiofonii i telewizji), DSA (art. 16), DSM (art. 17).
- Covery: czy i jak ZAiKS licencjonuje serwis prowadzony przez LLC z polskim właścicielem (pytanie do `internet@zaiks.org.pl`), zakres praw synchronizacji, adaptacje.

**CPA w USA / agent rejestrowy**
- Roczny raport i opłata licencyjna w Wyoming, ważność agenta; Form 5472 + pro forma 1120 (Form 7004); czy agent w Wyoming tworzy nexus dla sales tax; EIN bez SSN, konto bankowe, KYC właściciela spoza USA.

**Do zapytania u dostawców (przed jakąkolwiek integracją)**
- Stripe: kwalifikacja Managed Payments dla osoby/LLC z PL, kod podatkowy dla „streamed, permanent", status produktu (podgląd vs dostępny), kto zbiera zgodę; aktualne opłaty konta USA; ocena paska zbiórki przy aktywacji konta.
- Paddle: akceptacja LLC z właścicielem z PL i kategorii „wideo/kursy" (ręczna weryfikacja domeny i firmy).

## Ograniczenia badań

- Teksty ustaw UE: EUR-Lex był niedostępny; użyto kopii z legislation.gov.uk (stan 31.12.2020) i wytycznych Komisji. Brzmienie warto zweryfikować.
- Strona cennika Stripe dla USA nie wczytała się; stawki kart konta USA są ze źródeł wtórnych. Wiele progów światowych pochodzi z podsumowań Stripe Tax i blogów, nie z ustaw.
- Wyrok C-234/25 znany z komunikatu TSUE i komentarzy; sąd krajowy ma jeszcze zweryfikować kwalifikację, a „dożywotni" nie był omawiany.
- `napiwki-legalnosc.md` przerwano przed ukończeniem (limit narzędzi); sekcja 3 (UE: konsument, RODO, AML) jest niezbadana, sekcja 4 to wnioskowanie.
- `architektura-platnego-dostepu.md` analizuje stan repo z gałęzi `review/gate-sound` (HEAD `77fa243b`, docs z 2026-10-05..07); przed fazą 1 sprawdzić stan `main` i produkcji (konfiguracja Stripe, enum w bazie).
- `llc-jdg-spzoo.md`: skrypt kalkulacji (`calc.py`) nie został zachowany; wzory i założenia są w tekście. Liczby netto są ilustracyjne (koszty operacyjne 15%, kurs 3,9 PLN/USD).
- Koszty skalowania: realna prędkość kodowania 1080p na CPX22, bitrate wyjścia, miss ratio cache i CPU Workera/żądanie są niezmierzone (jawne założenia w `cost_model.py`); koszty pracy ludzi nie są w liczbach infrastruktury.
- Szacunki kosztów licencji na covery to szacunki własne badacza, nie oferty; liczby progów bramek pozycjonowania to propozycje rzędu wielkości.
