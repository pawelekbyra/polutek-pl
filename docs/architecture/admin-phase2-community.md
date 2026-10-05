# Faza 2 panelu: Społeczność (użytkownicy, komentarze, moderacja)

Stan: 2026-10-05, gałąź `feat/p2-community`. Zakres: sekcje 1.3 (bez płatności), 1.4, 4 oraz trasy `users*`, `comments*`,
`videos/[id]/comments` z [`admin-parity.md`](admin-parity.md) (wszystkie wiersze tego zakresu: `zrobione` albo `DROP`).
Wzorce jak w [`admin-phase2-content.md`](admin-phase2-content.md). Wygląd: prototyp `docs/design/admin-panel/` (`#/spolecznosc`).

## 1. Ekrany

| Ekran | Adres | Co robi |
|---|---|---|
| Moderacja (domyślna zakładka) | `/spolecznosc` | Kolejka komentarzy wstrzymanych albo ze zgłoszeniem (najstarsze pierwsze). Klawisze `j/k` (następny/poprzedni), `h` ukryj, `z` zostaw (wstrzymany zostaje zatwierdzony), `p` wstrzymaj, `w` wycisz autora. Decyzja to jedno żądanie: komentarz + jego zgłoszenia w jednej transakcji, toast „Cofnij” (12 s). Fokus przechodzi na następny element, a po ostatnim na nagłówek. `?stan=rozstrzygniete` to historia zamkniętych zgłoszeń. |
| Komentarze | `/spolecznosc?tab=komentarze` | Szukaj w treści/autorze, status, film, autor (`autor=<id>`), „Pytania bez odpowiedzi”, strona w URL. Checkboxy (do 50) i pasek akcji zbiorczych (Ukryj, Przywróć, Usuń…): jedno żądanie atomowe. W wierszu: Ukryj/Przywróć/Zatwierdź, Odpowiedz jako twórca, Serduszko, Usuń…. |
| Komentarze filmu | `/tresci/<slug>/komentarze` | Ta sama lista dla jednego filmu (stara zakładka była martwa, ADM-06). Nowa zakładka w `FilmTabs`. |
| Użytkownicy | `/spolecznosc?tab=uzytkownicy` | 4 kafle (konta, nowe 7 dni, ze znacznikiem, niezweryfikowane; każdy to link do segmentu), szukaj, 9 segmentów (nowi, aktywni 30 dni, wspierający, z napiwkiem, niezweryfikowani, 2FA, wyciszeni, administratorzy, usunięte), 6 sortowań (nagłówki z `aria-sort`), „Eksport CSV”. |
| Profil 360° | `/spolecznosc/u/<id>` | Podsumowanie i odznaki, akcje (Podgląd jako ta osoba, Znacznik wspierającego…, Rola…, Wycisz…/Zdejmij wyciszenie, Wyloguj wszędzie), napiwki z sumą, historia znacznika, konto, sesje (urządzenie i czas, bez IP i tokenów), komentarze, oglądanie, e-maile z rozsyłek, audyt dotyczący osoby, strefa zagrożenia (usunięcie). |

Adres profilu to `/spolecznosc/u/<id>` jak w prototypie (szkic WIP miał `/osoby/`; nic nie było wdrożone, więc bez przekierowania).
Wyszukiwarka palety i „Dzisiaj” linkują do nowych adresów. Serwerowe komponenty renderują całe strony (bez `loading.tsx`).

## 2. Przypadki użycia (`lib/modules`)

Moduł `admin-community` (nowy): odczyty łączące kilka modułów i zapisy dotykające danych osobowych. Zapisy domenowe leżą w swoich modułach.

