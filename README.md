# Polutek.pl

## 1. Tryb produktu

Polutek.pl to ścisły, jednokanałowy hub twórcy.

Inwarianty produktu:

* Jeden oficjalny kanał.
* Jeden twórca.
* Jeden katalog treści.
* Jeden system patronów/dostępu.
* Jedna społeczność.
* Jedna prywatna platforma mediowa dla właściciela/twórcy.

To NIE jest:

* marketplace dla wielu twórców,
* platforma do onboardingu twórców,
* mini-Patreon dla wielu twórców,
* publiczna, wielokanałowa sieć społecznościowa.

Ważne mapowanie modeli:

* `Creator` w bazie danych to legacy techniczna reprezentacja `MainChannel`.
* Nie zmieniaj nazwy `Creator -> Channel` w Prisemie, dopóki modułowy monolit nie będzie stabilny i przetestowany.
* `Subscription != Patron`.
* Subskrypcja/obserwowanie oznacza zainteresowanie e-mailami/newsletterem/powiadomieniami.
* Dostęp patrona jest kontrolowany przez stan bazy danych, w szczególności `User.isPatron` i przyszłe moduły patronów/płatności.
* Metadane Clerk to warstwa cache/sync, a nie źródło prawdy dla dostępu.

---

## 2. Aktualny refaktor

Aktywny refaktor to praktyczna migracja w kierunku Modułowego Monolitu.

Docelowy przepływ:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Route'y powinny być cienkie.

Use case'y powinny posiadać logikę biznesową.

Policy powinny posiadać reguły biznesowe.

Repozytoria powinny posiadać dostęp do bazy danych.

DTO powinny chronić kontrakty API/UI przed surowymi modelami Prisma.

Moduły muszą wystawiać publiczne API przez `index.ts`.

`README.md` jest aktywnym źródłem prawdy o aktualnym stanie refaktoryzacji, roadmapie, zasadach, znanych blokerach i kolejnych zadaniach.

---

## 3. Słownik statusów

Znaczenie statusów:

```txt
[ ]              nie rozpoczęto
[~]              częściowe / w toku / pozostają znane blokery
[x foundation]   fundament certyfikowany, ale pełne usunięcie legacy jest celowo odroczone
[x safety foundation] certyfikowana warstwa bezpieczeństwa, ale migracja dostarczania/runtime może pozostać
[x single-channel foundation] ścisły inwariant jednokanałowy certyfikowany, ale adaptery kompatybilności mogą pozostać
[x]              certyfikowane jako ukończone dla obecnego zakresu roadmapy
[!]              zablokowane / regresja / nie kontynuuj
```

Ważna zasada:

```txt
Uznane za gotowe != certyfikowane jako gotowe
```

Faza może zostać oznaczona jako certyfikowana tylko wtedy, gdy kod, testy, guardy, prawda w README i znane blokery są spójne.

Faza może być certyfikowana jako fundament (foundation) bez udawania, że wszystkie ścieżki legacy w runtime zostały usunięte.

---

## 4. Aktualny status

| Faza    | Opis                                            | Status                        |
| :------ | :---------------------------------------------- | :---------------------------- |
| **R0**  | Zasady, infrastruktura, projektowe bariery      | [x]                           |
| **R1**  | Shared, granica API, błędy, Actor, AppContext   | [x]                           |
| **R2**  | Moduł Audit                                     | [x foundation]                |
| **R3**  | Moduł Media                                     | [x safety foundation]         |
| **R4**  | Moduł Channel / ścisły jednokanałowy            | [x single-channel foundation] |
| **R5**  | Moduł Users                                     | [~ stronger]                  |
| **R6**  | Moduł Video                                     | [~ stronger]                  |
| **R6.5**| Access Foundation                               | [x video foundation]         |
| **R7**  | Moduły Patron + Payments                        | [ ]                           |
| **R8**  | Moduł Comments                                  | [ ]                           |
| **R9**  | Moduł Email                                     | [~ near-certification]        |
| **R10** | Czyszczenie przestarzałych fasad                | [ ]                           |
| **R11** | Frontend admina / kokpit operacyjny             | [ ]                           |

Aktualna interpretacja projektu:

* R0/R1 są certyfikowane jako obecny fundament.
* R2/R3/R4 są certyfikowane jako fundamenty, a nie pełne usunięcie wszystkich zależności legacy.
* R5/R6 to aktywne migracje częściowe i muszą zostać domknięte przed R7.
* R7 nie może się rozpocząć, dopóki blokery R5/R6 nie zostaną przejrzane i naprawione lub jawnie zaakceptowane.

---

## 5. Bieżące zadanie

```txt
R5/R6/R6.5 readiness review before R7 Patron + Payments architecture audit.
```

Nie zaczynaj jeszcze R7 Patron + Payments.

R7 może wystartować dopiero po:

* przejrzeniu blokerów R5 Users (admin users core identity is modular, extensions remain legacy),
* przejrzeniu blokerów R6 Video (delivery/playback),
* certyfikacji granicy dostarczania mediów (playback),
* uzgodnieniu README i architecture guard co do tego, co pozostaje legacy.

---

## 6. Obowiązkowe zasady agenta

Wszyscy agenci muszą przestrzegać tych zasad:

* Nie przenoś tylko plików.
* Nie twórz folderów nazywając fazę ukończoną.
* Nie oznaczaj `[x]` bez testów i walidacji.
* Nie aktualizuj README na bardziej optymistyczne niż rzeczywistość w kodzie.
* Nie zaczynaj nowych faz roadmapy, gdy pozostają znane blokery w obecnej fazie.
* Nie importuj wnętrzności modułów z route'ów.
* Nie mieszaj zamkniętych modułów z bezpośrednią Prismą/serwisami w tym samym route, chyba że jest to jawnie dozwolone (allowlisted) z fazą/komentarzem.
* Nigdy nie wystawiaj surowego `videoUrl` do publicznego UI/API.
* Nie traktuj metadanych Clerk jako źródła prawdy dla dostępu patrona.
* Nie wprowadzaj ponownie fallbacków twórcy, takich jak `polutek` lub `demo-creator`.
* Nie uruchamiaj konserwacji/naprawy (maintenance/repair) z normalnego runtime'u.
* Nie zaczynaj Fazy X jako osobnej roadmapy przed ukończeniem R0–R11.

Kluczowe doprecyzowanie:

Faza X nie może wystartować jako samodzielna roadmapa przed ukończeniem R0–R11.

Jednakże, R7–R11 muszą zawierać minimalne elementy Fazy X, które naturalnie należą do danej domeny. Zapobiega to sytuacji, w której Faza X stałaby się drugim masowym refaktorem.

---

## 7. Roadmapa R0–R11

### R0 — Zasady i infrastruktura

Cel:

* zasady projektu,
* skrypty walidacyjne,
* bariery architektoniczne (guards),
* README jako źródło prawdy.

Status:

```txt
[x]
```

Certyfikowane po przejściu certyfikacji R0/R1.

---

### R1 — Shared, granica API, błędy, ctx

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

Certyfikowany fundament.

Dalsze szlify mogą nastąpić później, ale R1 jest wystarczająco dobre jako baza dla dalszych prac domenowych.

---

### R2 — Audit

Cel:

* współdzielony moduł audytu,
* zdarzenia audytu oparte na aktorze,
* logowanie audytu świadome transakcji,
* użycie przez zmigrowane moduły.

Status:

```txt
[x foundation]
```

Certyfikowane jako fundament.

Oznacza to:

* `lib/modules/audit/**` istnieje,
* publiczne API przechodzi przez `lib/modules/audit/index.ts`,
* zmigrowane akcje kanału/wideo/użytkowników mogą używać audytu,
* audyt używa `AppContext` / `Actor`,
* wsparcie dla transakcji istnieje tam, gdzie jest potrzebne.

Nie oznacza jeszcze:

* każda akcja legacy w komentarzach/płatnościach/e-mailach/szczegółach admina jest w pełni zmigrowana do modułu audytu.

Pozostałe pokrycie audytem dla komentarzy/płatności/e-mailu/szczegółów admina należy do ich przejść domenowych.

---

### R3 — Media

Cel:

* bezpieczeństwo mediów,
* allowlisty URL,
* blokowanie prywatnych hostów,
* walidacja miniatur/wideo/awatarów/obrazków w komentarzach,
* wykrywanie źródeł HLS/DASH/bezpośrednich,
* gwarancje braku wycieku danych w publicznych DTO.

Status:

```txt
[x safety foundation]
```

Certyfikowane jako fundament bezpieczeństwa mediów.

Oznacza to:

* warstwa bezpieczeństwa MediaPolicy istnieje,
* bezpieczeństwo URL i blokowanie prywatnych hostów są przetestowane,
* publiczne DTO wideo nie wystawia surowego `videoUrl`,
* wykrywanie HLS/DASH istnieje jako klasyfikacja.

Nie oznacza jeszcze:

* pełna migracja dostarczania mediów/proxy jest ukończona,
* przepisywanie manifestów istnieje,
* proxy segmentów istnieje,
* `app/api/media/**`, `app/api/media-source/**` oraz `lib/blob.ts` są w pełni zmodularyzowane.

Ważne zastrzeżenie dot. HLS/DASH:

```txt
Wykrywanie HLS/DASH istnieje wyłącznie do celów walidacji/klasyfikacji.
Nie oznacza to, że przepisywanie manifestów lub dostarczanie przez proxy segmentów jest zaimplementowane.
```

Pełne dostarczanie mediów należy do przyszłego dedykowanego przejścia R3/R6 delivery.

---

### R4 — Channel (Kanał)

Cel:

* ścisły inwariant jednokanałowy,
* `MainChannel`,
* `MAIN_CREATOR_SLUG` jako źródło prawdy,
* jawna konserwacja (maintenance),
* ustawienia kanału admina,
* brak auto-naprawy w runtime.

Status:

```txt
[x single-channel foundation]
```

Certyfikowane jako fundament jednokanałowy.

Oznacza to:

* moduł kanału istnieje,
* ścisły inwariant jednokanałowy jest udokumentowany i przetestowany,
* nie powinien istnieć żaden fallback/zgadywanie w runtime,
* podgląd/zastosowanie konserwacji jest jawne, potwierdzone i audytowalne,
* `/api/admin/channel` używa modułu kanału,
* `/api/admin/creator` to zachowanie przestarzałe/wrapper, a nie równoległe źródło prawdy.

Nie oznacza jeszcze:

* każdy import legacy `@/lib/channel/main-channel.service` został usunięty.

Znane użycie adapterów kompatybilności pozostaje i jest śledzone do czyszczenia w R5/R6/R7/R10.

---

### R5 — Users (Użytkownicy)

Cel:

* lokalny użytkownik,
* synchronizacja Clerk,
* profil,
* język,
* soft delete (miękkie usuwanie),
* profil dostępu użytkownika,
* fundament łączenia użytkowników,
* użytkownicy admina,
* granica użytkownik/dostęp.

Status:

```txt
[~]
```

Znane pozostałe prace:

* użytkownicy admina nie są w pełni zmigrowani,
* ukończenie webhooka Clerk pozostaje,
* granica synchronizacji użytkownik-dostęp pozostaje,
* granica patron/płatności musi pozostać wyraźnie oddzielona,
* serwisy użytkownika legacy mogą nadal istnieć,
* guard musi utrzymywać zmigrowane route'y użytkowników w czystości.

