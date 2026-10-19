# Playlisty twórcy

Stan na 2026-10-19. Playlista to **uporządkowana lista filmów jednego kanału, ułożona przez twórcę** (np. „Wszystkie odcinki serii”, „Na start”). Widz odtwarza ją po kolei: strona playlisty, przycisk „Odtwórz wszystko”, kolejka na stronie filmu i autoodtwarzanie następnego.
Kod: moduł `lib/modules/playlists`, trasy Studia `app/api/studio/playlists*`, strona publiczna `app/[locale]/playlista|playlist/[channel]/[slug]`, ekran Studia `app/components/studio/StudioPlaylists.tsx`.

## 1. Playlista to nie „układ paska bocznego”

W kodzie są dwa różne pojęcia, które łatwo pomylić:

| | Pasek boczny strony głównej (`layout/sidebar`) | Playlista twórcy (`lib/modules/playlists`) |
|---|---|---|
| Czym jest | jedna lista „co oglądać dalej” kanału, sortowana wg `Video.sidebarOrder` / `showInSidebar` (`ChannelLayoutService`, komponent `SidebarPlaylist`, `lib/modules/video/domain/sidebar-order.ts`) | wiele nazwanych list kanału, każda z tytułem, opisem, widocznością i własną kolejnością |
| Kto ustawia | panel / Studio (kolejność filmów w pasku) | twórca w Studiu → Playlisty |
| Gdzie żyje | kolumny `Video` | tabele `Playlist` i `PlaylistItem` |
| Gdzie widać | prawy pasek strony głównej | strona playlisty, kolejka na stronie filmu, półka na stronie kanału |

Playlista **nie zmienia** `sidebarOrder` ani niczego w pasku bocznym i odwrotnie. Nazwa `SidebarPlaylist` w komponencie jest historyczna (to „lista w pasku”, nie playlista twórcy).

## 2. Dane (migracja addytywna `20261019180000_playlists`)

- `Playlist(id, channelId, title, description, visibility PUBLIC|UNLISTED|PRIVATE, slug, createdAt, updatedAt, deletedAt)`; **slug unikalny w obrębie kanału** (`@@unique([channelId, slug])`), liczony z tytułu (`slugifyPlaylistTitle`, `pickUniqueSlug`: `-2`, `-3`…), niezmienny po utworzeniu (linki są stabilne). Usunięcie to **soft delete** (`deletedAt`), slug zostaje zajęty.
- `PlaylistItem(id, playlistId, videoId, position, addedAt)`; `@@unique([playlistId, videoId])` (film raz na liście), indeks `(playlistId, position)`. `position` tylko porządkuje (po usunięciu mogą zostać luki).
- Limity: 100 playlist na kanał, 200 filmów na playlistę, tytuł 100 znaków, opis 1000 (`domain/playlist-rules.ts`).
- Playlista zawiera **wyłącznie filmy własnego kanału**: `addPlaylistVideo` szuka filmu z `creatorId = kanał playlisty`, obcy id wygląda jak brak filmu (404).

## 3. Uprawnienia i audyt

- Akcje authz (lista zamknięta, `lib/modules/authz`): `playlist.create`, `playlist.update`, `playlist.delete`, `playlist.manage_items`. Macierz: **OWNER, MANAGER i EDITOR** mogą wszystkie cztery; MODERATOR i TRANSLATOR żadnej. Kanał `LIMITED` zachowuje playlisty (platforma ogranicza tylko upload i sprzedaż); kanał zamrożony (`SUSPENDED`/`BANNED`/`DELETED`) jest tylko do odczytu. Personel platformy działa jak przy każdej treści kanału. Studio zawsze działa jako zwykły `user` (§4.23 w `CLAUDE.md`).
- Każdy use case zapisu woła `authorize()` jako pierwszy krok i **zawęża każde zapytanie do kanału** (id playlisty z innego kanału = 404, ochrona przed BOLA). Bramka `check-architecture` ma moduł `playlists` na liście `AUTHZ_MODULES`; wyjątek ma tylko odczyt publiczny.
- Audyt (`recordAuditEvent` w tej samej transakcji, z `channelId`): `PLAYLIST_CREATED`, `PLAYLIST_UPDATED`, `PLAYLIST_DELETED`, `PLAYLIST_VIDEO_ADDED`, `PLAYLIST_VIDEO_REMOVED`, `PLAYLIST_REORDERED` (metadane: id, liczniki, pola; nigdy treści).
- **Zmiana kolejności jest jedną atomową operacją:** `PUT /api/studio/playlists/<id>/order` z **pełną nową kolejnością** (`validateReorder`: dokładnie te same filmy co teraz, każdy raz). Zła lista (brak, nadmiar, powtórka, nieaktualny stan) → 400/409 i **nic nie jest zapisane**. Zapis to jedna transakcja z blokadą wiersza playlisty (`SELECT … FOR UPDATE`, ta sama blokada przy dodawaniu i usuwaniu), błąd w połowie cofa wszystkie pozycje.