| Use case | Moduł | Reguły |
|---|---|---|
| `moderateCommentsBulk` | comments | do 50 id, JEDNA transakcja, wszystko albo nic: brakujący komentarz albo stan, który zabrania akcji (np. usunięty) odrzuca całość (CONFLICT); aktualizacje warunkowe na stanie źródłowym, więc równoległa zmiana cofa transakcję; już w stanie docelowym = `unchanged` (powtórzenie jest nieszkodliwe). `reports: none/action/dismiss` zamyka w tej samej transakcji zgłoszenia i zeruje licznik. Audyt: wiersz na komentarz (`COMMENT_*`, `batchId`) i na grupę zgłoszeń (`REPORT_*`). Akcja `keep`: wstrzymany zatwierdzany, reszta bez zmian. |
| `undoCommentModeration` | comments | „Cofnij”: z `to` do `from` + ponowne otwarcie zgłoszeń zamkniętych przez tego administratora, atomowo. Jeśli komentarz zmienił stan od decyzji, NIC nie jest cofane (CONFLICT), żeby nie nadpisać nowszej decyzji. `DELETED` nigdy nie jest stanem źródłowym ani docelowym; usunięcie nie ma cofnięcia. Audyt `COMMENT_MODERATION_UNDONE`. |
| `createCreatorReply` | comments | odpowiedź z konta właściciela kanału (`Creator.userId`, stąd odznaka Autor); odpowiedź na odpowiedź trafia do wątku korzenia; tylko widoczny komentarz; opcjonalne serduszko w tej samej transakcji; idempotentne (ten sam tekst w tym wątku w ciągu 60 s zwraca istniejącą odpowiedź). |
| `setAdminCommentHeart` | comments | jawny stan zamiast przełącznika (przełącznik dublował się przy powtórzeniu żądania); bez zmiany = bez zapisu i audytu. |
| `listPanelComments`, `listModerationQueue`, `listResolvedReports`, `getModerationCounts` | comments | odczyty panelu; treść usunięta przez autora nigdy nie wraca (też dla admina). |
| `muteUserCommenting`, `unmuteUserCommenting` | users | wyciszenie na 1/7/30/365 dni z powodem 3-300 znaków; nie dla administratora ani usuniętego konta; audyt z `before/after`. `createVideoComment` odmawia do końca wyciszenia (czytanie i reakcje działają). |
| `revokeUserSessions` | users | wszystkie sesje albo jedna (id innej osoby = 404); zero sesji = bez audytu. Otwarta karta może działać do 60 s (pamięć podręczna ciasteczka sesji Better Auth). |
| `adminSetSupporter` | patron | znacznik wspierającego z obowiązkowym powodem; idempotentny względem stanu; cofnięcie kończy wszystkie aktywne znaczniki (jak `revokePatron`). Znacznik nie daje dostępu ani odznaki. |
| `listPanelUsers`, `getPanelUserStats`, `getUserProfile`, `listFilmOptions` | admin-community | odczyty; filtry segmentów w jednej funkcji `panelUserWhere`, wspólnej z eksportem. |
| `exportUsersCsv` | admin-community | CSV tego, co pokazuje lista; audyt `USERS_EXPORT` (aktor, filtry, liczba) w tej samej transakcji co odczyt; limit 20 000 wierszy; dane osobowe usuniętych kont nie wychodzą. |
| `viewAsPerson` | admin-community | „Podgląd jako ta osoba”: wyliczenie dostępu według zasad strony (dwa poziomy, napiwek niczego nie odblokowuje), bez sesji i bez podszywania; każde otwarcie zapisuje `ADMIN_VIEW_AS`. |
| `changeUserRoleFromPanel`, `deleteUserFromPanel` | users | istniejące (WIP): blokada ostatniego administratora, brak działania na sobie, wpisanie e-maila. |

## 3. Warstwa akcji

`apps/admin/lib/actions/run.ts` (`runAdminAction`): `requireAdmin` → zod `.strict()` → limit → step-up (gdy trzeba) → use case → wynik po polsku.
Limit w pamięci procesu (`rate-limit.ts`, okno przesuwne, na administratora i kubełek): panel to jeden mały kontener dla jednego właściciela,
Redis nie jest potrzebny, restart zeruje liczniki (nieszkodliwe). Aktor use case'ów to `{ type: "admin", userId: AdminUser.id }`, `requestId` = `cf-ray`.
Nieoczekiwany wyjątek kończy się ogólnym komunikatem bez szczegółów (szczegóły w logu).

| Akcja | Limit | Step-up |
|---|---|---|
| ukryj/wstrzymaj/zatwierdź/przywróć (jeden lub zbiorczo) | 120/min | nie (odwracalne) |
| usuń komentarz (jeden lub zbiorczo) | 30/min | **tak** (ostateczne) |
| decyzja z kolejki, „Cofnij”, serduszko | 120/min, 60/min | nie |
| odpowiedź twórcy | 20/min | nie |
| znacznik wspierającego, wyciszenie, wylogowanie, podgląd | 20-30/min | nie |
| zmiana roli | 10/10 min | **tak** |
| usunięcie konta | 5/10 min | **tak** + wpisany e-mail |
| eksport CSV (trasa `POST /api/spolecznosc/uzytkownicy/export`) | 5/h | **tak** |

