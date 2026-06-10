# Polutek.pl

## 0. Jak używać tego README

To README jest **operacyjnym źródłem prawdy dla agentów kodowania**.

Agent ma zakładać, że właściciel projektu może nie znać szczegółów technicznych. Dlatego README musi jasno mówić:

* czym jest produkt,
* czym produkt nie jest,
* jaki jest aktualny stan systemu,
* które rzeczy są naprawdę zrobione,
* które rzeczy są tylko fundamentem,
* które rzeczy są legacy,
* czego nie wolno ruszać,
* jaki powinien być następny prompt,
* kiedy wolno zmienić status fazy.

Jeżeli README, kod, testy i guardy się nie zgadzają, agent ma najpierw wykonać **reconciliation pass**, a nie kontynuować refaktor w ciemno.

Najważniejsza zasada:

```txt
README ma być bardziej ostrożne niż optymistyczne.
```

Nie wolno oznaczać fazy jako ukończonej tylko dlatego, że powstał folder modułu, pojedynczy use case albo code-only pass.

---

## 1. Tryb produktu

Polutek.pl to ścisły, jednokanałowy hub twórcy.

Inwarianty produktu:

* jeden oficjalny kanał,
* jeden twórca,
* jeden katalog treści,
* jeden system patronów/dostępu,
* jedna społeczność,
* jedna prywatna platforma mediowa dla właściciela/twórcy.

To NIE jest:

* marketplace dla wielu twórców,
* platforma do onboardingu twórców,
* mini-Patreon dla wielu twórców,
* publiczna wielokanałowa sieć społecznościowa,
* ogólny SaaS dla wielu creatorów,
* white-label CMS,
* multi-tenant creator platform.

Ważne mapowanie modeli:

* `Creator` w bazie danych to legacy techniczna reprezentacja `MainChannel`.
* Nie zmieniaj nazwy `Creator -> Channel` w Prismie bez osobnego, certyfikowanego migration plan.
* `Subscription != Patron`.
* Subskrypcja/obserwowanie oznacza zainteresowanie e-mailami/newsletterem/powiadomieniami.
* Dostęp patrona jest kontrolowany przez stan bazy danych.
* Aktualny read-model dostępu nadal może korzystać z `User.isPatron`.
* Docelowo źródłem prawdy dla patrona mają być aktywne `PatronGrant`.
* Metadane Clerk to cache/sync, a nie źródło prawdy dla dostępu.

---

## 2. Architektura

Aktywny kierunek architektoniczny to modułowy monolit.

Docelowy przepływ:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Route’y powinny być cienkie.

Route może:

* uwierzytelniać,
* parsować wejście,
* tworzyć `AppContext`,
* wywołać publiczne API modułu,
* zamapować wynik na HTTP.

Route nie powinien:

* zawierać logiki biznesowej,
* importować bezpośrednio `@/lib/prisma`,
* importować bezpośrednio `@/lib/services/**`,
* importować wnętrzności modułu,
* wykonywać dużych mapowań DTO,
* samodzielnie rozstrzygać polityk dostępu.

Use case powinien zawierać realny przepływ biznesowy.

Policy powinno zawierać reguły biznesowe.

Repository powinno zawierać dostęp do bazy danych.

DTO powinno chronić API/UI przed surowymi modelami Prisma.

Moduły muszą wystawiać publiczne API przez `index.ts`.

Dozwolone z route’a:

```ts
import { handleStripeWebhook } from "@/lib/modules/payments";
```

Zabronione z route’a:

```ts
import { HandleStripeWebhookUseCase } from "@/lib/modules/payments/application/handle-stripe-webhook.use-case";
```

---

## 3. Słownik statusów

Znaczenie statusów:

```txt
[ ]                           nie rozpoczęto
[~]                           częściowe / w toku / pozostają znane blokery
[~ foundation]                fundament istnieje, ale runtime nie jest w pełni przepięty
[~ core migrated]             główne runtime flows są przepięte, ale nie ma pełnej certyfikacji
[~ code-only pass]            kod został zmieniony, ale docs/guard/reconcile nie są domknięte
[~ pending certification]     kod wygląda na gotowy, ale wymaga testów/guardów/reconcile
[~ certification candidate]   zakres nadaje się do kontrolowanego passu certyfikacyjnego
[x foundation]                fundament certyfikowany, ale legacy może celowo pozostać
[x safety foundation]         certyfikowana warstwa bezpieczeństwa, ale runtime/delivery może pozostać
[x single-channel foundation] ścisły inwariant jednokanałowy certyfikowany
[x stronger foundation]       mocniejszy fundament, ale pozostają jawne legacy extensions
[x certified]                 certyfikowane jako ukończone dla aktualnego zakresu roadmapy
[x]                           ukończone i certyfikowane dla obecnego zakresu
[!]                           zablokowane / regresja / nie kontynuuj bez naprawy
```