## 4. Widoczność dla widza

- **PUBLIC:** na półce kanału i dostępna z linku. **UNLISTED:** tylko z linku, nigdy na liście, strona ma `noindex`. **PRIVATE:** publicznie nigdy (404 dla wszystkich; twórca pracuje na niej w Studiu). Playlista usunięta albo z kanału ukrytego (`publiclyVisibleChannelWhere`) jest „nie znaleziona”.
- Elementy filtruje jedna czysta reguła `isPlaylistItemVisible()`: film `PUBLISHED` (nie `UNLISTED`/`DRAFT`/`ARCHIVED`), już wymagalny, nie `REMOVED`, nie nadchodząca premiera, z kanału playlisty, a 18+ tylko dla zalogowanych. Pominięty element znika **bez śladu** (żadnego placeholdera ani licznika); licznik i okładka półki liczą wyłącznie widoczne filmy, pusta playlista nie trafia na półkę kanału.
- Poziom dostępu (`PUBLIC`/`LOGGED_IN`) nie ukrywa filmu na liście: karta dla gościa ma znaczek „Logowanie”, a bramkę nadal robi `checkVideoAccess()` przy odtwarzaniu (§4.4). Playlista niczego nie odblokowuje.

## 5. Strona publiczna

- Trasy (`lib/i18n/routing.ts`, klucz `playlist`): `/playlista/<kanał>/<slug>` (pl), `/en/playlist/<kanał>/<slug>` (en), `/de|es|fr|it|pt|zh/playlist/…` (jak pozostałe trasy języków interfejsu). `<kanał>` to slug albo `@handle` kanału. Dwie fizyczne ścieżki `app/[locale]/playlista` i `app/[locale]/playlist` używają tego samego `playlist-route.tsx` (jak `regulamin`/`terms`). Wpisy w `middleware.ts` (`isPublicRoute`) są dla wszystkich języków.
- Strona (`PlaylistPage`): tytuł, opis, link do kanału, liczba filmów, „Odtwórz wszystko” (pierwszy widoczny film) i numerowane karty. Karta prowadzi na stronę filmu z kontekstem: `/?v=<film>&list=<playlista>&i=<n>`.
- **Strona filmu z kontekstem playlisty:** `HomeExperience` czyta `?list=` (slug; playlista jest szukana **w kanale otwartego filmu**, więc slug nie musi być globalnie unikalny) i `?i=` (1-based, tylko podpowiedź; serwer znajduje miejsce po id filmu). `getPlaylistQueue()` zwraca kolejkę tylko gdy playlista jest PUBLIC/UNLISTED, kanał widoczny, a otwarty film jest jednym z widocznych elementów: inaczej strona zachowuje się jak bez `?list=` (nic nie wycieka o ukrytej liście). `ChannelHome` pokazuje `PlaylistQueuePanel` (tytuł, „n z m”, poprzedni/następny, przełącznik „Autoodtwarzanie następnego”, lista) nad paskiem bocznym (desktop) i pod odtwarzaczem (telefon).
- **Autoodtwarzanie następnego:** `VideoPlayer` na końcu filmu ogłasza zdarzenie `polutek:video-ended` (`announceVideoEnded`, nic poza kolejką go nie czyta); `PlaylistAutoAdvance` przełącza na następny film **tą samą płytką ścieżką co kliknięcie w pasek** (`history.pushState`, bez przeładowania; film spoza listy strony głównej otwiera się pełnym wejściem pod adresem z `?list=`). Odtwarzacz zachowuje się jak przy każdym wyborze: następny film startuje z dźwiękiem, o ile przeglądarka na to pozwala, a gdy odmówi, rusza wyciszony z przyciskiem włączenia dźwięku (`onAutoPlayFail`). Wybór „Autoodtwarzanie następnego” (domyślnie włączone) jest tylko w `localStorage` (`polutek:playlist-autoplay`). Kliknięcie filmu spoza playlisty w pasku bocznym zamyka kolejkę; film z playlisty zachowuje kontekst w adresie.
- Playlisty **nie są w sitemapie** (świadomie: nic nie zmienia indeksowania do czasu osobnej decyzji); PUBLIC nie ma `noindex`.

