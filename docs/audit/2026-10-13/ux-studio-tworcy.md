# C. UX platform wideo dla wielu twórców: research i rekomendacje dla pawelperfect.com

Data researchu: 2026-10-13. Źródła oznaczone [n] znajdziesz w sekcji „Źródła” na końcu. Tam, gdzie oficjalna pomoc nie potwierdza szczegółu, a opieram się na serwisach zewnętrznych, piszę o tym wprost („wg źródeł zewnętrznych”).

---

## Wnioski (TL;DR)

1. **Model konta:** konto (Better Auth) i kanał to osobne byty w relacji 1:N, z tabelą `ChannelMember(role)` od pierwszego dnia. W MVP twarde ograniczenie: **1 kanał na użytkownika** i tylko rola OWNER. Tak robią YouTube (konto Google → kanał osobisty plus kanały Brand Account [4][3]) i PeerTube (konto → wiele kanałów, a od v8.0 edytorzy kanału [9][10]). Model Twitcha, gdzie konto jest kanałem [13], jest prostszy, ale nie da się go potem rozszerzyć. Superadmin nie ma kanału. Obecne filmy właściciela trafiają na kanał należący do jego **zwykłego** konta twórcy, a nie do konta admina.
2. **Uchwyt (@handle) i nazwa:** zasady jak na YouTube: 3–30 znaków, uchwyt jest unikalny i nie rozróżnia wielkości liter, zmiana najwyżej 2 razy na 14 dni. Stary uchwyt YouTube trzyma przez 14 dni i w tym czasie działają oba URL-e [1][2][5]. U nas uchwyt jest w MVP tylko ASCII (`a-z0-9._-`), a zamiast 14 dni **trzymamy historię slugów i robimy 301 przez 180 dni** (Twitch trzyma starą nazwę co najmniej 6 miesięcy [13]). Uchwyty kanałów zweryfikowanych nigdy nie wracają do puli. Każdy kanał ma niezmienne ID, a `/channel/{id}` działa zawsze.
3. **Dodawanie filmu:** kreator w modalu jak w YouTube Studio: Plik → Szczegóły → Elementy → Kontrole → Widoczność [6]. Szkic (DRAFT) zakładamy w bazie **w chwili wyboru pliku**. Metadane zapisują się automatycznie, a upload multipart do R2 trwa w tle i da się go wznowić. Publikacja jest możliwa po gotowości pierwszej renditionu HLS (YouTube wymaga do tego przetworzenia SD [6]) albo przez opcję „opublikuj automatycznie po przetworzeniu” (PeerTube [8]). Wymagane minimum to tytuł w jednym języku. Reszta jest opcjonalna i ma rozsądne wartości domyślne z „Ustawień domyślnych przesyłania”.
4. **Wypłaty:** Stripe Connect z komponentami osadzonymi: onboarding, banner powiadomień, salda, wypłaty, lista wypłat, dokumenty, zarządzanie kontem [17][18][19]. Panel „Wypłaty” ma 5 zakładek: Przegląd, Napiwki, Wypłaty, Dokumenty, Ustawienia. Przed onboardingiem pokazujemy listę kontrolną kwalifikacji (18+, zweryfikowany e-mail, 2FA, co najmniej 1 publiczny film, akceptacja regulaminu twórcy). Opłaty są zawsze rozpisane przed i po napiwku (Ko-fi i Patreon pokazują opłatę i kwotę netto [21][23]).
5. **Napiwki dla widza:** przycisk „Wesprzyj” pod filmem i na stronie kanału. Kwoty predefiniowane (YouTube Super Thanks ma 4 stałe progi [24]) plus własna kwota, opcjonalna wiadomość, która pojawia się jako wyróżniony komentarz (moderowany), oraz opcja anonimowości. Przycisk jest niewidoczny, jeśli kanał nie ma aktywnych wypłat.
6. **Moderacja komentarzy:** ustawienia domyślne na poziomie kanału (nowe filmy je dziedziczą) z możliwością nadpisania per film. Mamy poziomy „wstrzymuj do przeglądu”, zablokowane słowa i linki, ukrytych i zatwierdzonych użytkowników oraz moderatorów kanału, którzy nie mają dostępu do Studia (model YouTube [11][12]). Wstrzymane komentarze trzymamy 60 dni [11].
7. **Trust & safety:** obowiązuje nas DSA. Art. 16 (mechanizm zgłoszeń) i art. 17 (uzasadnienie decyzji) dotyczą każdego hostingu, także małego [27]. Twórca widzi w Studiu zakładkę „Status kanału” z ostrzeżeniami i „strike'ami” (model YouTube: ostrzeżenie, potem 1 tydzień blokady, 2 tygodnie, a 3 strike'i w ciągu 90 dni oznaczają usunięcie kanału [7]) oraz przycisk odwołania. Superadmin ma kolejki zgłoszeń i gradację akcji, od ostrzeżenia po usunięcie, z obowiązkowym uzasadnieniem i logiem audytu.
8. **Strona główna bez algorytmu:** sekcje „Najnowsze z subskrypcji”, „Wybór redakcji”, „Najnowsze”, „Popularne w tym tygodniu”, „Kategorie” i „Nowe kanały”. Wyszukiwarka obejmuje filmy i kanały. Każdy film i kanał da się zgłosić, a kanał zablokować.
9. **Analityka w MVP:** wyświetlenia, czas oglądania, średni czas oglądania z wykresem utrzymania widzów, źródła ruchu (wewnętrzne/zewnętrzne/embed), subskrybenci +/-, napiwki brutto i netto. Zakres dat: 7, 28 i 90 dni.
10. **O czym właściciel nie pomyślał (MVP):** ustawienia domyślne przesyłania, limity uploadu i przestrzeni per twórca (z poziomem „zaufany”), wznawialny upload, historia slugów, oświadczenie o treściach AI (YouTube wymaga go od 2024 [25]), weryfikacja 2FA przed włączeniem wypłat, log aktywności kanału, eksport danych przy usuwaniu, ukrycie kanału zamiast usunięcia (YouTube [14]), zgłoszenia DSA, limity szybkości komentarzy i napiwków, banner „Ten kanał jest nowy”.

---

## 1. Model: konto a kanał

### Jak robią inni

- **YouTube.** Do oglądania, polubień i subskrypcji wystarczy konto Google, ale do uploadu, komentowania i tworzenia playlist trzeba mieć kanał. Kanał osobisty zarządza tylko właściciel. Kanał na Brand Account może mieć wielu właścicieli i menedżerów oraz inną nazwę niż konto Google, a każdy Brand Account może mieć tylko jeden kanał [4]. Nowszy system „uprawnień kanału” ma role [3]:
  - **Właściciel:** wszystko, łącznie z usunięciem kanału. Własności nie da się przekazać.
  - **Menedżer:** wszystko poza usunięciem kanału, także zarządzanie uprawnieniami.
  - **Edytor:** edycja i publikacja. Nie usuwa opublikowanych treści i nie zarządza uprawnieniami.
  - **Edytor (ograniczony):** jak Edytor, bez dostępu do danych o przychodach.
  - **Edytor napisów:** tylko napisy.
  - **Widz i Widz (ograniczony):** tylko podgląd, odpowiednio z przychodami lub bez.
  
  Zaproszenia wysyła się e-mailem i wygasają po 30 dniach [3].
- **Twitch.** Konto i kanał to jedno. URL kanału to nazwa użytkownika, którą można zmienić raz na 60 dni. **URL po zmianie nie przekierowuje**, a stara nazwa jest zatrzymana na co najmniej 6 miesięcy. Partnerzy nigdy nie zwalniają starej nazwy [13].
- **PeerTube.** Konto (login niezmienny, nazwa wyświetlana zmienna) ma wiele kanałów. Przy rejestracji zakłada się kanał domyślny: nazwa (id) i nazwa wyświetlana [9]. Pola kanału to Name (identyfikator), Display name, opis (Markdown) i Support (linki do wsparcia) [10]. Od **v8.0** (grudzień 2025) właściciel może zapraszać innych użytkowników instancji jako **edytorów**. Edytor publikuje i edytuje filmy, playlisty i komentarze oraz dane kanału, ale nie usuwa kanału i nie zarządza edytorami. Jest też strona „Activity” z logiem działań edytorów. Od **v8.2** (maj 2026) można przekazać kanał innemu kontu, a przekazanie wymaga akceptacji odbiorcy [10][28].
- **Vimeo.** Konto plus „Team” z rolami Viewer, Contributor, Contributor Plus (Enterprise), Uploader, Admin i Owner. Admin widzi całą zawartość, a Owner ma dodatkowo rozliczenia [15].
- **Rumble.** Nazwa kanału wyznacza URL, a osobny „title” wyświetla się na bannerze [16]. Oficjalnej informacji o liczbie kanałów na konto nie znalazłem.
- **Nebula i Floatplane.** To platformy kuratorowane. Nebula jest współwłasnością twórców, ma podział zysków 50/50 ważony czasem oglądania i nie ma otwartej rejestracji kanałów [29]. Na Floatplane każdy twórca sam ustala plany subskrypcji, a platforma pobiera prowizję (wg źródeł zewnętrznych, dawniej było to beta tylko na zaproszenie) [30].
- **Patreon, Ko-fi, Buy Me a Coffee.** Jedno konto twórcy odpowiada jednej stronie. Wielu stron nie rozwiązuje się w ramach jednego konta.

### Plusy i minusy dla nas

| Model | Plusy | Minusy |
|---|---|---|
| Konto = kanał (Twitch) | Najprostszy, zero dodatkowych ekranów | Nie da się zrobić zespołów ani wielu kanałów. Admin musiałby „być” kanałem. Zmiana nicku łamie URL |
| Konto → 1 kanał (tabela kanałów, limit 1) | Prosty UX, a dane gotowe na rozszerzenie | Wymaga przełącznika kanałów dopiero w v2 |
| Konto → N kanałów + role (YouTube/PeerTube) | Pełna elastyczność: zespoły, marki, przekazanie kanału | Więcej UI (przełącznik, zaproszenia, uprawnienia), większa powierzchnia nadużyć (farmy kanałów) |

### Rekomendacja dla nas

