# Polutek.pl

## 0. Jak używać tego README

To README jest **operacyjnym źródłem prawdy dla agentów kodowania**.

Agent ma zakładać, że właściciel projektu może nie znać szczegółów technicznych. Dlatego README musi mówić:

* czym jest produkt,
* czym produkt nie jest,
* jaki jest aktualny stan refaktoryzacji,
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

Nie wolno oznaczać fazy jako ukończonej tylko dlatego, że powstał folder modułu albo pojedynczy use case.

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
* ogólny SaaS dla wielu creatorów.

Ważne mapowanie modeli:

* `Creator` w bazie danych to legacy techniczna reprezentacja `MainChannel`.
* Nie zmieniaj nazwy `Creator -> Channel` w Prismie, dopóki modułowy monolit nie będzie stabilny i przetestowany.
* `Subscription != Patron`.
* Subskrypcja/obserwowanie oznacza zainteresowanie e-mailami/newsletterem/powiadomieniami.
* Dostęp patrona jest kontrolowany przez stan bazy danych.
* Aktualny read-model dostępu to nadal `User.isPatron`.
* Docelowo źródłem prawdy dla patrona mają być aktywne `PatronGrant`.
* Metadane Clerk to cache/sync, a nie źródło prawdy dla dostępu.

---

## 2. Aktualny refaktor

Aktywny refaktor to praktyczna migracja w kierunku modułowego monolitu.

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
[ ]                         nie rozpoczęto
[~]                         częściowe / w toku / pozostają znane blokery
[~ foundation]              fundament istnieje, ale runtime nie jest w pełni przepięty
[~ core migrated]           główne runtime flows są przepięte, ale nie ma pełnej certyfikacji
[~ pending certification]   kod wygląda na gotowy, ale wymaga testów/guardów/reconcile
[x foundation]              fundament certyfikowany, ale legacy może celowo pozostać
[x safety foundation]       certyfikowana warstwa bezpieczeństwa, ale runtime/delivery może pozostać
[x single-channel foundation] ścisły inwariant jednokanałowy certyfikowany
[x certified]               certyfikowane jako ukończone dla aktualnego zakresu roadmapy
[x]                         ukończone i certyfikowane dla obecnego zakresu
[!]                         zablokowane / regresja / nie kontynuuj bez naprawy
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

## 4. Aktualny status refaktoryzacji

| Faza     | Opis                                       | Status                                                      |
| :------- | :----------------------------------------- | :---------------------------------------------------------- |
| **R0**   | Zasady, infrastruktura, bariery projektowe | `[x]`                                                       |
| **R1**   | Shared, Result, błędy, Actor, AppContext   | `[x]`                                                       |
| **R2**   | Audit                                      | `[x foundation]`                                            |
| **R3**   | Media                                      | `[x safety foundation]`                                     |
| **R4**   | Channel / ścisły single-channel            | `[x single-channel foundation]`                             |
| **R5**   | Users                                      | `[x stronger foundation]`                                   |
| **R6**   | Video                                      | `[x stronger foundation]`                                   |
| **R6.5** | Access Foundation                          | `[x certified]`                                             |
| **R7**   | Patron + Payments                          | `[~ core runtime migrated / pending certification]`         |
| **R8**   | Comments                                   | `[~ core comments migrated]`                                |
| **R9**   | Email                                      | `[~ pending certification PR #774]`                         |
| **R10**  | Cleanup legacy fasad                       | `[~ preparation inventory / needs reconcile after R7 #777]` |
| **R11**  | Frontend admina / kokpit operacyjny        | `[ ]`                                                       |

Aktualna interpretacja:

* R0/R1 są ukończone jako fundament pracy agentów.
* R2/R3/R4 są certyfikowanymi foundation, nie pełnym usunięciem każdego legacy.
* R5/R6 są mocno zaawansowane, ale nadal mają znane legacy extensions.
* R6.5 certyfikuje dostęp dla wideo.
* R7 core runtime został przesunięty do modułów po PR #777, ale wymaga certyfikacji i dokumentacyjnego reconcile.
* R8 core comments są zmigrowane, ale admin/moderation/pin/context pozostają blokerami.
* R9 ma pending PR #774 i nie może być traktowany jako merged main.
* R10 inventory istnieje, ale część Payments/Patron jest nieaktualna po PR #777.
* R11 jeszcze nie wystartowało.

---

## 5. Bieżące zadanie

```txt
Najbliższe zadanie:
R7/R10 README reconciliation after PR #777.

Cel:
Ujednolicić README z realnym stanem main po migracji Stripe webhook + fulfillment/refund/dispute do modułu payments.

Nie zaczynać dużego R10 cleanup.
Nie zaczynać R11.
Nie oznaczać R7 jako [x].
Nie traktować PR #774 ani PR #775 jako merged main.
```

Następny dobry prompt dla agenta kodowania:

