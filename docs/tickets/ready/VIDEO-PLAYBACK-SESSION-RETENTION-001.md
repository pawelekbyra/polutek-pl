# VIDEO-PLAYBACK-SESSION-RETENTION-001 — Retencja/czyszczenie tabeli VideoPlaybackSession

Status: READY_FOR_BUILDER
Priority: LOW (unbounded growth, not a correctness/security issue)

## Why

`AppPreloadProvider` (`app/components/preload/AppPreloadProvider.tsx`) eagerly
warmuje playback plan dla wybranego filmu plus do 3 "sąsiednich" filmów przy
każdym intent/hover/idle, zanim widz cokolwiek kliknie. Każde takie wywołanie
`GET /api/media-source/[videoId]` przechodzi przez
`PlaybackService.createPlaybackPlanWithContext`
(`lib/modules/playback/application/playback.service.ts`) — dokładnie tę samą
ścieżkę co realne odtwarzanie — i tworzy realny wiersz
`prisma.videoPlaybackSession.create(...)`, niezależnie od tego, czy widz
kiedykolwiek faktycznie odtworzy film.

Sprawdzone: w `app/api/cron/` nie ma żadnego route'a referencjonującego
`VideoPlaybackSession` — brak jakiejkolwiek retencji/czyszczenia. Tabela
rośnie bez ograniczeń wprost proporcjonalnie do ruchu na stronie (hover +
idle prefetch), nie tylko do realnych odtworzeń.

Widok liczenia — nie jest to zepsute: `countedAsView` ustawiane jest dopiero
przy realnym zdarzeniu telemetrycznym `WATCHED_10_SECONDS`
(`lib/modules/video/application/record-playback-event.use-case.ts`), więc
preloadowana-a-nigdy-nieodtworzona sesja nigdy nie liczy się jako obejrzenie.
To jest czysto kwestia wolumenu wierszy w bazie, nie poprawności danych.

## Scope

1. Nowy cron (`app/api/cron/`, zarejestrowany w `vercel.json`, auth przez
   `CRON_SECRET` jak reszta cronów) usuwający wiersze `VideoPlaybackSession`
   starsze niż rozsądny próg (np. 30-90 dni) ORAZ nigdy niepoliczone jako
   `countedAsView` — do ustalenia dokładny próg z właścicielem/na podstawie
   realnego wolumenu.
2. Rozważyć: czy zachować krótszą retencję dla sesji patrona/admina (jeśli są
   tam dane diagnostyczne wykorzystywane w panelu admina) — sprawdzić, czy
   `/admin/users/[id]` albo diagnostyka patrona czyta cokolwiek z tej tabeli
   przed ustaleniem progu.
3. Zaktualizować `CLAUDE.md` §6 (tabela cronów) o nowy wpis.

## Invariants that must survive

- Cron nigdy nie usuwa wiersza, który mógłby jeszcze być potrzebny do
  diagnostyki trwającego sporu/reklamacji dot. płatności (sprawdzić, czy
  `VideoPlaybackSession` jest gdziekolwiek cytowane w logice sporów Stripe
  przed ustaleniem progu retencji).
- Usuwanie musi być tylko usuwaniem starych wierszy — nigdy nie modyfikuje
  ani nie wpływa na `countedAsView`/statystyki wyświetleń już zagregowane
  gdzie indziej.

## Non-goals

- Rozdzielenie `PlaybackService.createPlaybackPlanWithContext` na tani
  check dostępu vs. drogie mintowanie tokenu (żeby preload w ogóle nie
  tworzył sesji) — to osobna, większa zmiana kontraktu API/`PlaybackPlan`,
  rozważona i odrzucona jako zbyt duża przy audycie 2026-09-13 (patrz
  `docs/audit/2026-09-13-code-quality-cleanup-round-1.md`). Ten ticket to
  tylko sprzątanie istniejących danych, nie zmiana zachowania preloadu.