Ważna zasada:

```txt
Uznane za gotowe != certyfikowane jako gotowe.
```

Faza może zostać oznaczona jako certyfikowana tylko wtedy, gdy:

* kod działa w runtime,
* testy są aktualne,
* guardy są aktualne,
* README mówi prawdę,
* znane blokery są jawnie opisane,
* walidacja została uruchomiona albo uczciwie oznaczona jako NOT RUN.

---

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
| **R8**   | Comments                                   | `[~ core comments migrated / blockers remain]`          |
| **R9**   | Email                                      | `[~ code-only pass / pending docs+guard reconcile]`     |
| **R10**  | Cleanup legacy fasad                       | `[~ preparation inventory / needs reconcile with main]` |
| **R11**  | Frontend admina / kokpit operacyjny        | `[ ]`                                                   |

Aktualna interpretacja:

* R0/R1 są ukończone jako fundament pracy agentów.
* R2/R3/R4 są certyfikowanymi foundation, nie pełnym usunięciem każdego legacy.
* R5/R6 są mocno zaawansowane i po ostatnich passach mają mocniejszą ochronę, ale nadal mogą mieć jawne legacy extensions.
* R6.5 certyfikuje access foundation dla wideo.
* R7 core runtime został przesunięty do modułów, ale nie jest jeszcze pełnym `[x certified]`.
* R8 core comments są zmigrowane, ale `admin`, `moderation`, `pin`, `context` i część flow administracyjnych pozostają blokerami.
* R9 ma code-only preparation pass w main, ale wymaga dokumentacyjnego i guardowego reconcile przed zmianą statusu.
* R10 inventory istnieje, ale musi być okresowo uzgadniane z aktualnym main po większych zmianach modułowych.
* R11 jeszcze nie wystartowało.

---

## 5. Bieżące zadanie

```txt
Najbliższe zadanie:
Post-merge docs/guard reconcile po ostatnich passach R5/R6/R9.

Cel:
Uzgodnić README, guardy architektoniczne i dokumentację audytową z aktualnym main.

Nie zaczynać dużego R10 cleanup.
Nie zaczynać R11.
Nie oznaczać R7 jako [x certified].
Nie oznaczać R8 jako [x certified].
Nie oznaczać R9 jako [x certified].
Nie implementować R8 Comments Certification Candidate Pass, dopóki docs/guard reconcile nie zostanie wykonany.
```

Następny dobry prompt dla agenta kodowania:

```txt
Wykonaj post-merge docs/guard reconcile po ostatnich passach R5/R6/R9.

Zakres:
- Sprawdź aktualny main.
- Sprawdź README.md.
- Sprawdź scripts/check-architecture.ts.
- Sprawdź docs/audit, jeżeli zawierają inventory dla R5/R6/R8/R9/R10.
- Usuń albo popraw stale allowlisty, które opisują route jako legacy, mimo że aktualny kod jest już modularny.
- Nie zmieniaj runtime poza oczywistym usunięciem stale guard entries.
- Nie aktualizuj statusów faz optymistycznie.
- Nie oznaczaj R8/R9/R7 jako certified.
- Nie zaczynaj R10.
- Nie zaczynaj R11.

Na końcu uruchom:
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run

Jeżeli coś nie zostało uruchomione, oznacz jako NOT RUN i podaj powód.
```

Po tym kroku następny bezpieczny prompt to osobny:

```txt
R8 Comments Certification Candidate Implementation Pass.
```

Ten pass musi być oddzielny, kontrolowany i nie może być mieszany z R9, R10 ani R11.

---

## 6. Obowiązkowe zasady agentów

Agent musi przestrzegać tych zasad:

* Nie przenoś tylko plików.
* Nie twórz folderów, nazywając fazę ukończoną.
* Nie oznaczaj `[x]` bez testów i walidacji.
* Nie aktualizuj README na bardziej optymistyczne niż rzeczywistość kodu.
* Nie zaczynaj nowych faz roadmapy, gdy obecna faza ma znane blokery.
* Nie importuj wnętrzności modułów z route’ów.
* Nie mieszaj zamkniętych modułów z bezpośrednią Prismą/serwisami w tym samym route, chyba że jest to jawnie allowlisted i opisane.
* Nigdy nie wystawiaj surowego `videoUrl` do publicznego UI/API.
* Nie traktuj metadanych Clerk jako źródła prawdy dla dostępu patrona.
* Nie wprowadzaj fallbacków twórcy typu `polutek`, `demo-creator`, `default-creator`.
* Nie uruchamiaj maintenance/repair z normalnego runtime’u.
* Nie zaczynaj Fazy X jako osobnej roadmapy przed ukończeniem R0–R11.
* Nie oznaczaj PR-a jako merged tylko dlatego, że istnieje.
* Otwarty PR to pending state, nie source of truth main.
* Code-only pass nie wystarcza do certyfikacji fazy.
* Docs-only pass nie wystarcza do certyfikacji fazy.
* Guardy nie mogą kłamać o stanie route’ów.

Kluczowe doprecyzowanie:

```txt
Faza X nie może wystartować jako osobna roadmapa przed ukończeniem R0–R11.
```

Ale R7–R11 muszą zawierać minimalne elementy Fazy X naturalne dla swojej domeny, żeby Faza X nie stała się drugim masowym refaktorem.

---

# 7. Roadmapa R0–R11

## R0 — Zasady i infrastruktura

Cel:

* zasady projektu,
* README jako źródło prawdy,
* skrypty walidacyjne,
* bariery architektoniczne,
* standard raportów agentów.

Status:

```txt
[x]
```

R0 jest ukończone dla obecnego zakresu.

---

## R1 — Shared, Result, błędy, Actor, AppContext

Cel:

* `Actor`,
* `AppContext`,
* `UseCaseResult`,
* `AppError`,
* `ReadDb`,
* `WriteTx`,
* helpery API,
* mapowanie odpowiedzi,
* brak przestarzałych `ctx.userId` / `ctx.role`.

Status:

```txt
[x]
```

R1 jest certyfikowanym fundamentem.

Dalsze szlify mogą nastąpić później, ale R1 jest wystarczająco stabilne jako baza dla dalszych prac domenowych.

---

## R2 — Audit

Cel:

* współdzielony moduł audytu,
* zdarzenia audytu oparte na aktorze,
* logowanie audytu świadome transakcji,
* użycie przez zmigrowane moduły.

Status:

```txt
[x foundation]
```

R2 jest certyfikowanym foundation.

Nie oznacza to, że każdy legacy audit call został usunięty. Oznacza to, że istnieje stabilny kierunek i bezpieczna warstwa audytu dla modułów.

---

## R3 — Media

Cel:

* prywatne media,
* bezpieczne źródła odtwarzania,
* ochrona raw/signed/internal media URL,
* separacja storage od publicznego API,
* polityka dostępu do źródeł mediów.

Status:

```txt
[x safety foundation]
```

R3 ma certyfikowaną warstwę bezpieczeństwa.

Zasada trwała:

```txt
Publiczne API/UI nie może wystawiać surowego videoUrl ani prywatnych storage URL.
```

---

## R4 — Channel / single-channel

Cel:

* ścisły single-channel invariant,
* jeden oficjalny kanał,
* brak fallbacków twórcy,
* brak multi-creator runtime,
* jasne mapowanie legacy `Creator` na `MainChannel`.

Status:

```txt
[x single-channel foundation]
```

R4 certyfikuje inwariant produktu.

Nie zmieniaj `Creator -> Channel` w bazie bez osobnego migration plan.

---

## R5 — Users

Cel:

* moduł Users,
* profile użytkowników,
* admin users,
* user access profile,
* aktor,
* synchronizacja z Clerk,
* bezpieczne bridge’e dla legacy,
* eksport użytkowników przez use case.

Status:

```txt
[x stronger foundation]
```

R5 ma mocny fundament.

Istnieją modularne use case’y dla kluczowych admin/user flows, w tym listowania, szczegółów, statystyk i exportu.

Pozostające ryzyka R5:

* część rozszerzeń użytkownika może nadal dotykać płatności/subskrypcji,
* nie każdy legacy bridge musi być usunięty,
* część route’ów może pozostać jawnie allowlisted do przyszłego cleanupu,
* `User.isPatron` nadal może być read-modelem, a nie docelowym źródłem prawdy.

Nie oznaczaj R5 jako pełne `[x certified]`, jeżeli guardy albo inventory nadal wskazują legacy extensions.

---

## R6 — Video

Cel:

* moduł Video,
* publiczne DTO,
* admin/public separation,
* ochrona raw media URL,
* playback access,
* bezpieczne mapowanie video data.

Status:

```txt
[x stronger foundation]
```

R6 ma mocny fundament i dodatkowy safety pass dla publicznych DTO / raw URL leak prevention.

Zasada trwała:

```txt
Żaden publiczny DTO ani publiczny route nie może przypadkowo przepuścić raw/signed/internal media URL.
```

Pozostające ryzyka R6:

* część admin video route’ów może nadal zawierać legacy extensions,
* event/view persistence może nadal wymagać dalszego cleanupu,
* R6 nie powinno być rozszerzane w kierunku dużego R10 cleanup bez osobnego planu.

---

## R6.5 — Access Foundation

Cel:

* centralne decyzje dostępu,
* dostęp do wideo,
* patron-only gating,
* ochrona przed BOLA,
* wspólny model access decisions.

Status:

```txt
[x certified]
```

R6.5 jest certyfikowane dla aktualnego zakresu access foundation.

Zasada trwała:

```txt
UI może pokazywać stan dostępu, ale nie jest źródłem prawdy dla decyzji dostępowych.
```

---

## R7 — Patron + Payments

Cel:

* moduł Patron,
* moduł Payments,
* Stripe webhook,
* payment fulfillment,
* refund/dispute handling,
* patron grants,
* atomiczne grant/revoke,
* idempotencja zdarzeń płatniczych,
* admin payments,
* payment settings.

Status:

```txt
[~ stronger foundation / certification candidate]
```

R7 core runtime został przesunięty do modułów i jest mocno zaawansowany.

Nie oznacza to jeszcze `[x certified]`.

R7 może zostać certyfikowane dopiero po:

* reconciliation pass na aktualnym main,
* sprawdzeniu guardów,
* sprawdzeniu testów dla grant/revoke/refund/dispute,
* sprawdzeniu braku rozjazdu między `User.isPatron`, `PatronGrant` i payment state,
* uczciwym opisaniu pozostałych legacy extensions.

Zasada trwała:

```txt
Płatność i dostęp patrona muszą być spójne transakcyjnie.
```

---

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
* moderation,
* access control dla patron-only videos,
* audyt operacji moderacyjnych.

Status:

```txt
[~ core comments migrated / blockers remain]
```

Co jest aktualnie interpretowane jako zrobione:

* core comment flows są w dużej części zmigrowane,
* publiczne list/create comments używają modułu,
* część update/delete/replies/reactions/report została przesunięta do modułów,
* P0 access bug przy reakcjach na patron-only content został zaadresowany w core flow,
* istnieje fundament `CommentPolicy` / `CommentRepository` / comments use cases.

Pozostające blokery R8:

* `context` route wymaga migracji albo jawnego pozostawienia jako legacy,
* `pin/unpin` route wymaga migracji albo jawnego pozostawienia jako legacy,
* `admin/comments` wymaga migracji albo jawnego pozostawienia jako legacy,
* `admin/videos/[id]/comments` wymaga migracji albo jawnego pozostawienia jako legacy,
* moderacja powinna być spójna i audytowalna,
* status R8 nie może być certified bez osobnego certification candidate pass.

Następny docelowy krok dla R8:

```txt
R8 Comments Certification Candidate Implementation Pass
```

Ten pass powinien być uruchomiony dopiero po aktualizacji README/guardów po ostatnich merge’ach.

Zakres przyszłego R8 passu powinien być minimalny i kontrolowany:

* nie mieszać R8 z R9,
* nie zaczynać R10,
* nie zaczynać R11,
* nie przepisywać całego systemu komentarzy,
* skupić się na jawnych blockerach: context, pin, admin comments, admin video comments, moderation audit.

---

## R9 — Email

Cel:

* moduł Email,
* admin broadcast,
* broadcast history,
* Resend webhook,
* inbound responses,
* templates,
* subscriber resync,
* preferences/unsubscribe,
* delivery logs,
* idempotency,
* outbox/retry,
* brak wpływu na paid access.

Status:

```txt
[~ code-only pass / pending docs+guard reconcile]
```

Co jest aktualnie interpretowane jako zrobione:

* istnieje moduł Email,
* Resend webhook jest przepięty do modularnego use case,
* inbound email management ma code-only pass,
* webhook delivery state ma dodatkowe hardening logic,
* istnieją testy bezpieczeństwa, które pilnują, żeby Email nie mutował `User.isPatron`, `PatronGrant` ani `Payment`,
* część flows działa przez publiczne API modułu.