```txt
Wykonaj R7/R10 reconciliation pass.

Zaktualizuj guardy i docs po PR #777:
- Stripe webhook route nie jest już legacy R7 blockerem.
- Payments webhook/fulfillment/refund/dispute są core runtime migrated do lib/modules/payments.
- R7 nadal pending certification, bo payment settings, admin payments, source-of-truth PatronGrant/User.isPatron oraz refund atomicity wymagają weryfikacji.
- R10 inventory/readiness muszą zostać poprawione po R7 #777.
- Nie zaczynaj pełnego R10 cleanup.
- Nie ruszaj R8/R9 poza opisaniem ich jako pending/partial.
```

---

## 6. Obowiązkowe zasady agentów

Agent musi przestrzegać tych zasad:

* Nie przenoś tylko plików.
* Nie twórz folderów nazywając fazę ukończoną.
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
* Jeżeli branch/PR jest `mergeable: false`, wymaga rebase/reconcile przed uznaniem go za prawdę.

Kluczowe doprecyzowanie:

```txt
Faza X nie może wystartować jako osobna roadmapa przed ukończeniem R0–R11.
```

Ale R7–R11 muszą zawierać minimalne elementy Fazy X naturalne dla swojej domeny, żeby Faza X nie stała się drugim masowym refaktorem.

---

## 7. Roadmapa R0–R11

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

Oznacza to:

* `lib/modules/audit/**` istnieje,
* publiczne API przechodzi przez `lib/modules/audit/index.ts`,
* audyt używa `AppContext` / `Actor`,
* wsparcie dla transakcji istnieje tam, gdzie jest potrzebne,
* część zmigrowanych modułów może używać modułowego audytu.

Nie oznacza jeszcze:

* że każda akcja legacy w komentarzach/płatnościach/e-mailach/adminie używa modułu audytu,
* że legacy `audit.service.ts` można usunąć.

Pozostałe użycia legacy audytu należą do ich przejść domenowych.

---

## R3 — Media

Cel:

* bezpieczeństwo mediów,
* allowlisty URL,
* blokowanie prywatnych hostów,
* walidacja miniatur/wideo/awatarów/obrazków w komentarzach,
* wykrywanie HLS/DASH/direct,
* gwarancje braku wycieku danych w publicznych DTO.

Status:

```txt
[x safety foundation]
```

Oznacza to:

* fundament bezpieczeństwa MediaPolicy istnieje,
* bezpieczeństwo URL i blokowanie prywatnych hostów są pokryte,
* publiczne DTO wideo nie wystawia surowego `videoUrl`,
* wykrywanie HLS/DASH istnieje jako klasyfikacja.

Nie oznacza jeszcze:

* pełnej migracji dostarczania mediów/proxy,
* przepisywania manifestów,
* proxy segmentów,
* pełnego przeniesienia `app/api/media/**`, `app/api/media-source/**` i `lib/blob.ts`.

Ważne:

```txt
Wykrywanie HLS/DASH istnieje tylko do walidacji/klasyfikacji.
Nie oznacza gotowego proxy HLS/DASH.
```

---

## R4 — Channel / ścisły jednokanałowy model

Cel:

* ścisły inwariant jednokanałowy,
* `MainChannel`,
* `MAIN_CREATOR_SLUG` jako źródło prawdy,
* jawna konserwacja,
* ustawienia kanału admina,
* brak auto-naprawy w runtime.

Status:

```txt
[x single-channel foundation]
```

Oznacza to:

* moduł channel istnieje,
* produkt jest jednoznacznie single-channel,
* runtime nie powinien zgadywać twórcy,
* maintenance ma być jawne, potwierdzone i audytowalne,
* `/api/admin/channel` używa modułu kanału,
* `/api/admin/creator` jest legacy/wrapperem, nie równoległym źródłem prawdy.

Nie oznacza jeszcze:

* że każdy import legacy channel adapter został usunięty.

---

## R5 — Users

Cel:

* lokalny użytkownik,
* synchronizacja Clerk,
* profil,
* język,
* soft delete,
* profil dostępu,
* admin users,
* granica user/access,
* ochrona `User.isPatron` przed przypadkowym nadpisaniem przez identity sync.

Status:

```txt
[x stronger foundation]
```

Już zrobione / wzmocnione:

* moduł users istnieje,
* profile/sync/language zostały przeniesione w stronę modułów,
* admin users core lookup/list/details/stats są mocno zaawansowane,
* `getUserAccessProfile` dostarcza read-model dla access,
* `User.isPatron` nie powinien być nadpisywany przez identity sync,
* `UserProfileService` bridge jest ograniczony do kontrolowanego miejsca.

Znane pozostałe prace:

* admin users export pozostaje legacy,
* admin user details mogą mieć legacy extensions,
* subscriber resync pozostaje legacy,
* referral domain pozostaje przyszłym zakresem,
* granica users/patron/payments musi pozostać wyraźnie oddzielona.

R5 nie jest pełnym `[x]`, dopóki:

* wszystkie users route’y są czyste albo jawnie allowlisted,
* direct legacy UserProfileService usage jest zablokowane,
* user-access boundary jest zgodny z R7/R6.5,
* README i guardy zgadzają się co do pozostałego legacy.

---

## R6 — Video

Cel:

* CRUD wideo admina,
* reorder,
* archiwizacja,
* lista publiczna,
* hero,
* predykaty widoczności,
* bezpieczeństwo DTO,
* main-channel scoping,
* granica dostępu do wideo.

Status:

```txt
[x stronger foundation]
```

Już poprawione:

* moduł video istnieje,
* fundament admin CRUD/reorder istnieje,
* `PublicVideoDto` nie wystawia już `videoUrl`,
* `AdminVideoDto` może zawierać `videoUrl`,
* publiczne predykaty widoczności są zbliżone do reguł legacy,
* admin video lookup jest main-channel scoped,
* resync statystyk jest main-channel scoped,
* `/api/access` używa modułowego use case’a,
* dostęp patrona opiera się na stanie DB.

Znane pozostałe prace:

* frontend publiczny nie musi być jeszcze w pełni na DTO modułu,
* publiczne media delivery/playback nadal wymagają domknięcia,
* playback-event persistence może nadal być route-level/mixed,
* szczegóły admina/diagnostyka mogą mieć legacy extensions.

R6 nie jest pełnym `[x]`, dopóki:

* publiczne UI nigdy nie otrzymuje surowego `videoUrl`,
* delivery/playback/media-source są jasno sklasyfikowane,
* guardy i README zgadzają się co do legacy.

---

## R6.5 — Access Foundation

Cel:

* centralne decyzje access allow/deny/reason,
* certyfikowany scope: video access,
* `/api/access` używa modułu access,
* DB `User.isPatron` jest aktualnym read-modelem dostępu,
* Clerk metadata jest tylko cache,
* admin bypass działa tylko w obrębie głównego kanału,
* off-channel content jest traktowany jako `NOT_FOUND`.

Status:

```txt
[x certified]
```

Oznacza to:

* video access foundation jest certyfikowany,
* decyzje dostępu do wideo przechodzą przez moduł access,
* `User.isPatron` jest obecnym read-modelem,
* metadane Clerk nie wystarczają do przyznania dostępu.

Nie oznacza jeszcze:

* pełnej Access Matrix X1,
* pełnych reason codes X2,
* przeniesienia każdego legacy `AccessPolicy`,
* czytania patron status bezpośrednio z `PatronGrant`.

Docelowo R7 powinno umożliwić, by access czytał status patrona przez moduł patron.

---

## R7 — Patron + Payments

### Status R7

```txt
[~ core runtime migrated / pending certification]
```

R7 jest po dużym przesunięciu runtime do modułów po PR #777.

Nie jest już prawdą, że cały Stripe webhook/fulfillment/refund/dispute jest legacy.

Nie wolno jednak oznaczyć R7 jako `[x]`, bo pozostały blokery certyfikacyjne i administracyjne.

### Cel R7

R7 obejmuje:

* dostęp patrona,
* Stripe checkout,
* Stripe webhook,
* fulfillment płatności,
* refund/revoke,
* dispute/chargeback,
* patron grants,
* idempotencję,
* audyt,
* source-of-truth dla patron access,
* Clerk sync jako cache po zmianie DB.

### Co jest już zmigrowane / zrobione

* `lib/modules/patron` istnieje.
* `lib/modules/payments` istnieje.
* Checkout intent creation jest w module payments.
* Admin patron route używa modułu patron.
* Stripe webhook route używa `handleStripeWebhook` z `@/lib/modules/payments`.
* Payments module eksportuje:

  * `createCheckoutIntent`,
  * `fulfillPayment`,
  * `handleRefund`,
  * `handleDispute`,
  * `handleStripeWebhook`.
* Stripe event lock/idempotency została przeniesiona do modularnego flow.
* Fulfillment używa CAS na statusie payment.
* Fulfillment grantuje patrona przez moduł patron.
* `grantPatron` i `revokePatron` obsługują opcjonalny transaction client.
* Legacy `PaymentService` jest deprecated / R10 cleanup candidate, nie docelową ścieżką webhook route.

### R7 — aktualny model źródła prawdy

Aktualny stan:

```txt
User.isPatron = read-model używany przez access
PatronGrant = docelowe źródło prawdy / audytowalny zapis powodów dostępu
Clerk metadata = cache/sync
```

Docelowy stan:

```txt
Access -> Patron module -> active PatronGrant records
User.isPatron = denormalized read-model
Clerk metadata = cache
```

Nie wolno:

* przyznawać dostępu patrona na podstawie Clerk metadata,
* nadpisywać `User.isPatron` przez identity sync,
* traktować subskrypcji newslettera jako patron access,
* ufać `creatorId` od klienta przy checkout.

### R7 — znane blokery

R7 pozostaje pending certification, bo trzeba sprawdzić i/lub domknąć:

