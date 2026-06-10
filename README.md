# README fix dla PR #785 — R8 Comments Certification Candidate Pass

## 1. W sekcji statusów R0–R11 ustaw tabelę tak

Podmień całą tabelę w sekcji `## 4. Aktualny status roadmapy R0–R11` albo `## 4. Aktualny status refaktoryzacji` na:

```md
## 4. Aktualny status roadmapy R0–R11

| Faza     | Opis                                       | Status                                                  |
| :------- | :----------------------------------------- | :------------------------------------------------------ |
| **R0**   | Zasady, infrastruktura, bariery projektowe | `[x]`                                                   |
| **R1**   | Shared, Result, błędy, Actor, AppContext   | `[x]`                                                   |
| **R2**   | Audit                                      | `[x foundation]`                                        |
| **R3**   | Media                                      | `[x safety foundation]`                                 |
| **R4**   | Channel / ścisły single-channel            | `[x single-channel foundation]`                         |
| **R5**   | Users                                      | `[x stronger foundation]`                               |
| **R6**   | Video                                      | `[x stronger foundation]`                               |
| **R6.5** | Access Foundation                          | `[x certified]`                                         |
| **R7**   | Patron + Payments                          | `[~ stronger foundation / certification candidate]`     |
| **R8**   | Comments                                   | `[~ certification candidate / pending final validation]` |
| **R9**   | Email                                      | `[~ code-only pass / pending docs+guard reconcile]`     |
| **R10**  | Cleanup legacy fasad                       | `[~ preparation inventory / needs reconcile with main]` |
| **R11**  | Frontend admina / kokpit operacyjny        | `[ ]`                                                   |
```

## 2. Podmień aktualną interpretację pod tabelą na tę

```md
Aktualna interpretacja:

* R0/R1 są ukończone jako fundament pracy agentów.
* R2/R3/R4 są certyfikowanymi foundation, nie pełnym usunięciem każdego legacy.
* R5/R6 są mocno zaawansowane i po ostatnich passach mają mocniejszą ochronę, ale nadal mogą mieć jawne legacy extensions.
* R6.5 certyfikuje access foundation dla wideo.
* R7 core runtime został przesunięty do modułów, ale nie jest jeszcze pełnym `[x certified]`.
* R8 ma PR z certification candidate pass, który domyka główne znane blokery komentarzy, ale nie może być oznaczony jako certified przed zielonym CI, guardami, typecheckiem, testami i finalnym README/guard reconcile.
* R9 ma code-only preparation pass w main, ale wymaga dokumentacyjnego i guardowego reconcile przed zmianą statusu.
* R10 inventory istnieje, ale musi być okresowo uzgadniane z aktualnym main po większych zmianach modułowych.
* R11 jeszcze nie wystartowało.
```

## 3. W sekcji `## 5. Bieżące zadanie` ustaw to

````md
## 5. Bieżące zadanie

```txt
Najbliższe zadanie:
Review i final reconcile PR #785 — R8 Comments Certification Candidate Pass.

Cel:
Domknąć R8 Comments jako certification candidate bez cofania README, bez psucia R9 i bez przedwczesnego oznaczania R8 jako certified.

Warunki przed merge PR #785:
- CI musi być zielone albo failure musi być jednoznacznie wyjaśnione i naprawione.
- README nie może cofać ostrożnego statusu R9.
- R9 musi pozostać jako [~ code-only pass / pending docs+guard reconcile].
- R8 może być oznaczone najwyżej jako [~ certification candidate / pending final validation].
- Nie wolno oznaczać R8 jako [x certified].
- Nie zaczynać dużego R10 cleanup.
- Nie zaczynać R11.
- Nie oznaczać R7 jako [x certified].
````

Następny dobry prompt dla agenta kodowania:

```txt
Dokończ review/reconcile PR #785 — R8 Comments Certification Candidate Pass.

Zakres:
- Nie zmieniaj runtime poza naprawą błędów wykrytych przez CI/typecheck/testy.
- Napraw README tak, żeby nie cofało aktualnego ostrożnego source of truth.
- R8 ustaw najwyżej jako [~ certification candidate / pending final validation].
- R9 zostaw jako [~ code-only pass / pending docs+guard reconcile].
- Nie oznaczaj R7/R8/R9 jako certified.
- Sprawdź scripts/check-architecture.ts pod kątem stale allowlist.
- Zweryfikuj, czy R8 route’y nie importują już @/lib/prisma ani legacy comment services.
- Nie zaczynaj R10.
- Nie zaczynaj R11.

Na końcu uruchom:
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run

Jeżeli coś nie zostało uruchomione, oznacz jako NOT RUN i podaj powód.
```

````

## 4. W sekcji `## R8 — Comments` podmień cały opis R8 na ten

```md
## R8 — Comments

Cel:

* moduł Comments,
* list/create/update/delete,
* replies,
* reactions,
* reports,
* pin/unpin,
* context,
* admin comments,
* admin video comments,
* moderation,
* access control dla patron-only videos,
* audyt operacji moderacyjnych.

Status:

```txt
[~ certification candidate / pending final validation]
````

Co jest aktualnie interpretowane jako zrobione:

* moduł `comments` istnieje,
* core comment flows są zmigrowane do modułu,
* publiczne list/create/update/delete/replies/reactions/report działają przez modularne use case’y,
* `context` route został przesunięty w stronę modularnego `getCommentContext`,
* `pin/unpin` zostały przesunięte w stronę modularnych use case’ów,
* `admin/comments` został przesunięty w stronę modularnego `listAdminComments`,
* `admin/videos/[id]/comments` korzysta z modularnego listowania komentarzy,
* komentarze dziedziczą dostęp z filmu,
* interakcje z komentarzami pod patron-only video wymagają właściwego dostępu,
* legacy `pinned` PATCH hack został usunięty,
* guardy R8 zostały zaktualizowane w kierunku usunięcia R8 z Prisma allowlist.

R8 nie jest jeszcze `[x certified]`.

Warunki certyfikacji R8:

* CI zielone,
* `npm run quality:architecture-boundaries` zielone,
* `npm run typecheck` zielone,
* `npm test -- --run` zielone,
* README nie cofa aktualnego source of truth,
* guardy nie zawierają stale allowlist dla R8,
* route’y R8 nie importują bezpośrednio `@/lib/prisma`,
* route’y R8 nie importują legacy comment services,
* admin permission behavior nie został osłabiony przy przejściu z `requireAdminForApi(...)` na `getActorFromAuth()`,
* znane pozostałe braki są jawnie opisane.

Pozostające możliwe ryzyka R8:

* frontend moderation UI może nadal wymagać osobnego passu,
* pełny moderation log UI może nadal wymagać osobnego passu,
* admin permission granularity wymaga ręcznego review,
* R8 certification candidate nie oznacza jeszcze pełnej certyfikacji.

Zasada trwała:

```txt
Komentarze dziedziczą dostęp z filmu.
Jeżeli użytkownik nie ma prawa zobaczyć patron-only video, nie powinien widzieć ani używać komentarzy pod tym filmem.
```

Następny bezpieczny krok po merge PR #785:

```txt
R8 final validation + docs/guard reconcile.
```

Dopiero po tym można rozważyć zmianę statusu R8 na `[x certified]`.

````

## 5. Nie zmieniaj sekcji R9 na bardziej optymistyczną

R9 ma zostać:

```md
Status:

```txt
[~ code-only pass / pending docs+guard reconcile]
````

````

Nie używaj teraz:

```txt
[~ foundation migrated / pending certification]
````

bo to jest mniej precyzyjne i zbyt optymistyczne po samym code-only pass.