Pozostające blokery R9:

* README/docs/guard reconcile po code-only pass,
* sprawdzenie stale allowlist w `scripts/check-architecture.ts`,
* pełne domknięcie broadcast flows,
* templates mogą pozostać legacy,
* subscriber resync może pozostać boundary między Users i Email,
* outbox/retry może wymagać osobnego schema/model pass,
* R9 nie może zostać oznaczone jako certified po samym code-only pass.

Zasada trwała:

```txt
Email nie nadaje i nie odbiera dostępu patrona.
```

Email może komunikować się z użytkownikiem, ale nie jest źródłem prawdy dla płatnego dostępu.

---

## R10 — Cleanup legacy fasad

Cel:

* usunięcie lub zamrożenie legacy fasad,
* uporządkowanie allowlist,
* usunięcie martwego kodu,
* finalne zmniejszenie `@/lib/services/**`,
* reconcile inventory z main,
* zamiana tymczasowych bridge’y na trwałe modułowe API.

Status:

```txt
[~ preparation inventory / needs reconcile with main]
```

R10 nie powinno być zaczynane jako duży cleanup, dopóki R7/R8/R9 mają znane blokery.

Dozwolone teraz:

* aktualizowanie inventory,
* oznaczanie stale allowlist,
* usuwanie oczywiście martwych wpisów w guardach po merge’ach,
* dokumentacyjny reconcile.

Niedozwolone teraz:

* masowe usuwanie legacy services,
* przepisywanie wielu domen naraz,
* rozpoczynanie dużego cleanupu przed certyfikacją R7/R8/R9,
* usuwanie bridge’y bez potwierdzenia runtime.

---

## R11 — Frontend admina / kokpit operacyjny

Cel:

* spójny panel admina,
* kokpit operacyjny właściciela,
* przegląd treści,
* przegląd patronów,
* przegląd płatności,
* moderacja,
* komunikacja e-mail,
* diagnostyka,
* audyt.

Status:

```txt
[ ]
```

R11 jeszcze nie wystartowało.

Nie zaczynaj R11, dopóki R7/R8/R9/R10 nie zostaną ustabilizowane w minimalnym zakresie.

---

## 8. Guardy architektoniczne

Guardy są częścią produktu.

Guardy mają chronić projekt przed:

* bezpośrednimi importami Prismy w nowych route’ach,
* importowaniem prywatnych wnętrzności modułów,
* mieszaniem zamkniętych modułów z legacy services,
* wystawianiem prywatnych media URL,
* regresją single-channel invariant,
* użyciem Clerk metadata jako źródła prawdy dla patronatu,
* przypadkowym powrotem logiki biznesowej do route’ów.

Jeżeli guard blokuje zmianę, agent nie ma go obchodzić.

Agent ma najpierw sprawdzić:

* czy guard wykrył realny problem,
* czy allowlista jest nadal aktualna,
* czy route rzeczywiście jest legacy,
* czy dokumentacja zgadza się z kodem.

Stale allowlist są błędem dokumentacyjnym.

---

## 9. Walidacja

Podstawowe komendy:

```bash
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
```

Pełniejsza walidacja:

```bash
npm run quality
```

Testy coverage:

```bash
npm run test:coverage
```

E2E:

```bash
npm run e2e
```

Env validation:

```bash
npm run env:validate
npm run env:validate:prod
```

Przed deployem produkcyjnym:

```bash
npm run db:migrate:deploy
npm run db:generate
npm run db:smoke
npm run emails:ensure-required
npm run build
```

Jeżeli walidacja nie została uruchomiona, raport musi zawierać:

```txt
NOT RUN — reason: ...
```

Nie wolno pisać, że coś przeszło, jeżeli nie zostało uruchomione.

---

## 10. Standard raportu po pracy

Każdy istotny pass powinien zakończyć się raportem:

```md
# Work Report

## Cel
Co miało zostać zrobione.

## Zakres
Jakie domeny i pliki zostały dotknięte.

## Zmiany
Co faktycznie zmieniono.

## Decyzje
Jakie decyzje domenowe albo techniczne podjęto.

## Guardy
Czy guardy były aktualizowane.
Czy usunięto stale allowlist.
Czy dodano nowe allowlist i dlaczego.

## Ryzyka
Co może wymagać dalszej obserwacji.

## Walidacja
- npm run quality:architecture-boundaries:
- npm run typecheck:
- npm test -- --run:

## Następny bezpieczny krok
Jedna konkretna rekomendacja.
```

