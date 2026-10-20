# Rozdziały filmów (chapters): specyfikacja wdrożeniowa

Stan na 2026-10-20. **Stan budowy (2026-10-20): zadania 1 (dane, domena, Studio, plan odtwarzania) i 2 (odtwarzacz i karta opisu) z sekcji 12 są zbudowane; zadanie 3 (SEO i wyszukiwarka) czeka, więc opisy JSON-LD i wyszukiwania są nadal projektem.** Rozdziały („chapters”, jak na YouTube) to lista `czas → tytuł` zapisana przy filmie przez twórcę: dzieli pasek postępu na odcinki, pokazuje tytuł rozdziału, ma panel „Rozdziały” z przeskokiem i klikalne znaczniki czasu w opisie.
Dokument ma wystarczyć, żeby trzy niezależne zadania (sekcja 12) dało się wykonać bez zgadywania. Fakty z kodu mają wskazane pliki i linie (stan `origin/main` z 2026-10-20, `f1664b7f`); zdania oznaczone **[niezweryfikowane]** nie zostały sprawdzone w źródle pierwotnym.

## 1. Co jest dziś (fakty z kodu)

**Strona filmu.** Film jest pokazywany na stronie głównej pod `/?v=<slug>` (`app/[locale]/(home)/page.tsx`); `UrlMask` zwija widoczny adres do `/` (`app/components/UrlMask.tsx`, decyzja właściciela: **nie zmieniamy**), `/watch/<slug>` tylko przekierowuje. Cały łańcuch danych jest **jednakowy dla każdego widza** (`getHomeSelectionCached` jest zakresu żądania, `home-content.loader.ts:118`): `PublicVideoDTO` (`app/types/video.ts`) budowany w **jednym miejscu**, `VideoContentService.mapToPublicVideoDTO` (`lib/modules/video/infrastructure/video-content.service.ts:116-159`; tam doszły `tags`/`category`, to wzór dla nowych pól). Opis (`description`/`descriptionEn`) trafia do DTO **bez względu na poziom dostępu**, a `Hero.tsx:96` wybiera język. W DTO nie ma napisów: „Subtitles are not part of the public DTO: they come only with a playable plan” (`app/types/video.ts`).

**Karta opisu** to `Hero.tsx:424-477` (`descPanel`, zwijanie `truncateAtWord(…, 160)` / „Pokaż więcej”, całe pole klika się i przełącza zwinięcie, przyciski w środku robią `stopPropagation`). Menu Udostępnij: `Hero.tsx:388-394` (`getStartSeconds` z `player/playback-position.ts`). Gniazdo odtwarzacza: `Hero.tsx:267` (`data-player-slot`, `lg:rounded-[22px]`, `overflow-hidden`; zewnętrzna karta `lg:rounded-[26px]` w linii 265; poniżej `lg` pełna szerokość, bez zaokrągleń).