R5 nie jest ukończone dopóki:

* route'y profilu/synchronizacji/języka są zmigrowane,
* webhook Clerk importuje tylko publiczne API modułu,
* użytkownicy admina (core lookup) są zmigrowani,
* `User.isPatron` w bazie jako źródło prawdy jest chronione testami i nie jest nadpisywane przez identity sync,
* metadane Clerk pozostają tylko cache'em.

---

### R6 — Video (Wideo)

Cel:

* CRUD wideo admina,
* reorder (zmiana kolejności),
* archiwizacja,
* lista publiczna,
* hero (wideo promowane),
* predykaty widoczności,
* bezpieczeństwo DTO,
* zasięg main-channel (main-channel scoping),
* granica dostępu do wideo.

Status:

```txt
[~ stronger]
```

Już poprawione:

* moduł video istnieje,
* fundament admin CRUD/reorder istnieje,
* `PublicVideoDto` nie wystawia surowego `videoUrl`,
* `AdminVideoDto` może zawierać `videoUrl`,
* predykaty listy publicznej/hero zostały zbliżone do reguł widoczności legacy,
* core lookup wideo admina jest main-channel scoped przez use case,
* resync statystyk jest main-channel scoped przez use case,
* route dostępu (`/api/access`) używa modułowego use case'a,
* baza danych `User.isPatron` jest źródłem prawdy dla dostępu patrona.

Znane pozostałe prace:

* migracja frontendu publicznego do DTO modułu pozostaje zadaniem na przyszłość,
* publiczne DTO jest bezpieczne, ale publiczny route dostarczania mediów/playbacku wciąż wymaga dedykowanego domknięcia,
* dostarczanie mediów/proxy/media-source nie są w pełni zmodularyzowane,
* wszystkie zmigrowane route'y wideo muszą być chronione przez guard.

R6 nie jest ukończone dopóki:

* szczegóły admina (diagnostyka/audyt) nie zostaną w pełni zmigrowane lub jawnie zaakceptowane jako rozszerzenie legacy,
* publiczne UI nigdy nie otrzymuje surowego `videoUrl`,
* README i guard zgadzają się co do pozostałego legacy.

---

### R6.5 — Access Foundation (Fundament Dostępu)

Cel:
* `access` jest centralnym modułem decyzji: allow/deny/reason,
* obecnie certyfikowany scope to video access,
* `/api/access` używa modułu access,
* DB `User.isPatron` jest źródłem prawdy (source of truth),
* metadane Clerk są tylko cache'em,
* admin bypass działa tylko w obrębie głównego kanału (main channel),
* treści spoza głównego kanału (off-channel) są traktowane jako `NOT_FOUND`,
* playback/media-source nadal mogą używać legacy `AccessPolicy` i są pozostałymi blokerami dostarczania R6/R3.

Status:
```txt
[x video foundation]
```

Certyfikowany fundament dostępu dla wideo.

---

### R7 — Patron + Payments (Patroni i Płatności)

#### R7 readiness notes

R7 may start only after a readiness audit confirms:
- Users source-of-truth is clear.
- Access decisions use lib/modules/access.
- DB User.isPatron remains the current source of truth until Patron module introduces a grant model.
- Checkout never accepts client creatorId.
- Stripe webhook idempotency strategy is defined.
- Refund/revoke updates DB source-of-truth and audit.
- Clerk metadata sync happens after DB commit and remains cache only.
- Legacy patron/payment services are mapped before migration.

Cel:

* dostęp patrona,
* Stripe checkout,
* Stripe webhook,
* realizacja płatności,
* zwrot/cofnięcie (refund/revoke),
* uprawnienia patrona (patron grants),
* idempotencja,
* audyt,
* baza danych jako źródło prawdy.

Status:

```txt
[ ]
```

Nie zaczynaj R7, dopóki blokery R5/R6 nie zostaną przejrzane.

R7 musi od początku zawierać minimalne elementy Fazy X:

* idempotencja,
* ochrona przed duplikatem webhooka,
* audyt,
* testy scenariuszowe dla refund/revoke,
* testy źródła prawdy (source-of-truth),
* dyscyplina efektów ubocznych po zatwierdzeniu transakcji (post-commit),
* brak metadanych Clerk jako źródła prawdy,
* checkout nie może akceptować `creatorId` od klienta.

Oczekuje się, że R7 będzie jedną z najbardziej krytycznych faz.

Blokery gotowości R7:
- obecne przepływy patron/payment to serwisy legacy,
- idempotencja webhooków Stripe musi zostać certyfikowana,
- checkout nie może akceptować `creatorId` od klienta,
- refund/revoke musi aktualizować DB `User.isPatron` jako źródło prawdy,
- synchronizacja metadanych Clerk musi być post-commit i służyć wyłącznie jako cache,
- decyzje o dostępie muszą używać `lib/modules/access`, a nie bezpośrednio płatności/patrona.

---

### R8 — Comments (Komentarze)

Cel:

* listowanie komentarzy,
* twórz/aktualizuj/usuń,
* reakcje,
* zgłoszenia,
* moderacja,
* przypinanie/serduszkowanie (pin/heart),
* polityka dostępu,
* audyt moderacji.

Status:

```txt
[ ]
```

R8 musi zawierać minimalne elementy Fazy X:

* sprawdzenia dostępu,
* powody odmowy dostępu tam, gdzie to praktyczne,
* audyt moderacji,
* testy scenariuszowe dla treści patronów/publicznych,
* przepływy zgłoszeń/moderacji.