## 6. Półka „Playlisty” na stronie kanału (jak podpiąć)

Strona kanału (`app/[locale]/channel/[slug]/page.tsx`) jest edytowana równolegle przez inną gałąź, więc nie została tu ruszona. Półka to **samodzielny komponent serwerowy**; wystarczy dopisać go pod zakładką „Wideo” (albo nad siatką filmów):

```tsx
import ChannelPlaylistsSection from '@/app/components/playlists/ChannelPlaylistsSection';
// ...
<ChannelPlaylistsSection channelId={creator.id} channelSlug={creator.slug} locale={locale} signedIn={!!userId} />
```

Komponent sam czyta dane (`listPublicPlaylistsForChannel`), nic nie renderuje, gdy kanał nie ma widocznych playlist, i zwraca tylko playlisty PUBLIC z co najmniej jednym filmem, który widz może zobaczyć. Osobnej trasy publicznego odczytu (API) nie ma: strona i półka są renderowane na serwerze.

## 7. Studio i API

- Ekran Studio → **Playlisty** (`StudioPlaylists`): lista z liczbą filmów i widocznością, tworzenie, edycja tytułu/opisu/widoczności, dodawanie filmów z wyszukiwarką własnych filmów (korzysta z `/api/studio/videos`), zmiana kolejności przyciskami „w górę/w dół” **albo klawiszami Alt + strzałka** na wybranym wierszu (fokus zostaje na przesuniętym filmie, komunikat `aria-live`), usuwanie z playlisty i usunięcie playlisty we własnym oknie potwierdzenia (`ConfirmDialog`: `alertdialog`, fokus na „Anuluj”, Esc, pułapka Tab; bez `window.confirm`). Film niewidoczny jeszcze dla widzów jest oznaczony. Układ jednokolumnowy z zawijaniem, miękkie zaokrąglenia i tokeny `--chan-*`.
- API (`/api/studio/playlists`: GET, POST; `/[id]`: GET, PATCH, DELETE; `/[id]/items`: POST, DELETE; `/[id]/order`: PUT): `withStudio` (sesja, kanał), schematy zod w `lib/api/studio-playlist-schemas.ts` (nieznane pola są wycinane), limity per użytkownik (`lib/api/studio-rate-limit.ts`: odczyt 120/min, zapis 30–60/min, 429 z kodem `RATE_LIMITED`), ten sam kształt błędu `{ error, code }` co reszta Studia. Komunikaty błędów w PL (jak inne trasy Studia), teksty interfejsu przez `tx()` w 8 językach.

## 8. Testy

`tests/unit/modules/playlists/` (macierz i BOLA, unikalność sluga, wyścig na indeksie unikalnym, atomowość i walidacja zmiany kolejności na pamięciowej bazie z cofaniem transakcji, filtrowanie widoczności, kolejka), `tests/unit/modules/authz/policy.test.ts` (macierz `playlist.*`), `tests/unit/playlists-routing.test.ts` (klucze tras dla ośmiu języków, przełącznik języka, middleware), parytet katalogów `tests/unit/i18n/catalog-parity.test.ts`.
