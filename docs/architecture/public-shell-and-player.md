# Publiczna strona: powłoka, ładowanie, odtwarzacz

Stan 2026-10-05. Dotyczy części publicznej (`app/[locale]/(home)`, `app/components/**`). Panel administratora ma własny wygląd (`../design/admin-panel/DESIGN-SYSTEM.md`).
Dźwięk w odtwarzaczu i przycisk logo: `../operations/PLAYER-SOUND.md`. Języki: `../operations/I18N.md`.

## Zasady ogólne

- Jedna aplikacyjna powłoka VOD/PWA. Nie twórz równoległych skórek (dawne trasy eksperymentalne `/testujemy`, `/cyberpunk*`, `/glass` i inne usunięto); prototypuj, rozwijając produkcyjne komponenty i tokeny semantyczne.
- Typografia publiczna: samodzielnie hostowany Geist Sans/Mono z paczki `geist`; `font-sans`, `font-heading`, `font-brand` to Geist Sans, `font-mono` to Geist Mono (`preload: false`). Budowanie nie pobiera czcionek z sieci.
  Wyjątek: nakładka kokpitu premiery (DSEG7, Oxanium; w `app/fonts/` leży też Bowlby One) z `app/fonts/` (`premieres-and-fundraising.md`).
- Paleta: tokeny `--chan-*`. Niebieski (`--chan-blue`) to główny akcent akcji, bursztynowa rodzina (`--chan-amber*`) to akcent wtórny. Karty o chłodnych neutralnych barwach, miękkie obramowania, spójne promienie, warstwowe cienie.
  Bez twardych „3D” cieni przesuniętych i bez nowych literalnych kolorów akcentu. Okno napiwku ma białe tło karty (`.tip-gate-surface` w `globals.css`).
- Logo: `public/logo-glasses.svg` jako zwykły `<img>` w `BrandName.tsx`; w pasku przycisk logo to `BrandHomeLink` (`PLAYER-SOUND.md`). Nie zmniejszaj logo bez sprawdzenia, że wypełnia slot paska. Przycisk logowania w pasku to ikona 38x38 poniżej `sm:`.
- Wewnętrzne identyfikatory zostały po rebrandzie celowo: `.polutek-vidstack-player`, `PolutekControls.tsx`, zdarzenia `polutek:open-support`, `polutek:gate-enter`, klucze `polutek:*` w `localStorage`/`sessionStorage`.
  Kanał główny to ustawienie `main_channel_id` (id kanału), a nie zmienna `MAIN_CREATOR_SLUG` (CLAUDE.md §4.24).
- Przełącznik języków: pigułka w pasku z ikoną globusa (bez flagi), lista w wierszach z flagami (`public/flags/`, circle-flags MIT, `THIRD_PARTY_NOTICES.md`); stan i klawiatura w `app/components/language-switcher/`.
- Instalacja jako aplikacja: `InstallAppMenu` istnieje, ale nie jest nigdzie zamontowany (przycisk usunięto na prośbę właściciela); `public/manifest.json` ma `orientation: portrait-primary`.
  `RotateDeviceGuard.tsx` i `OrientationLock.tsx` istnieją w repozytorium, ale **nie są zamontowane** w `app/layout.tsx` (stan 2026-10-05).
- Telefon: poniżej `lg` (1024 px) odtwarzacz jest na całą szerokość (bez zaokrągleń, ramki i marginesu strony). Kontener nośnika w `Hero.tsx` ma `-mx-4 md:-mx-6 lg:mx-0` i **musi zostać przy `width: auto`**
  (nigdy `w-full` obok ujemnych marginesów). Zakładki komentarze/filmy to płaski pasek z podkreśleniem; panele komentarzy i filmów nie mają karty poniżej `lg`.
- Blokady i stany odtwarzacza (`PlayerLoadingState`, `AccessLockOverlay`, `PlayerErrorOverlay`, `PlayerStateFrame`) mają pasujący wygląd; stany odmowy nigdy nie trzymają zamontowanego odtwarzacza.
  Ruch w tle zatrzymuje `prefers-reduced-motion`.