- **Schemat od razu docelowy:** `Channel` (id: cuid, handle, displayName, ...) i `ChannelMember(channelId, userId, role, invitedBy, acceptedAt)`. Role w enum: `OWNER | MANAGER | EDITOR | EDITOR_LIMITED | SUBTITLER | MODERATOR | VIEWER`. W MVP używamy tylko `OWNER`.
- **Limit `maxChannelsPerUser = 1`** jako ustawienie globalne w panelu superadmina, z możliwością nadania wyjątku konkretnemu użytkownikowi. W v2 podnosimy limit do 3–5 i dodajemy przełącznik kanałów w menu konta (jak YouTube „Przełącz konto”).
- **Role zespołowe w v2:** najpierw MANAGER, EDITOR i SUBTITLER/TŁUMACZ (pasuje do istniejącego workflow tłumaczeń PL/EN), potem VIEWER-finanse. Zaproszenie idzie e-mailem do istniejącego konta, wygasa po 30 dniach (jak YouTube) i wymaga akceptacji (jak PeerTube). Tylko OWNER może usunąć kanał, przekazać go i podłączyć lub zmienić konto Stripe. Do tego „Aktywność kanału”, czyli log działań członków.
- **Superadmin:** osobna rola platformowa (`user.platformRole = SUPERADMIN | STAFF_MODERATOR | USER`), niezależna od `ChannelMember`. Superadmin nie pojawia się w `ChannelMember`, a działa przez admin.pawelperfect.com.
- **Migracja obecnego kanału:** utwórz kanał „Paweł Perfect” (`@pawelperfect`) z OWNER-em będącym **osobnym, zwykłym kontem** właściciela, a nie kontem superadmina. Wszystkie obecne filmy, komentarze i historię napiwków przypisz do tego kanału. Dzięki temu admin „nie ma kanału”, a właściciel jako twórca korzysta z tego samego Studia co inni.
- **Rejestracja widza nie zakłada kanału.** Kanał jest opcjonalny („Utwórz kanał”), inaczej niż w PeerTube. Komentowanie u nas **nie wymaga kanału**: komentuje konto z nickiem. To świadoma różnica wobec YouTube [4], prostsza dla widzów.

---

## 2. Tworzenie kanału, nazwa, uchwyt

### Jak robią inni

- **YouTube: kroki.** Ustawienia → „Dodaj kanał lub zarządzaj kanałami” → „Utwórz kanał” → zdjęcie, nazwa, uchwyt → „Utwórz kanał”. Te trzy pola wystarczają [4]. Uchwyt może zostać nadany automatycznie z nazwy, a gdy konwersja się nie uda, jest losowy [1].
- **YouTube: zasady uchwytu** [1]:
  - 3–30 znaków (wyjątki dla CJK i innych pism);
  - litery i cyfry z 75 języków oraz `_ - . ·`, ale nie na początku ani na końcu;
  - bez rozróżniania wielkości liter, bez mieszania pism LTR i RTL;
  - nie może wyglądać jak URL ani numer telefonu, musi być unikalny;
  - nie wolno go sprzedawać ani przekazywać;
  - uchwyty obraźliwe lub spamowe są odbierane i zastępowane wygenerowanymi.
- **YouTube: zmiany.** Uchwyt można zmienić 2 razy na 14 dni. Stary jest zatrzymany 14 dni dla właściciela, w tym czasie działają oba URL-e, a potem staje się dostępny dla innych [5]. Nazwę kanału też można zmienić 2 razy na 14 dni, a **zmiana nazwy usuwa odznakę weryfikacji** [2]. Zmiana uchwytu odznaki nie usuwa [26]. Propagacja zmiany nazwy trwa do kilku dni [2].
- **YouTube: weryfikacja (odznaka).** Wymaga 100 tys. subskrybentów (lub proaktywnej weryfikacji znanych kanałów), włączonego 2FA, kompletnego profilu (banner, awatar, opis, co najmniej 1 publiczny film), autentyczności i aktywności [26].
- **Twitch.** Nazwa ma co najmniej 4 znaki, wymaga zweryfikowanego e-maila, zmiana raz na 60 dni, bez przekierowania. Zmiana samej wielkości liter (display name) jest dozwolona zawsze [13].
- **PeerTube.** Handle kanału ma postać `nazwa@instancja`. Dokumentacja nie opisuje zmiany „Name” po utworzeniu [10]. W praktyce identyfikator jest wpięty w adresy ActivityPub i uważa się go za niezmienny (wg dyskusji społeczności ActivityPub [31]). Display name zmienia się dowolnie.

### Rekomendacja dla nas

**Wejście:** menu konta (awatar) → „Utwórz kanał” (gdy użytkownik nie ma kanału) lub „Twój kanał” i „Studio twórcy” (gdy ma). Ten sam CTA pojawia się w Ustawieniach konta w karcie „Kanał” oraz w pustym stanie przycisku „Prześlij”.

**Ekran „Utwórz kanał” (modal lub pełna strona, 1 krok):**

| Pole | Wymagane | Reguły |
|---|---|---|
| Nazwa kanału (displayName) | tak | 1–50 znaków Unicode, trim, bez znaków sterujących i zero-width, maks. 3 emoji. Filtr wulgaryzmów (8 języków UI). Ostrzeżenie (miękkie), gdy nazwa jest bardzo podobna do kanału zweryfikowanego |
| Uchwyt @ | tak (podpowiadany na żywo z nazwy, z transliteracją ł→l, ą→a) | 3–30 znaków, `[a-z0-9._-]`, bez znaku specjalnego na początku/końcu i bez dwóch pod rząd, nie same cyfry, nie wzorzec URL ani telefonu. Unikalność case-insensitive, lista zarezerwowanych, filtr wulgaryzmów. Sprawdzanie dostępności z debounce 300 ms i podpowiedzi alternatyw („pawel.perfect”, „pawelperfect_tv”), jak YouTube [5] |
| Zdjęcie profilowe | nie | JPG/PNG/WebP, min. 98×98, maks. 4 MB. Kadrowanie do koła. Domyślnie inicjały na kolorowym tle |
| Główny język kanału | tak (domyślnie język UI) | PL/EN/…, wpływa na domyślny język nowych filmów |
| Kraj | nie | Przydaje się później do Stripe i statystyk |
| Akceptacja „Zasad dla twórców” | tak | Checkbox z linkiem; zapisujemy wersję regulaminu i datę |

Po „Utwórz kanał” pokazujemy ekran sukcesu z listą kontrolną onboardingu (sekcja 9) i CTA „Prześlij pierwszy film”.

**Zarezerwowane uchwyty (seed plus edycja w adminie):**
- wszystkie segmenty tras aplikacji: `admin, api, studio, www, app, auth, login, logout, signup, register, settings, account, upload, watch, embed, search, feed, subscriptions, explore, trending, channel, c, u, v, about, help, support, terms, privacy, legal, dmca, report, payouts, wyplaty, stripe, status, blog, docs, static, assets, cdn, hls, media`;
- nazwy marki: `pawelperfect`, `pawel-perfect`, `perfect`, `official`, `oficjalny`, `team`, `staff`, `moderator`, `mod`, `system`, `root`, `null`, `undefined`;
- odpowiedniki w 8 językach UI (np. `pomoc`, `ustawienia`, `hilfe`, `ayuda`);
- znane marki i osoby: lista „chroniona”, zwalniana tylko przez admina po weryfikacji tożsamości.