Nie migruj komentarzy przed stabilizacją granic dostępu/użytkownika/wideo.

---

### R9 — Email

Cel:

* integracja z Resend,
* broadcast (rozsyłanie),
* semantyka kolejek/paczek,
* webhooki e-mail,
* e-maile przychodzące, jeśli potrzebne,
* powiadomienia.

Status:

```txt
[~ near-certification]
```

R9 Email jest na poziomie ~78–84%. Posiada utwardzony fundament, czyste granice i testy kontraktowe. Zidentyfikowano ścieżki migracji dla idempotencji i outboxa.

R9 musi zawierać minimalne elementy Fazy X:

* idempotentna obsługa webhooków (obecnie: best-effort, patrz `docs/audit/R9-Email-Idempotency-Decision.md`),
* semantyka ponowień/statusów (plan: `docs/audit/R9-Outbox-Retry-Plan.md`),
* audyt broadcastów,
* podstawowe notatki operacyjne (runbook),
* brak admin broadcast typu "fire-and-forget" jako docelowy projekt.

### Blokery R9 Email

* **Broadcast route**: Zmigrowany (POST/GET).
* **Resend webhook**: Zmigrowany. Działa best-effort idempotency.
* **Webhook idempotency**: Best-effort. Durable wymaga unikalnego pola (rekomendacja: `providerEventId`).
* **Delivery aggregate counts**: Zabezpieczone przed duplikatami i terminal-state overwrite.
* **Inbound Responses**: Zmigrowany. `/api/admin/emails/responses` używa use case'ów.
* **Email preferences/unsubscribe**: Policy istnieje i jest egzekwowana.
* **Outbox/retry**: Zaplanowano (Future R9/R10), obecnie fire-and-forget.
* **EmailService legacy bridge**: Nadal używany jako adapter.
* **Admin templates/subscriber resync**: Pozostają legacy (Future R9/R10).

---

### R10 — Czyszczenie przestarzałych fasad

Cel:

* usunięcie przestarzałych fasad kompatybilności,
* wzmocnienie bramek jakości (quality gates),
* blokowanie nowych importów z serwisów legacy,
* usunięcie przestarzałych adapterów po przetestowaniu przepływów zastępczych.

Status:

```txt
[ ]
```

Nie zaczynaj R10 zbyt wcześnie.

R10 następuje po istnieniu przepływów zastępczych.

---

### R11 — Frontend admina / kokpit operacyjny

Cel:

* UI zarządzania dla admina,
* zarządzanie treścią,
* zdrowie systemu,
* widoczność operacyjna,
* gotowość do wydania (release readiness).

Status:

```txt
[ ]
```

R11 powinno zawierać praktyczne elementy kokpitu mini-X:

* ostatni audyt,
* nieudane webhooki,
* status płatności/patronów,
* zdrowie mediów,
* status broadcastów,
* panel konserwacji,
* checklistę gotowości wydania.

Nie buduj gigantycznej architektury kokpitu przed istnieniem podstawowych domen.

---

## 8. Zasady architektury

### 8.1 Cienkie route'y

Handlery route'ów powinny:

* uwierzytelniać,
* parsować wejście,
* tworzyć kontekst,
* wywoływać use case,
* mapować wynik na odpowiedź HTTP.

Handlery route'ów nie powinny zawierać:

* bezpośredniej logiki biznesowej,
* bezpośredniego `prisma.*`,
* bezpośredniego `prisma.$transaction`,
* bezpośredniej logiki polityki dostępu,
* bezpośredniej logiki biznesowej Stripe/Clerk/Resend,
* surowych wywołań repozytorium,
* dużych mapowań DTO.

Wyjątki legacy muszą być jawnie dozwolone (allowlisted) i udokumentowane.

---

### 8.2 Use case'y

Każdy use case powinien przyjmować:

```txt
input + AppContext
```

Przykładowy kształt:

```ts
export async function updateSomething(
  input: UpdateSomethingInput,
  ctx: AppContext
): Promise<UseCaseResult<Dto, ErrorType>> {
  ...
}
```

Use case'y posiadają:

* przepływ biznesowy,
* przewidywalne błędy domenowe,
* granicę transakcji tam, gdzie jest potrzebna,
* wywołania audytu,
* egzekwowanie polityk.

---

### 8.3 Actor

Używaj `Actor` wszędzie zamiast luźnych `userId`, `role`, `currentUser`, `admin` lub obiektów sesji.

Warianty aktora:

```txt
guest
user
admin
system
```

Ważne:

* `actor.isPatron` z sesji Clerk to tylko cache.
* Decyzje paywall/dostęp muszą weryfikować stan bazy danych przez moduły Users/Patron.

---

### 8.4 AppContext

`AppContext` nie może wystawiać przestarzałych pól skrótowych, takich jak:

```txt
ctx.userId
ctx.role
```

Używaj:

```txt
ctx.actor
```

---

### 8.5 Result Pattern i błędy

Przewidywalne awarie domenowe powinny używać:

```txt
UseCaseResult
AppError
typowane błędy domenowe
```

Nie używaj zwykłego `throw new Error(string)` dla normalnych awarii domenowych, takich jak:

* nie znaleziono (not found),
* zabronione (forbidden),
* użytkownik usunięty,
* nie jest patronem,
* wideo nie należy do głównego kanału,
* duplikacja webhooka,
* nieprawidłowe potwierdzenie konserwacji.

Nieoczekiwane błędy infrastrukturalne/programistyczne mogą wciąż rzucać wyjątki.

---

### 8.6 Publiczne API modułu

Kod zewnętrzny powinien importować moduły przez korzeń `index.ts`.

Dozwolone:

```ts
import { getUserProfile } from '@/lib/modules/users';
```

Zabronione z route'ów:

```ts
import { GetUserProfileUseCase } from '@/lib/modules/users/application/get-user-profile.use-case';
```

Route'y nie mogą importować wnętrzności modułów.

---

### 8.7 Brak HTTP/Next w modułach

Pliki w `lib/modules/**` nie mogą importować:

* `next/server`,
* `next/navigation`,
* `next/cache`,
* `NextResponse`,
* `app/**`,
* handlerów route'ów.

HTTP należy do `app/**` i `lib/api/**`.

Logika domenowa należy do `lib/modules/**`.

---

### 8.8 ReadDb / WriteTx

Metody repozytoriów powinny używać jawnych typów DB:

```txt
ReadDb = PrismaClient | Prisma.TransactionClient
WriteTx = Prisma.TransactionClient
```

Zasady:

* metody odczytu mogą przyjmować `ReadDb`,
* krytyczne zapisy powinny preferować `WriteTx`,
* use case'y posiadają granice transakcji,
* repozytoria nie powinny ukrywać wieloetapowych transakcji biznesowych.

---

### 8.9 Zewnętrzne efekty uboczne

Nie wywołuj ślepo zewnętrznych efektów ubocznych wewnątrz transakcji DB.

Zewnętrzne efekty uboczne to:

* Clerk,
* Stripe,
* Resend,
* storage,
* webhooki.

Preferowany wzorzec:

```txt
1. Transakcja DB zapisuje źródło prawdy
2. Transakcja DB zapisuje audyt
3. Transakcja DB zapisuje outbox lub zwraca pracę post-commit
4. Efekt uboczny następuje po zatwierdzeniu (commit) lub przez ponawialnego workera
```

---

## 9. Ścisły inwariant jednokanałowy

Runtime nie może:

* tworzyć twórców,
* zmieniać nazw twórców,
* auto-zatwierdzać twórców,
* auto-ustawiać `isPrimary`,
* degradować innych twórców,
* zgadywać fallback twórcy,
* używać zahardkodowanych slugów fallback,
* uruchamiać konserwacji z normalnego ładowania strony/route'a API,
* przypisywać własności treści poza jawną konserwacją.

Ważne inwarianty:

* `MAIN_CREATOR_SLUG` jest źródłem prawdy.
* Publiczna treść musi należeć do `mainChannel.id`.
* Checkout nie może akceptować `creatorId` od klienta.
* `Subscription != Patron`.
* Konserwacja musi być jawna, z możliwością podglądu, potwierdzona i audytowalna.
* `Creator` pozostaje techniczną reprezentacją legacy `MainChannel`.

---

## 10. Odpowiedzialności domenowe

### shared

Posiada:

* `Actor`,
* `AppContext`,
* `UseCaseResult`,
* `AppError`,
* `ReadDb`,
* `WriteTx`,
* współdzielone helpery.

Nie może posiadać logiki biznesowej konkretnych domen.

---

### api

Posiada:

* granicę HTTP,
* helpery uwierzytelniania,
* parsowanie JSON,
* mapowanie błędów Zod,
* mapowanie wyników use-case na odpowiedzi HTTP.

Może importować Next.js.

Moduły nie mogą.

---

### audit

Posiada:

* zapisywanie zdarzeń audytu,
* audyt świadomy aktora,
* wsparcie dla audytu świadomego transakcji.

Aktualny status:

```txt
fundament certyfikowany dla zmigrowanych modułów
```

Pokrycie audytem legacy pozostaje dla późniejszych przejść domenowych.

---

### media

Posiada:

* bezpieczną walidację URL mediów,
* walidację URL miniatur,
* walidację URL awatarów,
* walidację URL obrazków w komentarzach,
* blokowanie wewnętrznych/prywatnych hostów,
* klasyfikację HLS/DASH/direct.

Aktualny status:

```txt
fundament bezpieczeństwa certyfikowany
```

Migracja dostarczania/proxy pozostaje pracą na przyszłość.

---

### channel

Posiada:

* dostęp do głównego kanału,
* ścisły inwariant jednokanałowy,
* ustawienia kanału admina,
* podgląd/zastosowanie konserwacji,
* politykę kanału/błędy.

Aktualny status:

```txt
fundament jednokanałowy certyfikowany
```

Przestarzały adapter kompatybilności pozostaje do czasu czyszczenia w R5/R6/R7/R10.

---

### users

Posiada:

* lokalnego użytkownika,
* synchronizację Clerk,
* profil,
* język,
* profil dostępu,
* miękkie usuwanie,
* fundament łączenia użytkowników.

Aktualny status:

```txt
częściowy
```

Pozostało: użytkownicy admina, ukończenie webhooka, granica synchronizacji użytkownik-dostęp.

---

### video

Posiada:

* CRUD wideo admina,
* archiwizację,
* reorder,
* listę publiczną,
* hero,
* DTO,
* politykę wideo,
* zasięg main-channel.

Aktualny status:

```txt
częściowy (wzmocniony)
```

Pozostało: migracja frontendu publicznego, granica playbacku/delivery.

---

### access (dostęp)

Posiada:

* centralne decyzje o dostępie dla wideo, komentarzy, media-source, playbacku, podglądu admina oraz przyszłe powody dostępu.
* granice dostępu do treści,
* reguły widoczności (publiczne/zalogowany/patron),
* obejście admina,
* powody odmowy dostępu.

Aktualny status:

```txt
fundament certyfikowany dla wideo
```

Certyfikowany zasięg: dostęp do wideo. Używany przez `/api/access`. Dostarczanie mediów (playback) wciąż używa polityki legacy.

---

### patron

Posiada:

* dostęp patrona,
* uprawnienia patrona,
* przyznawanie/cofanie/wyliczanie,
* stan dostępu jako źródło prawdy.

Aktualny status:

```txt
nie rozpoczęto
```

---

### payments

Posiada:

* Stripe checkout,
* Stripe webhook,
* realizację płatności,
* obsługę zwrotów/sporów,
* idempotencję,
* łączenie płatności z uprawnieniami patrona.

Aktualny status:

```txt
nie rozpoczęto
```

---

### comments

Posiada:

* komentarze,
* moderację,
* zgłoszenia,
* reakcje,
* politykę dostępu,
* audyt moderacji.

Aktualny status:

```txt
nie rozpoczęto
```

---

### email

Posiada:

* wysyłanie e-maili,
* broadcasty,
* webhooki Resend,
* semantykę ponowień/statusów,
* zadania powiadomień.

Aktualny status:

```txt
nie rozpoczęto
```

---

## 11. Faza X i jej relacja do R0–R11

Faza X to długofalowa roadmapa doskonałości.

Faza X nie może zostać rozpoczęta jako samodzielna roadmapa przed ukończeniem R0–R11.

Jednakże:

```txt
Każda krytyczna faza R musi zawierać minimalne elementy Fazy X, które naturalnie należą do tej domeny.
```

To jest strategia, która zapobiega temu, by Faza X stała się drugim masowym refaktorem.

---

### 11.1 Masterplan Fazy X

* **X1**: Macierz Dostępu — centralna macierz uprawnień.
* **X2**: Powody aktora — jawne powody odmowy dostępu.
* **X3**: Outbox — efekty uboczne po zatwierdzeniu transakcji.
* **X4**: Idempotencja — ochrona przed duplikatami zdarzeń.
* **X5**: Obserwowalność — strukturalne logi, zdarzenia domenowe, metryki.
* **X6**: Bramki jakości — automatyczne egzekwowanie architektury.
* **X7**: Testy scenariuszowe — testy w języku produktu.
* **X8**: Kokpit admina — operacyjne centrum kontroli.
* **X9**: Runbooki — instrukcje operacyjne.
* **X10**: Gotowość wydania — dowody wydania i checklista.
* **X11**: Porządki semantyczne — końcowe czyszczenie nazw w schemacie.

---

### 11.2 Wbudowane elementy X w fazy R

| Faza R                   | Minimalne elementy X do zawarcia                                                                                                                                       |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R7 Patron + Payments** | idempotencja, audyt, testy duplikatów webhooków, testy scenariuszowe refund/revoke, sprawdzenia źródła prawdy w DB, dyscyplina efektów ubocznych post-commit           |
| **R8 Comments**          | polityka dostępu, powody odmowy dostępu tam, gdzie praktyczne, audyt moderacji, testy scenariuszowe zgłoszeń/moderacji                                                 |
| **R9 Email**             | idempotentna obsługa webhooków, semantyka ponowień/statusów, audyt broadcastów, podstawowe notatki operacyjne (runbook)                                                |
| **R10 Czyszczenie**      | silniejsze bramki jakości, guardy importów przestarzałych, dostosowanie checklisty gotowości wydania                                                                   |
| **R11 Frontend admina**  | ostatni audyt, nieudane webhooki/zadania, zdrowie mediów, status płatności/patronów, status broadcastów, powierzchnia gotowości wydania                                |

Nie buduj X1–X11 jako samodzielnych modułów przedwcześnie.

Każda faza R powinna zostawiać po sobie haki (hooks), testy, dokumentację i guardy potrzebne do tego, by Faza X stała się szlifem i operacyjnym utwardzeniem, a nie drugim refaktorem.

---

## 12. Bramki jakości (Quality gates)

Komendy walidacyjne:

```bash
npx prisma validate
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
npm test -- --run --coverage
npm run lint
npm run build
```

Jeśli komenda nie może zostać uruchomiona z powodu braku środowiska, zależności, bazy danych, Clerk, Stripe lub ograniczeń piaskownicy, agent musi to jawnie zaznaczyć.

Nie pisz PASS, jeśli komenda nie została uruchomiona.

Architecture guard powinien raportować:

* route'y importujące `@/lib/prisma`,
* route'y importujące `@/lib/services`,
* route'y importujące wewnętrzne ścieżki modułów,
* pliki importujące przestarzały adapter kanału,
* dozwolone (allowlisted) znane blokery z fazą/powodem.

Obecny guard może używać allowlist, dopóki R5–R11 są niekompletne.

Allowlisty muszą być jawne i uzasadnione.

---

## 13. Definicja ukończenia (DoD) dla wycinka refaktora

Wycinek refaktora jest ukończony tylko wtedy, gdy:

1. Wybrano konkretny route/przepływ.
2. Sprawdzono obecne zachowanie/kontrakt.
3. Use case obsługuje realny obecny przepływ, a nie tylko przyszłą abstrakcję.
4. Route importuje publiczne API modułu przez `index.ts`.
5. Route nie importuje `@/lib/prisma`, chyba że jest wciąż jawnie legacy/allowlisted.
6. Route nie importuje `@/lib/services/**`, chyba że jest wciąż jawnie legacy/allowlisted.
7. Route nie importuje wewnętrznych plików modułu.
8. DTO jest minimalne i bezpieczne.
9. Źródło prawdy/reguła biznesowa jest przetestowana.
10. Architecture guard chroni zmigrowany route.
11. Status w README zmienia się dopiero po realnej integracji w runtime.
12. Znane blokery są udokumentowane, a nie ukryte.
13. Uruchomiono walidację lub jawnie wyjaśniono brak możliwości jej uruchomienia.

Dodanie use case'a to za mało.