- Blokady `AccessLockOverlay`: tylko dwa stany, `LOGIN_REQUIRED` („ściana graffiti”: jeden element `role="button"` obsługiwany kliknięciem, Enter i Spacją) i wyświetlany `COMING_SOON` (kokpit). Kompaktowe blokady w listach są statyczne.
- Odtwarzacz: własne sterowanie (`app/components/player/PolutekControls.tsx`) zamiast stockowego układu Vidstack; źródło tylko `self_hls` (`app/components/playback-source.ts`).

## Powłoka i ładowanie pierwszego widoku

- Strona główna to `force-dynamic` + `no-store`: **nigdy** nie wkładaj jej (ani niczego z sesją, danymi komentarzy widza czy planem odtwarzania) do współdzielonego cache.
- Strona główna i jej `loading.tsx` leżą w grupie tras `app/[locale]/(home)/` (nie bezpośrednio w `app/[locale]/`), bo `loading.tsx` na segmencie działa jako zewnętrzna granica Suspense dla wszystkich tras zagnieżdżonych.
  Nie dodawaj gołego `app/[locale]/loading.tsx`. Cztery dokumenty prawne są statyczne (`force-static`, `revalidate = 3600`) i nie mają `loading.tsx`.
- **Brama wejściowa „Follow the white rabbit”** (`app/components/preload/PageRevealGate.tsx` + `MatrixGatePrompt.tsx`, tło `MatrixRain.tsx`): po ustabilizowaniu strony (konto załadowane, odtwarzacz zbuforowany; autoodtwarzanie czeka dodatkowo
  na ≥ 3 s bufora) albo po `PAGE_REVEAL_MAX_WAIT_MS` (6000 ms od nawigacji; na dźwięk wejścia i wektor królika pasek czeka dłużej, do `GATE_SOUND_MAX_WAIT_MS` = 25 s, a przy niewczytanym dźwięku wejście to zwykłe wygaszenie: `gate-readiness.ts`) preloader zamienia się w bramę: królik z napisem nad nim jest na środku od początku, pod nim pasek ładowania ustępuje przyciskowi „ENTER”, a kliknięcie przycisku albo królika jest przepustką (fazy: covering → gate → leaving → done; w `covering` jest tylko cienki pasek bez płytki, bez napisu, królika i niczego do kliknięcia; środek królika, a wcześniej paska, to środek widocznego ekranu, napis „Follow the white rabbit” pojawia się razem z królikiem nad nim, „ENTER” pod nim, oba przypięte do pola królika; Matrix na jasno, patrz CLAUDE.md §4.13). CSS ukrywa preloader po 30 s nawet bez JS; kursor: marchewka (`data-cursor="carrot"`, tylko wskaźniki precyzyjne) jest już w `covering` (także w HTML z serwera i `loading.tsx`) oraz w `gate`, a od kliknięcia do końca wejścia (`warp`, `leaving`) nie ma żadnego (`none`);
  kolejne montowania w tej samej sesji pomijają bramę (`polutek:revealed` w `sessionStorage`). `HomeRouteLoading` zwraca `null` po odkryciu. Testy `page-reveal-gate`, `home-route-loading`, `video-player-page-reveal`
  (mockują `MatrixRain`: jsdom nie ma canvas). Nie usuwaj bramy bez wyraźnej prośby. Nie dodawaj nowych kluczy `waitFor` dla rzeczy poniżej linii załamania.
- **Pierwszy widok kompletny z serwera:** `HomeExperience` przekazuje przeglądarce sesję widza (`AuthSessionSeedProvider`, `lib/auth/session-snapshot.ts`: bez tokenu), pierwszą stronę komentarzy (`initialComments`),
  plan odtwarzania hero i układ sidebara (`ChannelLayoutService.getSidebarLayout` → `initialLayout`), więc pasek, blokady, polubienia, komentarze i odtwarzacz są finalne już w pierwszym HTML. Daty względne i odliczanie premiery używają
  czasu renderu serwera podczas hydracji (`RenderClock.tsx`); liczby i daty mają stały język i `Europe/Warsaw`. `auth()`, treść strony, wiersz kanału głównego i avatar administratora są czytane raz na żądanie (React `cache`).