**Plan odtwarzania** (`PlaybackPlan`, `lib/modules/playback/domain/playback.dto.ts:46-77`) niesie `player.textTracks`. Budują go `playerFor()` (`lib/modules/playback/application/playback.service.ts:68-82`) i **tylko plan gotowy do odtwarzania dostaje napisy** (`playback.service.ts:309`); każdy plan odmowy woła `unavailablePlan()` z samym `thumbnailUrl` i `title` (linie 183-321). Dokładnie tak powinny jechać rozdziały. Wiersz `Video` jest tam wczytany w całości (`findUnique … include`, linia 174), więc nowa kolumna jest dostępna bez zmiany zapytania. Plan jest pobierany po stronie klienta dla każdego filmu (`/api/media-source/[videoId]`, nigdy nie cache'owany, CLAUDE.md §4.3), a dla pierwszego widoku dostarcza go serwer (`loadHeroPlaybackPlan`, `HomeExperience.tsx:130`); przełączanie filmów to `history.pushState`, bez renderu serwera (CLAUDE.md §4.13). **Wniosek: dane z DTO listy nie dojadą do przełączonego filmu; plan dojedzie zawsze.**

**`?t=` i wznawianie** (`lib/video-start-time.ts`, `app/components/player/useVideoProgress.ts`): `parseStartTime` (sekundy, `1m30s`, `1:30`), `clampStartTime(seconds, duration)` (po końcu ląduje 1 s przed nim), `formatClock`, `withStartTime`. `?t=` jest czytane **raz na wczytanie strony** dla pierwszego filmu i **usuwane z adresu** (`useVideoProgress.ts` `readPageStart`, ok. linii 36-52); `applyStart()` stosuje je raz na film w `onCanPlay` (`VideoPlayer.tsx:481-492`). **Konsekwencja: skok z listy rozdziałów w obrębie otwartej strony nie może iść przez `?t=`** (adres jest zwinięty, parametr już zużyty); trzeba przestawić `currentTime` bezpośrednio, z tym samym `clampStartTime`. `?t=` zostaje natomiast poprawnym adresem dla Google i linków udostępniania (sekcja 9).

**Metadane i JSON-LD** (`page.tsx:31-86` i `97-114`): `VideoObject` jest wypisywany dla każdego filmu, który nie jest `noindex` (czyli także dla `LOGGED_IN`; dziś zawiera `description`), `embedUrl = /?v=<slug>`. Przy `NEXT_PUBLIC_SITE_BETA` cała strona jest i tak `noindex` (CLAUDE.md §4.13), więc dane strukturalne zaczną działać dla Google dopiero po wyłączeniu bety.

**Stos odtwarzacza.** `@vidstack/react` i `vidstack` **1.15.6**, `hls.js` **1.7.3** (`package.json:63,71,88`; `package-lock.json` potwierdza), ładowany jako `hls.js/light` z własnego bundla (`player/self-hls.ts`). Własne sterowanie: `app/components/player/PolutekControls.tsx` (`TimeSlider.Root` > `Track` > `Progress` + `TrackFill`, `Thumb`, `Preview` z `TimeSlider.Value`; prawa grupa: `CaptionsToggleButton`, `PlayerSettingsMenu`, `FullscreenToggleButton`). Style: `app/globals.css` ok. 628-985 (`.mc-*`). `.mc-scrub-track` ma `overflow:hidden`, `.mc-scrub-buffer`/`.mc-scrub-fill` biorą szerokość z `--slider-progress`/`--slider-fill`; `@media (hover:none) { .mc-scrub-preview { display:none } }` (podpowiedź nad paskiem **nie istnieje na telefonie**); `@media (max-width:640px)` chowa `.mc-time-dur`. Menu ustawień (`PlayerSettingsMenu.tsx`) to gotowy wzór panelu: przycisk + `role="menu"`, klasy `.mc-menu`/`.mc-menu-item`, Escape zwraca fokus. Skróty klawiszy: `VideoPlayer.tsx:88` `PLAYER_KEY_SHORTCUTS = { speedUp: '', slowDown: '' }` przekazane jako `keyShortcuts` (`VideoPlayer.tsx:480`). Napisy: `<Track>` w `<MediaProvider>` tylko dla języka strony (`VideoPlayer.tsx:598-610`), `CaptionsSync` w `PolutekControls`.

**Studio.** Edytor: `app/components/studio/StudioVideoEditor.tsx` (527 linii; zapis `PATCH` w `save()`, linie 118-140; po prawej karta podglądu z miniaturą i statusem, **bez odtwarzacza**; „Więcej opcji” to osobny komponent `VideoMoreOptions` w linii 319). Pola formularza i czyste reguły: `studio/video-form.ts` (`EditorForm`, `isFormDirty`, `DESCRIPTION_MAX = 5000`, `TITLE_MAX = 100`). Trasa: `app/api/studio/videos/[id]/route.ts` (`PATCH` → `updateVideoSchema` → `updateAdminVideo`). Schemat: `lib/api/studio-schemas.ts` (`updateVideoSchema`; `videoMetadataFields` to lista dozwolonych pól; **plik ma CRLF**). Use case: `lib/modules/video/application/update-admin-video.use-case.ts` (`authorize(ctx, "video.update", …)` na początku; metadane przez `resolveVideoMetadata()` w `domain/video-metadata.ts`, „only fields that were sent come back”; audyt `VIDEO_UPDATED` z `changed: Object.keys(safeInput)` w tej samej transakcji). Zapis do bazy: `VideoRepository.updateForMainChannel` (`video.repository.ts:300-326`, biała lista pól). `video.update` mają OWNER, MANAGER i EDITOR (`lib/modules/authz/domain/matrix.ts`, `CONTENT_EDIT`), kanał `LIMITED` ją zachowuje, kanał zamrożony traci. Panel `apps/admin` używa tego samego use case'u i **nie wyśle** `chapters`, więc nic nie nadpisze (zapis tylko wysłanych pól).

**Budżety plików** (`scripts/check-hotspots.ts`): `source` 550, `client-component` 450, `route` 350 linii; wyjątki: `Hero.tsx` 500 (dziś 485), `VideoPlayer.tsx` 650 (dziś 627), `ChannelHome.tsx` 470 (dziś 469), `PremiumWrapper.tsx` 500. **`StudioVideoEditor.tsx` ma 527 linii (liczone jak bramka: `split("
")`) i zaczyna się od `"use client"`, czyli podlega budżetowi 450 dla komponentów klienckich bez wpisu wyjątku (to samo `StudioUploadWizard.tsx`, 490): `npm run quality:hotspots` jest więc na `main` już przekroczony; sprawdzić to przed zadaniem 1 i nie pogarszać (w edytorze dozwolone wpięcie netto bliskie 0 linii, najlepiej wyciągnięcie czegoś do nowego pliku).** Wolne linie wyjątków liczone tą samą metodą: `Hero.tsx` 485/500, `VideoPlayer.tsx` 627/650, `ChannelHome.tsx` 469/470. Cały nowy kod idzie do **nowych plików** (sekcja 12), a w istniejących plikach tylko krótkie wpięcia.

**Baza.** `Video` (`prisma/schema.prisma:770-865`) ma `tags String[]`, `category`, `searchText` (tylko z triggera), `durationSeconds Int?` (z tekstu `duration` przez ten sam trigger) i `titleEn`/`descriptionEn`, ale **nie ma pola języka treści**. Najnowsza migracja: `20261019180000_playlists`. Trigger wyszukiwarki: `20261019170000_video_search` (`video_search_refresh()`, `BEFORE INSERT OR UPDATE OF title, titleEn, description, descriptionEn, tags, category, tier, duration`; opis wchodzi do `searchText` **tylko dla `tier = 'PUBLIC'`**, `left(…, 3000)`). Pliki: `schema.prisma` ma mieszane CRLF/LF, migracje SQL z tego tygodnia to LF, `studio-schemas.ts` i `studio-client.ts` to CRLF, `globals.css`, `Hero.tsx`, `VideoPlayer.tsx`, `PolutekControls.tsx` to LF (sprawdzone poleceniem `file`).

## 2. Co daje Vidstack 1.15.6 (sprawdzone w `node_modules`, nie z pamięci)

Wszystkie ścieżki: `node_modules/vidstack/dev/chunks/` oraz `node_modules/@vidstack/react/`.

1. **Rozdziały to ścieżka tekstowa `kind: "chapters"`.** `SliderChapters` (`vidstack-C7VnVlv2.js:812-1039`) nasłuchuje `watchActiveTextTrack(media.textTracks, "chapters", …)` (`vidstack-DPxkpJG-.js:10-34`): bierze **pierwszą ścieżkę `kind="chapters"` w trybie `showing`**; jeśli jej `readyState !== 2`, czeka na zdarzenie `load`. Kiedy ścieżka ma wskazy (`track.cues.length`), `#fillGaps()` (linie 964-984) buduje listę odcinków **wypełniając dziury pustymi wskazami** (od początku filmu do pierwszego rozdziału, między rozdziałami, do końca `duration()`), dlatego pierwszy rozdział nie musi zaczynać się w 0, ale my i tak wymuszamy 0:00.
2. **Wskazy można dodać programowo, bez pliku WebVTT i bez sieci.** `TextTrack` (`vidstack-BpQc-xfw.js:15-122`): konstruktor bez `src` i `content` ustawia `readyState = 2` od razu (linia 76); `addCue(cue)` wstawia wskaz w kolejności czasu i wysyła `add-cue`, na co `SliderChapters` reaguje (`vidstack-C7VnVlv2.js:1001-1003`, debounce 150 ms). `TextTrackList.add(init)` (`vidstack-BWkbKDUg.js`, klasa `TextTrackList`) z `default: true` ustawia `mode = "showing"` po ok. 300 ms (`#selectTracks`); tryb można też ustawić ręcznie: `track.mode = "showing"`. `TextTrackInit.content` przyjmuje też JSON `{ cues: [{startTime, endTime, text}] }` z `type: "json"` (linie 147-158, 205-214) lub tekst WebVTT, ale tam parsowanie jest asynchroniczne (`import("media-captions")`), więc **wybieramy wariant `addCue`** (synchroniczny, bez zależności od dynamicznego importu).
3. **Szkic dowodowy (do wdrożenia w `ChaptersTrackSync`, komponent wewnątrz `<MediaPlayer>`):**

```tsx
const player = useMediaPlayer();            // @vidstack/react
useEffect(() => {
  if (!player || chapters.length < 3) return;
  const track = new TextTrack({ kind: "chapters", label: "Chapters", language: lang, type: "vtt" }); // bez src/content => readyState 2
  chapters.forEach((c, i) => {
    const end = chapters[i + 1]?.startSeconds ?? (duration || c.startSeconds + 1); // ostatni do końca filmu
    track.addCue(new window.VTTCue(c.startSeconds, end, title(c)));
  });
  player.textTracks.add(track);
  track.mode = "showing";                   // wymagane przez watchActiveTextTrack
  return () => { player.textTracks.remove(track); };
}, [player, chapters, duration, lang]);
```
   `TextTrack` i `isTrackCaptionKind` są eksportowane z `@vidstack/react` (`vidstack-react.d.ts`, lista eksportów; ten sam import już robi `CaptionsToggle.tsx:5`). Gdy `duration` jest nieznane przy montażu, ostatni wskaz dostaje koniec po `loadedmetadata`/`onDurationChange` (efekt zależy od `duration`; `SliderChapters` sam przelicza przy zmianie czasu trwania, linie 1015-1018).
4. **Segmentowany pasek w React:** `TimeSlider.Chapters` (`vidstack-react.d.ts:1002-1027`) dostaje funkcję `(cues, forwardRef) => …`, każdy odcinek to element z `ref={forwardRef}` zawierający własny `TimeSlider.Track` (`TrackFill`, `Progress`). Vidstack sam ustawia **`width: N%`** każdego odcinka (`#watchContainerWidths`, linie 882-894) i zmienne `--chapter-fill` / `--chapter-progress` (linie 895-947); atrybuty `data-active` / `data-ended`. Bez wskazów (`cues.length === 0`) komponent podaje jeden pusty wskaz, czyli **jeden pełny odcinek: zachowanie identyczne jak dziś** (`ChapterTracks`, `vidstack-react.d.ts` → `vidstack-CmGGM4tp.js`, `$cues.length ? $cues : [emptyCue]`). Przerwy między odcinkami to czysty CSS (`gap`/`margin` na elementach), szerokość liczy Vidstack.
5. **Tytuł rozdziału:** `TimeSlider.ChapterTitle` (wewnątrz `TimeSlider.Preview`) pokazuje `activePointerCue || activeCue` (czyli tytuł rozdziału pod kursorem, a bez kursora bieżący); `useChapterTitle()` (`vidstack-react.d.ts:1528`) zwraca tytuł **aktualnie granego** rozdziału (`watchCueTextChange(…, "chapters", …)`, `vidstack-CHHburuM.js:131`), do etykiety obok czasu. `useChapterOptions()` (linia 1614) daje listę `{cue, label, startTimeText, durationText, selected, select()}` do panelu: `select()` przewija do rozdziału.
6. **Skróty:** domyślne klucze (`MEDIA_KEY_SHORTCUTS` w `vidstack-BWkbKDUg.js`): `k Space` pauza, `m`, `f`, `i`, `c`, `j J ArrowLeft`, `l L ArrowRight`, `ArrowUp/Down`, `> <` (u nas wyłączone), **cyfry 0-9 skaczą do 0-90 % filmu**. Obiekt `keyShortcuts` przyjmuje **własne nazwane wpisy** w kształcie `{ keys: "Ctrl+ArrowRight ]", onKeyDown({event, player, remote}) { … } }`; dopasowanie wymaga **dokładnie tych samych modyfikatorów** (pętla po `MODIFIER_KEYS`, `#getMatchingMethod`), więc `Ctrl+ArrowRight` nie koliduje z `ArrowRight` (przewijanie o 5 s). Skróty nie działają, gdy fokus jest w `input, textarea, select, [contenteditable], [role^="menuitem"]` (`IGNORE_SELECTORS`), więc nie przeszkadzają w panelu rozdziałów.
7. **Ograniczenie, które trzeba znać:** `aria-valuetext` suwaka czasu jest generowany po angielsku (`vidstack-C-fvFLVV.js:1750-1753`, „x out of y”); tytułu rozdziału tam nie ma. Nie nadpisujemy go; rozdział dla czytnika ekranu wystawia osobny, widoczny w DOM element (etykieta rozdziału obok czasu, `aria-live="off"`, plus lista w panelu). **[Do sprawdzenia w implementacji: czy `state.textTrack` (używany przez `CaptionsToggleButton`, `CaptionsToggle.tsx:56`) zostaje śladem napisów, gdy ścieżka rozdziałów jest `showing`. Ten przycisk i tak sprawdza `isTrackCaptionKind`, więc obecny kod jest odporny; mimo to test w przeglądarce z napisami i rozdziałami naraz jest w planie testów.]**

**Co to znaczy dla nas.** (a) Z naszym własnym sterowaniem (`PolutekControls` składa gotowe prymitywy Vidstack, nie `DefaultLayout`) działają `TimeSlider.Chapters`, `ChapterTitle`, `useChapterTitle`, `useChapterOptions` bez żadnych zmian w bibliotece. (b) HLS nie ma tu nic do rzeczy: ścieżka rozdziałów to ścieżka tekstowa po stronie odtwarzacza, nie ma jej w manifeście i nie zależy od `hls.js/light` (który zresztą ma okrojony moduł napisów; nie używamy go do rozdziałów). Nie dodajemy nic do CSP (żadnego pliku `.vtt`, żadnego nowego hosta). (c) **Plan awaryjny**, gdyby test w przeglądarce wykazał problem ze ścieżką: ta sama czysta funkcja `buildChapterSegments(chapters, duration)` (sekcja 4.2) może zasilić własne znaczniki przerw jako absolutne elementy w `.mc-scrub-track` plus `useMediaState("currentTime")` do bieżącego rozdziału; interfejs komponentów zostaje ten sam.

## 3. Decyzje (skrót)

| # | Decyzja |
|---|---|
| a | Kolumna `Video.chapters Json?` (nullable, addytywna), kształt `{ startSeconds, title, titleEn? }[]`, walidacja zod i czysty moduł domenowy; **nie** tabela. |
| b | **Nie** w `PublicVideoDTO`. Rozdziały jadą wyłącznie w **planie odtwarzania** (`player.chapters`, tylko plan `READY`), jak napisy. Do JSON-LD jedno osobne czytanie serwerowe, tylko `PUBLIC` + indeksowalny. |
| c | Studio: osobny komponent `VideoChaptersEditor` w sekcji edytora (nowy plik), lista wierszy (czas + tytuł PL + EN), „Importuj z opisu”, własny dialog potwierdzenia, ten sam `PATCH` i akcja `video.update`. |
| d | Odtwarzacz: segmentowany pasek (`TimeSlider.Chapters`), tytuł w podpowiedzi i etykieta obok czasu, przycisk „Rozdziały” z menu, skróty `Ctrl/Alt+←/→` oraz `[`/`]`. |
| e | Karta opisu: znaczniki czasu w opisie stają się przyciskami skoku; pod opisem zwijana lista rozdziałów. |
| f | Znaczniki czasu w komentarzach: **poza zakresem** tej pracy. |
| g | JSON-LD `hasPart` z `Clip` tylko dla filmu `PUBLIC` i indeksowalnego; adresy `…/?v=<slug>&t=<s>`. |
| h | Tytuły rozdziałów w `searchText`: **tak, ale w osobnym, późniejszym zadaniu i osobnej migracji** (sekcja 10). |
| i-l | Teksty, testy, podział na zadania, weryfikacja i wycofanie: sekcje 11-14. |

## 4. (a) Model danych i moduł domenowy

### 4.1 Dlaczego `Json?` w kolumnie, a nie tabela

Rozdziały są zawsze czytane i zapisywane **razem z filmem i w całości** (twórca edytuje jedną listę, serwer zastępuje ją atomowo), nie mają własnych relacji, nie są przeszukiwane po polach, a liczba jest mała (≤ 50). Tabela `VideoChapter` dołożyłaby join do każdego planu odtwarzania, transakcję „usuń i wstaw”, kolejność i unikalność w bazie, bez żadnej korzyści. Kolumna `Json?` jest jednym polem `findUnique`, które plan i tak wczytuje. Koszt: brak twardej integralności w bazie, więc (1) **jedyne miejsce zapisu** to use case przez moduł domenowy, (2) `CHECK` w migracji pilnuje tylko typu i liczby, (3) czytanie jest zawsze przez `parseStoredChapters()` (niepoprawna zawartość daje „brak rozdziałów”, nigdy wyjątek).

Migracja `prisma/migrations/20261020120000_video_chapters/migration.sql` (LF, bez BOM, addytywna):

```sql
-- Video chapters (docs/architecture/video-chapters.md). Additive only: one nullable column and one CHECK.
ALTER TABLE "Video" ADD COLUMN "chapters" JSONB;
ALTER TABLE "Video" ADD CONSTRAINT "Video_chapters_shape_check"
  CHECK ("chapters" IS NULL OR (jsonb_typeof("chapters") = 'array' AND jsonb_array_length("chapters") BETWEEN 1 AND 50));
```
`schema.prisma`: dopisać w modelu `Video` (obok `tags`) `/// … chapters Json?` (komentarz `///` jak sąsiednie pola; **nie** przepisywać pliku, tylko wstawić linię; plik ma mieszane końce linii: sprawdzić `git diff --stat`). Istniejące wiersze mają `NULL`. Pusta lista jest zapisywana jako `NULL` (Prisma: przy czyszczeniu `Prisma.DbNull`, nie `null`; `null` w polu `Json?` byłby JSON-owym `null`). Stary kod ignoruje kolumnę, więc migracja jest bezpieczna dla wycofania kodu (CLAUDE.md §4.0).

### 4.2 Moduł domenowy `lib/video-chapters.ts` (czysty, bezpieczny dla klienta)

Obok `lib/video-metadata.ts` i `lib/video-start-time.ts` (ten sam wzorzec: współdzielony przez Studio, use case, odtwarzacz i testy; bez I/O, bez Reacta, bez Prisma). Eksporty:

```ts
export const CHAPTERS_MIN = 3;            // jak YouTube; jedna stała do zmiany
export const CHAPTERS_MAX = 50;
export const CHAPTER_MIN_GAP_SECONDS = 10; // każdy rozdział co najmniej 10 s
export const CHAPTER_TITLE_MAX = 80;
export interface Chapter { startSeconds: number; title: string; titleEn?: string }
export type ChapterProblem =
  | { code: "TOO_FEW" | "TOO_MANY" | "FIRST_NOT_ZERO" | "NOT_ASCENDING" | "DUPLICATE_START" | "TOO_CLOSE"
        | "BEYOND_DURATION" | "TITLE_EMPTY" | "TITLE_TOO_LONG" | "INVALID_TIME"; index?: number };
export function normalizeChapters(raw: unknown): Chapter[];                       // trim, pojedyncze spacje, bez znaków sterujących, sort rosnąco, odrzuca śmieci
export function validateChapters(chapters: readonly Chapter[], durationSeconds?: number | null): ChapterProblem[];
export function parseStoredChapters(value: unknown): Chapter[];                   // z bazy: normalizacja + walidacja strukturalna; zła zawartość => []
export function parseChaptersFromDescription(text: string): { chapters: Chapter[]; skipped: { line: number; text: string; reason: string }[] };
export function pickChapterTitle(chapter: Chapter, language: string): string;      // en/inne != pl => titleEn ?? title
export function activeChapterIndex(chapters: readonly Chapter[], seconds: number): number; // -1 gdy brak
export function adjacentChapterStart(chapters: readonly Chapter[], seconds: number, dir: -1 | 1): number | null;
export function buildChapterSegments(chapters: readonly Chapter[], durationSeconds: number): { start: number; end: number; title: string }[];
export function chapterWindowEnd(…): number; // koniec ostatniego rozdziału = czas trwania
```

**Reguły** (każda ma test; źródło każdej liczby w sekcji 15):

| Reguła | Wartość | Uzasadnienie |
|---|---|---|
| Pierwszy rozdział | `startSeconds === 0` | YouTube Help „Add chapters”: pierwszy znacznik `00:00` (źródło w sekcji 15) |
| Najmniej rozdziałów | **3** (lub 0 = brak) | jak YouTube; lista w Studio da się wkleić do opisu na YouTube; jedna stała `CHAPTERS_MIN` |
| Najwięcej | **50** | rozsądny sufit dla paska i panelu; CHECK w bazie 1-50 |
| Odstęp | co najmniej **10 s** między początkami | YouTube: „each chapter at least 10 seconds”; poniżej tego odcinek jest niewidoczny na pasku |
| Kolejność i unikalność | ściśle rosnąco, bez powtórzonych czasów | Google (Clip): „no two clips … same start time” |
| Granica | `startSeconds ≤ duration − 10` gdy czas trwania znany (`Video.durationSeconds`); gdy `null`, tylko reguły strukturalne, a odtwarzacz odrzuca rozdziały za końcem | `durationSeconds` bywa puste (trigger parsuje tekst `duration`) |
| Czas | liczba całkowita 0 … 86400 (`MAX_START_SECONDS` z `lib/video-start-time.ts`) | jedna definicja „sensownego czasu” |
| Tytuł | 1-80 znaków (liczone jak `[...s].length`, jak tagi), bez nowych linii, przycięty, pojedyncze spacje | podpowiedź na pasku i panel są jednowierszowe |
| `titleEn` | opcjonalny, 0-80; pusty = `null`/brak | EN widzi `titleEn ?? title`; pozostałe języki UI pokazują treści angielskie (CLAUDE.md §4.11): `pickChapterTitle` zwraca `titleEn ?? title` dla `language !== "pl"` |

`parseChaptersFromDescription(text)`: wejście to opis (PL albo EN). Każda linia: opcjonalny prefiks (`-`, `*`, `•`, `–`, `—`, `>`), potem opcjonalnie `[`/`(` i **czas na początku linii** w formie `m:ss`, `mm:ss`, `h:mm:ss`, `hh:mm:ss` (sekundy i minuty przy godzinach < 60; ta sama gramatyka co `CLOCK_FORM` w `video-start-time.ts`, bez `1m30s`), opcjonalnie zamknięcie `]`/`)`, separator (` `, `-`, `–`, `—`, `:`, `|`, `·`, `)` w dowolnej kombinacji) i **tytuł** (reszta linii, przycięta). Reguły: czas **tylko na początku linii** (jak YouTube; czasy w środku zdania to nie rozdziały); linia bez tytułu → `skipped` z powodem; powtórzony czas → pierwszy wygrywa, reszta do `skipped`; wynik posortowany. Zwraca też `skipped`, bo Studio ma pokazać, co pominięto. Funkcja **nie dopisuje** brakującego 0:00 ani nie naprawia odstępów: to robi twórca w edytorze po zobaczeniu komunikatów walidacji (jawnie, nie po cichu). Ta sama gramatyka czasu jest używana do **linkowania znaczników w opisie** (sekcja 8): wspólna funkcja `scanTimestamps(text)` zwracająca `{index, length, seconds}`.

### 4.3 Zapis (use case i trasa)

- `lib/api/studio-schemas.ts` (**CRLF, dopisać wiersze w tym samym stylu, nie przepisywać pliku**): w `videoMetadataFields` dodać `chapters: studioChaptersSchema.nullable().optional()`; `studioChaptersSchema = z.array(z.object({ startSeconds: z.number().int().min(0).max(86400), title: z.string().max(200), titleEn: z.string().max(200).nullable().optional() })).max(CHAPTERS_MAX)`. Zod jest tylko pierwszą linią (kształt i limity pól); reguły domenowe sprawdza use case. `createVideoSchema` dostaje to samo pole przez `videoMetadataFields`, ale kreator uploadu go nie wysyła (czas trwania nieznany; sekcja 7).
- `domain/video-metadata.ts` (`resolveVideoMetadata`): dodać gałąź `chapters`: `undefined` = nie ruszać, `null` albo `[]` = wyczyść, inaczej `normalizeChapters` → `validateChapters(…, existing.durationSeconds)`; pierwszy problem → `AppError(400, "VIDEO_CHAPTERS_INVALID", komunikat po polsku)` z kodem problemu w `details`/komunikacie, tak jak `VIDEO_TAGS_TOO_MANY`. Czas trwania musi dojść do tej funkcji: najprościej drugi argument `resolveVideoMetadata(input, { durationSeconds })`, wołany z `update-admin-video.use-case.ts` (tam `existing` jest już wczytany, linia 30).
- `UpdateVideoInput`/`AdminUpdateVideoInput` (`video.repository.ts`): `chapters?: Chapter[] | null`; `updateForMainChannel`: `if (data.chapters !== undefined) updateData.chapters = data.chapters === null ? Prisma.DbNull : (data.chapters as unknown as Prisma.InputJsonValue);`.
- Autoryzacja: **bez nowej akcji**; `authorize(ctx, "video.update", …)` w use case'ie już stoi na pierwszym miejscu (OWNER, MANAGER, EDITOR; kanał zamrożony odmawia, `LIMITED` pozwala; film z innego kanału = 404 przez `updateForMainChannel`). Rozdziały to metadane filmu jak tagi, nowa akcja w zamkniętej liście (`actions.ts`) + wiersz macierzy + test kontraktowy nie dają żadnej różnicy w uprawnieniach.
- Audyt: istniejące `VIDEO_UPDATED` (ta sama transakcja) już dopisze `chapters` do `changed`; dodać do metadanych `chaptersCount: number | null` (**tylko liczba, nigdy tytuły**, CLAUDE.md §4.20: „id, liczniki, statusy, nigdy treści”). Osobne zdarzenie `VIDEO_CHAPTERS_UPDATED` **nie jest potrzebne** (jedna transakcja z resztą pól; panel audytu filtruje po `changed`). Test `admin-audit-coverage` nie wymaga zmian (nie powstaje nowa trasa mutująca).
- Odczyt do edytora: `toAdminVideoDto` (`video.dto.ts:243-290`) dopisuje `chapters: parseStoredChapters(video.chapters)` (tak jak `tags`), `AdminVideoDto` i `StudioVideo` (`studio-client.ts`, CRLF) dostają pole `chapters: Chapter[]`. `GET /api/studio/videos/[id]` oddaje je bez zmian w trasie.
- Wariant: nic w `createAdminVideo` (nowy film nie ma jeszcze czasu trwania; rozdziały dodaje się po uploadzie).

## 5. (b) Wystawienie publiczne i poziomy dostępu

**Reguła: rozdziały są częścią planu odtwarzania, nie DTO.** W `PlaybackPlan.player` dochodzi `chapters?: { startSeconds: number; title: string; titleEn?: string }[]` (`playback.dto.ts:58-64`, obok `textTracks`), a `playerFor()` dostaje `chapters` jako kolejny argument i **tylko wywołanie na linii 309 (plan gotowy) go przekazuje**; wszystkie `unavailablePlan()` pozostają bez rozdziałów (jak napisy; test: dla planu odmowy `player.chapters === undefined`). Dla `COMING_SOON` i `LOGIN_REQUIRED` rozdziałów nie ma. Skutki:

| Widz | Film `PUBLIC` | Film `LOGGED_IN` |
|---|---|---|
| gość | plan `READY` → rozdziały w pasku, panelu i liście pod opisem | plan `LOGIN_REQUIRED` → **żadnych rozdziałów**; opis (z godzinami, jeśli twórca je wpisał) jest widoczny jak dziś, ale znaczniki czasu w opisie są zwykłym tekstem (nie ma czego przewijać) |
| zalogowany | j.w. | plan `READY` → rozdziały jak wyżej |

To jest ostrzejsze niż reguła opisu (opis trafia do DTO dla wszystkich, `Hero.tsx:96`), czyli **nic nie przecieka ponad to, co dopuszcza opis**: tytuły rozdziałów w strukturze mają ten sam albo węższy zasięg niż tekst opisu. Twórca, który wkleja znaczniki do opisu filmu `LOGGED_IN`, i tak robi je publicznymi dla gości (to jego decyzja, tak jak dziś); Studio może to powiedzieć jednym zdaniem w podpowiedzi przy „Importuj z opisu” (sekcja 6). Premiera przed czasem: jak każdy plan odmowy, brak rozdziałów. `UNLISTED`: reguły poziomu jak `PUBLISHED`; brak JSON-LD (`shouldNoIndexVideo`).

`PAID` (etap 6, wyłączony): poziom czytany z surowej kolumny, plan `READY` tylko z uprawnieniem; rozdziały jadą z planem, więc nie wymagają osobnej logiki. W DTO `tier` jest „efektywny” (`LOGGED_IN` dla `PAID`), więc **kontroli „czy PUBLIC” dla JSON-LD nie wolno opierać na surowym stringu z innego źródła** (sekcja 9).

Nie dodajemy rozdziałów do: `PublicVideoDTO`, `mapToPublicVideoDTO`, RSS, oEmbed, `/embed`, karuzel, wyszukiwarki API (poza `searchText`, sekcja 10), powiadomień, eksportu danych (to treść twórcy, nie dane widza). Embed (`app/embed/[slug]/EmbedPlayer.tsx`) używa tego samego `VideoPlayer`, więc dostanie pasek i panel z planu bez zmian; to akceptowalne (odtwarzacz osadzony pokazuje to samo co na stronie), ale test ręczny obowiązkowy (sekcja 14).

**Skok z listy pod opisem wymaga rozdziałów poza polem odtwarzacza.** `Hero` jest rodzeństwem `PremiumWrapper`, a `useVideoAccess()` działa tylko w jego środku. Wzorzec już istnieje: `player/playback-position.ts` (moduł-magazyn zapisywany przez odtwarzacz, czytany przez menu Udostępnij). Dla rozdziałów: nowy `player/chapters-store.ts` (magazyn `useSyncExternalStore` per `videoId`: `publishChapters(videoId, chapters, durationSeconds)`, `clearChapters(videoId)`, `useVideoChapters(videoId)`) zapisywany przez `ChaptersTrackSync` w odtwarzaczu, czytany przez komponenty pod opisem. Skok: `player/seek-request.ts` (`requestSeek(videoId, seconds)` → `CustomEvent("polutek:seek-request")`, jak `polutek:video-ended`); nasłuch w nowym komponencie wewnątrz `<MediaPlayer>` (`ChaptersSeekListener`) wykonuje `player.currentTime = clampStartTime(seconds, player.duration)` (**ten sam bezpieczny skok co `?t=`**), wznawia odtwarzanie, jeśli była pauza po `ended`, i na telefonie przewija pole odtwarzacza do widoku (`scrollIntoView({ block: "nearest" })`, bez animacji przy reduced motion). Magazyn jest pusty, dopóki plan nie przyjdzie, więc dla gościa filmu `LOGGED_IN` lista nie istnieje.

## 6. (c) Studio: edytor rozdziałów

**Miejsce:** nowy plik `app/components/studio/VideoChaptersEditor.tsx` (`"use client"`, < 300 linii) + czysty plik `app/components/studio/chapters-form.ts` (wiersze edytora ↔ `Chapter[]`, tekst „m:ss” ↔ sekundy, komunikaty problemów, dirty). W `StudioVideoEditor.tsx` tylko wpięcie (importy, `chapters` w `EditorForm`/`toForm`/`save`/`isFormDirty`, jeden element `<VideoChaptersEditor …/>` pod „Więcej opcji”, linia ~324): **netto ~0 nowych linii** (plik ma 527 przy budżecie 450, patrz sekcja 1). Pole `chapters: ChapterRow[]` w `EditorForm` (`video-form.ts`); `isFormDirty` ma już gałąź tablic, ale porównuje elementy przez `!==`, więc dla obiektów trzeba w `isFormDirty` dodać porównanie po `JSON.stringify` albo trzymać w formularzu tablicę łańcuchów `"0:00|Wstęp|Intro"`; **zalecenie: osobna funkcja `areChaptersEqual()` w `chapters-form.ts` i jedna linia w `isFormDirty`**.

**UX (tokeny `--chan-*`, miękkie zaokrąglenia jak reszta Studia: `rounded-xl`/`rounded-2xl`, klasy z `studio/ui.tsx`: `inputClass`, `ghostButtonClass`, `smallGhostButtonClass`, `smallDangerGhostButtonClass`, `Field`, `Notice`):**
- Karta zwijana `<details>` jak „Więcej opcji”; w nagłówku licznik „Rozdziały (N)”. Podpowiedź: „Pierwszy rozdział zaczyna się w 0:00, co najmniej 3 rozdziały, każdy minimum 10 s. Jak na YouTube.” Gdy film jest `LOGGED_IN`, drugie zdanie: „Tytuły rozdziałów są widoczne tylko dla osób, które mogą obejrzeć film. Jeśli wpiszesz znaczniki czasu także w opisie, opis jest widoczny dla wszystkich.”
- Lista wierszy (`<ul>` z `<li>`): pole **czasu** (`inputMode="numeric"`, tekst „m:ss” albo „h:mm:ss”, parsowane `parseStartTime`; `aria-label="Czas rozdziału {n}"`), pole **tytułu PL**, pole **tytułu EN** (opcjonalne, węższe; na wąskim ekranie wiersz zawija się do dwóch linii, a EN jest pod PL), przyciski „Usuń” (ikona + `aria-label`) i „W górę/W dół”? **Nie**: kolejność wynika z czasu, wiersze sortują się po zatwierdzeniu pola czasu (`onBlur`/Enter), żeby nie przeskakiwały pod palcem w trakcie pisania. Fokus po dodaniu wiersza trafia w jego pole czasu; po usunięciu na przycisk „Dodaj rozdział”.
- Przyciski: „Dodaj rozdział” (nowy wiersz = poprzedni start + 60 s albo 0:00 przy pustej liście), „Importuj z opisu”, „Wyczyść wszystkie”. **Podgląd odtwarzacza w Studio nie istnieje** (`StudioVideoEditor` pokazuje tylko miniaturę i status), więc „dodaj w bieżącym czasie odtwarzacza” **nie wchodzi**; zamiast tego link „Otwórz film w nowej karcie” istnieje już w karcie podglądu dla opublikowanego filmu (twórca sprawdza czasy w widoku widza). Osadzony podgląd w Studio jest otwartym pomysłem na później (sekcja 16).
- **Importuj z opisu:** czyta opisy z formularza (PL → `chapters[].title`; jeśli w opisie EN są te same czasy, ich tytuły trafiają do `titleEn` po dopasowaniu czasu). Wynik **zastępuje listę** dopiero po potwierdzeniu własnym `ConfirmDialog` (`studio/ConfirmDialog.tsx`: `alertdialog`, fokus na „Anuluj”, Esc, Tab w pętli; **nie** `window.confirm`), jeśli lista nie jest pusta; komunikat „Wczytano N rozdziałów, pominięto M linii” z rozwijaną listą pominiętych (numer linii + powód). Nic nie jest zapisywane, dopóki twórca nie kliknie „Zapisz” całego formularza (jedno miejsce zapisu, jedno `PATCH`).
- **Walidacja na żywo** (`validateChapters` z `lib/video-chapters.ts`, czas trwania z `video.duration`/`durationSeconds` jeśli znany): komunikaty przy wierszu (`aria-invalid`, `aria-describedby` na element z tekstem; błąd ogłasza się przez `role="alert"` tylko dla zbiorczego `Notice` nad listą, nie dla każdego znaku) i zablokowany przycisk „Zapisz”, gdy lista niepusta jest niepoprawna. Puste = brak rozdziałów = poprawne. Serwer waliduje ponownie (źródło prawdy).
- Klawiatura: wszystko natywne `input`/`button` w kolejności DOM; Enter w polu tytułu dodaje nowy wiersz (tylko gdy bieżący jest poprawny), Backspace w pustym tytule nie usuwa wiersza (zbyt ryzykowne), usuwa tylko przycisk. Cele dotykowe ≥ 40 px wysokości (`min-h-10`), WCAG 2.5.8 **[niezweryfikowane: pamiętane z WCAG 2.2, minimum 24x24 CSS px, poziom AA; link w sekcji 15 zwrócił 404]**.
- Nowe komunikaty przez `tx()` (sekcja 11); żadnych `window.confirm`/`alert`.

**Kreator uploadu** (`StudioUploadWizard.tsx`, 489 linii) **nie dostaje** edytora rozdziałów: w momencie wgrywania nie ma jeszcze czasu trwania, a twórca i tak dopisze rozdziały po obejrzeniu filmu. `createVideoSchema` przyjmuje pole (spójność), ale nic go nie wysyła.

## 7. (d) Odtwarzacz: doświadczenie widza

Wszystkie nowe elementy są w **nowych plikach** w `app/components/player/chapters/` (katalog nowy, bo `player/` ma już 15 plików); w `PolutekControls.tsx` (175 linii) i `VideoPlayer.tsx` (627, limit 650) tylko wpięcia.

1. **Wpięcie w `VideoPlayer.tsx` (max ~8 linii; wolne 23):** `chapters = playerConfig?.chapters` → wewnątrz `<MediaPlayer>` obok `<PolutekControls />` render `<ChaptersTrackSync videoId={video.id} chapters={chapters} />` i `<ChaptersSeekListener videoId={video.id} />`; w `PLAYER_KEY_SHORTCUTS` (`VideoPlayer.tsx:88`) dopisać dwa wpisy klawiszy rozdziałów, tworzone przez `buildChapterKeyShortcuts(getChapters)` z nowego pliku (callbacki czytają rozdziały z magazynu, więc stała pozostaje stała). `ChaptersTrackSync` ma dodatkowo: filtr rozdziałów za końcem `player.duration` (za końcem = pominięty), wyczyszczenie magazynu przy odmontowaniu i przy zmianie filmu, `publishChapters`.
2. **Segmentowany pasek (`ScrubBar` w `PolutekControls.tsx`):** zamiast jednego `TimeSlider.Track` użyć `<TimeSlider.Chapters>{(cues, ref) => cues.map(cue => <div key={cue.startTime} ref={ref} className="mc-scrub-chapter"><TimeSlider.Track className="mc-scrub-track">…Progress/TrackFill…</TimeSlider.Track></div>)}</TimeSlider.Chapters>`. Szerokości liczy Vidstack, my dajemy w CSS tylko **przerwy 2 px** (`.mc-scrub-chapter { margin-right: 2px } :last-child { margin-right:0 }` oraz `display:flex` na kontenerze) i podpinamy `--chapter-fill`/`--chapter-progress` do `.mc-scrub-fill`/`.mc-scrub-buffer` (`width: var(--chapter-fill)` zamiast `var(--slider-fill)` wewnątrz odcinka). Bez rozdziałów komponent daje jeden odcinek i wygląd jest **dokładnie jak dziś** (test wizualny). Uwaga: `.mc-scrub-track` ma `overflow:hidden` i wysokość 2→4 px na hover; wysokość przejścia zostaje, przerwy są między odcinkami, nie wewnątrz toru.
   Ponieważ pole segmentowanego paska musi dalej przyjmować dotyk i przeciąganie na całej szerokości, **`.mc-scrub` zostaje korzeniem zdarzeń** (cały `TimeSlider.Root`), a odcinki są tylko wizualne (`pointer-events:none` na odcinkach nie jest potrzebne: Vidstack liczy pozycję z korzenia).
3. **Tytuł w podpowiedzi:** w `TimeSlider.Preview` obok `TimeSlider.Value` dodać `<TimeSlider.ChapterTitle className="mc-scrub-preview-chapter" />` (czas nad tytułem lub „0:42 · Tytuł”, dwie linie dozwolone, maks. 28 znaków z `text-overflow:ellipsis`). **Na telefonie podpowiedź jest ukryta** (`@media (hover:none)`, `globals.css` ok. linii 976), więc potrzebna jest etykieta niezależna od najechania.
4. **Etykieta bieżącego rozdziału obok czasu** (`ChapterLabel`, `useChapterTitle()`): w `.mc-time` jako trzeci element po czasie trwania („0:42 / 10:00 · Tytuł”) na szerokim ekranie; **na wąskim (≤ 640 px) czas trwania jest już ukryty**, więc etykieta zajmuje jego miejsce, jedna linia z wielokropkiem (`max-width`), klikalna jako skrót do panelu rozdziałów (to ten sam przycisk co w punkcie 5, `aria-haspopup`). Kiedy brak rozdziałów, elementu nie ma.
5. **Przycisk „Rozdziały” + panel** (`ChaptersMenu`, wzór `PlayerSettingsMenu.tsx`): przycisk w prawej grupie przed ustawieniami (ikona `ChaptersIcon` z `@vidstack/react/icons`, `aria-label={copy.chapters}`, `aria-haspopup="menu"`, `aria-expanded`), widoczny tylko gdy są rozdziały. Panel `role="menu"` w klasach `.mc-menu`/`.mc-menu-item` (rozszerzonych o kolumnę czasu `tabular-nums` i znacznik bieżącego rozdziału `aria-current="true"` + `.mc-menu-item--on`), elementy `menuitem`; strzałki ↑/↓, Home/End, Enter/Spacja skacze (`requestSeek` ze ścieżki z punktu 5 sekcji 5, panel zamyka się, fokus wraca na przycisk), Esc zamyka. Lista przewija się do bieżącego rozdziału przy otwarciu. Na telefonie panel to **arkusz przyklejony do dołu pola odtwarzacza** wewnątrz ramki odtwarzacza (nie portal poza nią): wysokość max 60 % pola, prostokątne wewnętrzne warstwy (zewnętrzne zaokrąglenie 22 px robi slot `data-player-slot` z `overflow-hidden`, `Hero.tsx:267`; wewnątrz nic nie wystaje i nie ma własnych zaokrągleń narożników poza slotem), jak istniejące `.mc-menu`.
6. **Skróty:** `Ctrl+ArrowLeft` / `Ctrl+ArrowRight` (Windows/Linux) i `Alt+ArrowLeft` / `Alt+ArrowRight` (Mac) to dokładnie skróty YouTube (źródło w sekcji 15), plus aliasy `[` i `]` (bez modyfikatorów; na macOS `Ctrl+strzałki` przechwytuje system, a `Alt+←/→` w przeglądarce bywa „wstecz/dalej” **[niezweryfikowane: sprawdzić w Safari/Chrome na macOS; Vidstack woła `preventDefault`, ale przeglądarka może przechwycić wcześniej]**). Poprzedni rozdział: jeśli bieżący trwa > 3 s, skok na jego początek, inaczej na poprzedni (jak odtwarzacze muzyki; `adjacentChapterStart`). Brak konfliktów z istniejącymi: `ArrowLeft/Right` ma inne modyfikatory (patrz sekcja 2 pkt 6), `[ ]` nie występują w domyślnych skrótach Vidstack ani w naszych (`speedUp/slowDown` puste), `c` to napisy. Skróty ignorują `input`/`textarea`/`[role^="menuitem"]` (Vidstack), więc nie psują wpisywania w komentarzach.
7. **Dostępność i ruch:** panel ma `prefers-reduced-motion` (brak animacji, `transition:none` dopisane do istniejącego bloku `@media (prefers-reduced-motion:reduce)`), kontrast jak reszta `.mc-*` (biały tekst na ciemnym tle). Pasek: rozdziały nie zmieniają semantyki `slider`; tytuł bieżącego rozdziału jest tekstem w DOM (etykieta), a lista rozdziałów dostępna z klawiatury w menu (sekcja 2 pkt 7). Odcinki są dekoracją (`aria-hidden` dziedziczy z Vidstack).
8. **Wydajność:** zero zapytań sieciowych (rozdziały jadą w planie), brak nowych bibliotek, `TimeSlider.Chapters` aktualizuje style bezpośrednio na elementach (bez renderów Reacta co klatkę, `setRefs`), magazyn rozdziałów zmienia się raz na film.

## 8. (e) Karta opisu: klikalne znaczniki i lista rozdziałów

- **Klikalne znaczniki czasu w opisie.** Nowy komponent `app/components/video/LinkedDescription.tsx` (render tekstu opisu, `whitespace-pre-wrap` jak dziś) dzieli tekst przez `scanTimestamps()`; znacznik dostaje `<button type="button" class="…">` z `aria-label="Przejdź do 12:30"`, **tylko jeśli** magazyn ma dla filmu rozdziały lub czas trwania (czyli odtwarzacz jest zamontowany) i `seconds ≤ duration` (nieznany czas trwania: link wolno, `clampStartTime` obetnie). Kliknięcie: `event.stopPropagation()` (karta opisu przełącza zwinięcie po kliknięciu, `Hero.tsx:426-427`) i `requestSeek(video.id, seconds)`. Bez odtwarzacza (gość i film `LOGGED_IN`, premiera) znaczniki są zwykłym tekstem. Nie zmieniamy `truncateAtWord(…, 160)`; skrócony tekst też przechodzi przez komponent (znacznik uciętego fragmentu zostaje tekstem, jeśli ucięcie przypadło w jego środku, bo `scanTimestamps` działa na tekście już skróconym).
- **Wpięcie w `Hero.tsx` (15 wolnych linii do limitu 500):** zastąpić dwa wyrażenia `displayDescription.trimEnd()` i `truncateAtWord(displayDescription, 160)` (linie 443 i 459) przez `<LinkedDescription text={…} videoId={video.id} />` i dodać `<DescriptionChapters videoId={video.id} />` pod blokiem tekstu w karcie (po linii 475): **max ~6 linii netto**.
- **Lista rozdziałów pod opisem** (`DescriptionChapters`, nowy plik): jeśli magazyn nie ma rozdziałów, nic nie renderuje. Nagłówek „Rozdziały” z licznikiem, **domyślnie zwinięta** do 5 pozycji, przycisk „Pokaż wszystkie (N)” / „Pokaż mniej” (`aria-expanded`) gdy więcej niż 5; każda pozycja to przycisk: czas (`tabular-nums`, kolor `--chan-blue`) + tytuł (`pickChapterTitle` w języku strony) + podświetlenie bieżącego (`aria-current`). Kliknięcie robi `requestSeek` i zatrzymuje propagację do karty. Stylizacja: tokeny `--chan-*`, miękkie `rounded-xl`, bez nowych literalnych kolorów akcentu (§ „Paleta” w `public-shell-and-player.md`).
- **CLS.** Magazyn napełnia się po zamontowaniu odtwarzacza, więc sekcja pojawia się po hydracji i przesuwa elementy poniżej. Dla pierwszego widoku plan jest w HTML (`initialPlayback`, `HomeExperience.tsx:130`), więc `DescriptionChapters` może być **zasiane z tego planu po stronie serwera** przez `ChannelHome` (jedna prop, `ChannelHome` ma tylko 1 wolną linię: **wymaga podniesienia limitu w `check-hotspots.ts` albo przeniesienia kodu**; dlatego traktujemy to jako opcję poprawy, nie wymóg pierwszej wersji). Akceptujemy pojawienie się po hydracji; blok jest w karcie opisu, poniżej treści, której nie obejmuje pierwsze malowanie.

## 9. (g) SEO: dane strukturalne

Źródło: Google Search Central, „Video structured data” (sekcja 15). `Clip` (zagnieżdżony w `VideoObject` przez `hasPart`): wymagane `name`, `startOffset` (sekundy od początku), `url` (**ta sama ścieżka co film z parametrem czasu, np. `?t=120`**); zalecane `endOffset`. Ograniczenia: film musi dawać się otworzyć od wskazanego miejsca, `VideoObject` na stronie, gdzie film można obejrzeć, **czas trwania ≥ 30 s**, dwa klipy tego samego filmu nie mogą mieć tego samego startu. Nasze `/?v=<slug>&t=<s>` spełnia warunek deep linku: `?t=` jest honorowane przy wejściu (`readPageStart`, potem usuwane z paska).

**Reguła:** `hasPart` dopisujemy w `page.tsx` do istniejącego obiektu `videoJsonLd` (linie 97-114) **wyłącznie gdy**: film nie jest `noindex` (to już warunek całego bloku), `selectedVideo.tier === "PUBLIC"` (efektywny poziom z DTO, `PAID`→`LOGGED_IN` więc bezpieczne), nie 18+ (też warunek bloku), czas trwania znany i ≥ 30 s oraz rozdziałów ≥ `CHAPTERS_MIN`. Dla `LOGGED_IN` i `UNLISTED` nie ma `hasPart` (dziś `VideoObject` dla `LOGGED_IN` istnieje i **nie zmieniamy tej decyzji**; to osobna sprawa dla właściciela, opisana w sekcji 16). Kształt:

```json
"hasPart": [ { "@type": "Clip", "name": "Wstęp", "startOffset": 0, "endOffset": 95,
               "url": "https://<host>/?v=<slug>&t=0" } , … ]
```
`name` w języku strony (`pickChapterTitle`), `url` zbudowany `withStartTime(canonical, s)` z `lib/video-start-time.ts` (dla `0` funkcja usuwa `t`, więc dla pierwszego klipu `startOffset: 0` i `url` bez `t`; Google wymaga parametru czasu dla klipu, więc **dla pierwszego klipu ustawiamy `t=0` ręcznie**: dodać do `video-start-time.ts` nic, zbudować URL w nowej funkcji `buildChapterClipUrl(base, slug, s)` w `lib/video-chapters-seo.ts`), `endOffset` = start następnego, ostatni = czas trwania. Treść `JSON.stringify(...).replace(/</g, "\\u003c")` jak dziś. Dane czyta jedna nowa funkcja serwerowa `getPublicVideoChapters(videoId)` w `lib/modules/video` (React `cache`, jedno `select: { chapters: true, durationSeconds: true }`), wołana **tylko** gdy powyższe warunki spełnione (bez dodatkowego zapytania dla pozostałych filmów).

`SeekToAction` **pomijamy**: Google opisuje go jako obsługiwany w ograniczonej liczbie języków i wymagający dostępu do plików wideo (nasz film jest za podpisanym tokenem HLS); `Clip` jest „supported in all languages”. Mapy strony, `robots`, RSS, oEmbed: bez zmian. Beta (`noindex`) sprawia, że efekt zobaczymy dopiero po wyłączeniu bety; JSON-LD można sprawdzić od razu w źródle strony (sekcja 14).

## 10. (h) Wyszukiwanie: tytuły rozdziałów w `searchText`

**Decyzja: tak, dla filmów `PUBLIC`, w osobnym zadaniu (3) i osobnej migracji, nie w migracji kolumny.** Dlaczego tak: wyszukiwarka zna dziś tytuł, tagi, kategorię i opis `PUBLIC`; tytuły rozdziałów to najlepsze „fragmenty” treści („znajdź, gdzie omawiam X”). Dlaczego osobno: trigger jest wspólny dla wszystkich ścieżek zapisu, jego przebudowa przepisuje funkcję i wymaga uzupełnienia całej tabeli; chcemy to wdrożyć po tym, jak sama funkcja rozdziałów jest sprawdzona na produkcji. Uwaga prywatność: tak samo jak opis, **tylko `tier = 'PUBLIC'`** (filmy nie-`PUBLIC` wracają z wyszukiwarki jako tytuł i miniatura, CLAUDE.md §4.30).

Migracja `prisma/migrations/20261020130000_video_chapters_search/migration.sql` (zaplanowana, nie dla zadania 1):

```sql
CREATE OR REPLACE FUNCTION video_search_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parts text[]; chapter_text text;
BEGIN
  chapter_text := NULL;
  IF NEW."tier" = 'PUBLIC' AND NEW."chapters" IS NOT NULL AND jsonb_typeof(NEW."chapters") = 'array' THEN
    SELECT string_agg(coalesce(c->>'title','') || ' ' || coalesce(c->>'titleEn',''), ' ')
      INTO chapter_text FROM jsonb_array_elements(NEW."chapters") AS c;   -- tylko dla tablicy: jsonb_array_elements na nie-tablicy rzuca wyjątek
  END IF;
  NEW."searchText" := video_search_normalize(concat_ws(' ', NEW."title", NEW."titleEn", array_to_string(NEW."tags",' '),
    NEW."category",
    CASE WHEN NEW."tier" = 'PUBLIC' THEN left(concat_ws(' ', NEW."description", NEW."descriptionEn"), 3000) END,
    left(chapter_text, 2000)));
  /* ... reszta (durationSeconds) bez zmian, skopiowana z 20261019170000 ... */
  RETURN NEW;
END $$;
DROP TRIGGER "Video_search_refresh" ON "Video";
CREATE TRIGGER "Video_search_refresh" BEFORE INSERT OR UPDATE OF "title","titleEn","description","descriptionEn","tags","category","tier","duration","chapters"
  ON "Video" FOR EACH ROW EXECUTE FUNCTION video_search_refresh();
UPDATE "Video" SET "title" = "title";   -- przeliczenie wszystkich wierszy, jak w poprzedniej migracji
```
Nie zmienia się `video_search_normalize()` ani `normalizeSearchText()`, więc test porównujący tablice znaków zostaje bez zmian (CLAUDE.md §4.30). Test integracyjny (konfiguracja Postgres `vitest.postgres.config.ts`): wiersz `PUBLIC` z rozdziałami → `searchText` zawiera tytuł rozdziału, ten sam wiersz `LOGGED_IN` → nie zawiera; `chapters` o złym kształcie (np. obiekt) nie wywala `UPDATE`. **Aplikacja nigdy nie zapisuje `searchText`** (bez zmian). Ryzyko: `UPDATE "Video" SET "title" = "title"` blokuje wiersze przez czas przeliczenia; przy obecnej liczbie filmów pomijalne, ale migracja wymaga `pre-deploy` zrzutu jak każda (CLAUDE.md §9, SERWEREK.md).

## 11. (i) Teksty interfejsu (`tx("pl", "en")`, katalogi `lib/i18n/catalog/{de,es,fr,it,pt,zh}.json`, klucz = tekst angielski, test parytetu)

Wszystkie literalne (test wyciąga tylko stałe łańcuchy), z zachowaniem `{0}`/`{1}` w obu językach. Gracz używa `polutek-controls-copy.ts` (nowe klucze w `buildPlayerCopy`, który ma 35 linii).

| PL | EN | Gdzie |
|---|---|---|
| Rozdziały | Chapters | przycisk, nagłówek panelu, lista pod opisem |
| Rozdział {0} z {1} | Chapter {0} of {1} | etykieta panelu (`aria-label` przycisku) |
| Poprzedni rozdział | Previous chapter | skrót/pomoc (tooltip przycisków, jeśli dodane) |
| Następny rozdział | Next chapter | j.w. |
| Pokaż wszystkie ({0}) | Show all ({0}) | lista pod opisem |
| Pokaż mniej | Show less | **już istnieje** (`t.showLess`, krótka fraza), użyć słownika `t.*`, nie nowego `tx` |
| Przejdź do {0} | Go to {0} | `aria-label` znacznika w opisie |
| Rozdziały (opcjonalnie) | Chapters (optional) | nagłówek edytora |
| Pierwszy rozdział zaczyna się w 0:00, co najmniej {0} rozdziały, każdy minimum {1} s. | The first chapter starts at 0:00, at least {0} chapters, each at least {1} s. | podpowiedź edytora |
| Dodaj rozdział | Add chapter | |
| Importuj z opisu | Import from description | |
| Wyczyść wszystkie | Clear all | |
| Czas rozdziału {0} | Chapter {0} time | `aria-label` |
| Tytuł rozdziału {0} (PL) | Chapter {0} title (PL) | |
| Tytuł rozdziału {0} (EN, opcjonalnie) | Chapter {0} title (EN, optional) | |
| Usuń rozdział {0} | Remove chapter {0} | |
| Zastąpić listę rozdziałów? | Replace the chapter list? | tytuł `ConfirmDialog` |
| Obecna lista ({0}) zostanie zastąpiona rozdziałami z opisu ({1}). Nic nie jest zapisane, dopóki nie klikniesz „Zapisz”. | The current list ({0}) will be replaced by the chapters from the description ({1}). Nothing is saved until you click “Save”. | treść dialogu |
| Zastąp | Replace | przycisk dialogu |
| Wczytano {0} rozdziałów, pominięto {1} linii. | Imported {0} chapters, skipped {1} lines. | po imporcie |
| W opisie nie znaleziono znaczników czasu na początku linii. | No timestamps found at the start of a line in the description. | |
| Tytuły rozdziałów widzą tylko osoby, które mogą obejrzeć film; opis jest widoczny dla wszystkich. | Chapter titles are visible only to people who can watch the video; the description is visible to everyone. | podpowiedź przy `LOGGED_IN` |
| Komunikaty walidacji: „Pierwszy rozdział musi zaczynać się w 0:00.”, „Dodaj co najmniej {0} rozdziały.”, „Najwyżej {0} rozdziałów.”, „Rozdziały muszą być w kolejności i co najmniej {0} s od siebie.”, „Czas poza długością filmu.”, „Tytuł nie może być pusty.”, „Tytuł może mieć najwyżej {0} znaków.”, „Nieprawidłowy czas (np. 12:30).” | EN odpowiednio | `chapters-form.ts` |

Komunikaty błędów API (`AppError`) są po polsku jak reszta (`VIDEO_TAGS_TOO_MANY`), a Studio pokazuje własny, przetłumaczony tekst na podstawie kodu problemu. Nowe teksty trzeba dopisać do **wszystkich sześciu** katalogów w tym samym PR (inaczej pada test parytetu); tłumaczenia robione zwykłym skryptem scalającym jak wcześniejsze (`scripts` nie są tu potrzebne).

## 12. (k) Podział na zadania

Zasada: każde zadanie jedna gałąź i jeden PR, małe, niezależnie testowalne, kolejność **1 → 2 → 3** (2 wymaga kontraktu `Chapter` i planu z zadania 1; 3 jest niezależne od 2, ale po 1). Wszystkie: nowe pliki jak sąsiednie pod względem końców linii, `git diff --stat` bez przepisywania całych plików, `npm run quality` i `quality:hotspots`, merge i wdrożenie według memory (bez pytania: merge + backup + deploy).

### Zadanie 1: dane, domena, Studio, plan (backend + Studio), ZBUDOWANE
Odstępstwa od planu: `AdminVideoDto`/`StudioVideo` niosą też `durationSeconds` (edytor waliduje wobec długości filmu); `PATCH` z Studia wysyła `chapters` tylko, gdy lista się zmieniła (zwykły zapis nie przepisuje ani nie audytuje rozdziałów); `toForm` z edytora przeniesiono do `videoToForm` w `studio/video-form.ts` (plik edytora ma teraz 518 linii zamiast 527; `StudioVideoEditor.tsx` i `StudioUploadWizard.tsx` nadal przekraczają budżet 450 jak przed zadaniem). Zod-owy `studioChaptersSchema` jest eksportowany ze `studio-schemas.ts`.
Pliki:
- NOWE `lib/video-chapters.ts` (moduł z sekcji 4.2) i `scanTimestamps` w nim; testy `tests/unit/video-chapters.test.ts`.
- NOWE `prisma/migrations/20261020120000_video_chapters/migration.sql`; EDYCJA `prisma/schema.prisma` (jedna linia w `Video`).
- EDYCJA `lib/api/studio-schemas.ts` (CRLF), `lib/modules/video/domain/video-metadata.ts` (`resolveVideoMetadata` + czas trwania), `lib/modules/video/application/update-admin-video.use-case.ts` (przekazanie `durationSeconds`, `chaptersCount` w audycie), `lib/modules/video/infrastructure/video.repository.ts` (`updateForMainChannel`, typy), `lib/modules/video/domain/video.dto.ts` (`toAdminVideoDto`, `AdminVideoDto`).
- EDYCJA `lib/modules/playback/domain/playback.dto.ts` (`player.chapters`), `lib/modules/playback/application/playback.service.ts` (`playerFor` + linia 309; tylko plan gotowy).
- NOWE `app/components/studio/VideoChaptersEditor.tsx`, `app/components/studio/chapters-form.ts`; EDYCJA `studio/video-form.ts` (`EditorForm.chapters`, `isFormDirty`), `studio/studio-client.ts` (CRLF; `StudioVideo.chapters`), `studio/StudioVideoEditor.tsx` (netto ~0 linii).
- EDYCJA katalogi `lib/i18n/catalog/*.json` (teksty Studia z sekcji 11).
- Dokumentacja: ten plik (zmienić status na „zbudowane”), CLAUDE.md nowy podpunkt, `docs/README.md` indeks.
Sam efekt dla widza: brak (plan niesie rozdziały, ale odtwarzacz ich jeszcze nie używa). Wdrożenie bezpieczne i niewidoczne.

### Zadanie 2: odtwarzacz i karta opisu (UI widza), ZBUDOWANE
Odstępstwa od planu (sprawdzone w przeglądarce na atrapie odtwarzacza z prawdziwymi komponentami): (1) skróty `Ctrl/Alt+←/→` i `[` `]` czytają rozdziały ze ścieżki rozdziałów odtwarzacza (`chapter-keys.ts`, bez `videoId` i magazynu); Vidstack **nie** woła `preventDefault` dla własnego skrótu, więc robi to nasz callback. (2) Panel i skok z panelu idą przez `useChapterOptions()` i wspólny `seek-player.ts` (ten sam `clampStartTime` co `?t=`); `requestSeek` obsługuje tylko skok spoza odtwarzacza (opis, lista pod nim). (3) Wspólny stan otwarcia panelu (etykieta obok czasu i przycisk) to `chapters/chapters-menu-context.tsx`; `ChaptersParts` składa `ChaptersTrackSync` i `ChaptersSeekListener` w jedno wpięcie. (4) Ścieżka rozdziałów i cały interfejs rozdziałów powstają dopiero, gdy znany jest czas trwania filmu (bez metadanych pasek zostaje jednym odcinkiem; na telefonie bez `preload` dzieje się to po pierwszym dotknięciu). (5) Rozdziały za końcem filmu są pomijane, a gdy zostaje mniej niż `CHAPTERS_MIN`, nie ma rozdziałów wcale. (6) `.mc-group--right` i przyciski w lewej grupie nie kurczą się (kurczy się tylko pigułka z czasem i etykietą), inaczej etykieta nachodziła na przyciski na 375 px. (7) **Znalezisko poza zakresem:** `keyShortcuts` przekazane do `MediaPlayer` **zastępuje** domyślne skróty Vidstack (sprawdzone: z samym `{ speedUp: '', slowDown: '' }` nie działają `k`, `m`, `f`, `c`, strzałki ani cyfry; bez propa działają). Obecny `VideoPlayer` ma więc wyłączone wszystkie domyślne skróty, nie tylko prędkość; naprawa to `{ ...MEDIA_KEY_SHORTCUTS, speedUp: '', slowDown: '', ...CHAPTER_KEY_SHORTCUTS }` (`MEDIA_KEY_SHORTCUTS` z `@vidstack/react`). **Naprawione** w osobnym PR (`fix/player-keyboard-shortcuts`): domyślne skróty wracają dla wszystkich widzów (Spacja/`k`, `m`, `f`, `c`, strzałki, cyfry), prędkość nadal tylko z menu, skróty rozdziałów nie kolidują (modyfikatory muszą pasować dokładnie).
Pliki: NOWE `app/components/player/chapters/{ChaptersTrackSync,ChaptersSeekListener,ChapterLabel,ChaptersMenu,chapter-keys}.tsx|ts`, `app/components/player/chapters-store.ts`, `app/components/player/seek-request.ts`, `app/components/video/{LinkedDescription,DescriptionChapters}.tsx`; EDYCJA `app/components/player/PolutekControls.tsx` (`ScrubBar` z `TimeSlider.Chapters`, `ChapterTitle` w podglądzie, `ChapterLabel`, `ChaptersMenu`), `app/components/player/polutek-controls-copy.ts` (teksty), `app/components/VideoPlayer.tsx` (≤ ~10 linii, wolne 23), `app/components/Hero.tsx` (≤ ~6 linii, wolne 15), `app/globals.css` (klasy `.mc-scrub-chapter`, `.mc-chapters-*`, wąski ekran, `prefers-reduced-motion`), katalogi `lib/i18n/catalog/*.json`.
Zależy od: zadanie 1 (kontrakt planu). Test ręczny w przeglądarce obowiązkowy (zob. 14): paski, dotyk, panel na telefonie, napisy + rozdziały naraz.

### Zadanie 3: SEO i wyszukiwarka (mały, niezależny), ZBUDOWANE
Odstępstwa od planu: (1) strona nie woła osobno `getPublicVideoChapters`, tylko `getPublicChapterClips` (ten sam plik use case'a): sprawdza `canExposeChapterClips` (`PUBLIC` + `PUBLISHED` + nie 18+, **efektywny poziom z DTO**), dopiero wtedy czyta bazę (jedno zapytanie, `cache`), a samo zapytanie ma dodatkowo `where: { tier: "PUBLIC", status: "PUBLISHED" }` na surowych kolumnach (dwa niezależne zamki; `PAID` i `LOGGED_IN` nie przechodzą żadnego). (2) `buildChapterClips` zwraca `null` także gdy po odrzuceniu rozdziałów za końcem zostaje mniej niż `CHAPTERS_MIN` (spójnie z odtwarzaczem). (3) Adres klipu bazuje na tym samym adresie strony co `embedUrl` (`getExplicitLocaleHref(locale, "home")`), czyli na stronie w języku widza. (4) Migracja jest dokładnie z sekcji 10 (kopia funkcji z `20261019170000`, dodany fragment rozdziałów i `"chapters"` na liście kolumn triggera, uzupełnienie wierszy); sprawdzona w PGlite na trzech migracjach po kolei (patrz PR), **testu `*.pg.test.ts` na prawdziwym Postgresie nie dopisano** (brak bazy lokalnie), zamiast tego test tekstowy kontraktu migracji i test strony.
Pliki: NOWE `lib/video-chapters-seo.ts`, `lib/modules/video/application/get-public-video-chapters.ts` (eksport w `lib/modules/video/index.ts`), migracja `20261020130000_video_chapters_search`, testy `tests/unit/video-chapters-seo.test.ts`, `tests/unit/modules/video/{get-public-video-chapters,video-chapters-search-migration}.test.ts`; EDYCJA `app/[locale]/(home)/page.tsx` (+8 linii), `docs/architecture/search.md`, CLAUDE.md §4.30.
Plan pierwotny:
Pliki: NOWE `lib/video-chapters-seo.ts` (`buildChapterClipUrl`, `buildChapterClips`), `lib/modules/video/application/get-public-video-chapters.ts` (+ eksport w `lib/modules/video/index.ts`); EDYCJA `app/[locale]/(home)/page.tsx` (`hasPart`); testy; NOWA migracja `20261020130000_video_chapters_search` (sekcja 10) + test Postgres; dokumentacja `docs/architecture/search.md` (jedno zdanie) i CLAUDE.md §4.30.
Zależy od: zadanie 1. Można zrobić przed zadaniem 2, bo nic nie dotyka UI.

## 13. (j) Testy

Jednostkowe (`tests/unit/`, Vitest, bez przeglądarki; opis zachowań, nie implementacji):
- `video-chapters.test.ts`: `normalizeChapters` (spacje, sterujące, sort, odrzut śmieci, `NaN`), każda reguła `validateChapters` osobno plus granice (dokładnie 10 s, dokładnie 3, dokładnie 50, czas trwania `null` i znany, ostatni rozdział < 10 s od końca), `parseStoredChapters` (zły JSON/obiekt/`null` → `[]`), `pickChapterTitle` (pl/en/de, brak `titleEn`), `activeChapterIndex`, `adjacentChapterStart` (> 3 s w rozdziale, pierwszy/ostatni), `buildChapterSegments`.
- `parseChaptersFromDescription`: `0:00 Wstęp`, `00:00 - Wstęp`, `- 1:02 – Temat`, `1:02:03 Koniec`, `[2:10] Tytuł`, `3:05)Tytuł`, czasy w środku zdania ignorowane, wiersz bez tytułu → `skipped`, duplikat czasu, wersja EN, CRLF, bardzo długi opis (5000 znaków, wydajność), brak znaczników.
- `scanTimestamps` / `LinkedDescription` (test komponentu): znacznik w tekście → przycisk, `stopPropagation`, brak odtwarzacza → tekst, godziny „20:00” w prozie.
- Schemat zod i use case: PATCH z poprawną listą zapisuje i audytuje `chaptersCount` (bez tytułów w metadanych), zła lista → 400 z kodem, `null` czyści (`DbNull`), pominięte pole nie rusza istniejących, rola `EDITOR` może, `MODERATOR`/`TRANSLATOR` nie (macierz bez zmian; test kontraktowy authz zielony), film z innego kanału 404, kanał zamrożony odmowa, film `PAID` zachowuje poziom (istniejący test nie pęka).
- Plan odtwarzania: `playerFor` z rozdziałami tylko w planie gotowym; **plany odmowy (`LOGIN_REQUIRED`, `COMING_SOON`, `NO_PRIMARY_ASSET`, `ERROR`) nie mają `player.chapters`** (test dla każdego statusu), gość + film `LOGGED_IN` → brak.
- `toAdminVideoDto` zwraca `chapters`; **`mapToPublicVideoDTO` NIE zwraca** (test strażnik, żeby nikt nie dopisał do DTO).
- SEO: `buildChapterClips` (adresy z `?v=` i `&t=`, `endOffset`, `t=0` dla pierwszego), reguły „tylko `PUBLIC`”, `noindex`, 18+, czas trwania < 30 s, mniej niż 3 rozdziały → brak `hasPart`; JSON poprawny po `replace(/</g, …)`.
- Katalogi i18n: istniejący test parytetu (nowe teksty we wszystkich 6 plikach).
- Postgres (zadanie 3): trigger z sekcji 10.
- Testy czytające źródła jako tekst (konwencje, np. brak stylów inline, nowe pliki w dozwolonych katalogach): uruchomić, aktualizować świadomie.
- Hotspoty: `npm run quality:hotspots` zielony (bez podnoszenia limitów).
Ręcznie w przeglądarce (lokalnie, `npm run dev`, atrapa planu z rozdziałami): segmenty paska, tytuł w podpowiedzi, etykieta na 375 px, panel jako arkusz w ramce 22 px, skrót klawiszy, dotyk (przeciąganie przez przerwy), napisy + rozdziały razem, odtwarzacz osadzony, `prefers-reduced-motion`.

## 14. Weryfikacja na produkcji bez logowania i wycofanie

**Stan wyjściowy.** Do sprawdzenia potrzebny jest film z rozdziałami. Twórca ustawia je w Studio (wymaga logowania właściciela), albo operator na serwerku robi jednorazowo `UPDATE "Video" SET "chapters" = '[…]'::jsonb WHERE "slug" = '<film testowy>'` na **filmie `UNLISTED` utworzonym w tym celu** (po `backup.sh`, wpis `ai-log`; zasady SERWEREK.md rozdz. 12).

Sprawdzenia bez logowania:
1. `curl -s https://pawelperfect.com/api/media-source/<id-filmu-PUBLIC>` (plan nie jest cache'owany, tworzy sesję odtwarzania) → w `player` jest `chapters` z poprawnymi czasami; dla filmu `LOGGED_IN` jako gość → status `LOGIN_REQUIRED` i **brak** `chapters` (kluczowa kontrola prywatności); dla filmu bez rozdziałów brak pola.
2. `curl -s 'https://pawelperfect.com/?v=<slug>' | grep -o 'hasPart.\{0,300\}'` dla filmu `PUBLIC` z rozdziałami → `Clip` z `/?v=…&t=…`; dla `LOGGED_IN` i `UNLISTED` → brak `hasPart`. Walidacja kształtu w Rich Results Test (Google; wymaga publicznej strony, a przy becie `noindex` test informacyjny).
3. Przeglądarka (wbudowana, bez konta): otwórz `/?v=<slug>` (po bramie wejściowej), sprawdź: pasek podzielony na odcinki, podpowiedź z tytułem (desktop), etykieta rozdziału i przycisk „Rozdziały” (telefon 375 px: `resize_window`), skok z panelu i z listy pod opisem (czas w `video.currentTime` przez `javascript_tool`), skróty `]`/`[`, klikalny znacznik w opisie, zachowanie przy `?t=` z linku, konsola bez błędów (`read_console_messages`), brak nowych żądań sieciowych (`read_network_requests`: tylko plan).
4. Regresje: film bez rozdziałów wygląda jak przed zmianą (jeden odcinek), napisy działają, wznawianie oglądania działa, strona kanału i wyszukiwarka bez zmian.
5. Studio (po zalogowaniu właściciela): zapis, import, walidacja, wpis audytu `VIDEO_UPDATED` z `chaptersCount`.

**Wycofanie.** Kolumna jest addytywna i nullable: stary obraz ją ignoruje, więc **`deploy.sh --rollback` (kod) wystarcza** (CLAUDE.md §4.0), bez zrzutu. Jeśli rozdziały zawiodą tylko wizualnie, szybkie wyłączenie bez wdrożenia: `UPDATE "Video" SET "chapters" = NULL` (po zrzucie) usuwa je ze wszystkich planów. Migracja z zadania 3 (trigger) wycofuje się nową migracją przywracającą funkcję z `20261019170000_video_search` (istniejącej nigdy nie edytujemy) albo zrzutem `pre-deploy-*`; dlatego zadanie 3 wdrażamy osobno i po zadaniach 1-2.

## 15. Źródła i badania (stan: pobrane 2026-10-20)

- YouTube Help, „Add chapters to your videos”: https://support.google.com/youtube/answer/9884579 . Zweryfikowane: pierwszy znacznik 00:00, co najmniej trzy znaczniki w kolejności rosnącej, rozdział min. 10 s; zapis znaczników zastępuje rozdziały automatyczne.
- YouTube Help, skróty klawiszowe: https://support.google.com/youtube/answer/7631406 . Zweryfikowane: następny rozdział `Ctrl+→` (Windows) / `⌥+→` (Mac), poprzedni `Ctrl+←` / `⌥+←`.
- Google Search Central, „Video structured data” (klucz: sekcja Key moments, `Clip`, `SeekToAction`): https://developers.google.com/search/docs/appearance/structured-data/video . Zweryfikowane: wymagane `name`, `startOffset`, `url` (ta sama ścieżka z parametrem czasu), zalecane `endOffset`, film ≥ 30 s, brak powtórzonych startów; `SeekToAction` wymaga dostępu do plików wideo i ma ograniczoną obsługę językową. Uwaga: przykład mikrodanych w dokumentacji ma błąd formatu czasu (`P10M` zamiast `PT10M`); my używamy JSON-LD.
- Vidstack, dokumentacja `TimeSlider` / `SliderChapters`: https://www.vidstack.io/docs/player/components/sliders/time-slider . Zweryfikowane: komponent działa na „aktywnej ścieżce rozdziałów”, API `(cues, forwardRef)`, `onChapterFill`, `onChapterProgress`; **szczegóły kodu zweryfikowane w zainstalowanym `node_modules` 1.15.6** (sekcja 2), strona dokumentacji nie opisuje formatu ścieżki ani zmiennych CSS.
- **[niezweryfikowane]** sposób prezentacji rozdziałów w Vimeo i Mux (nie pobierano ich dokumentacji; decyzje UX opierają się na YouTube i API Vidstack). **[niezweryfikowane]** WCAG 2.2 SC 2.5.8 Target Size (Minimum): z pamięci 24x24 px, poziom AA; próba pobrania strony „Understanding” zwróciła 404. Przed użyciem tej wartości w uzasadnieniach sprawdzić https://www.w3.org/TR/WCAG22/#target-size-minimum . **[niezweryfikowane]** zachowanie `Alt+←/→` w przeglądarkach na macOS (może być skrótem „wstecz/dalej”).
- Wewnętrznie: `CLAUDE.md` §4.0, 4.3, 4.4, 4.11, 4.13, 4.20, 4.23, 4.26, 4.30; `docs/architecture/public-shell-and-player.md`, `playlists.md`, `search.md`, `database-and-migrations.md`.

## 16. Ryzyka i pytania do właściciela

Ryzyka (techniczne):
1. **Ścieżka `chapters` w trybie `showing` a stan `textTrack` Vidstack** (może wpłynąć na przycisk CC lub na wybór napisów). Odporne z założenia (`isTrackCaptionKind`), ale to jedyne miejsce, gdzie biblioteka może zaskoczyć: test ręczny z napisami i rozdziałami naraz jest w zadaniu 2; plan awaryjny: własne znaczniki z `buildChapterSegments` (sekcja 2).
2. **Zmiana szerokości odcinków przy zmianie `duration`** (np. HLS dopiero podaje długość): `SliderChapters` przelicza po `duration` (debounce 150 ms), chwilowo możliwy skok układu paska przy starcie; akceptowalne, bo pasek jest wtedy ukryty pod bramą wejściową lub przed pierwszą klatką.
3. **Pojawienie się listy pod opisem po hydracji** (CLS), opcja SSR w sekcji 8.
4. **Pasek z przerwami w rozmiarze dotykowym:** 2 px przerwy nie mogą utrudniać trafienia; dlatego zdarzenia zostają na korzeniu suwaka.
5. **Budżety plików:** `Hero` i `VideoPlayer` mają odpowiednio 15 i 23 wolne linie; jeśli w praktyce zabraknie, **podnieść limit w `check-hotspots.ts` z uzasadnieniem jest gorsze niż wyciągnąć więcej do nowych plików**.
6. **Cała treść w jednej kolumnie `Json`:** brak integralności bazy; łagodzone `parseStoredChapters`, `CHECK` i jedynym miejscem zapisu.
7. **Zmiana czasu trwania filmu po ponownym wgraniu** może unieważnić rozdziały (poza końcem); odtwarzacz je pomija, Studio podświetla błąd przy następnym zapisie. Nie kasujemy ich automatycznie.

Pytania do właściciela (z domyślną odpowiedzią do przyjęcia, jeśli nie powie inaczej):
1. Minimum rozdziałów: **3** (jak YouTube) czy 2? *Domyślnie 3.*
2. Czy tytuły rozdziałów filmu `LOGGED_IN` mogą być widoczne dla gości? *Domyślnie nie (tylko z planem odtwarzania); opis zostaje, jaki jest.*
3. Czy `VideoObject` w JSON-LD ma nadal być wypisywany dla filmów `LOGGED_IN` (dziś jest, z opisem)? *Poza zakresem; nie zmieniamy bez decyzji, ale rozdziałów tam nie dodajemy.*
4. Znaczniki czasu w **komentarzach**: *poza zakresem pierwszej wersji.* Powód: renderer komentarzy jest białą listą (§4.9), a linkowanie czasów w treści użytkowników to nowa powierzchnia (`mapCommentToDto`, moderacja, XSS, język); kosztowałoby osobne zadanie (`scanTimestamps` już jest, więc dodanie później jest tanie).
5. Skróty: `Ctrl/Alt+←/→` jak YouTube plus `[` `]`. *Domyślnie tak.*
6. Podgląd odtwarzacza w edytorze Studio z przyciskiem „użyj bieżącego czasu”: *odłożone* (Studio nie ma dziś odtwarzacza); w pierwszej wersji twórca wpisuje czasy ręcznie lub importuje z opisu.
7. Wyszukiwanie po tytułach rozdziałów (zadanie 3, migracja z triggerem): *tak, po zadaniach 1-2.*
8. Czy rozdziały mają być dostępne także w panelu `apps/admin` (edycja przez personel)? *Nie w tej pracy; use case jest wspólny, więc dodanie pola w panelu to osobna, mała zmiana.*