Eksport to POST (obejmuje go reguła CSRF proxy panelu), a nie GET: plik pobiera przycisk (`fetch` + blob). Przy `STEP_UP_REQUIRED`
przycisk i okna prowadzą na `/potwierdz?next=<ta lista>` i wracają; `safeNextPath` nie przepuszcza `/api/`, więc powrót jest na stronę.

## 4. Decyzje i źródła

1. **Atomowość zbiorcza = wszystko albo nic**, nie „najlepsze starania”: zaznaczenie pochodzi z aktualnej listy, a nieaktualny wiersz to sygnał „odśwież”, nie powód do częściowej zmiany bez śladu. Wzorzec UX: zaznaczanie z paskiem akcji i cofnięciem zamiast okna potwierdzenia dla czynności odwracalnych (zgodnie z `DESIGN-SYSTEM.md`); okno „Skutek” tylko dla ostatecznego usunięcia.
2. **Ukrycie lub usunięcie komentarza zamyka jego zgłoszenia jako uznane** (a „Zostaw” jako oddalone), żeby licznik „do moderacji” się nie rozjeżdżał. Dotyczy tylko nowych use case'ów panelu; stare use case'y dla trasy `www` bez zmian.
3. **Kolejka jest per komentarz**, nie per zgłoszenie (prototyp): trzy zgłoszenia jednego komentarza to jedna decyzja. Licznik na zakładce to liczba komentarzy w kolejce; licznik w nawigacji (`NavCounts.moderation`, faza 1) liczy zgłoszenia + wstrzymane i może być większy.
4. **CSV**: [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection) (przeczytane 2026-10-05): znaki wyzwalające `= + - @`, tabulator, CR, LF i warianty pełnoszerokie `＝ ＋ － ＠`. Każda komórka tekstowa jest cudzysłowiona (cudzysłów podwajany), a zaczynająca się od znaku wyzwalającego (po pominięciu białych i sterujących znaków) dostaje apostrof z przodu; podziały wiersza w komórce spłaszczone; liczby liczone przez nas (kwoty) nie są prefiksowane. BOM UTF-8 i CRLF (RFC 4180), żeby Excel czytał polskie litery. Znane ograniczenie, które podaje OWASP: po zapisaniu i ponownym otwarciu w Excelu apostrof bywa widoczny; wybraliśmy zalecaną metodę apostrofu zamiast tabulatora, bo nie psuje importu do innych narzędzi. Test: `tests/unit/modules/admin-community/community.test.ts`.
5. **Usunięcie konta (RODO)**: bez zmian względem istniejącej anonimizacji (`AccountDeletionCleanupUseCase`: wiersz zostaje jako nagrobek, sesje/logowania/2FA/awatar/subskrypcje kasowane, komentarze zostają bez treści, wpłaty zostają w księgowości bez danych osobowych, audyt tylko z identyfikatorami). Okno pokazuje skutki z prawdziwymi liczbami osoby. Anonimizacja zamiast kasowania wierszy jest zgodna z art. 17 ust. 3 lit. b RODO (obowiązek prawny: dokumenty księgowe), dane osobowe znikają. Administratora nie da się usunąć (najpierw odebrać rolę), ostatniego nigdy.
6. **Wyciszenie**: kolumny `User.commentMutedUntil` i `commentMuteReason` (migracja addytywna). Brak wyciszenia „bezterminowego” celowo: każde wyciszenie wygasa, a rok to maksimum; do dłuższych spraw służy usunięcie konta.
7. **Wyloguj wszędzie** to usunięcie wierszy `Session` (Better Auth sprawdza sesję w bazie); ciasteczko ma 60 s pamięci podręcznej, więc skutek może być opóźniony o minutę. Udokumentowane w oknie.
8. **Sesje w profilu**: tylko urządzenie, czasy i wygaśnięcie. Adres IP i token celowo nie są pokazywane (minimalizacja danych).
9. **Podgląd jako ta osoba** nie wydaje sesji (nie ma podszywania się), tylko tłumaczy dostęp; wpis `ADMIN_VIEW_AS` przy każdym otwarciu, bo to odczyt danych osoby.
10. **Audyt przy usuwaniu komentarza**: treść zostaje w bazie jako dowód moderacji (jak dotąd); okno mówi o tym wprost.
11. **Podkreślone zasady**: dwa poziomy dostępu (PATRON zniknął), brak bramek płatności, jedyny ADMIN to właściciel; „znacznik wspierającego” to notatka administratora bez skutku na stronie.
12. **Poza zakresem tej fazy**: „Zobacz w Stripe” i zwroty (faza 3), „Wyślij wiadomość” (DROP), pulpit użytkowników (DROP), przeniesienie `CommentItem.tsx` z `www` na panel (faza 5).

