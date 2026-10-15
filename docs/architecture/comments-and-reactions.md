# Komentarze i reakcje

Stan 2026-10-05. Kod: `lib/modules/comments/`, `app/api/comments/`, `app/api/videos/[id]/reaction`.

- `CommentReactionType` to `LIKE | DISLIKE` (jedna reakcja użytkownika na komentarz: `@@unique([userId, commentId])`).
- **Dislike nie ma publicznego licznika**: agregowane jest tylko `likesCount`; usunięcie lub zamiana DISLIKE nigdy nie rusza `likesCount`.
- Reakcje to stan docelowy, nie przełącznik: `setCommentReaction` / `setVideoReaction` (`LIKE`, `DISLIKE` albo `null`), idempotentne i odporne na wyścigi (`createMany({ skipDuplicates })`, liczniki zmieniają się o liczbę
  zmienionych wierszy). API: `PUT /api/comments/[id]/reaction` z opcjonalnym `{ type }`, `DELETE` czyści (60/min na użytkownika). Polubienia filmów: `PUT /api/videos/[id]/reaction` (use case `setVideoReaction`), który **nie może** wywoływać `revalidatePath`
  (Hero aktualizuje stan z wyniku; w kodzie strony nie ma dziś żadnego `revalidatePath`).
- Widoczność: `mapCommentToDto` to biała lista. Tekst i autor wracają tylko dla `VISIBLE`; moderatorzy widzą też `HIDDEN`/`HELD_FOR_REVIEW`; treść `DELETED` zostaje w bazie, jest widoczna tylko w panelu i nigdy gdy usunął ją autor;
  tekst komentarzy usuniętych przez autora jest kasowany po 30 dniach przez `/api/cron/purge-deleted-comments` (usunięte/ukryte przez moderację zostaje). `threadCommentWhere()` w repozytorium to jedyny filtr listy
  (ukrywa też komentarze usuniętych kont). `repliesCount` w DTO jest liczone (`_count`); kolumny `Comment.repliesCount`/`score`/`imageUrl` nie są czytane ani zapisywane.
- Brak publicznego wyróżnienia wspierających (decyzja 2026-10-04): DTO niosą tylko plakietki `ADMIN`/`AUTHOR`, UI pokazuje tylko „Twórca”, bez obwódki avatara.
- Moderacja to maszyna stanów w `CommentPolicy` (`restore` tylko z `HIDDEN`/`HELD_FOR_REVIEW`; `DELETED` jest ostateczne); niedozwolona akcja to `CONFLICT` (409). Każda trasa mapuje błędy przez `commentErrorStatus` /
  `lib/api/comment-response.ts`; komunikaty bazy nigdy nie trafiają do klienta (`commentDatabaseError`).
- Moderacja (ukrycie, przywrócenie, serce twórcy, odpowiedź twórcy) jest wyłącznie w panelu. Publiczny `CommentItem` ma tylko zwykłe funkcje (zgłoszenie, usunięcie i edycja własnego, przypięcie przez twórcę filmu, polubienie, odpowiedź)
  i pokazuje serce twórcy tylko do odczytu.
- Zgłoszenia: jedno na użytkownika i komentarz; `reportsCount` = oczekujące zgłoszenia (przeliczane przy zgłoszeniu i rozstrzygnięciu); 3 oczekujące zgłoszenia wstrzymują komentarz widza do przeglądu
  (`HOLD_THRESHOLD` w `report-comment.use-case.ts`), nigdy komentarz administratora ani twórcy filmu.
- Wątki: lista osadza pierwsze 3 odpowiedzi; reszta przez `GET /api/comments/[id]/replies` (publiczne, także dla gości).
- Pisać i reagować mogą tylko zalogowani (wszystkie poziomy dostępu zachowują się tak samo); konto w trakcie onboardingu nie może komentować (`ONBOARDING_REQUIRED`).
- Komentarze są renderowane na serwerze z pierwszą stroną (bez `ssr:false`); szkielet `EmbeddedComments` to tylko zapas, gdy serwer nie zdołał ich załadować.
- Karta profilu autora: klik w imię lub awatar w `CommentItem` otwiera `UserProfileCard` (`app/components/comments/components/`, okno z `components/ui/dialog.tsx`). Dane tylko z `CommentAuthorDto` (nazwa, awatar, plakietka „Twórca”; pole `username` ze spuścizny Clerka nie jest pokazywane), bez zapytań i bez danych prywatnych; usunięty autor (`DELETED_COMMENT_AUTHOR_NAME`) i komentarz bez autora nie otwierają karty; własne komentarze widza używają bieżącego awatara z sesji. Kolejne fakty (data dołączenia, liczba komentarzy) dopisuje się w karcie, gdy będą potrzebne.
- Blokada widza na kanale (`ChannelBan`): rola z `comment.moderate` blokuje i odblokowuje ze Studia (Komentarze → „Zablokowani użytkownicy”); `createVideoComment` zwraca `FORBIDDEN/CHANNEL_BANNED` zablokowanemu (komentarz i odpowiedź), a blokada z datą końca wygasa sama. Decyzje moderacyjne i odwołania twórców: CLAUDE.md §4.27.
