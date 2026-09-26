# ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001 — Wspólny scaffold list/paginacja/filtrowanie w panelu admina

Status: DONE (2026-09-26) — zobacz CLAUDE.md §5.2 dla szczegółów implementacji, w tym dlaczego `useAdminVideos.ts` został wyłączony z migracji.
Priority: LOW (maintenance cost, nie bug)

## Why

Audyt 2026-09-13 (runda 2) znalazł, że `app/admin/users/page.tsx`,
`app/admin/comments/page.tsx`, `app/admin/comments/reports/page.tsx` i
`app/admin/videos/page.tsx` (przez `VideoTableWrapper`) każda samodzielnie
implementuje niezależny stos search/filter/table/pagination: własna trójka
`useState` (`page`/`total`/`totalPages`), własny wzorzec fetch-i-ustaw-tablicę,
własny markup `Card`/`Table`. To już dziś generuje realny dryf wizualny (patrz
`ADMIN-EMAILS-VISUAL-DRIFT-001` i punkt 4 w audycie) i utrudnia utrzymanie —
każda zmiana wzorca paginacji (jak ta zrobiona dziś dla zgłoszeń komentarzy)
musi być ręcznie powtórzona w 4 miejscach zamiast jednym.

Dodatkowo `app/admin/videos/components/useAdminVideos.ts` to ~150-liniowy
hook eksponujący ~40 surowych setterów `useState` bezpośrednio do strony,
która potem 6 razy powtarza ten sam taniec "fetch → mutuj → refetch".

## Scope

1. Zaprojektować jeden współdzielony `useAdminListQuery`-style hook (fetch +
   paginacja + filtrowanie + stan ładowania/błędu) i/lub komponent
   `AdminDataTable`, oparty na wzorcu już użytym w `lib/admin/query-parser.ts`
   po stronie serwera.
2. Przepisać cztery istniejące listy (users, comments, comments/reports,
   videos) na ten wspólny scaffold, zachowując każdą stronę specyficzną
   logikę (kolumny, akcje wierszy, filtry per-lista).
3. Scalić `useAdminVideos.ts`'s `readVideoLoadError` z
   `api-error.ts`'s `readAdminApiError` (ta sama logika, dwie implementacje w
   tym samym katalogu) przy okazji.

## Invariants that must survive

- Żadna z czterech list nie może stracić istniejącej funkcjonalności
  (filtry, sortowanie, akcje wierszy) w trakcie migracji na wspólny scaffold.
- Kontrakt odpowiedzi API każdej listy zostaje bez zmian — to czysto
  frontendowy refaktor konsumpcji, nie zmiana backendu.

## Non-goals

- Zmiana kontraktu żadnego endpointu API admina.
- Rozwiązanie `ADMIN-EMAILS-VISUAL-DRIFT-001` — to osobna decyzja, choć
  wspólny scaffold ułatwi jej wdrożenie, gdy zapadnie.