---

## 11. Zasady dokumentacji

README nie jest miejscem na marketing.

README ma być narzędziem operacyjnym.

Zasady:

* opisuj stan ostrożnie,
* nie podbijaj statusu po samym code-only pass,
* nie usuwaj blokerów bez sprawdzenia kodu,
* nie zakładaj, że guardy są aktualne,
* nie zakładaj, że docs/audit są aktualne,
* nie opieraj się na nazwie PR-a,
* source of truth to aktualny `main` + testy + guardy + README po reconcile.

Jeżeli dokumentacja i kod się różnią:

```txt
Najpierw reconcile, potem implementacja.
```

---

## 12. Zasady dla obecnego momentu projektu

Aktualnie projekt jest w profesjonalnym, kontrolowanym przejściu z mocnego modularnego fundamentu do certyfikacji kolejnych domen.

Nie należy przyspieszać przez mieszanie zadań.

Najbliższa poprawna kolejność:

```txt
1. Post-merge docs/guard reconcile po R5/R6/R9 passach.
2. R8 Comments Certification Candidate Implementation Pass.
3. R9 docs/guard/certification follow-up, jeśli po reconcile nadal wymagany.
4. R7 final certification reconcile.
5. Dopiero później ograniczony R10 cleanup.
6. R11 dopiero po stabilizacji R7/R8/R9/R10.
```

Nie zmieniaj tej kolejności bez bardzo dobrego powodu.

---

## 13. Minimalny następny prompt

```txt
Pracujesz w repozytorium Polutek.pl.

Wykonaj post-merge docs/guard reconcile po ostatnich passach R5/R6/R9.

Cel:
README, scripts/check-architecture.ts i docs/audit mają mówić prawdę o aktualnym main.

Zakres:
- Sprawdź aktualny main.
- Sprawdź README.md.
- Sprawdź scripts/check-architecture.ts.
- Sprawdź docs/audit, jeśli zawierają inventory dla R5/R6/R8/R9/R10.
- Usuń stale allowlisty dla route’ów, które nie importują już Prismy ani legacy services.
- Nie zmieniaj runtime, chyba że jest to absolutnie minimalna korekta wymagana przez guard.
- Nie oznaczaj R7/R8/R9 jako certified.
- Nie zaczynaj R8 implementation pass.
- Nie zaczynaj R10.
- Nie zaczynaj R11.

Szczególnie sprawdź:
- app/api/admin/users/export/route.ts
- app/api/admin/emails/responses/route.ts
- app/api/comments/[commentId]/context/route.ts
- app/api/comments/[commentId]/pin/route.ts
- app/api/admin/comments/route.ts
- app/api/admin/videos/[id]/comments/route.ts

Na końcu uruchom:
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run

Raport:
- Co było stale w README.
- Co było stale w guardach.
- Co zostało zmienione.
- Co pozostaje blockerem R8.
- Co pozostaje blockerem R9.
- Czy można bezpiecznie przejść do R8 Comments Certification Candidate Implementation Pass.
```

---

## 14. Inwarianty, których nie wolno złamać

```txt
Polutek.pl ma jeden oficjalny kanał.
Polutek.pl ma jednego właściciela / twórcę.
Polutek.pl nie jest marketplace’em.
Polutek.pl nie jest SaaS-em dla wielu twórców.
Dostęp patrona pochodzi z bazy danych.
Clerk nie jest źródłem prawdy dla patronatu.
Email nie nadaje dostępu płatnego.
Route’y nie zawierają logiki biznesowej.
Moduły wystawiają publiczne API przez index.ts.
Prywatne media nie są wystawiane jako surowe URL-e.
Każda istotna operacja administracyjna powinna być audytowalna.
Guardy mają chronić architekturę, nie udawać zielonego stanu.
```

---

## 15. Filozofia kodu

Kod Polutek.pl ma być prosty, jawny i trudny do przypadkowego zepsucia.

Preferowane są:

* krótkie route’y,
* czytelne use case’y,
* jednoznaczne policy,
* małe repository,
* bezpieczne DTO,
* jawne błędy,
* małe testy,
* silne guardy,
* minimalne zależności,
* brak magicznych wyjątków,
* brak przypadkowego mieszania domen.

Nie chodzi o maksymalną abstrakcję.

Chodzi o system, w którym:

```txt
każda linijka ma powód,
każda domena ma granice,
każdy wyjątek jest nazwany,
każda decyzja jest sprawdzalna,
a README mówi prawdę.
```