## 5. Testy

| Plik | Co pilnuje |
|---|---|
| `tests/unit/modules/comments/moderation-bulk.test.ts` (18) | zbiorcza moderacja: jedna transakcja, wszystko albo nic, wyścig cofa zmianę, idempotencja, zamykanie zgłoszeń, `keep`, usunięcie, limit 50 i duplikaty, brak uprawnień; „Cofnij” (konflikt, DELETED, cudze zgłoszenia); odpowiedź twórcy (idempotencja, wątek, ukryty cel, brak konta twórcy); serduszko |
| `tests/unit/modules/users/admin-user-safety.test.ts` (9) | wyciszenie (walidacja, audyt przed/po, administrator, usunięte), zdjęcie, wylogowanie jednej/wszystkich sesji |
| `tests/unit/modules/patron/admin-set-supporter.test.ts` (4) | powód obowiązkowy, idempotencja, aktor |
| `tests/unit/modules/admin-community/community.test.ts` (23) | CSV injection (w tym warianty pełnoszerokie), segmenty, eksport (audyt, limit, dane usuniętych), podgląd jako osoba, etykiety urządzeń |
| `tests/unit/modules/comments/core-flows.test.ts` (+2) | wyciszone konto nie komentuje, wygasłe wyciszenie tak |
| `tests/unit/admin-app/community-actions.test.ts` (18) | akcje: jedno żądanie zbiorcze, step-up (usuń, rola, usunięcie konta), zod strict, limity, mapowanie błędów, brak wycieku wyjątku |
| `tests/unit/admin-app/community-export-route.test.ts` (5) | 401, 403 step-up, 400, plik jako załącznik bez cache, 429, 413 |
| `tests/unit/admin-app/community-components.test.tsx` (11) | klawisze kolejki i „Cofnij”, ignorowanie klawiszy w polach, wyciszenie, zaznaczanie do 50 w jednym żądaniu, okno usunięcia i przejście do step-up, odpowiedź twórcy, okna profilu |
| `tests/unit/admin-app/rate-limit.test.ts` | okno przesuwne, osobne liczniki |
| `tests/postgres/admin-community.pg.test.ts` | atomowość i „Cofnij” na prawdziwym schemacie, kolumny wyciszenia, lista i eksport. **Napisany, ale NIE uruchomiony** (brak lokalnego Postgresa); uruchomi go CI z Postgresem albo lokalnie z `DATABASE_URL`. |

Nie wykonano: oglądu w przeglądarce (układ, tryb ciemny/jasny, telefon) ani testów Playwright z wirtualnym WebAuthn (brak przeglądarki w środowisku agenta).

## 6. Wdrożenie

1. **Migracja** `20261005120000_add_user_comment_mute` (addytywna, idempotentna, `ADD COLUMN IF NOT EXISTS`; zero zapisów danych). Najpierw `backup.sh`, potem `prisma migrate deploy`, dopiero potem nowy obraz `www` i panelu (kod `www` czyta nowe kolumny w `createVideoComment`; obraz bez migracji zwróciłby błąd przy dodawaniu komentarza).
2. **Zmienne środowiskowe**: żadnych nowych. Panel używa tych samych (`DATABASE_URL`, sesja, Access).
3. **Kolejność**: migracja → obraz `www` → obraz panelu. Rollback: wystarczy poprzedni obraz, kolumny można zostawić.
4. Po wdrożeniu stare `/admin/users*` (bez wpłat) i `/admin/comments*` mogą przejść na 308 do panelu (faza 5, wiersze są `zrobione`).

## 7. Ryzyka

- Limit w pamięci procesu nie chroni przy wielu replikach; panel ma jedną.
- Kolejka ładuje do 25 komentarzy na stronę z dołączonymi zgłoszeniami (do 10 na komentarz): wystarcza przy skali kanału, przy tysiącach zgłoszeń potrzebna będzie paginacja zgłoszeń.
- „Aktywni 30 dni” liczy się z `Session.updatedAt` (odświeżane co `updateAge`), więc to przybliżenie ostatniej aktywności.
- Lista „Pytania bez odpowiedzi” opiera się na znaku `?` w treści i na tym, że odpowiedź napisało konto właściciela kanału: heurystyka.
- Pamięć podręczna sesji www (60 s) opóźnia skutek „Wyloguj wszędzie”.