Utworzenie folderu modułu to za mało.

Route nie jest zmigrowany, dopóki przepływ w runtime nie używa modułu, a testy/guardy go nie chronią.

---

## 14. Znane bieżące blokery

### Blokery R5 Users

* Użytkownicy admina nie są w pełni zmigrowani (R5 blocker).
* Ukończenie webhooka Clerk pozostaje (R5/R9 boundary).
* Granica synchronizacji użytkownik-dostęp pozostaje.
* Granica patron/płatności pozostaje.
* Serwisy użytkownika legacy mogą nadal istnieć.
* `User.isPatron` w DB musi pozostać źródłem prawdy.
* Metadane Clerk muszą pozostać tylko cache'em.

---

### Blokery R6 Video

* Szczegóły admina (diagnostyka/audyt) pozostają jako rozszerzenie legacy (R6 blocker).
* Migracja frontendu publicznego do DTO modułu pozostaje zadaniem na przyszłość.
* Publiczne DTO jest bezpieczne, ale publiczny route dostarczania mediów/playbacku wciąż wymaga dedykowanego domknięcia (R3/R6 delivery blocker).
* Dostarczanie mediów/proxy/media-source nie są w pełni zmodularyzowane.

---

### Blokery R7 przed startem

R7 nie może wystartować, dopóki:

* blokery R5/R6 nie zostaną przejrzane,
* strategia granicy dostępu/playbacku jest bezpieczna,
* reguły źródła prawdy dla płatności/patronów są spisane,
* wymagania mini-X dla R7 są zaakceptowane.

---

### Pozostałe duże domeny legacy

Jeszcze nie zmigrowane jako pełne moduły:

* payments (płatności),
* patron,
* comments (komentarze),
* email,
* referrals (polecenia),
* admin cockpit,
* release readiness (gotowość wydania).

---

## 15. Notatki certyfikacyjne

### R0/R1 Certification Pass — 2026-06-09

* Usunięto przestarzałe `userId` / `role` z `AppContext`.
* Poprawiono `UserPolicy.canSeeProfile()` z `actor.role` na `actor.type`.
* Udokumentowano `isPatron` w Clerk jako cache, a nie źródło prawdy.
* Dodano `user.errors.ts`.
* Zastąpiono przewidywalne `throw new Error` w modułach przez `AppError` / typowane błędy.
* Dodano `lib/modules/**` do pokrycia testami.
* Dodano testy dla Actor/AppContext, UseCaseResult, UserPolicy oraz błędów użytkownika.
* Wzmocniono architecture guard dla wewnętrznych importów modułów i mieszanych route'ów.
* Zastosowano minimalne utwardzenie bezpieczeństwa: `PublicVideoDto` nie wystawia już `videoUrl`.

Status:

```txt
R0 [x]
R1 [x]
```

---

### R2/R3/R4 Certification Pass — 2026-06-09

R2 Audit:

* Fundament audytu certyfikowany.
* API modułu używa `AppContext` / `Actor`.
* Wspiera zapisywanie świadome transakcji.
* Używany przez zmigrowane akcje kanału/wideo/użytkowników.
* Ścieżki audytu legacy pozostają dla komentarzy/płatności/e-mailu/szczegółów admina i należą do ich przejść domenowych.

R3 Media:

* Fundament bezpieczeństwa mediów certyfikowany.
* `MediaPolicy` zawiera allowlisty URL i blokowanie prywatnych hostów.
* Bezpieczeństwo miniatur/wideo/awatarów/obrazków-komentarzy pokryte.
* Brak wycieków w `PublicVideoDto` potwierdzony.
* Wykrywanie HLS/DASH istnieje tylko dla klasyfikacji.
* Dostarczanie mediów/proxy/media-source pozostają legacy.

R4 Channel:

* Fundament ścisłego jednokanałowości certyfikowany.
* Nie powinien istnieć żaden fallback/zgadywanie/auto-naprawa w runtime.
* Podgląd/zastosowanie konserwacji jest jawne i audytowalne.
* Użycie adaptera kanału legacy zmapowane.
* Przestarzały adapter kompatybilności pozostaje do czasu czyszczenia w R5/R6/R7/R10.

Status:

```txt
R2 [x foundation]
R3 [x safety foundation]
R4 [x single-channel foundation]
```

---

### R6 Video + Access Safety Pass — 2026-06-09

* Wzmocniono bezpieczeństwo zapisu w repozytorium wideo (scoped write semantics).
* Zaimplementowano use case `getAdminVideoById` z wymuszonym zasięgiem głównego kanału.
* Zmigrowano `app/api/admin/videos/[id]/route.ts` do modułu video (szczegóły diagnostyki pozostają jako legacy extension).
* Zaimplementowano modułowy use case `resyncAdminVideoStats` z audytem i zasięgiem głównego kanału.
* Zaimplementowano modułowy fundament `access` dla wideo.
* Zmigrowano `app/api/access/route.ts` do nowego modułu access (używa `User.isPatron` z bazy jako źródła prawdy).
* Sklasyfikowano blokery R5 (admin users) i R7 (admin patron management) w README i architecture guard.
* Dodano testy dla bezpieczeństwa repozytorium, resyncu i modularnego dostępu.

Status:

```txt
R6 [~ stronger]
```

---

### R5 Users Admin/Webhook Pass — 2026-06-09

* Clerk webhook boundary jest czysty; logika identity sync i soft-delete w use case.
* Identity sync nie nadpisuje `User.isPatron` (source-of-truth protected).
* Admin users (list/details) zmigrowane do modularnych use case'ów (core identity).
* `getUserAccessProfile` dostarcza stabilny read-model dla decyzji access.
* Route'y profilu, synchronizacji i języka użytkownika są modularne.
* Admin patron management route jawnie sklasyfikowany jako R7 blocker.
* Referrals sklasyfikowane jako future domain blocker.