**Podszywanie się (impersonacja):**
- uchwyt tylko ASCII w MVP, co eliminuje homoglify (Unicode w uchwytach dopiero w v2, ze „skeleton” wg Unicode UTS #39);
- nazwa wyświetlana może być dowolna, ale gdy jest identyczna lub prawie identyczna z kanałem zweryfikowanym, trafia do kolejki „Do sprawdzenia” w adminie (kanał działa, flaga jest cicha);
- przycisk „Zgłoś → Podszywanie się” na stronie kanału.

**Zmiana nazwy i uchwytu (Studio → Personalizacja → Profil):**
- **Nazwa:** maks. 2 zmiany na 14 dni (jak YouTube [2]). Na kanale zweryfikowanym pokazujemy ostrzeżenie „Zmiana nazwy usunie odznakę weryfikacji do czasu ponownej weryfikacji” (YouTube [2][26]). Alternatywa łagodniejsza: odznaka zostaje, a zmiana trafia do kolejki admina.
- **Uchwyt:** maks. 2 zmiany na 14 dni. Modal z podsumowaniem: „Twój stary adres @stary będzie przekierowywał na @nowy przez 180 dni. Przez 14 dni możesz wrócić do starego uchwytu.”
- **Historia slugów:** tabela `ChannelHandleHistory(handle, channelId, releasedAt, reservedUntil)`. Żądanie `/@stary` daje 301 na `/@nowy` do `reservedUntil` (180 dni). Przez ten czas nikt inny nie może zająć starego uchwytu. Uchwyty kanałów zweryfikowanych i kanałów, które miały powyżej X subskrybentów, nie są nigdy zwalniane (wzór: Partnerzy Twitcha [13]).
- **Zawsze działające linki:** `/channel/{id}`, a w osadzeniach i e-mailach linkujemy po ID filmu, nie po uchwycie. Linki do filmów (`/watch/{videoId}` lub `/v/{id}`) nie zawierają uchwytu, więc zmiana uchwytu ich nie łamie.
- Zmiana nazwy i uchwytu trafia do logu audytu kanału, a admin widzi historię.

---

## 3. Personalizacja i branding kanału

### Jak robią inni

YouTube Studio → **Personalizacja** obejmuje układ strony kanału (zwiastun dla niesubskrybentów, film polecany, sekcje), branding (zdjęcie profilowe, banner, znak wodny filmu) oraz podstawowe informacje (nazwa, uchwyt, opis, linki, e-mail kontaktowy) [32]. PeerTube ma nazwę wyświetlaną, opis w Markdown, pole „Support”, awatar i banner [10]. Rumble rozdziela URL (nazwę) od tytułu na bannerze [16].

### Rekomendacja dla nas

**MVP: Studio → Personalizacja, 3 zakładki:**
1. **Profil:** nazwa, uchwyt (z limitami jak wyżej), opis PL i EN (maks. 1000 znaków, linki autolinkowane z `rel="nofollow ugc"`), do 5 linków (tytuł + URL, ikony znanych serwisów), publiczny e-mail kontaktowy (opcjonalnie, ukryty za „Pokaż e-mail” dla zalogowanych, żeby utrudnić scraping), kraj, główny język.
2. **Branding:** awatar i banner (zalecane 2560×1440 z podglądem „bezpiecznej strefy” na telefon, TV i desktop, maks. 6 MB).
3. **Układ:** „Film polecany dla nowych widzów” (zwiastun) i „Film polecany dla subskrybentów”.

Każda zakładka ma przyciski „Opublikuj” i „Anuluj” oraz link „Wyświetl kanał” (podgląd), jak YouTube.

**v2:** sekcje strony głównej kanału (Najnowsze, Popularne, Playlista X), znak wodny, tłumaczenia nazwy i opisu na pozostałe języki UI (wpięte w istniejący workflow tłumaczeń), własny kolor akcentu.

**Później:** własna domena kanału, strona „O kanale” z rozbudowanymi statystykami.

---

## 4. Dodawanie filmu (upload)

### Jak robią inni

**YouTube Studio** [6]:
1. **UTWÓRZ → Prześlij filmy.** Można wybrać do 15 plików naraz, a każdy edytuje się osobno.
2. **Przetwarzanie.** Studio pokazuje szacowany czas osobno dla SD, HD i 4K. Wyższe jakości trwają dłużej, a weryfikacja konta przyspiesza przetwarzanie.
3. **Szczegóły:**
   - tytuł (do 100 znaków) i opis (do 5000 znaków), z opcją „użyj ponownie szczegółów” z poprzedniego filmu;
   - miniatura i playlisty (opcjonalne);
   - **Odbiorcy, czyli „przeznaczone dla dzieci”: jedyne pole obowiązkowe poza tytułem (COPPA)**;
   - ograniczenie wiekowe i film powiązany;
   - w sekcji „Pokaż więcej”: płatna promocja, **oświadczenie o treściach zmienionych lub syntetycznych**, automatyczne rozdziały, tagi, język i certyfikacja napisów, data i miejsce nagrania, licencja, kategoria, komentarze i oceny, napisy, ekran końcowy, karty.
4. **Elementy filmu:** napisy, ekran końcowy (film musi mieć co najmniej 25 s), karty.
5. **Kontrole:** sprawdzanie praw autorskich działa w tle i można publikować w trakcie. Wyniki nie są ostateczne.
6. **Widoczność:** Prywatny, Niepubliczny lub Publiczny. Możliwa natychmiastowa Premiera i Harmonogram (do daty publikacji film jest prywatny). **Publikacja wymaga ukończenia przetwarzania SD.**
- Zamknięcie okna przed etapem „Widoczność” zapisuje film jako prywatny w „Treściach” [6]. Wg poradnika uczelni ląduje jako szkic [33].
- Domyślna widoczność dla twórców w wieku 13–17 lat to Prywatny [6].
- Zaplanowane filmy nie publikują się w czasie kary za strike [6].

**Limity YouTube:**
- bez weryfikacji: 15 minut na film. Weryfikacja przez telefon zdejmuje ten limit [34];
- maksimum: **256 GB lub 12 h** [34];
- istnieje dzienny limit przesyłania na kanał, wspólny dla desktopu, aplikacji i API, ale jego wartość nie jest publiczna [6].

**Edycja po publikacji (YouTube):** edytor Studia pozwala przyciąć film i zamazać fragmenty. **Pliku nie można podmienić z zachowaniem URL**, a nowa wersja oznacza nowy upload (wg źródeł zewnętrznych [35]).

**PeerTube** [8]:
- „Publish”: najpierw wybór kanału i prywatności, potem pliku. **Metadane edytuje się w trakcie uploadu.**
- Prywatność: Public, Internal (tylko zalogowani na instancji, czyli odpowiednik naszego LOGGED_IN), Unlisted, Private, Password protected i Scheduled.
- Pola: tytuł, opis (Markdown), do 5 tagów, tekst „support”, kanał, miniatura (PNG/JPG/WebP do 8 MB, zalecane 1280×720), licencja, kategoria, język, oryginalna data publikacji, zgoda na pobieranie, polityka komentarzy, ostrzeżenie o treściach wrażliwych, ograniczenie domen dla embedów.
- Automatyczna transkrypcja (6.2+), napisy .vtt/.srt per język, rozdziały w formacie `H:MM:SS` (także z opisu).
- **Podmiana pliku** (6.0+, jeśli admin włączy) trwale usuwa poprzednią wersję i pokazuje datę ponownego uploadu.
- Opcja **„Publish video after transcoding”**.

**Vimeo:** podmiana pliku zachowuje URL, komentarze, statystyki i polubienia. Oryginał jest odtwarzalny do momentu rozpoczęcia konwersji nowego pliku. Plany wyższe mają historię wersji z przywracaniem [36].

### Rekomendacja dla nas: kreator „Prześlij film”

**Zasada nadrzędna:** upload i metadane to dwa niezależne procesy. Film w bazie powstaje w chwili wyboru pliku, a użytkownik nie traci pracy, nawet jeśli zamknie modal.

**Wejście:** przycisk „+ Utwórz → Prześlij film” w nagłówku Studia oraz na stronie kanału (widok właściciela) i w pustym stanie listy „Treści”. Drag & drop pliku na dowolną stronę Studia otwiera kreator.

**Krok 0: wybór pliku(ów)**
- Strefa drag & drop i „Wybierz pliki”. W MVP 1 plik naraz, w v2 do 10. Akceptujemy `video/*` (MP4, MOV, MKV, WebM, AVI), walidacja po stronie klienta: typ MIME, rozmiar i długość (odczyt metadanych przez `<video>`).
- Ostrzeżenia przed startem: „Plik ma 18 GB. Twój limit to 10 GB”. Za długi film skutkuje informacją, jak podnieść limit (poziom zaufania, zob. sekcja 13).
- Po wyborze:
  1. `POST /videos` tworzy `Video{status: DRAFT, uploadState: UPLOADING}` z tytułem = nazwa pliku bez rozszerzenia;
  2. start presigned multipart do R2 (części 8–64 MB, 3–4 równoległe);
  3. kreator przechodzi do kroku „Szczegóły”.
- **Wznawialność:** `uploadId`, numery i ETagi części zapisujemy w IndexedDB i w bazie. Po odświeżeniu lub ponownym wejściu Studio pokazuje „Przesyłanie przerwane: wybierz ten sam plik, aby wznowić”. Zgodność pliku sprawdzamy po nazwie, rozmiarze, `lastModified` i haszu pierwszych 8 MB.
- **Globalny menedżer uploadów** (kontekst w layoucie Studia) sprawia, że upload trwa przy nawigacji wewnątrz aplikacji. Mini-pasek w rogu pokazuje „Przesyłanie 1 filmu: 43%”. `beforeunload` ostrzega przy zamykaniu karty tylko, gdy trwa przesyłanie bajtów.

**Pasek stanu w stopce kreatora (zawsze widoczny)**, wzorowany na ikonach YouTube [6]:
- `Przesyłanie 43% • zostało ~6 min` → `Przesłano` → `W kolejce do przetwarzania (pozycja 3)` → `Przetwarzanie: 360p gotowe, 720p 40%, 1080p w kolejce` → `Gotowe`;
- `Kontrole: brak problemów` / `Kontrole: 1 uwaga`;
- link „Kopiuj link do filmu” jest aktywny od razu (URL istnieje, choć film to wciąż szkic).

**Krok 1: Szczegóły** (autozapis co 2 s i na blur, ze wskaźnikiem „Zapisano”)

| Pole | Wymagane | Uwagi |
|---|---|---|
| Tytuł PL / EN (zakładki językowe) | **tak, co najmniej w jednym języku** | maks. 100 znaków (jak YouTube [6]). Licznik znaków. Język główny zgodny z językiem kanału. Przycisk „Zleć tłumaczenie” (istniejący workflow) |
| Opis PL / EN | nie | maks. 5000 znaków, linki i znaczniki czasu (`00:00 Wstęp` daje rozdziały automatycznie, jak PeerTube [8]). Opcja „Wypełnij szczegółami z poprzedniego filmu” |
| Miniatura | nie (auto) | 3 kadry wygenerowane przez encoder (np. 25%, 50%, 75%) do wyboru, aktywne po pierwszej renditionie, plus „Prześlij własną” (JPG/PNG/WebP, 1280×720, maks. 2 MB, kadr 16:9) |
| Playlisty | nie | (v2) |
| Treści dla dorosłych / ograniczenie wiekowe | **tak (odpowiedź tak/nie)** | Odpowiednik pola „Odbiorcy” w YouTube: jedna obowiązkowa decyzja. „Tak” wymusza tier LOGGED_IN z potwierdzeniem wieku i blur miniatury (jak NSFW w PeerTube [8]) |
| Treści zmienione lub syntetyczne (AI) | tak/nie, domyślnie „nie” | Realistyczne treści wygenerowane lub zmienione AI dostają etykietę na odtwarzaczu (polityka YouTube [25]) |
| Płatna promocja / lokowanie | nie | Etykieta „Zawiera płatną promocję” |
| Kategoria | nie (domyślnie z kanału) | Lista globalna zarządzana przez admina; potrzebna do odkrywania treści |
| Tagi | nie | maks. 10, każdy do 30 znaków |
| Język filmu | tak (domyślnie z kanału) | Potrzebny do filtrów i napisów |
| Data nagrania | nie | |
| Komentarze | domyślnie z ustawień kanału | Włączone / Wstrzymuj wszystkie do przeglądu / Wyłączone (sekcja 6) |
| Napiwki pod tym filmem | domyślnie „tak”, jeśli wypłaty aktywne | Przełącznik |
| Licencja | nie (domyślnie „Wszelkie prawa zastrzeżone”) | Opcjonalnie CC BY (v2) |

**Krok 2: Elementy**
- **Napisy:** dla PL, EN i pozostałych języków „Prześlij plik” (.vtt/.srt, walidacja kodowania UTF-8 i sygnatur czasu) albo „Wygeneruj automatycznie” (v2, np. Whisper w kolejce encodera; transkrypcja z możliwością edycji jak w PeerTube 6.2 [8]).
- **Rozdziały:** wykryte z opisu z podglądem, plus edytor tabelaryczny (v2).
- **Tłumaczenia:** status tytułu, opisu i napisów per język (istniejący workflow).

**Krok 3: Kontrole** (automatyczne, nie blokują edycji)
- stan kodowania: kodek i kontener obsługiwane, długość, czy jest audio;
- **duplikat:** hash pliku (SHA-256 lub perceptual hash w v2) taki sam jak film już na platformie. Pokazujemy „Ten plik został już przesłany na kanał X”, a dla cudzego kanału flaga do admina;
- kompletność: brak miniatury lub opisu to tylko informacja, nie błąd;
- moderacja automatyczna (v2/później): skan klatek pod kątem nagości lub CSAM, np. hashe PhotoDNA lub Cloudflare CSAM Scanning Tool na miniaturach, a filmy przy flagach do kolejki admina.
- Brak odpowiednika Content ID. Zamiast tego oświadczenie twórcy w regulaminie i ścieżka zgłoszeń naruszeń praw autorskich (sekcja 11).

**Krok 4: Widoczność**
- Radio:
  - **Prywatny (szkic)**: tylko kanał. Nasz `DRAFT`.
  - **Niepubliczny**: każdy z linkiem. `UNLISTED`.
  - **Publiczny**: `PUBLISHED`. Pod nim podopcja dostępu: „Wszyscy” (`PUBLIC`) lub „Tylko zalogowani” (`LOGGED_IN`).
- „Zaplanuj”: data, godzina i strefa czasowa (domyślnie przeglądarki, z wyświetleniem w strefie kanału). Opcjonalnie checkbox „Ustaw jako premierę”: odliczanie na stronie filmu, czat lub komentarze, przypomnienie dla subskrybentów.
- Publikacja jest możliwa, gdy gotowa jest co najmniej jedna renditiona (360p lub 480p), analogicznie do wymogu SD w YouTube [6]. Wcześniej przycisk brzmi **„Opublikuj po przetworzeniu”** (jak PeerTube [8]), co ustawia `publishWhenReady=true`.
- Po kliknięciu: ekran „Film opublikowany” z linkiem, przyciskami udostępniania i kodem embed. Jeśli przetwarzanie trwa: „Film zostanie opublikowany automatycznie, gdy będzie gotowy. Wyślemy Ci powiadomienie.”

**Stany techniczne (`Video.processingState`) i to, co widzi twórca:**

| Stan | Komunikat w Studiu | Akcje |
|---|---|---|
| `UPLOADING` | „Przesyłanie 43%” | Wstrzymaj, Anuluj (usuwa szkic i części w R2 po potwierdzeniu) |
| `UPLOAD_INTERRUPTED` | „Przesyłanie przerwane” | Wznów (wybierz plik ponownie), Usuń |
| `UPLOADED` / `QUEUED` | „W kolejce do przetwarzania” | edycja metadanych |
| `PROCESSING` | „Przetwarzanie 720p 40%” | edycja metadanych, publikacja po pierwszej renditionie |
| `READY` | „Gotowe” | wszystko |
| `FAILED` | „Nie udało się przetworzyć: nieobsługiwany kodek audio (np. …). Wyeksportuj jako MP4 H.264/AAC” | Ponów, Prześlij nowy plik, Usuń |
| `BLOCKED` | „Zablokowany przez moderację: zobacz Status kanału” | Odwołaj się |

- **Błędy uploadu:** utrata sieci daje automatyczny retry części z backoffem (5 prób), potem stan „przerwane”. Wygaśnięcie presigned URL powoduje ciche odnowienie. Przekroczenie limitu przestrzeni daje komunikat przed startem, a nie w trakcie.
- **Powiadomienia:** „Twój film jest gotowy” lub „Przetwarzanie nie powiodło się” (in-app i e-mail, opcjonalnie).
- **Porzucone szkice** bez ukończonego uploadu przez 7 dni: przypomnienie, a po 30 dniach automatyczne czyszczenie części multipart w R2 (reguła lifecycle `AbortIncompleteMultipartUpload`).

**Wskazówki formatu** (link „Zalecane ustawienia” przy uploadzie): MP4 (H.264 lub HEVC, AAC 48 kHz), progresywny, rozdzielczość natywna do 4K, stała liczba klatek, „fast start”. Oryginał trzymamy (sekcja 5, podmiana pliku).

---

## 5. Zarządzanie filmami

### Jak robią inni

- **YouTube „Treści”:** zakładki (Filmy, Shorts, Na żywo, Posty, Playlisty), filtry (widoczność, prawa autorskie, ograniczenia) i edycja zbiorcza (wg źródeł zewnętrznych [32]). Status praw autorskich sprawdza się w kolumnie „Ograniczenia” [37]. Edytor pozwala przycinać i zamazywać, ale nie podmieniać pliku [35].
- **Vimeo:** podmiana pliku z zachowaniem URL, statystyk i komentarzy oraz historia wersji [36].
- **PeerTube:** „Replace file” (opcja admina) usuwa poprzednią wersję i pokazuje datę re-uploadu. Rozdziały, napisy i przeniesienie własności filmu [8][10].
- **YouTube:** usunięcie filmu nie zdejmuje strike'a [7].

### Rekomendacja dla nas: Studio → Treści

**Lista (tabela):** miniatura z czasem trwania, tytuł z flagami języków (które tłumaczenia są kompletne), widoczność (ikona i tekst), dostęp (Wszyscy/Zalogowani), ograniczenia (Dorośli, Moderacja, Prawa autorskie), stan przetwarzania, data publikacji lub planowana, wyświetlenia, komentarze, polubienia (% łapek w górę), napiwki (suma).

- **Filtry:** widoczność, stan, język z brakującym tłumaczeniem, ograniczenia, zakres dat. Wyszukiwanie po tytule.
- **Zakładki:** Filmy, Premiery i zaplanowane, Szkice, Zarchiwizowane. W v2 Playlisty.
- **Akcje zbiorcze** (zaznaczenie kilku): zmień widoczność, zmień dostęp, ustawienia komentarzy, kategoria, dodaj do playlisty (v2), archiwizuj, usuń. Każda pokazuje podsumowanie przed wykonaniem.

**Edycja po publikacji (strona filmu w Studiu, zakładki Szczegóły / Napisy i tłumaczenia / Komentarze / Analityka):**
- Wszystko z kreatora można edytować w dowolnym momencie, a zmiany tytułu, opisu i miniatury są natychmiastowe.
- **Podmiana pliku (przewaga nad YouTube):** „Zastąp plik wideo”. Nowy upload koduje się w tle, a stary HLS jest serwowany do czasu gotowości nowego (lepiej niż Vimeo, które ma przerwę [36]). Atomowe przełączenie zachowuje URL, statystyki, komentarze i napiwki. Pod filmem pokazujemy „Zaktualizowano DD.MM” (jak PeerTube [8]). Ostrzeżenie: napisy i rozdziały mogą przestać pasować, więc dajemy opcję oznaczenia napisów jako „do weryfikacji”. Poprzedni oryginał trzymamy 30 dni („Przywróć poprzednią wersję”), potem usuwamy. **Ograniczenie:** podmiana resetuje kontrolę duplikatów i auto-moderację, a przy statusie „pod obserwacją” wymaga akceptacji admina, bo inaczej da się podmienić niewinny film na zakazany po zebraniu wyświetleń.
- **Archiwizuj** (`ARCHIVED`): film znika z kanału i wyszukiwarki, a link pokazuje „Ten film został zarchiwizowany przez twórcę”. Statystyki i napiwki zostają. Działanie jest odwracalne.
- **Usuń:** modal z wpisaniem tytułu, informacją co zginie (komentarze, statystyki) i co zostaje (historia napiwków w panelu Wypłat, bo dane finansowe muszą przetrwać), opcją „Pobierz oryginał przed usunięciem”. Soft delete przez 30 dni z możliwością przywrócenia w „Kosz”, potem twarde usunięcie plików z R2. Usunięcie nie zdejmuje ostrzeżeń ani strike'ów (jak YouTube [7]).
- **Planowanie i premiery:** edycja daty do momentu publikacji. Zmiana z premiery na zwykłą publikację jest dozwolona do startu.
- **Napisy:** zakładka per język ze statusem (brak / szkic / opublikowane / do weryfikacji), uploadem, edytorem online (v2) i pobieraniem.
- **Miniatury:** w v2 test A/B miniatur, który YouTube oferuje, pomijamy. Nie jest potrzebny w MVP.

---

## 6. Moderacja komentarzy przez twórcę

### Jak robią inni

**YouTube** [11][12]:
- **Ustawienia per film:**
  - Komentarze włączone, z poziomem moderacji: Brak / Podstawowa / Ścisła / Wstrzymuj wszystkie. Wstrzymane komentarze czekają w Studiu do 60 dni.
  - Wstrzymane (istniejące widoczne, nowe zablokowane).
  - Wyłączone.
  - Opcjonalnie ograniczenie komentowania do subskrybentów o minimalnym stażu.
- **Narzędzia na poziomie kanału** (nie da się ich ustawić per film):
  - ukryci użytkownicy (ich komentarze nie są widoczne na żadnym filmie kanału);
  - zatwierdzeni użytkownicy (omijają filtry);
  - zablokowane słowa (komentarze z nimi są wstrzymywane);
  - blokowanie linków.
- **Ustawienie domyślne dla nowych filmów:** nie zmienia istniejących, można je nadpisać per film [11].
- **Moderatorzy:** dwa poziomy, standardowy (ukrywa użytkowników, wstrzymuje komentarze) i zarządzający (dodatkowo zablokowane słowa i dodawanie moderatorów standardowych). **Moderatorzy nie mają dostępu do Studia**, a dodaje się ich po URL kanału. Oficjalne tabele YouTube są tu częściowo niespójne [12].

### Rekomendacja dla nas

**Rozdział kompetencji:**

| Twórca (i jego moderatorzy) może | Tylko personel platformy może |
|---|---|
| ukryć i odkryć komentarz na swoim kanale, usunąć go z kanału | trwale usunąć komentarz z bazy, zbanować konto platformowo |
| wstrzymywać komentarze do przeglądu (wszystkie / z linkami / ze słowami) | widzieć zgłoszenia z całej platformy, decydować o nielegalności (DSA) |
| ukryć użytkownika na swoim kanale (shadow: on widzi swoje komentarze, inni nie) | zablokować użytkownikowi komentowanie wszędzie |
| serduszko, przypięcie (1 na film), odpowiedź jako twórca | zmienić ustawienia domyślne platformy, globalne listy słów |
| zgłosić komentarz lub użytkownika do personelu | |

**Studio → Komentarze** (zakładki):
- **Opublikowane:** wszystkie komentarze z kanału, filtry „bez odpowiedzi twórcy”, „z pytaniem”, „z napiwkiem”, wyszukiwanie. Akcje inline: Odpowiedz, ❤, Przypnij, Ukryj, Ukryj użytkownika na kanale, Zgłoś.
- **Do przeglądu:** wstrzymane, z powodem („zablokowane słowo: …”, „link”, „nowe konto”, „filtr spamu”). Akcje: Zatwierdź, Odrzuć, Zatwierdź i dodaj autora do zatwierdzonych. Automatyczne odrzucenie po 60 dniach (jak YouTube [11]).
- **Ukryte i usunięte:** z możliwością przywrócenia (30 dni).

**Studio → Ustawienia → Społeczność:**
- **Ustawienia domyślne dla nowych filmów:** Włączone / Wstrzymuj potencjalnie nieodpowiednie / Wstrzymuj wszystkie / Wyłączone. Komentować mogą: Zalogowani (domyślnie) / Konta starsze niż N dni / Subskrybenci.
- Zablokowane słowa (lista, z importem), opcja „Wstrzymuj komentarze z linkami”.
- Ukryci użytkownicy i Zatwierdzeni użytkownicy.
- **Moderatorzy kanału (v2):** dodanie po nicku, bez dostępu do Studia. Moderują z widoku filmu i z uproszczonej kolejki „Do przeglądu”. Plakietka „Moderator” przy nicku.
- **Override per film** w edycji filmu, zakładka „Komentarze”.

**Globalnie (admin):**
- platformowe listy słów w 8 językach, które zawsze wstrzymują lub blokują;
- rate limit (np. 5 komentarzy na minutę i 50 na godzinę na konto);
- nowe konta (poniżej 24 h): komentarze z linkami zawsze do przeglądu.

---

## 7. Analityka dla twórcy

### Jak robią inni

YouTube Analytics ma zakładki Przegląd, Zasięg (źródła ruchu, wyświetlenia miniatur, CTR), Zaangażowanie (czas oglądania, średni czas oglądania, najlepsze filmy, utrzymanie widzów), Odbiorcy (unikalni widzowie, przyrost subskrybentów, powracający) i Przychody (wg źródeł zewnętrznych [38]). Wskaźniki interpretuje się łącznie: wysoki CTR przy niskim czasie oglądania sugeruje, że miniatura obiecuje więcej, niż film daje [38].

### Rekomendacja dla nas

**MVP (Studio → Analityka, zakres 7, 28 i 90 dni oraz „od początku”):**
- **Kafelki:** Wyświetlenia, Czas oglądania (h), Subskrybenci (+/−), Napiwki (brutto i netto, liczba).
- **Wykres dzienny** dla wybranego kafelka.
- **Tabela „Najlepsze filmy”:** wyświetlenia, czas oglądania, średni czas oglądania, % obejrzenia, polubienia, komentarze, napiwki.
- **Per film:**
  - krzywa **utrzymania widzów**: % widzów w danym punkcie filmu, liczony z eventów odtwarzacza HLS w kubełkach 1% długości;
  - **Źródła ruchu:** strona główna, subskrypcje, wyszukiwarka, strona kanału, polecane obok filmu, osadzenia, zewnętrzne (referrer domain), bezpośrednie;
  - **Języki napisów** używane przez widzów (przydatne przy dwujęzyczności).
- **Definicje:** „wyświetlenie” liczymy jako co najmniej 30 s lub 30% krótkiego filmu, z deduplikacją per użytkownik lub sesja na 24 h. Zasada musi być opisana w tooltipie, żeby twórcy nie porównywali liczb z YouTube 1:1.
- **Prywatność:** agregaty, bez listy „kto oglądał”. Lista „kto dał napiwek” tylko dla nieanonimowych.

**v2:** kraje i urządzenia, wyświetlenia miniatur i CTR (wymaga logowania impresji), dane w czasie rzeczywistym (48 h), porównanie filmów, eksport CSV.

**Później:** analiza kohort subskrybentów, „Kiedy Twoi widzowie są online”.

---

## 8. Monetyzacja: napiwki i wypłaty

### Jak robią inni

- **YouTube Super Thanks:** ikona serca z $ pod filmem. Widz wybiera jedną z **4 stałych kwot ($2–$50)**, dostaje animację i **wyróżniony, kolorowy komentarz**, na który twórca łatwo odpowiada. Działa też na starych filmach. Dostępne dla kanałów w YPP. Podział wg relacji prasowych z 2021 r. to 70/30 [24].
- **Twitch Bits:** waluta wirtualna. Streamer dostaje 1 centa za Bit, a widz płaci więcej (marża i opłaty). Minimalna wypłata to $100, płatna około 15. dnia miesiąca (wg źródeł zewnętrznych [39]).
- **Ko-fi:** jednorazowe napiwki **0% prowizji** w planie darmowym, 5% od członkostw i sprzedaży. Pieniądze trafiają **bezpośrednio na konto PayPal lub Stripe twórcy**. Opłaty procesora (~3% + $0,30) są osobne [21].
- **Buy Me a Coffee:** 5% prowizji plus opłaty Stripe, z możliwymi dopłatami za wypłatę i transakcje zagraniczne (wg źródeł zewnętrznych [22]).
- **Patreon:**
  - panel „Wypłaty” pokazuje saldo dostępne i oczekujące;
  - środka z płatności jednorazowych są „pending” do 7 dni, a z iOS do 75 dni;
  - **przed potwierdzeniem wypłaty widać opłatę i kwotę netto**, a minimum zależy od metody;
  - zmiana danych wypłaty lub formularza podatkowego blokuje wypłaty na 5 dni (ochrona przed przejęciem konta);
  - zakładka Dokumenty zawiera CSV z zarobkami i wypłatami oraz dokumenty podatkowe;
  - przy podejrzanej aktywności wypłaty są wstrzymywane, ale konto działa [23][40].
- **Throne:** lista życzeń z ukrytym adresem twórcy. Fani dają prezenty bez konta i anonimowo, a dane obu stron nie są wymieniane [41]. Lekcja dla nas: **anonimowość i prywatność obu stron jako funkcja**.
- **Stripe Connect: komponenty osadzone (web)** [17]:
  - Account onboarding: zlokalizowany formularz KYC, który waliduje dane, obsługuje wszystkie typy działalności i weryfikację tożsamości [18];
  - Account management i **Notification banner** (wymagane działania, np. brakujące dokumenty);
  - Payments i Payment details (lista płatności, zwroty, spory);
  - **Payouts** (saldo, harmonogram, lista wypłat, wypłaty natychmiastowe i ręczne; flagi `instant_payouts`, `standard_payouts`, `edit_payout_schedule`, `external_account_collection` [19]);
  - Balances, Payouts list i Payout details;
  - **Documents** (dokumenty do pobrania), Balance report i Payout reconciliation report;
  - Tax settings i Tax registrations.
  
  Harmonogram wypłat: `manual`, `daily`, `weekly` lub `monthly` plus `delay_days` [20]. **Pierwsza wypłata zwykle 7–14 dni po pierwszej płatności** [20].

### Rekomendacja dla nas

**Widz: napiwek pod filmem**
1. Pod filmem, obok 👍👎 i „Udostępnij”, jest przycisk **„Wesprzyj ♥”** (kolor akcentu). Na stronie kanału, w nagłówku obok „Subskrybuj”, jest **„Wesprzyj kanał”**.
2. Bottom-sheet (mobile) lub modal (desktop):
   - nagłówek „Wesprzyj @kanał”;
   - kwoty predefiniowane 5 / 10 / 20 / 50 zł (lub 2/5/10/25 € lub $, zależnie od waluty widza), które twórca może zmienić w ustawieniach (v2), plus pole „Inna kwota” (min. 2 zł, maks. 2000 zł);
   - opcjonalna wiadomość (maks. 300 znaków);
   - checkbox „Pokaż wiadomość publicznie jako komentarz” (domyślnie włączony, gdy wpisano wiadomość);
   - checkbox „Wesprzyj anonimowo” (twórca nie widzi nicku, a publiczny komentarz ma podpis „Anonimowy widz”);
   - przejrzystość: „Twórca otrzyma ok. 18,40 zł z 20 zł (opłata płatności ~1,10 zł, prowizja platformy 0,50 zł)”, z linkiem „Jak liczymy opłaty”.
3. Płatność przez Stripe Payment Element lub Checkout (karta, BLIK, Apple/Google Pay, Przelewy24). **Napiwek bez logowania jest dozwolony** (e-mail do potwierdzenia), ale wiadomość publiczna wymaga zalogowania, co ogranicza spam.
4. Sukces: animacja, „Dziękujemy! @kanał dostał Twój napiwek”, opcjonalny CTA „Subskrybuj”. E-mail z potwierdzeniem.
5. Wyróżniony komentarz: ramka w kolorze kwoty z badge „♥ 20 zł”, podlega moderacji jak zwykły komentarz. Ukrycie komentarza nie zwraca napiwku, co musi być zapisane w regulaminie. W Studiu w zakładce Komentarze jest filtr „Z napiwkiem”.
6. **Przycisk jest ukryty**, gdy kanał nie ma `charges_enabled` lub admin wyłączył napiwki kanałowi. Nie pokazujemy wyszarzonego przycisku widzom.
- **Zabezpieczenia:** limit kwot i częstotliwości per karta/konto, Radar, 3DS. Zwroty tylko przez personel (spory i oszustwa). Twórca nie robi zwrotów w MVP, a komponent „Payments” z refundami ewentualnie w v2.

**Twórca: włączenie napiwków (onboarding do wypłat)**

Studio → **Wypłaty** (pusty stan) pokazuje listę kontrolną „Zacznij przyjmować napiwki”:
1. ✅ Masz ukończone 18 lat (oświadczenie plus Stripe KYC; dla niepełnoletnich Stripe wymaga zgody opiekuna, więc w MVP blokujemy).
2. ✅ Zweryfikowany adres e-mail.
3. ⬜ **Włączone 2FA** (ochrona przed przejęciem konta i wypłat; YouTube wymaga 2FA do weryfikacji kanału [26]).
4. ⬜ Co najmniej 1 publiczny film.
5. ⬜ Akceptacja „Regulaminu wsparcia twórców” (prowizja, zwroty, podatki po stronie twórcy).
6. ⬜ **„Połącz konto wypłat”** otwiera osadzony onboarding Stripe [18] w panelu (bez przekierowania). Przed startem wyjaśniamy: „Stripe zapyta o dane osobowe, dokument tożsamości i konto bankowe. Platforma nie widzi Twoich danych bankowych.”

Po `onExit` pobieramy stan konta (`details_submitted`, `charges_enabled`, `payouts_enabled` [18]) i pokazujemy jeden ze stanów:
- „Weryfikacja w toku, zwykle do 2 dni roboczych”;
- „Wymagane działanie” (banner powiadomień [17]);
- „Gotowe: napiwki włączone”. Wtedy przełącznik „Pokaż przycisk Wesprzyj na kanale” (domyślnie włączony) i informacja „Pierwsza wypłata zwykle 7–14 dni po pierwszym napiwku” [20].

**Panel „Wypłaty / Payouts”: ekrany**

Nad wszystkimi zakładkami zawsze stoi **Notification banner Stripe** [17], np. „Stripe potrzebuje dokumentu”.

1. **Przegląd**
   - komponent **Balances**: dostępne, w drodze, oczekujące;
   - nasze kafelki: napiwki w tym miesiącu (brutto, prowizja platformy, opłaty Stripe, netto), liczba wspierających, top 5 filmów wg napiwków;
   - następna wypłata (data i kwota);
   - link „Jak liczymy opłaty”.
2. **Napiwki** (nasza tabela z bazy): data, kwota brutto, opłaty, netto, film lub kanał, wspierający (nick lub „Anonim”), wiadomość, status (opłacony / zwrócony / sporny). Filtry i eksport CSV. Akcja „Podziękuj” (odpowiedź na komentarz lub prywatna wiadomość w v2).
3. **Wypłaty:** komponent **Payouts** [19] (saldo, harmonogram, lista wypłat). Wypłaty natychmiastowe tylko jeśli je świadomie włączymy (koszt). Szczegóły wypłaty pokazuje **Payout details**.
4. **Dokumenty:** komponent **Documents** [17] plus nasze miesięczne zestawienia PDF/CSV („Zestawienie napiwków – wrzesień 2026”). Informacja: „Jesteś odpowiedzialny za rozliczenie przychodów w swoim kraju.”
5. **Ustawienia:**
   - komponent **Account management** (dane, konto bankowe);
   - harmonogram wypłat (domyślnie tygodniowo; flaga `edit_payout_schedule` [19]);
   - kwoty predefiniowane napiwków (v2), minimalna kwota;
   - „Napiwki domyślnie włączone dla nowych filmów”;
   - rozłączenie konta wypłat (tylko OWNER, z potwierdzeniem i blokadą 5 dni przy zmianie konta bankowego, jak Patreon [23]).

**Przejrzystość opłat (stała strona „Opłaty”):** wzór i przykład liczbowy dla 5, 20 i 100 zł. Prowizja platformy wyrażona w % i zmieniana z wyprzedzeniem 30 dni z powiadomieniem.

**Do decyzji technicznej** (osobny research Stripe): charge type (direct vs destination z `on_behalf_of`), kto ponosi spory i ujemne salda (wpływa na to, czy wolno wyłączyć uwierzytelnianie Stripe w komponentach [18]), oraz ewentualny obowiązek **DAC7**. DAC7 obejmuje „usługi osobiste” i sprzedaż towarów. Czy dobrowolne napiwki bez świadczenia się w nim mieszczą, nie znalazłem w źródłach. To pytanie do doradcy podatkowego [42].

---

## 9. Architektura informacji „Studia twórcy”

### Jak robią inni

Lewe menu YouTube Studio: **Panel, Treści, Analityka, Komentarze/Społeczność, Napisy, Prawa autorskie, Zarabianie, Personalizacja, Biblioteka audio** oraz na dole **Ustawienia** i „Prześlij opinię” (wg poradników [32]). Uprawnienia, czyli kto widzi co, są w Ustawieniach [3]. W PeerTube wszystko jest w „My library” i „Manage” per kanał, z logiem „Activity” [10].

### Rekomendacja dla nas: „Studio twórcy” (studio.pawelperfect.com lub /studio)

**Nagłówek:** przełącznik kanału (w v2, gdy jest ich więcej), wyszukiwarka w treściach kanału, **„+ Utwórz”** (Prześlij film; w v2 Nowa playlista i Post), dzwonek, awatar.

**Lewe menu MVP:**
1. **Panel:** ostatni film z kafelkami 48 h, kolejka „Do przeglądu” (liczba), status wypłat, komunikaty platformy, lista kontrolna onboardingu dopóki nie jest ukończona.
2. **Treści:** sekcja 5.
3. **Analityka:** sekcja 7.
4. **Komentarze:** sekcja 6.
5. **Napisy i tłumaczenia:** lista filmów z brakami per język (PL/EN plus pozostałe). Pasuje do istniejącego workflow.
6. **Wypłaty:** sekcja 8.
7. **Personalizacja:** sekcja 3.
8. **Status kanału:** ostrzeżenia, strike'i, ograniczenia funkcji, odwołania (sekcja 11). Badge, gdy coś jest aktywne.
9. Na dole: **Ustawienia** (Kanał: język, kraj, słowa kluczowe; Ustawienia domyślne przesyłania; Społeczność; Uprawnienia w v2; Zaawansowane: ukryj lub usuń kanał, przekaż kanał w v2) i **Pomoc i opinie**.

**v2:** Playlisty, Społeczność/Posty, Uprawnienia (zespół), Aktywność kanału (log).
**Później:** Prawa autorskie (zgłoszenia złożone przez twórcę), Premiery na żywo / Live.

**Punkty wejścia (menu awatara w aplikacji widza):**
- bez kanału: „Utwórz kanał”;
- z kanałem: „Twój kanał”, „Studio twórcy”, „Wypłaty” (skrót) i, w v2, „Przełącz kanał”;
- zawsze: Ustawienia konta, Język, Motyw, Wyloguj.

**Puste stany (każdy z jednym CTA):**
- Treści: „Prześlij swój pierwszy film” z ilustracją i linkiem do zaleceń formatu;
- Analityka: „Dane pojawią się po pierwszych wyświetleniach”;
- Komentarze: „Brak komentarzy, udostępnij film”;
- Wypłaty: lista kontrolna z sekcji 8.

**Lista kontrolna onboardingu** (Panel, zwijana, z % ukończenia):
1. Dodaj zdjęcie profilowe i banner.
2. Uzupełnij opis.
3. Prześlij pierwszy film.
4. Dodaj napisy PL lub EN.
5. Włącz 2FA.
6. Włącz napiwki.
7. Udostępnij kanał.

---

## 10. Strona widza po przejściu na wiele kanałów

### Jak robią inni

YouTube opiera odkrywanie na algorytmie. Platformy kuratorowane (Nebula, Floatplane) opierają je na wyborze redakcji i liście twórców [29][30]. PeerTube na stronie głównej pokazuje „Discover”: wybór admina, najnowsze, popularne, a do tego kategorie i lokalne/federowane listy (wg dokumentacji PeerTube [8]).

### Rekomendacja dla nas

**Strona kanału `/@handle`:**
- nagłówek: banner, awatar, nazwa (+ odznaka), @handle, liczba subskrybentów i filmów, skrócony opis „…więcej”, linki, przyciski **Subskrybuj** (z dzwonkiem: Wszystkie / Brak), **Wesprzyj**, menu ⋯ (Zgłoś, Zablokuj kanał, Kopiuj link);
- zakładki: **Główna** (zwiastun lub film polecany plus „Najnowsze” i „Popularne”), **Filmy** (sort: najnowsze, popularne, najstarsze), **Playlisty** (v2), **Społeczność** (później), **Informacje** (pełny opis, data dołączenia, kraj, łączne wyświetlenia, e-mail kontaktowy, „Zgłoś kanał”);
- dla właściciela: przyciski „Personalizuj kanał” i „Zarządzaj filmami”.

**Strona główna (bez algorytmu, deterministyczna):**
1. **„Najnowsze z Twoich subskrypcji”** (zalogowani z subskrypcjami): poziomy rząd.
2. **„Wybór redakcji”**: kuratorowane przez superadmina, z datą wygaśnięcia.
3. **„Najnowsze”** z całej platformy, z limitem 2 na kanał w sekcji, żeby jeden aktywny kanał nie zalewał listy.
4. **„Popularne w tym tygodniu”**: wyświetlenia i czas oglądania z 7 dni, ważone świeżością.
5. **„Kategorie”**: chipy u góry jak w YouTube, filtrujące wszystko.
6. **„Nowe kanały”**: kanały z co najmniej 1 publicznym filmem, utworzone w ciągu 30 dni, w wariancie ręcznie zatwierdzanym przez admina, żeby ograniczyć spam.
- Filtr języka treści (PL / EN / wszystkie), domyślnie wg języka UI. Dla platformy dwujęzycznej to kluczowe.

**Subskrypcje `/feed/subscriptions`:** chronologicznie, z filtrem „Dziś / Ten tydzień / Nieobejrzane”. Lista kanałów w lewym pasku.

**Wyszukiwarka:** jedno pole, wyniki mieszane (najpierw do 3 trafionych kanałów, potem filmy). Filtry: typ (film/kanał), data, długość, język, napisy, sortowanie. Wyszukiwanie po tytule i opisie w obu językach (Postgres FTS z konfiguracją `simple` + `unaccent`, ewentualnie Meilisearch później).

**Powiadomienia:** dzwonek (nowy film lub premiera z subskrybowanego kanału, gdy dzwonek jest „Wszystkie”), odpowiedź na komentarz, ❤ od twórcy, zaplanowana premiera za 15 min. Dla twórcy: nowy napiwek, komentarz do przeglądu, film gotowy, decyzja moderacji. E-mail jako digest (dzienny lub tygodniowy), z wypisaniem się per typ.

**Zgłoś i zablokuj:**
- „Zgłoś film / kanał / komentarz”, powody: spam, nagość, przemoc, nienawiść, nękanie, podszywanie się, naruszenie praw autorskich (osobny formularz), **treść nielegalna (DSA)** z polem uzasadnienia i opcjonalnymi danymi kontaktowymi [27];
- „Zablokuj kanał”: filmy znikają z rekomendacji, strony głównej i wyszukiwania, a komentarze tego twórcy są ukryte dla blokującego. Lista blokad w Ustawieniach konta.

---

## 11. Trust & safety

### Jak robią inni

**YouTube: zasady społeczności** [7]:
- **ostrzeżenie** za pierwsze naruszenie, które wygasa po 90 dniach od ukończenia szkolenia;
- **1. strike**: tydzień bez uploadu, live, planowania, miniatur i postów (zaplanowane filmy przechodzą na prywatne);
- **2. strike** w ciągu 90 dni: 2 tygodnie;
- **3. strike** w ciągu 90 dni: usunięcie kanału;
- strike wygasa po 90 dniach, a usunięcie filmu go nie zdejmuje;
- odwołanie jest możliwe;
- poważne nadużycie oznacza terminację bez ostrzeżeń, a zakładanie nowego kanału w celu obejścia kary skutkuje terminacją wszystkich.

**YouTube: prawa autorskie** [37]:
- **kontrzgłoszenie** przez Studio z imieniem, nazwiskiem, adresem i uzasadnieniem (fair use, pomyłka);
- zgłaszający ma **10 dni roboczych** na wykazanie kroków prawnych, inaczej film wraca, a strike może zostać zdjęty;
- alternatywy: prośba o wycofanie lub odczekanie 90 dni po „Copyright School”;
- status widać w Treściach, w kolumnie „Ograniczenia”.

**Patreon:** przy podejrzanej aktywności wstrzymuje **tylko wypłaty**, a konto działa dalej [40].

**DSA (UE):** art. 16 (mechanizm zgłoszeń) i art. 17 (**uzasadnienie** każdej decyzji ograniczającej widoczność, płatności, zawieszającej lub zamykającej konto) obowiązują wszystkie usługi hostingowe, także małe. Małe i mikro przedsiębiorstwa są zwolnione z art. 15 i z większości obowiązków „platform online” z art. 19–28 [27]. **Wniosek: komunikat dla twórcy musi zawierać uzasadnienie.**

### Rekomendacja dla nas: widok twórcy (Studio → Status kanału)

- **Karty stanu:** „Wszystko w porządku” (zielona) albo aktywne ostrzeżenia lub strike'i. Każda karta zawiera:
  - czego dotyczy (film lub komentarz, z miniaturą);
  - którą zasadę naruszono (link do konkretnego punktu);
  - **uzasadnienie** (fakty, podstawa: regulamin lub prawo);
  - czy decyzja była automatyczna (wymóg art. 17 [27]);
  - skutki („Do 20.10 nie możesz przesyłać filmów”);
  - data wygaśnięcia;
  - przycisk **„Odwołaj się”** (formularz, 1 odwołanie na decyzję, odpowiedź w ciągu X dni).
- **Ograniczenia funkcji** widoczne w kontekście: wyszarzony przycisk „Prześlij” z tooltipem i linkiem do Statusu kanału.
- **Gradacja:** ostrzeżenie (90 dni) → strike 1 (7 dni blokady uploadu i publikacji) → strike 2 w 90 dni (14 dni) → strike 3 w 90 dni oznacza wniosek o terminację, z ręczną decyzją superadmina. Jasna tabela w „Zasadach dla twórców”.
- **Prawa autorskie:** zgłoszenie od właściciela praw (formularz publiczny z danymi i oświadczeniem) → film zablokowany, a twórca dostaje powiadomienie z uzasadnieniem i przyciskami „Kontrzgłoszenie” lub „Akceptuję”. Kontrzgłoszenie wymaga imienia, nazwiska, adresu i uzasadnienia oraz zgody na przekazanie danych zgłaszającemu. 10 dni roboczych, potem przywrócenie, jeśli zgłaszający nie wykazał kroków prawnych (model wzorowany na YouTube [37]; zgodność z polskim prawem do weryfikacji przez prawnika).
- **Stany kanału widoczne dla twórcy:** Aktywny / Ograniczony (lista ograniczeń) / Napiwki wstrzymane / Ukryty przez platformę / Zawieszony (Studio tylko do odczytu, eksport danych i odwołanie dostępne) / Zamknięty (e-mail z uzasadnieniem, okno na pobranie danych i wypłatę salda).

### Rekomendacja dla nas: widok superadmina (admin.pawelperfect.com)

- **Kolejki:**
  - Zgłoszenia (filmy, kanały, komentarze; priorytet: nielegalne/CSAM natychmiast, podszywanie, reszta);
  - Do sprawdzenia automatycznie (duplikaty, flagi skanu, nowe kanały, nazwy podobne do zweryfikowanych);
  - Prawa autorskie (zgłoszenia i kontrzgłoszenia z licznikiem 10 dni);
  - Odwołania;
  - Wnioski o weryfikację (v2);
  - Wypłaty: spory i ryzyko (webhooki Stripe).
- **Karta kanału:** dane, właściciel, historia uchwytów i nazw, filmy, statystyki, napiwki i stan konta Stripe, historia decyzji.
- **Akcje** (każda z obowiązkowym powodem z listy, polem uzasadnienia i opcją „powiadom twórcę”): Ostrzeż, Nałóż strike, **Ogranicz upload**, **Wyłącz napiwki**, Ukryj kanał w odkrywaniu (wyszukiwarka i strona główna), Ukryj kanał całkowicie, Zawieś, Usuń, Odbierz uchwyt (z wygenerowaniem zastępczego, jak YouTube [1]), Nadaj lub odbierz odznakę, Zmień limity (poziom zaufania).
- **„Zobacz jako” (impersonacja):** tylko podgląd (read-only) Studia twórcy, z czerwonym paskiem „Przeglądasz jako @kanał”, wymuszonym podaniem powodu i wpisem do logu audytu. Brak możliwości wykonywania akcji finansowych, a wszystkie akcje admina idą przez panel admina, nie przez „bycie” użytkownikiem. Opcjonalnie twórca widzi w „Aktywności kanału”, że personel przeglądał kanał.
- **Log audytu:** niemodyfikowalny (append-only): kto, kiedy, co, przed i po, powód. Eksport.
- **Ustawienia globalne:**
  - rejestracja kanałów: otwarta / na zaproszenie / wyłączona;
  - `maxChannelsPerUser`;
  - limity uploadu per poziom zaufania;
  - prowizja platformy i minimalne kwoty napiwków;
  - kategorie, zarezerwowane uchwyty, globalne słowa blokowane;
  - wybór redakcji;
  - teksty regulaminów z wersjonowaniem (wymuszenie ponownej akceptacji).

---

## 12. Cykl życia kanału

### Jak robią inni

- **YouTube** [14]:
  - **Ukryj kanał** (odwracalne): nazwa, filmy, polubienia, subskrypcje i subskrybenci stają się prywatne. Po przywróceniu liczniki aktualizują się do tygodnia.
  - **Usuń kanał** (nieodwracalne): usuwa filmy, komentarze, wiadomości, playlisty i historię. Tylko na desktopie.
  - Usunięcie konta głównego właściciela usuwa kanał.
  - Własności nie można przekazać w modelu „uprawnień kanału” [3].
- **PeerTube:** usunięcie konta jest nieodwracalne i usuwa kanały, filmy i komentarze [9]. Przekazanie kanału na inne konto (od 8.2) wymaga akceptacji odbiorcy, a edytorzy zostają [10][28].
- **Twitch:** po usunięciu konta nazwa wraca do puli po co najmniej 6 miesiącach [13].

### Rekomendacja dla nas

**Studio → Ustawienia → Zaawansowane**, z trzema opcjami:

1. **Ukryj kanał** (odwracalne, natychmiast):
   - Skutki: kanał, filmy i playlisty niedostępne publicznie („Ten kanał jest niedostępny”), napiwki wyłączone, komentarze twórcy pod cudzymi filmami pokazują się jako „Kanał ukryty”.
   - Subskrypcje są zachowane, ale bez powiadomień.
   - Saldo Stripe nadal się wypłaca.
   - Przywrócenie jednym kliknięciem.
2. **Usuń kanał:**
   - Krok 1: podsumowanie (X filmów, Y komentarzy, Z subskrybentów, saldo N zł) i **„Pobierz archiwum”** (oryginały filmów, metadane JSON, napisy, CSV napiwków), przygotowywane asynchronicznie i wysyłane linkiem e-mailem.
   - Krok 2: wpisanie @handle, ponowne uwierzytelnienie (hasło lub 2FA).
   - Kanał przechodzi w stan `PENDING_DELETION` (ukryty) na **30 dni z możliwością anulowania**, potem następuje twarde usunięcie plików i danych.
   - **Zostają (zanonimizowane lub zachowane z obowiązku prawnego):**
     - historia napiwków i rozliczeń (księgowość, spory; Stripe Connect account pozostaje w Stripe);
     - log moderacji i decyzji (DSA);
     - uchwyt zarezerwowany 180 dni.
   - **Usuwane:** filmy, miniatury, napisy, statystyki. Komentarze, które twórca pisał jako kanał, otrzymują podpis „Usunięty kanał” albo są usuwane. Decyzja: rekomenduję usunięcie treści i zachowanie struktury wątku („[komentarz usunięty]”).
   - Usunięcia nie da się wykonać przy aktywnym postępowaniu moderacyjnym lub sporze płatności. Wtedy kanał zostaje tylko ukryty, a wniosek trafia do admina.
   - Saldo: zablokowane przy niezakończonych sporach, w pozostałych przypadkach wypłata standardowa.
3. **Przekaż kanał** (v2, tylko OWNER):
   - zaproszenie na e-mail lub nick istniejącego konta, akceptacja odbiorcy (jak PeerTube [10]);
   - **odbiorca musi podłączyć własne konto wypłat**, bo stare konto Stripe zostaje przy poprzednim właścicielu (jego dane KYC);
   - napiwki są wyłączone do czasu onboardingu nowego właściciela, a historia napiwków poprzedniego właściciela nie jest widoczna dla nowego;
   - poprzedni właściciel może zostać jako MANAGER (opcja);
   - wpis w logu audytu i powiadomienie admina.

**Interakcja z usunięciem konta:**
- Usunięcie konta użytkownika z kanałem wymaga najpierw usunięcia kanału lub przekazania go (v2), co jest jasno komunikowane w Ustawieniach konta.
- W MVP: „Usunięcie konta usunie też kanał @x” z tym samym 30-dniowym okresem i archiwum.
- Konto jest anonimizowane, nick zwalniany po 180 dniach.

---

## 13. O czym właściciel nie pomyślał: lista z priorytetami

| # | Funkcja | Dlaczego | Priorytet |
|---|---|---|---|
| 1 | **Ustawienia domyślne przesyłania** (język, kategoria, komentarze, napiwki, dostęp, szablon opisu) | YouTube ma ustawienia domyślne komentarzy dla nowych filmów [11] i „użyj ponownie szczegółów” [6]; oszczędza czas | MVP |
| 2 | **Limity per twórca i poziomy zaufania** | YouTube: 15 min bez weryfikacji, 12 h / 256 GB po weryfikacji [34], dzienny limit uploadu [6]. U nas koszty R2 i encodera. Propozycja: *Nowy* (do 60 min i 5 GB na plik, 3 filmy/dzień, 50 GB łącznie), *Zweryfikowany* (2FA + 30 dni + bez strike'ów: 4 h, 20 GB, 10/dzień, 500 GB), *Zaufany* (ręcznie: 12 h, 100 GB, bez limitu dziennego) | MVP |
| 3 | **Pasek zajętości przestrzeni** w Studiu z opcją „Usuń oryginały starszych filmów” (oszczędność) | Przejrzystość kosztów | v2 |
| 4 | **Oświadczenie AI / treści syntetyczne** | Standard rynkowy od 2024 [25]; przyszłe wymogi AI Act dot. oznaczania deepfake'ów | MVP (1 checkbox) |
| 5 | **2FA wymagane do wypłat** i blokada wypłat po zmianie danych | Ochrona przed przejęciem (Patreon: 5 dni [23]; YouTube wymaga 2FA do weryfikacji [26]) | MVP |
| 6 | **Odznaka weryfikacji** | Ochrona przed podszywaniem. Kryteria nie liczbowe (mała platforma): autentyczność, 2FA, kompletny profil, ręczna decyzja admina (wzór YouTube [26]) | v2 |
| 7 | **Playlisty** | Podstawowa nawigacja kanału (PeerTube [10]) | v2 |
| 8 | **Posty społeczności** | Komunikacja twórcy z widzami poza filmami | później |
| 9 | **Rate limiting** komentarzy, zgłoszeń, napiwków, tworzenia kanałów (np. 1 kanał na konto na 30 dni), sprawdzania uchwytów | Antyspam i nadużycia | MVP |
| 10 | **Dostępność (WCAG 2.2 AA):** napisy jako obywatel pierwszej klasy, sterowanie odtwarzaczem z klawiatury, alt dla miniatur (z tytułu), kontrast, `prefers-reduced-motion` w animacji napiwku, focus trap w modalach kreatora | Obowiązek wynikający z EAA (od 06.2025) dla usług e-commerce, a napiwki to płatności | MVP (podstawy) |
| 11 | **Upload z telefonu:** kreator responsywny, na mobile jako pełnoekranowe kroki. Upload w tle ograniczony (przeglądarka mobilna przerywa przy wygaszeniu ekranu), więc komunikat „Nie blokuj ekranu” i wznawialność | Wielu twórców nagrywa telefonem | MVP (responsywność), PWA później |
| 12 | **Embed** z ustawieniem twórcy „Zezwalaj na osadzanie” i listą domen (PeerTube [8]) | Dystrybucja | v2 |
| 13 | **Pobieranie oryginału** przez twórcę | Kopia zapasowa, wymagana przy usuwaniu kanału | MVP |
| 14 | **Log aktywności kanału** | Bezpieczeństwo, zespoły (PeerTube „Activity” [10]) | v2 (z rolami) |
| 15 | **Transkrypcja automatyczna** (napisy auto PL/EN) | PeerTube 6.2+ [8]. Dostępność i SEO, a przy dwujęzyczności baza do tłumaczeń | v2 |
| 16 | **Kanały RSS** per kanał | Tanie, cenione przez widzów spoza algorytmu | v2 |
| 17 | **Eksport danych (RODO art. 20)** dla twórcy i widza | Obowiązek | MVP (prosty) |
| 18 | **Status „nowy kanał”** z ograniczeniem linków w opisie przez pierwsze 7 dni | Antyspam SEO | MVP |
| 19 | **Rozdziały** z opisu | Niski koszt (parser) | MVP |
| 20 | **Premiery z odliczaniem** | Już w modelu danych | MVP (istnieje) |
| 21 | **Live streaming** | Duży koszt | później |
| 22 | **Członkostwa / subskrypcje płatne** | Naturalny krok po napiwkach (Patreon, Floatplane [30]) | później |
| 23 | **Strona „Opłaty” i „Zasady dla twórców”** z wersjonowaniem i ponowną akceptacją | Przejrzystość, DSA (art. 14: jasne T&C) | MVP |
| 24 | **Powiadomienia e-mail z preferencjami** i wypisaniem per typ | Deliverability i RODO | MVP |
| 25 | **Strefa czasowa kanału** dla premier i harmonogramów | Częsty błąd przy planowaniu | MVP |

---

## Priorytety MVP / v2 / później

### MVP (premiera wielokanałowości)

- **Model:** User → Channel (limit 1) + ChannelMember (OWNER), rola platformowa SUPERADMIN, migracja kanału właściciela na osobne konto.
- **Tworzenie kanału:** nazwa, @handle z walidacją, rezerwacjami i filtrem wulgaryzmów, awatar, język, akceptacja zasad.
- **Zmiana nazwy i uchwytu:** limit 2 na 14 dni, historia slugów i 301 przez 180 dni, `/channel/{id}`.
- **Personalizacja:** profil, branding, film polecany.
- **Kreator uploadu** (4 kroki, autozapis, wznawialny multipart, globalny menedżer uploadów), stany przetwarzania, „Opublikuj po przetworzeniu”, harmonogram i premiera.
- **Treści:** lista, filtry, edycja, archiwizacja, usuwanie z koszem 30 dni, akcje zbiorcze (widoczność, dostęp, archiwizacja).
- **Komentarze:** ustawienia domyślne kanału plus override per film, kolejka „Do przeglądu”, zablokowane słowa i linki, ukryci i zatwierdzeni użytkownicy, ❤ i przypięcie.
- **Analityka podstawowa:** wyświetlenia, czas oglądania, średni czas oglądania, utrzymanie widzów, źródła ruchu, subskrybenci, napiwki.
- **Napiwki:** pod filmem i na kanale, wyróżniony komentarz, opcja anonimowości, przejrzystość opłat.
- **Wypłaty:** lista kontrolna, osadzony onboarding Stripe, banner powiadomień, zakładki Przegląd, Napiwki, Wypłaty, Dokumenty i Ustawienia.
- **Strona kanału** `/@handle` z zakładkami Główna, Filmy i Informacje. Strona główna z sekcjami kuratorowanymi i chronologicznymi, subskrypcje z dzwonkiem, wyszukiwarka filmów i kanałów, Zgłoś i Zablokuj.
- **Status kanału** (ostrzeżenia, strike'i, odwołania z uzasadnieniem DSA). Admin: kolejki, akcje, „zobacz jako” tylko do odczytu, log audytu, ustawienia globalne.
- **Ukryj i usuń kanał** (30 dni karencji i archiwum), limity i poziomy zaufania, 2FA do wypłat, oświadczenie AI, rate limiting, podstawy WCAG.

### v2

- Wiele kanałów na konto i przełącznik kanałów.
- Role zespołowe (Menedżer, Edytor, Tłumacz/Napisy, Widz-finanse) z zaproszeniami i logiem aktywności.
- Moderatorzy komentarzy.
- Przekazanie kanału.
- Playlisty.
- Odznaka weryfikacji.
- Podmiana pliku z wersjonowaniem.
- Automatyczne napisy i edytor napisów online.
- Upload wielu plików naraz.
- Analityka rozszerzona (kraje, urządzenia, CTR miniatur, czas rzeczywisty, CSV).
- Własne kwoty napiwków.
- Embed z kontrolą domen, RSS, sekcje strony kanału, tłumaczenia nazwy i opisu kanału, wskaźnik zajętości przestrzeni.

### Później

- Posty społeczności.
- Członkostwa płatne.
- Live streaming.
- Własne domeny kanałów.
- Rekomendacje algorytmiczne.
- Perceptual hashing i automatyczna moderacja wideo.
- Aplikacja mobilna lub PWA z uploadem w tle.
- Test A/B miniatur.

---

## Źródła

Dostęp do wszystkich: 2026-10-13.

1. YouTube Help – „Handle naming guidelines”: https://support.google.com/youtube/answer/11585688
2. YouTube Help – „Manage your channel name, handle & picture”: https://support.google.com/youtube/answer/2657964
3. YouTube Help – „Add or remove access to your YouTube channel” (uprawnienia kanału, role): https://support.google.com/youtube/answer/9481328
4. YouTube Help – „Create a YouTube channel”: https://support.google.com/youtube/answer/1646861
5. YouTube Help – „Change, view, or hide your handle”: https://support.google.com/youtube/answer/15920820
6. YouTube Help – „Upload YouTube videos”: https://support.google.com/youtube/answer/57407
7. YouTube Help – „Community Guidelines strike basics”: https://support.google.com/youtube/answer/2802032
8. PeerTube Docs – „Create & upload a video”: https://docs.joinpeertube.org/use/create-upload-video
9. PeerTube Docs – „Setup your account”: https://docs.joinpeertube.org/use/setup-account
10. PeerTube Docs – „Library” (kanały, edytorzy, przekazanie kanału, playlisty): https://docs.joinpeertube.org/use/library
11. YouTube Help – ustawienia komentarzy i narzędzia moderacji: https://support.google.com/youtube/answer/9483359
12. YouTube Help – „Moderate comments” i „Moderate your Community” (moderatorzy standardowi i zarządzający): https://support.google.com/youtube/answer/15535966 ; https://support.google.com/youtube/answer/15739725
13. Twitch Help – „Username Rename and Recycling Policies”: https://help.twitch.tv/s/article/username-rename-and-recycling-policies ; „Delete My Twitch Account”: https://help.twitch.tv/s/article/delete-twitch-account ; „Partner Program Overview”: https://help.twitch.tv/s/article/partner-program-overview
14. YouTube Help – „Delete or hide your YouTube channel”: https://support.google.com/youtube/answer/55759
15. Vimeo Help – „About team member types”: https://help.vimeo.com/hc/en-us/articles/12425417783697-About-team-member-types
16. Rumble Support – „How to Rumble: Creating a channel”: https://rumble.support/help/how-to-rumble-creating-a-channel
17. Stripe Docs – „Supported Connect embedded components”: https://docs.stripe.com/connect/supported-embedded-components
18. Stripe Docs – „Account onboarding” (embedded component): https://docs.stripe.com/connect/supported-embedded-components/account-onboarding
19. Stripe Docs – „Payouts” (embedded component): https://docs.stripe.com/connect/supported-embedded-components/payouts
20. Stripe Docs – „Manage payout schedule”: https://docs.stripe.com/connect/manage-payout-schedule ; „Receive payouts”: https://docs.stripe.com/payouts ; Stripe Support – „Delay for first payout for connected accounts”: https://support.stripe.com/questions/delay-for-first-payout-for-connected-accounts
21. Ko-fi Help – „Does Ko-fi take a fee?”: https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee (treść wg wyników wyszukiwania; bezpośredni fetch zwrócił 403)
22. Buy Me a Coffee – opłaty (źródło zewnętrzne): https://schoolmaker.com/blog/buy-me-a-coffee-pricing ; https://www.builtbyfoundry.io/blog/buy-me-a-coffee-review-2026-is-the-5-percent-fee-worth-it
23. Patreon Help – „How payouts work”: https://support.patreon.com/hc/en-us/articles/208656246 ; „Payouts Dashboard”: https://support.patreon.com/hc/en-us/articles/360058429051-Payout-Dashboard ; „Adding your payout details”: https://support.patreon.com/hc/en-us/articles/115004029783
24. Super Thanks – relacje z premiery: https://9to5google.com/2021/07/21/youtube-adds-super-thanks-tipping-option-for-your-favorite-channels/ ; https://www.xda-developers.com/youtube-announces-super-thanks/
25. YouTube Official Blog – „How we're helping creators disclose altered or synthetic content”: https://blog.youtube/news-and-events/disclosing-ai-generated-content
26. YouTube Help – „Verification badges on channels”: https://support.google.com/youtube/answer/3046484
27. DSA – art. 17 (tekst): https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-17/ ; omówienie obowiązków art. 16–18 dla małych hostingów: https://www.bookacamp.de/en/dsa ; https://prighter.com/resources/laws/dsa/articles/article-17
28. PeerTube – ogłoszenia v8.0 i v8.2: https://framablog.org/?p=40771 ; https://joinpeertube.org/news/release-8.2 ; https://linuxiac.com/peertube-8-0-brings-a-modern-video-player-and-team-channel-management/
29. Nebula – Wikipedia: https://en.wikipedia.org/wiki/Nebula_(streaming_service)
30. Floatplane – przewodnik (źródło zewnętrzne): https://clipchamp.com/en/blog/ultimate-guide-to-floatplane
31. Dyskusja o zmienności handle w ActivityPub: https://socialhub.activitypub.rocks/t/changeable-usernames/830
32. YouTube Studio – przewodniki po nawigacji (zewnętrzne): https://metricool.com/what-is-youtube-studio/ ; https://vidiq.com/blog/post/beginners-guide-youtube-studio ; https://buffer.com/resources/how-to-use-youtube-studio/
33. Poradnik uczelni – upload w YouTube Studio (szkice): https://vlsisoc2020.eng.utah.edu/?p=158
34. YouTube Help – „Upload videos longer than 15 minutes”: https://support.google.com/youtube/answer/71673
35. Edytor YouTube Studio, ograniczenia (zewnętrzne): https://primalvideo.com/guides/how-to-edit-youtube-videos-after-upload-fix-mistakes-more/ ; YouTube Help „Preview and review changes”: https://support.google.com/youtube/answer/16564646
36. Vimeo – „Replace video files without breaking existing URLs or embeds”: https://vimeo.com/product/replace-video-files ; „Video version history”: https://vimeo.com/product/video-version-history
37. YouTube Help – „Submit a copyright counter notification”: https://support.google.com/youtube/answer/2807684 ; „About copyright removal requests”: https://support.google.com/youtube/answer/13823830
38. YouTube Analytics – przewodniki (zewnętrzne): https://hellothematic.com/youtube-analytics-101/ ; https://revive.social/youtube-analytics/
39. Twitch Bits (zewnętrzne): https://streamlabs.com/content-hub/post/what-are-twitch-bits-worth
40. Patreon Help – „Suspicious activity on your account”: https://support.patreon.com/hc/en-us/articles/360002007671
41. Throne – przewodnik dla twórców i prywatność (zewnętrzne): https://www.sirency.com/blog/throne-wishlist-for-creators ; https://streamlabs.com/content-hub/post/how-to-make-a-throne-wishlist
42. DAC7 a twórcy (zewnętrzne): https://pbl.legal/insights/dac7-reporting-content-creators-platform-rules/ ; https://pwc.com/mt/en/publications/tax-legal/dac7-the-new-digital-platform-reporting-rules.html

**Zastrzeżenia metodologiczne:**
- Kilka szczegółów pochodzi ze źródeł zewnętrznych, a nie z oficjalnej pomocy: dokładny podział Super Thanks, opłaty BMC, stawka Bits, menu YouTube Studio, zachowanie przy zamknięciu karty w trakcie uploadu. Oznaczyłem je w tekście.
- Oficjalne strony Ko-fi i części Vimeo zwracały 403/404, więc ich treść znam z wyników wyszukiwania.
- Nie potwierdziłem oficjalnie, czy Rumble pozwala na wiele kanałów na konto ani czy w PeerTube da się zmienić „Name” kanału.
- Kwestie prawne (DSA, DAC7, procedura praw autorskich w PL, EAA) wymagają weryfikacji przez prawnika lub doradcę podatkowego.
