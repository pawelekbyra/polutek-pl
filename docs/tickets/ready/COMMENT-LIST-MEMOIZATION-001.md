# COMMENT-LIST-MEMOIZATION-001 — Brak memoizacji na liście komentarzy

Status: READY_FOR_BUILDER
Priority: LOW (moderate perf, skaluje się z liczbą komentarzy w wątku)

## Why

Audyt wydajności 2026-09-13 (runda 3) znalazł: `EmbeddedComments.tsx`
przekazuje inline-owe funkcje strzałkowe (`onLike={(id) => likeMutation.mutate(id)}`
itd.) do każdego `CommentItem`, który nie jest owinięty w `React.memo`.
Dodatkowo `isReactionPending={likeMutation.isPending || dislikeMutation.isPending}`
to jedna, współdzielona flaga dla **całej listy** — polubienie jednego
komentarza przełącza ten prop jednocześnie na wszystkich `CommentItem`ach,
wymuszając re-render + re-layout (każdy owinięty w `CommentMotionItem` z
`layout="position"` framer-motion) całej widocznej listy podczas gdy tylko
jedna mutacja jest w locie.

Wpływ skaluje się z liczbą komentarzy w wątku — dla jednokanałowej platformy
VOD wątki komentarzy raczej nie są ogromne, więc to moderate, nie high, ale
jest to realna, konkretna nieefektywność na jedynej prawdziwie
per-elementowej "gorącej" ścieżce renderowania w aplikacji.

## Scope

1. Owinąć `CommentItem` w `React.memo` z sensownym porównaniem propsów
   (albo domyślnym, jeśli propsy są już w większości prymitywami/stabilnymi
   referencjami po kroku 2).
2. Ustabilizować callbacki przekazywane do `CommentItem` przez `useCallback`
   w `EmbeddedComments.tsx`, żeby nie były tworzone na nowo przy każdym renderze.
3. Zamienić globalny `isReactionPending` na stan per-komentarz (np. śledzić
   `commentId` aktualnie mutowanego komentarza zamiast gołego booleana z
   `useMutation`), żeby tylko faktycznie zmieniany komentarz re-renderował
   się podczas swojej własnej mutacji.

## Invariants that must survive

- Zachowanie UI (stan "processing"/disabled na przycisku reakcji) musi
  wyglądać identycznie z perspektywy użytkownika — zmienia się tylko
  **zakres** re-renderu, nie widoczny efekt.
- Wszystkie istniejące testy komentarzy (`tests/unit/comments-*`,
  `tests/unit/components/comments/`) muszą przejść bez zmian w asercjach
  dotyczących zachowania (disabled state, aria-pressed itd.) — jeśli test
  łamie się na tej zmianie, to sygnał że zachowanie się zmieniło, nie że
  test jest nieaktualny.

## Non-goals

- Wirtualizacja listy komentarzy (react-window itp.) — nieproporcjonalne
  do dzisiejszej skali wątków komentarzy na tej platformie.