### P0 R5/R6 Integrity Pass — 2026-06-09

* Naprawiono wyciek treści dla patronów w sitemap.xml (teraz tylko PUBLIC).
* Przywrócono pełny kontrakt API dla listy użytkowników admina (paymentTotals, normalizedTotal, relation counts).
* Wprowadzono modularny bridge `getOrCreateCurrentUser` dla zachowania trudnej logiki legacy conflict-resolution.
* Usunięto osierocony serwis `VideosAdminService`.
* Zmigrowano statystyki użytkowników admina do modularnego use case.
* Wzmocniono architecture guard: direct Prisma w nowych route'ach jest teraz blokowana.
* Wszystkie pozostałe importy Prisma w route'ach zostały sklasyfikowane w allowliście.

Status:

```txt
R5 [~ stronger]
```

---

### R6.5 Access Foundation Pass — 2026-06-09

* `/api/access` używa `lib/modules/access`.
* DB `User.isPatron` jest jedynym źródłem prawdy dla dostępu patrona.
* Cache aktora/Clerk nie jest wystarczający do przyznania dostępu.
* Decyzje są ograniczone do głównego kanału (main-channel scoped).
* Podgląd admina działa tylko w obrębie głównego kanału.
* Treści spoza kanału (off-channel) zwracają `NOT_FOUND`.
* Legacy `AccessPolicy` ograniczone do znanych przepływów playback/media-source i oznaczone jako przestarzałe.
* Pozostała macierz dostępu (Access Matrix) należy do przyszłych prac R8/X1/X2.

Status:

```txt
R6.5 [x video foundation]
```

---

## 16. Szablon raportu agenta

Każdy agent musi zakończyć tym raportem:

```md
### Refactor Report — [Tytuł zadania]

#### Summary
- ...

#### Changed files
- ...

#### README
- README zaktualizowane: TAK/NIE
- README pozostaje źródłem prawdy: TAK/NIE
- Statusy zmienione: TAK/NIE
- Bieżące zadanie zmienione: TAK/NIE

#### Real phase status
- R0:
- R1:
- R2:
- R3:
- R4:
- R5:
- R6:
- R7:
- R8:
- R9:
- R10:
- R11:

#### Validation
- Prisma validate: PASS/FAIL/NOT RUN + powód
- Architecture boundaries: PASS/FAIL/NOT RUN + powód
- Typecheck: PASS/FAIL/NOT RUN + powód
- Tests: PASS/FAIL/NOT RUN + powód
- Coverage: PASS/FAIL/NOT RUN + powód
- Lint: PASS/FAIL/NOT RUN + powód
- Build: PASS/FAIL/NOT RUN + powód

#### Architecture guard
- route'y z bezpośrednią Prismą:
- route'y z `@/lib/services`:
- route'y z wewnętrznymi importami modułów:
- importy przestarzałego adaptera kanału:
- nowe wpisy w allowlist:

#### Legacy/deprecated adapters
- ...

#### Known blockers
- ...

#### Scope control
- Nie rozpoczęto niepowiązanych domen: TAK/NIE
- Nie zaktualizowano statusu ponad rzeczywistość kodu: TAK/NIE
- Nie ukryto awarii walidacji: TAK/NIE

#### Next recommended step
- ...
```

---

## 17. Plan pracy w najbliższym czasie

### Krok 1 — Dokończenie blokerów R5/R6

Kolejne aktywne prace:

```txt
R5/R6 blocker completion
```

Skupienie:

* granica użytkownik/admin/webhook (R5),
* gotowość dostarczania mediów/playbacku (R6/R3),
* wyrównanie guardów,
* certyfikacja R6.5 Access Foundation,
* brak R7 przed przeglądem gotowości.

---

### Krok 2 — Przegląd gotowości R7

Przed implementacją wykonaj audyt architektury R7:

* sprawdź serwis płatności,
* sprawdź webhook Stripe,
* sprawdź checkout,
* sprawdź przepływ refund/revoke,
* sprawdź źródło prawdy patrona,
* spisz mapę use-case'ów R7,
* zdecyduj o minimalnym zakresie idempotencji/outbox.

---

### Krok 3 — Budowa R7 Patron + Payments

Zbuduj moduły:

* `lib/modules/patron`,
* `lib/modules/payments`,
* opcjonalnie fundament `lib/modules/idempotency`, jeśli potrzebny.

R7 musi od pierwszego dnia zawierać elementy mini-X.

---

### Krok 4 — Certyfikacja R7

Certyfikuj:

* duplikat webhooka nie dubluje uprawnień,
* zwrot pieniędzy cofa dostęp patrona,
* subskrypcja nigdy nie daje dostępu patrona,
* checkout nigdy nie używa `creatorId` od klienta,
* `User.isPatron` w DB jest źródłem prawdy,
* audyt jest zapisywany,
* efekty uboczne są post-commit lub jawnie bezpieczne.

---

### Krok 5 — R8/R9/R10/R11

Kontynuuj dopiero po ustabilizowaniu R7.

---

## 18. Docelowy cel projektu

Po R0–R11:

```txt
Czysty, praktyczny, produkcyjny monolit modułowy dla ściśle jednokanałowej platformy twórcy.
```

Po Fazie X:

```txt
Samomonitorujący się system operacyjny dla prywatnej platformy mediowej twórcy.
```

Celem nie jest maksymalna abstrakcja.

Celem jest:

```txt
jak najmniejsza liczba miejsc, w których przyszli agenci lub programiści mogą popełnić niebezpieczne błędy.
```