* `app/api/admin/payment-settings/route.ts` pozostaje legacy/direct Prisma.
* Admin payments list route używa legacy `PaymentsAdminService`.
* Subscriptions/payment boundary pozostaje mixed.
* `User.isPatron` vs `PatronGrant` drift risk nadal istnieje.
* Access module nadal czyta read-model zamiast docelowo pytać Patron module.
* Payment settings nie są jeszcze w module payments.
* Admin payments stats/list nie są jeszcze w module payments.
* Refund full revoke wymaga sprawdzenia atomiczności: jeżeli `handleRefund` jest już w transakcji, `revokePatron` powinno używać tego samego transaction clienta.
* Legacy payment services mogą pozostać jako deprecated compatibility/R10 cleanup candidates, ale nie mogą być mylone z aktywnym webhook runtime.

### R7 — minimalne elementy Fazy X

R7 musi zawierać:

* idempotencję Stripe webhooków,
* ochronę przed duplikatem webhooka,
* testy scenariuszowe refund/revoke,
* testy source-of-truth,
* audyt,
* dyscyplinę post-commit effects,
* brak Clerk metadata jako źródła prawdy,
* brak klientowego `creatorId` przy checkout.

### R7 — następny zalecany krok

```txt
R7 certification + reconciliation pass.

Sprawdź:
1. Refund full -> revoke patron atomicity.
2. Dispute lost/won -> PatronGrant/User.isPatron consistency.
3. Payment settings migration plan.
4. Admin payments list/stats migration plan.
5. Czy legacy PaymentService jest już tylko deprecated cleanup candidate.
6. Czy guardy i docs nie opisują Stripe webhook jako legacy.
7. Czy tests/CI realnie przechodzą.
```

---

## R8 — Comments

Status:

```txt
[~ core comments migrated]
```

Cel:

* listowanie komentarzy,
* tworzenie komentarzy,
* aktualizacja/usuwanie,
* reakcje,
* replies,
* report,
* pin/heart,
* context/thread,
* admin moderation,
* polityka dostępu,
* audyt moderacji.

Już zrobione / aktualny core:

* moduł `comments` istnieje,
* `CommentPolicy` używa modularnego access tam, gdzie core flow zostało zmigrowane,
* interakcje wideo i reakcje komentarzy zostały przesunięte w stronę use case’ów,
* główne przepływy list/create/update/delete/replies/report są przynajmniej częściowo modularne,
* R8 nie powinno dotykać R7 Payments/Patron ani R9 Email.

Znane blokery R8:

* admin comments management pozostaje legacy/mixed,
* pin pozostaje blockerem,
* context/thread route pozostaje blockerem,
* moderation UI pozostaje blockerem,
* audyt moderacji nie jest pełny,
* część legacy CommentService/CommentAccessService może nadal istnieć,
* otwarty PR #775 może zawierać dodatkowy reconcile, ale nie wolno traktować go jako merged main, dopóki nie zostanie zmergowany.

R8 musi zawierać minimalne elementy Fazy X:

* sprawdzenia dostępu,
* powody odmowy dostępu tam, gdzie praktyczne,
* audyt moderacji,
* testy scenariuszowe dla patron/public,
* przepływy zgłoszeń/moderacji.

---

## R9 — Email

Status:

```txt
[~ pending certification PR #774]
```

Cel:

* integracja z Resend,
* broadcast,
* delivery status,
* webhooki e-mail,
* inbound responses,
* preferences/unsubscribe,
* semantyka retry/outbox,
* audyt broadcastów.

Aktualna interpretacja:

* R9 ma fundamenty i production hardening w toku.
* PR #774 jest pending i nie może być traktowany jako merged main.
* PR #774 deklaruje near-certification, ale dopóki nie jest merged/rebased, README main powinno pozostać ostrożne.
* R9 nie może mutować `User.isPatron`, `PatronGrant`, płatności ani dostępu patrona.

Znane blokery / pending:

* PR #774 wymaga review/rebase/reconcile.
* Durable idempotency może wymagać trwałego unikalnego pola provider event id.
* Outbox/retry pozostaje future R9/R10.
* EmailService legacy bridge może nadal istnieć jako adapter.
* Admin templates/subscriber resync mogą pozostać legacy.
* Broadcast nie powinien docelowo być fire-and-forget bez obserwowalności.

R9 musi zawierać minimalne elementy Fazy X:

* idempotentna obsługa webhooków,
* semantyka ponowień/statusów,
* audyt broadcastów,
* podstawowy runbook,
* brak fire-and-forget jako docelowego projektu.

---

## R10 — Cleanup legacy fasad

Status:

```txt
[~ preparation inventory / needs reconcile after R7 #777]
```

Cel:

* usunięcie przestarzałych fasad kompatybilności,
* wzmocnienie guardów,
* blokowanie nowych importów legacy,
* usuwanie dead code dopiero po istnieniu zamienników,
* aktualizacja readiness po każdej większej migracji domeny.

Aktualny stan:

* R10 inventory istnieje.
* R10 Direct Prisma inventory istnieje.
* R10 Legacy Service inventory istnieje.
* R10 Cleanup Readiness istnieje.
* Część R10 inventory jest przestarzała po PR #777.
* Szczególnie sekcje Payments/Patron muszą zostać zreconciliowane.

Nie wolno:

* zaczynać masowego cleanupu R10 przed domknięciem R7/R8/R9,
* usuwać legacy service tylko dlatego, że wygląda na stary,
* usuwać bridge, jeśli runtime albo testy go nadal używają,
* ufać R10 inventory bez sprawdzenia, czy nie jest starsze niż ostatni merged PR.

R10 następuje po istnieniu przepływów zastępczych.

Najbliższe R10 zadanie:

```txt
Reconcile R10 docs after R7 #777.
Nie usuwać jeszcze masowo kodu.
```

---

## R11 — Frontend admina / kokpit operacyjny

Status:

```txt
[ ]
```

Cel:

* UI zarządzania dla admina,
* zarządzanie treścią,
* zdrowie systemu,
* widoczność operacyjna,
* gotowość wydania.

R11 powinno zawierać praktyczne elementy mini-X:

* ostatni audyt,
* nieudane webhooki,
* status płatności/patronów,
* zdrowie mediów,
* status broadcastów,
* panel konserwacji,
* checklistę gotowości wydania.

Nie buduj gigantycznej architektury kokpitu przed ustabilizowaniem R7/R8/R9/R10.

---

## 8. Zasady architektury

### 8.1 Cienkie route’y

Route powinien być adapterem HTTP.

Dozwolone:

```txt
auth -> parse -> ctx -> use case -> HTTP response
```

Zabronione:

* business logic,
* direct Prisma,
* direct services,
* direct repository,
* internal module imports,
* duże DTO mappingi,
* polityka dostępu w route.

Wyjątki legacy muszą być jawnie allowlisted.

---

### 8.2 Publiczne API modułu

Moduły muszą wystawiać publiczne API przez `index.ts`.

Dozwolone:

```ts
import { grantPatron } from "@/lib/modules/patron";
```

Zabronione:

```ts
import { grantPatron } from "@/lib/modules/patron/application/grant-patron.use-case";
```

---

### 8.3 Brak HTTP/Next w modułach

Pliki w `lib/modules/**` nie mogą importować:

* `next/server`,
* `next/navigation`,
* `next/cache`,
* `NextResponse`,
* `app/**`,
* route handlers.

HTTP należy do `app/**` i `lib/api/**`.

Logika domenowa należy do `lib/modules/**`.

---

### 8.4 AppContext

Use case powinien przyjmować:

```txt
input + AppContext
```

`AppContext` powinien zawierać:

* `actor`,
* `db`,
* `prisma` tam, gdzie potrzebne jako compatibility,
* `requestId`,
* `now`.

Nie przywracaj przestarzałych skrótów:

```txt
ctx.userId
ctx.role
```

Używaj:

```txt
ctx.actor
```

---

### 8.5 Actor

Używaj `Actor`, a nie luźnych `userId`, `role`, `admin`.

Warianty aktora:

```txt
guest
user
admin
system
```

Ważne:

* `actor.isPatron` z sesji/Clerk jest cache’em.
* Decyzje paywall/access muszą sprawdzać DB przez moduły Users/Patron/Access.

---

### 8.6 Result Pattern i błędy

Przewidywalne błędy domenowe powinny używać:

```txt
UseCaseResult
AppError
typowane błędy domenowe
```

Nie używaj zwykłego `throw new Error(string)` dla normalnych awarii domenowych, takich jak:

* not found,
* forbidden,
* user deleted,
* not patron,
* video not in main channel,
* duplicate webhook,
* invalid maintenance confirmation.

Nieoczekiwane błędy infrastrukturalne mogą nadal rzucać wyjątki.

---

### 8.7 ReadDb / WriteTx

Repozytoria powinny używać jawnych typów:

```txt
ReadDb = PrismaClient | Prisma.TransactionClient
WriteTx = Prisma.TransactionClient
```

Zasady:

* odczyty mogą przyjmować `ReadDb`,
* krytyczne zapisy powinny preferować `WriteTx`,
* use case posiada granicę transakcji,
* repozytorium nie powinno ukrywać wieloetapowych transakcji biznesowych.

Jeżeli use case jest już w transakcji i woła inny use case, powinien przekazać `tx`, jeżeli ten use case obsługuje opcjonalny transaction client.

Dotyczy szczególnie:

```txt
payments -> patron
refund -> revokePatron
fulfillment -> grantPatron
dispute -> recalculatePatronStatus
```

---

### 8.8 Efekty uboczne

Nie wywołuj ślepo zewnętrznych efektów ubocznych wewnątrz transakcji DB.

Zewnętrzne efekty uboczne:

* Clerk,
* Stripe,
* Resend,
* storage,
* webhooki,
* e-maile.

Preferowany wzorzec:

```txt
1. Transakcja DB zapisuje źródło prawdy.
2. Transakcja DB zapisuje audyt.
3. Transakcja DB zapisuje outbox albo zwraca pracę post-commit.
4. Efekt uboczny następuje po commit albo przez worker.
```

Obecnie projekt może mieć pragmatic bridge, ale agent musi opisać to uczciwie jako bridge/pending hardening.

---

## 9. Ścisły inwariant single-channel

Runtime nie może:

* tworzyć twórców,
* zmieniać nazw twórców,
* auto-zatwierdzać twórców,
* auto-ustawiać `isPrimary`,
* degradować innych twórców,
* zgadywać fallback twórcy,
* używać zahardkodowanych fallback slugów,
* uruchamiać konserwacji z normalnego ładowania strony,
* przypisywać własności treści poza jawną konserwacją.

Ważne inwarianty:

* `MAIN_CREATOR_SLUG` jest źródłem prawdy.
* Publiczna treść musi należeć do `mainChannel.id`.
* Checkout nie może akceptować `creatorId` od klienta.
* `Subscription != Patron`.
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
* helpery wspólne.

Nie posiada logiki biznesowej konkretnych domen.

---

### api

Posiada:

* granicę HTTP,
* helpery auth,
* parsowanie JSON,
* mapowanie Zod,
* mapowanie use-case result na HTTP.

Może importować Next.js.

Moduły nie mogą.

---

### audit

Posiada:

* zapisywanie zdarzeń audytu,
* audyt świadomy aktora,
* audyt świadomy transakcji.

Status:

```txt
[x foundation]
```

Legacy `audit.service.ts` może nadal istnieć jako bridge dla niezmigrowanych admin routes.

---

### media

Posiada:

* walidację URL mediów,
* walidację miniatur,
* walidację awatarów,
* walidację obrazków komentarzy,
* blokowanie prywatnych hostów,
* klasyfikację HLS/DASH/direct.

Status:

```txt
[x safety foundation]
```

Delivery/proxy pozostaje częściowo legacy.

---

### channel

Posiada:

* dostęp do głównego kanału,
* single-channel invariant,
* ustawienia kanału admina,
* maintenance preview/apply,
* politykę kanału.

Status:

```txt
[x single-channel foundation]
```

---

### users

Posiada:

* lokalnego użytkownika,
* synchronizację Clerk,
* profil,
* język,
* soft delete,
* access profile,
* admin user core.

Status:

```txt
[x stronger foundation]
```

Pozostaje:

* export,
* subscriber resync,
* admin details extensions,
* referrals.

---

### video

Posiada:

* admin video CRUD,
* reorder,
* archive,
* public list,
* hero,
* DTO,
* video policy,
* main-channel scoping.

Status:

```txt
[x stronger foundation]
```

Pozostaje:

* delivery/playback,
* analytics persistence,
* część admin diagnostics.

---

### access

Posiada:

* decyzje dostępu do wideo,
* patron/public/logged-in visibility,
* admin bypass,
* deny reasons,
* off-channel NOT_FOUND.

Status:

```txt
[x certified]
```

Pozostaje:

* Access Matrix,
* pełne reason codes,
* PatronGrant source-of-truth integration.

---

### patron

Posiada:

* patron grants,
* grant,
* revoke,
* recalculate,
* get patron status,
* read-model sync.

Status:

```txt
[~ core runtime migrated / pending certification]
```

Pozostaje:

* full source-of-truth switch,
* drift prevention,
* access integration through Patron module,
* scenario certification.

---

### payments

Posiada:

* checkout,
* Stripe webhook,
* fulfillment,
* refund,
* dispute,
* idempotency,
* payment repository,
* Stripe event lock.

Status:

```txt
[~ core runtime migrated / pending certification]
```

Pozostaje:

* payment settings,
* admin payments,
* subscriptions/payment boundary,
* full certification,
* stale docs/guards cleanup.

---

### comments

Posiada:

* comments,
* reactions,
* replies,
* report,
* access policy,
* repository,
* moderation future.

Status:

```txt
[~ core comments migrated]
```

Pozostaje:

* admin comments,
* pin,
* context,
* moderation UI,
* moderation audit.

---

### email

Posiada:

* broadcast,
* Resend webhook,
* delivery logs,
* inbound responses,
* preferences,
* provider bridge.

Status:

```txt
[~ pending certification PR #774]
```

Pozostaje:

* PR #774 reconcile,
* durable idempotency,
* outbox/retry,
* templates/subscriber resync.

---

### admin cockpit

Posiadać będzie:

* operational dashboard,
* payment/patron status,
* failed webhook visibility,
* health,
* release readiness.

Status:

```txt
[ ]
```

---

## 11. Faza X

Faza X to długofalowa roadmapa doskonałości.

Nie może wystartować jako osobna roadmapa przed ukończeniem R0–R11.

Jednak każda krytyczna faza R musi zawierać minimalne elementy X, które naturalnie należą do jej domeny.

Masterplan Fazy X:

* **X1:** Access Matrix.
* **X2:** Actor deny reasons.
* **X3:** Outbox.
* **X4:** Idempotency.
* **X5:** Observability.
* **X6:** Quality gates.
* **X7:** Scenario tests.
* **X8:** Admin cockpit.
* **X9:** Runbooks.
* **X10:** Release readiness.
* **X11:** Semantic cleanup.

Minimalne elementy X w fazach:

| Faza                 | Minimalne elementy X                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------------------------- |
| R7 Patron + Payments | idempotencja, audit, duplicate webhook tests, refund/revoke scenarios, DB source-of-truth, post-commit effects |
| R8 Comments          | access policy, deny reasons, moderation audit, patron/public scenarios                                         |
| R9 Email             | webhook idempotency, retry/status semantics, broadcast audit, runbook                                          |
| R10 Cleanup          | stronger guards, legacy import blocks, release checklist alignment                                             |
| R11 Admin            | operational status, failed jobs/webhooks, health, readiness dashboard                                          |

Nie buduj X1–X11 jako osobnych modułów przedwcześnie.

---

## 12. Quality gates

Standardowe komendy walidacyjne:

```bash
npx prisma validate
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
npm test -- --run --coverage
npm run lint
npm run build
```

Jeżeli komenda nie może zostać uruchomiona z powodu środowiska, zależności, bazy danych, Clerk, Stripe, Vercel albo ograniczeń sandboxa, agent musi napisać:

```txt
NOT RUN + dokładny powód
```

Nie wolno pisać PASS bez uruchomienia.

Aktualna znana uwaga CI:

```txt
Jeżeli CI pada na npm ci, dalsze kroki mogą być skipped.
Nie interpretuj tego jako fail typecheck/test/build.
Opisz to jako dependency/install failure.
```

---

## 13. Definicja ukończenia wycinka refaktora

Wycinek refaktora jest ukończony tylko wtedy, gdy:

1. Wybrano konkretny route/przepływ.
2. Sprawdzono obecne zachowanie/kontrakt.
3. Use case obsługuje realny obecny przepływ.
4. Route importuje publiczne API modułu przez `index.ts`.
5. Route nie importuje `@/lib/prisma`, chyba że jest jawnie legacy/allowlisted.
6. Route nie importuje `@/lib/services/**`, chyba że jest jawnie legacy/allowlisted.
7. Route nie importuje wnętrzności modułu.
8. DTO jest minimalne i bezpieczne.
9. Source-of-truth/reguła biznesowa jest przetestowana.
10. Architecture guard chroni zmigrowany route.
11. README zmienia status dopiero po realnej integracji runtime.
12. Znane blokery są opisane, a nie ukryte.
13. Walidacja została uruchomiona albo oznaczona jako NOT RUN z powodem.

Dodanie use case’a to za mało.

Utworzenie folderu modułu to za mało.

Route nie jest zmigrowany, dopóki runtime nie używa modułu.

---

## 14. Znane bieżące blokery

### R5 Users

* Admin users export legacy.
* Subscriber resync legacy.
* Referrals future domain.
* Admin user details mogą zawierać legacy extensions.
* UserProfileService bridge ma pozostać izolowany.

---

### R6 Video / R3 Media

* Playback/media delivery nie jest w pełni modułowe.
* Playback-event persistence może pozostać mixed.
* Admin diagnostics extensions mogą pozostać legacy.
* Publiczne DTO musi nadal chronić przed `videoUrl` leak.

---

### R7 Patron + Payments

* Payment settings route legacy/direct Prisma.
* Admin payments list legacy service.
* Subscriptions/payment boundary mixed.
* `User.isPatron` vs `PatronGrant` drift risk.
* Access nadal czyta read-model, nie docelowo Patron module.
* Full refund -> revoke patron atomicity wymaga sprawdzenia.
* R10 docs/guards mogą być stale po PR #777.
* Legacy payment services są cleanup candidates, nie powinny wracać jako runtime path.

---

### R8 Comments

* Admin comments legacy/mixed.
* Pin route legacy/mixed.
* Context route legacy/mixed.
* Moderation UI pending.
* Moderation audit pending.
* PR #775 pending/reconcile, jeśli nadal open.

---

### R9 Email

* PR #774 pending/reconcile, jeśli nadal open.
* Durable idempotency pending.
* Outbox/retry pending.
* Admin templates/subscriber resync legacy.
* Email bridge może pozostać tymczasowo.

---

### R10 Cleanup

* Inventory wymaga aktualizacji po R7 #777.
* Nie zaczynać masowego cleanupu przed R7/R8/R9 certification.
* Nie usuwać bridge bez sprawdzenia runtime usage.

---

### R11 Admin Cockpit

* Nie rozpoczęto.
* Nie zaczynać przed ustabilizowaniem podstaw domen.

---

## 15. Notatki certyfikacyjne

### R0/R1 Certification

Status:

```txt
R0 [x]
R1 [x]
```

Zakres:

* ustalono README jako source of truth,
* wprowadzono `Actor`,
* wprowadzono `AppContext`,
* wprowadzono Result/Error pattern,
* usunięto przestarzałe skróty kontekstowe,
* dodano podstawowe bariery architektoniczne.

---

### R2/R3/R4 Foundation

Status:

```txt
R2 [x foundation]
R3 [x safety foundation]
R4 [x single-channel foundation]
```

Zakres:

* audit foundation,
* media safety foundation,
* single-channel foundation.

---

### R5/R6/R6.5 Strengthening

Status:

```txt
R5 [x stronger foundation]
R6 [x stronger foundation]
R6.5 [x certified]
```

Zakres:

* users stronger foundation,
* video stronger foundation,
* access video foundation certified,
* `User.isPatron` protected as DB read-model,
* Clerk metadata remains cache.

---

### R7 Core Runtime Migration — post PR #777

Status:

```txt
R7 [~ core runtime migrated / pending certification]
```

Zakres:

* checkout module foundation exists,
* patron module foundation exists,
* admin patron route modular,
* Stripe webhook route delegates to payments module,
* fulfillment/refund/dispute have modular use cases,
* Stripe event lock/idempotency moved to modular path,
* grant/revoke patron support transaction sharing.

Niecertyfikowane / pending:

* refund full revoke transaction sharing must be verified,
* payment settings route remains legacy,
* admin payments remain legacy,
* `User.isPatron` vs `PatronGrant` source-of-truth not fully switched,
* R10 docs/guards stale after #777,
* CI/validation must be checked honestly.

---

### R8 Core Comments

Status:

```txt
R8 [~ core comments migrated]
```

Zakres:

* core comment flows moved toward module,
* comment access policy exists,
* reactions/list/create/update/delete/replies/report largely migrated or partially migrated.

Pending:

* admin comments,
* pin,
* context,
* moderation UI,
* moderation audit,
* PR #775 reconcile if still open.

---

### R9 Email

Status:

```txt
R9 [~ pending certification PR #774]
```

Pending:

* PR #774 review/rebase/reconcile,
* durable idempotency,
* outbox/retry,
* templates/subscriber resync,
* no mutation of patron/payment/access state.

---

## 16. Szablon raportu agenta

Każdy agent kończy zadanie raportem:

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
- Czy statusy są ostrożne, a nie optymistyczne: TAK/NIE

#### Real phase status
- R0:
- R1:
- R2:
- R3:
- R4:
- R5:
- R6:
- R6.5:
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
- CI/Vercel: PASS/FAIL/NOT RUN + powód

#### Architecture guard
- route’y z bezpośrednią Prismą:
- route’y z `@/lib/services`:
- route’y z wewnętrznymi importami modułów:
- importy przestarzałego adaptera kanału:
- nowe wpisy w allowlist:
- stare wpisy wymagające reconcile:

#### Legacy/deprecated adapters
- ...

#### Known blockers
- ...

#### Scope control
- Nie rozpoczęto niepowiązanych domen: TAK/NIE
- Nie zaktualizowano statusu ponad rzeczywistość kodu: TAK/NIE
- Nie ukryto awarii walidacji: TAK/NIE
- Nie potraktowano open PR jako merged main: TAK/NIE

#### Next recommended step
- ...
```

---

## 17. Plan pracy w najbliższym czasie

### Krok 1 — R7/R10 Reconciliation after PR #777

Cel:

* poprawić README, guardy i R10 docs po migracji Stripe webhook/fulfillment/refund/dispute do modułu payments,
* nie oznaczać R7 jako `[x]`,
* opisać R7 jako core runtime migrated / pending certification,
* usunąć stare opisy “Stripe webhook still legacy”,
* sprawdzić refund atomicity.

Zakres:

* README,
* `scripts/check-architecture.ts`,
* `docs/audit/R10-Cleanup-Readiness.md`,
* `docs/audit/R10-Legacy-Service-Inventory.md`,
* `docs/audit/R10-Direct-Prisma-Inventory.md`, jeśli wymaga aktualizacji,
* opcjonalnie test/fix dla refund full revoke transaction sharing.

---

### Krok 2 — R7 Certification Pass

Certyfikuj:

* duplicate webhook nie dubluje payment/grant,
* payment succeeded grantuje patrona atomowo,
* full refund cofa dostęp patrona atomowo,
* partial refund nie powoduje niejawnego błędu statusu,
* lost dispute cofa grant/source-of-truth,
* won dispute zachowuje spójność,
* Clerk sync pozostaje cache/post-commit,
* `User.isPatron` i `PatronGrant` nie driftują bez wykrycia,
* checkout nie używa klientowego `creatorId`.

---

### Krok 3 — R8 Admin/Moderation albo R9 Reconcile

Po R7 certification wybierz jedno:

```txt
A) R8 admin comments / pin / context / moderation audit
B) R9 PR #774 rebase/reconcile/certification
```

Nie robić obu naraz.

---

### Krok 4 — R10 Cleanup dopiero po R7/R8/R9

Dopiero gdy R7/R8/R9 mają realne zastępcze flows, zacznij usuwać legacy.

---

### Krok 5 — R11 Admin Cockpit

Dopiero po ustabilizowaniu domen.

---

## 18. Docelowy cel projektu

Po R0–R11:

```txt
Czysty, praktyczny, produkcyjny monolit modułowy dla ścisłej jednokanałowej platformy twórcy.
```

Po Fazie X:

```txt
Samomonitorujący się system operacyjny dla prywatnej platformy mediowej twórcy.
```

Celem nie jest maksymalna abstrakcja.

Celem jest:

```txt
jak najmniejsza liczba miejsc, w których przyszli agenci albo programiści mogą popełnić niebezpieczne błędy.
```
