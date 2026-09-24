# COMING-SOON-PREMIERE-COUNTDOWN-001 — Docelowa wersja "Coming soon" z premierą per film

Status: READY_FOR_BUILDER
Priority: MEDIUM (zastępuje tymczasowy hack `TEMP_PATRON_COMING_SOON`)

## Why

`TEMP_PATRON_COMING_SOON` (`lib/temp-patron-coming-soon.ts`, wpisane do
"TEMPORARY CHANGES REGISTRY" w `CLAUDE.md`, 2026-09-22) to prowizorka
zbudowana na starym, przedpivotowym mechanizmie tier PATRON:

- Zasłania **wszystkie** filmy oznaczone `tier = PATRON` naraz — nie jeden,
  konkretny, zapowiadany film.
- Data premiery to jedna zahardkodowana stała (`PATRON_COMING_SOON_TARGET`)
  — w schemacie nie istnieje żadne pole na datę premiery per film. Zmiana
  terminu = edycja kodu + deploy.
- Licznik (`formatPremiereCountdown`) i nakładka (`AccessLockOverlay`'s
  `ComingSoonScene`) są celowo tymczasowe i mają zostać zdjęte razem z flagą.
- 2026-09-24: jako działający prototyp na tym mechanizmie dodano tykanie
  licznika co sekundę (z sekundami) i pełną nawigowalność zapowiadanych
  filmów z sidebar do dużej nakładki w głównym feedzie (`SidebarPlaylist`'s
  `onClick` już nie blokuje `preventDefault()` dla `isComingSoon`). To wciąż
  atrapa na starym mechanizmie tier PATRON, nie docelowa architektura.

Właściciel potwierdził kierunek (patrz wątek projektu, 2026-09-24): chce
**jeden konkretny film** wskazany realną datą premiery, widoczny w osobnej
sekcji "Coming soon" niezależnej od tier PATRON, z żywym licznikiem i tą
samą nakładką w wersji dużej po kliknięciu w głównym feedzie.

## Scope

1. **Migracja Prisma**: `Video.premiereAt DateTime?` (nullable). Film w
   statusie `DRAFT` z `premiereAt` w przyszłości = "nadchodząca premiera".
   Tylko jeden taki film powinien być pokazywany naraz — ten z najbliższą
   datą (reguła w warstwie query, bez dodatkowego pola-przełącznika).
2. **Bezpieczny, publiczny DTO dla zapowiadanego filmu** — DRAFT-y dziś są
   całkowicie niepubliczne (i słusznie, ze względu na `videoUrl`/tokeny).
   Potrzebny osobny, okrojony kształt danych: `id`/`slug`, tytuł (albo
   teaser — do ustalenia z właścicielem, czy tytuł ma być w pełni widoczny
   czy zamazany do premiery), miniaturka, `premiereAt`. Zero danych o
   playbacku; **nigdy** przez `/api/media-source`.
3. **`getSidebarLayout()` / sidebar API**: nowy, niezależny typ sekcji
   `UPCOMING` (nie nadpisywać sekcji PATRON) zwracający ten jeden film.
4. **`SidebarPlaylist.tsx`**: renderować sekcję `UPCOMING` zamiast obecnego
   nadpisywania etykiety/listy sekcji PATRON. Link prowadzi do `?v=<slug>`
   tego filmu jak każdy inny.
5. **`AccessLockOverlay`/`ComingSoonScene`**: przyjmować realny `premiereAt`
   z propsów (zamiast importować stałą z `lib/temp-patron-coming-soon.ts`);
   tykanie co sekundę zostaje (już wdrożone jako prototyp).
6. **`PremiumWrapper`/`Hero`**: rozpoznawać "ten film jest nadchodzącą
   premierą" po fakcie posiadania `premiereAt` w przyszłości (nowe pole z
   API), a nie po `tier === "PATRON"` — dziś tier PATRON jest funkcjonalnie
   identyczny z LOGGED_IN i nie powinien być przeciążany drugim znaczeniem.
   Renderować `ComingSoonScene` w wariancie pełnym, bez żadnego zapytania o
   playback plan.
7. **Panel admina** (`/admin/videos/new`, `/admin/videos/[id]/edit`): pole
   daty premiery, żeby nie trzeba było grzebać w kodzie przy każdej zmianie
   terminu.
8. **Sprzątanie**: usunięcie `TEMP_PATRON_COMING_SOON`,
   `lib/temp-patron-coming-soon.ts` i całego tymczasowego mechanizmu
   (`AccessLockOverlay`'s `COMING_SOON` pseudo-state pozostaje, ale zasilany
   realnymi danymi) oraz wpisu w "TEMPORARY CHANGES REGISTRY" w `CLAUDE.md`.

## Invariants that must survive

- Zero zmian w `checkVideoAccess()`/`PatronGrant` — to wyłącznie warstwa
  widoczności/prezentacji, tak jak obecny tymczasowy mechanizm.
- Niepublikowany film nadal nigdy nie ujawnia `videoUrl`, tokenów ani
  identyfikatorów dostawcy — dotyczy to też nowego, okrojonego DTO.
- Tier `PATRON` zostaje funkcjonalnie identyczny z `LOGGED_IN` (patrz
  `CLAUDE.md` §4.4) — logika premiery nie może z powrotem uzależnić
  dostępu od tier PATRON.

## Non-goals

- Automatyczne publikowanie filmu dokładnie o `premiereAt` (cron/webhook) —
  osobny, mniejszy ticket, jeśli właściciel tego zechce; na start
  wystarczy ręczne przełączenie `status` na `PUBLISHED` w adminie po
  premierze, tak jak dziś.
- Wiele równoległych zapowiedzi premier naraz — na start jeden film.