- **Bez okładki w odtwarzaczu (decyzja 2026-10-04):** okładki należą do miniatur, listy, kart i metadanych. Do pierwszej prawdziwej klatki `PremiumWrapper` i `VideoPlayer` pokazują `PlayerStartLoading` (czarna ramka ze spinnerem po ok. 450 ms); odtwarzacz nie ma `poster`.
- **Przełączanie filmu w sesji nigdy nie renderuje strony na serwerze:** żadnego `router.push`/`router.replace`/`<Link>` do zmiany `?v=`; `SidebarPlaylist` robi `preventDefault` na zwykłym kliknięciu, `ChannelHome.handleVideoSelect` przełącza lokalnie
  i woła `window.history.pushState({ polutekVideoId }, "", "?v=<slug>")`; `popstate` przywraca film z wpisu historii (`UrlMask` przepisuje widoczny adres na `/`). Stan polubienia serwer renderuje tylko dla filmu, z którym strona się otworzyła;
  dla innych `Hero` pobiera `GET /api/videos/[id]/viewer-state` (`private, no-store`).
- `ChannelHome` renderuje DWIE instancje `SidebarPlaylist` naraz (zawsze zamontowany panel „filmy” na telefonie i `aside` na desktopie, ukrywane tylko CSS); `sidebar-layout-request.ts` łączy ich zapytania w jedno.
- `AppPreloadProvider` to pamięciowa warstwa rozgrzewania: komentarze oraz plany odtwarzania tylko na zamiar i tylko dla filmu, który widz może odtworzyć (plan otwiera sesję odtwarzania: nigdy w tle, nigdy dla filmu tylko dla zalogowanych
  przy gościu ani dla premiery). Plany są izolowane po widzu/sesji i filmie, nieaktualne zapytania są przerywane, `PremiumWrapper` zawodzi zamknięcie, dopóki bieżący widz nie ma jawnego planu `READY + canPlay + access.allowed + source + zgodne videoId`.
  Pierwsze sekundy strumienia rozgrzewa `preload/media-warmup.ts` (150 ms zwłoki, najwyżej 2 naraz, 15 s limitu, nic przy Data Saver/2g/3g; nie otwiera sesji i nie liczy wyświetleń). Cache w pamięci; nie osłabiaj zakresu widza.
- `ServiceWorkerCleanup` wyłącza trwałe przechwytywanie i cache service workera; `public/sw.js` to celowo worker „kill switch”. Nie dodawaj trwałych/offline cache dla logowania, płatności, `media-source`, odtwarzania ani danych użytkownika.

## Napisy (WebVTT)

`Video.subtitleUrlPl` / `subtitleUrlEn` to opcjonalne adresy plików WebVTT. `PlaybackService` wkłada je jako `textTracks` do `PlaybackPlan.player` tylko planu odtwarzalnego (https lub ten sam serwis; plany odmowy ich nie niosą).
`VideoPlayer` montuje tylko ścieżkę w języku strony (`pickCaptionTrack()` w `player/captions.ts`, bez języka zastępczego); host `.vtt` musi być w CSP `connect-src`. Przycisk CC (`player/CaptionsToggle.tsx`) to tylko włącznik
(klawisz `c`, `aria-pressed`), ukryty gdy brak ścieżki w języku strony; wybór to preferencja widza w `localStorage` (`polutek:captions`, domyślnie włączone). Pliki lokalne: `public/subtitles/<slug>/<język>.vtt`;
`tests/unit/subtitles-files.test.ts` sprawdza je z długością filmu. Zarządzany upload i walidacja napisów nie są kompletne.

## Wznawianie oglądania, `?t=` i ustawienia (2026-10-14)

Pełny opis niezmienników: CLAUDE.md §4.26. Skrót: `POST /api/videos/[id]/progress` zapisuje pozycję zalogowanego (`watch-progress`), gość używa `localStorage`; `useVideoProgress` w `VideoPlayer` stosuje pozycję startową (`?t=` wygrywa), raportuje co ~10 s i przy zamknięciu karty, a `ResumeNotice` pokazuje „Wznowiono od mm:ss” z przyciskiem „Od początku”.
`PlayerSettingsMenu` (w `PolutekControls`) daje jakość (Auto + poziomy z manifestu HLS), prędkość 0,5-2x i obraz w obrazie. Półka „Kontynuuj oglądanie” (`channel/ContinueWatchingShelf.tsx`) jest renderowana w `ChannelHome` z danych `HomeExperience`.
Menu Udostępnij (`ShareButton`, `getStartSeconds`) dodaje pozycję „Zacznij od aktualnego czasu”, która dopisuje `?t=` do linków menu.
