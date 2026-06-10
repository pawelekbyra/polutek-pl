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
[~ validated candidate]       kandydat przeszedł walidację domenową, ale nie jest jeszcze finalnie certified
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
* walidacja została uruchomiona albo uczciwie oznaczona jako NOT RUN,
* finalny stan `main` jest zgodny z raportem PR-a.

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
| **R8**   | Comments                                   | `[x certified]`                                         |
| **R9**   | Email                                      | `[x certified]`                                         |
| **R10**  | Cleanup legacy fasad                       | `[~ cleanup pending / inventory reconciled after #795/#797]` |
| **R11**  | Frontend admina / kokpit operacyjny        | `[ ]`                                                   |

Aktualna interpretacja:

* R0/R1 są ukończone jako fundament pracy agentów.
* R2/R3/R4 są certyfikowanymi foundation, nie pełnym usunięciem każdego legacy.
* R5/R6 są mocno zaawansowane i po ostatnich passach mają mocniejszą ochronę, ale nadal mogą mieć jawne legacy extensions.
* R6.5 certyfikuje access foundation dla wideo.
* R7 core runtime został przesunięty do modułów i wzmocniony testami, ale nie jest jeszcze pełnym `[x certified]`.
* R8 Comments przeszedł finalny reconcile / validation pass i został certyfikowany jako `[x certified]`.
* R9 Email został domknięty po templates completion: admin templates CRUD przeniesiony do modułu email, R9 routes usunięte z direct Prisma allowlist, dodane testy template use-case’ów.
* R10 inventory zostało odświeżone, ale po certyfikacji R9 wymaga lekkiego post-R9 reconcile przed realnym cleanupem.
* R11 jeszcze nie wystartowało.
* Otwarte PR-y #791 i #792 są stare/duplikujące R9 i nie powinny być mergowane po merge #793.

---

## 5. Bieżące zadanie

```txt
Najbliższe zadanie:
R10 Cleanup: Admin Subscribers Resync / Referrals.

Cel:
Zmigrować pozostałą logikę resync subskrybentów i claimowania poleceń do modułów, usuwając direct Prisma usage.

Stan:
- #795 Admin Stats modularization zmergowany.
- #797 Subscriptions modularization zmergowany.
- R10 Inventory został uzgodniony po modularizacji subskrypcji i statystyk.
- app/api/user/referrals/route.ts jest już czysty.
```

Następny dobry prompt dla agenta kodowania/dokumentacji:

```txt
Start from current main.

Task: R10 Cleanup: Admin Subscribers Resync / Referrals.

Goal:
Zmigrować pozostałą logikę resync subskrybentów i claimowania poleceń do modułów, usuwając direct Prisma usage w app/api/admin/subscribers/resync/route.ts oraz app/api/user/referrals/claim/route.ts.

Required:
- Runtime code modifications allowed ONLY for the narrow scope of Admin Subscribers Resync / Referrals.
- Update docs/audit/R10-Direct-Prisma-Inventory.md and R10-Next-Cleanup-Plan.md after cleanup.
- Do not touch README/notatka/docs/architecture unless explicitly asked.
- Do not touch R9 email code or R7/R8 runtime.
- Use modular Use Cases and Repositories.

Validation:
- npm run quality:architecture-boundaries
- npm run typecheck
- npm test -- --run

Output:
- confirmed Prisma removal from target routes
- updated R10 inventory count
- list of removed legacy services
```

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
* PR body jest ważnym raportem, ale nie zastępuje post-merge verification na `main`.

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

R1 jest ukończone jako fundament dla dalszych faz.

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
* zmigrowane domeny mogą rejestrować zdarzenia przez moduł audytu.

Nie oznacza jeszcze:

* każda akcja legacy w komentarzach/płatnościach/e-mailach/szczegółach admina jest w pełni zmigrowana do modułu audytu.

Pozostałe pokrycie audytem dla komentarzy, płatności, e-maila i szczegółów admina należy do ich własnych przejść domenowych.

---

## R3 — Media

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

Pełne dostarczanie mediów przez proxy to osobny pass, nie warunek obecnej certyfikacji R3.

---

## R4 — Channel / ścisły single-channel

Cel:

* jeden kanał,
* brak fallbacków creator,
* brak fake creator slug,
* brak automatycznego tworzenia creatorów w runtime,
* `Creator` traktowany jako legacy reprezentacja `MainChannel`.

Status:

```txt
[x single-channel foundation]
```

Oznacza to:

* inwariant single-channel jest jawny,
* fallbacki typu `polutek`, `demo-creator`, `default-creator` są zabronione,
* runtime nie powinien tworzyć domyślnego creatora,
* nowe prace muszą respektować jeden kanał.

Nie oznacza jeszcze:

* model Prisma `Creator` został przemianowany na `Channel`,
* wszystkie historyczne nazwy i helpery zostały usunięte.

Zmiana nazwy modelu to osobna migracja i nie wolno jej robić przy okazji innej fazy.

---

## R5 — Users

Cel:

* uporządkowanie użytkowników,
* admin user flows,
* role,
* profile,
* eksport admina,
* subscriber/subscription flows,
* ochrona przed mieszaniem `Subscription` i `Patron`.

Status:

```txt
[x stronger foundation]
```

Oznacza to:

* moduł Users istnieje,
* część admin/user flows została przesunięta w stronę use case’ów,
* admin users export został przesunięty z route’a do modułowego use case’a,
* obecny stan jest mocniejszy niż pierwotny legacy.

Nie oznacza jeszcze:

* wszystkie user/subscription/referral flows są w pełni certyfikowane,
* każdy route użytkowników jest czysty,
* wszystkie stare serwisy users są martwe.

Zasada:

```txt
Subscription != Patron.
```

Subskrypcje i patronat nie mogą być traktowane jako to samo.

---

## R6 — Video

Cel:

* DTO publicznego wideo,
* ochrona przed wyciekiem `videoUrl`,
* publiczne API wideo,
* admin video flows,
* media-source safety,
* playback event safety.

Status:

```txt
[x stronger foundation]
```

Oznacza to:

* publiczne DTO wideo zostało wzmocnione,
* publiczne API nie powinno wystawiać surowego `videoUrl`,
* runtime publiczny ma silniejsze zabezpieczenia,
* raw media URL leak safety jest jawnie chronione.

Nie oznacza jeszcze:

* każdy admin video route jest w pełni certyfikowany,
* cała analityka/playback jest w pełni zmodularyzowana,
* każdy fragment media delivery przeszedł pełną migrację.

Zasada trwała:

```txt
Nigdy nie wystawiaj surowego videoUrl do publicznego UI/API.
```

---

## R6.5 — Access Foundation

Cel:

* ujednolicony access foundation,
* sprawdzanie dostępu do wideo,
* odróżnienie public/patron-only/deleted/not-found,
* podstawa dla R7/R8/R9.

Status:

```txt
[x certified]
```

Oznacza to:

* access foundation jest certyfikowany dla aktualnego zakresu,
* nowe domeny powinny korzystać z modułowego access,
* R8 Comments musi dziedziczyć dostęp z filmu,
* R7 Patron/Payments musi respektować DB jako źródło prawdy.

Zasada:

```txt
Access decision ma wynikać z bazy danych i polityki domenowej, nie z luźnych metadanych Clerk.
```

---

## R7 — Patron + Payments

Cel:

* moduł Patron,
* moduł Payments,
* checkout,
* Stripe webhook,
* fulfillment,
* refunds,
* disputes,
* patron grants,
* spójność transakcyjna payment -> patron access.

Status:

```txt
[~ stronger foundation / certification candidate]
```

Oznacza to:

* core runtime płatności został przesunięty do modułów,
* Stripe webhook orchestration został przesunięty w stronę use case’a,
* refund/revoke patron flow został wzmocniony,
* payment admin flows zostały częściowo zmodularyzowane,
* idempotency i transakcyjność są wyraźnie ważne,
* testy R7 zostały dodatkowo wzmocnione w PR #789.

Nie oznacza jeszcze:

* R7 jest pełnym `[x certified]`,
* wszystkie edge-case’y płatności zostały ręcznie zweryfikowane,
* każdy admin/payment route jest ostatecznie certyfikowany,
* każda ścieżka patron access została przepisana do docelowego `PatronGrant`.

Warunki certyfikacji R7:

* zielone guardy,
* zielony typecheck,
* zielone testy,
* jasny raport transakcyjności,
* brak mieszania Clerk metadata jako source of truth,
* brak regresji w refund/dispute/fulfillment,
* README i docs/audit zgodne z aktualnym kodem.

Zasada trwała:

```txt
Payment fulfillment i dostęp patrona muszą być spójne transakcyjnie.
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
* admin video comments,
* moderation,
* access control dla patron-only videos,
* audyt operacji moderacyjnych.

Status:

```txt
[x certified]
```

Co jest aktualnie interpretowane jako zrobione:

* moduł `comments` istnieje,
* core comment flows są zmigrowane do modułu,
* publiczne list/create/update/delete/replies/reactions/report działają przez modularne use case’y,
* `context` route został przesunięty w stronę modularnego `getCommentContext`,
* `pin/unpin` zostały przesunięte w stronę modularnych use case’ów,
* `admin/comments` został przesunięty w stronę modularnego `listAdminComments`,
* `admin/videos/[id]/comments` korzysta z modularnego listowania komentarzy,
* admin comments routes używają mocniejszej granicy admin auth,
* komentarze dziedziczą dostęp z filmu,
* interakcje z komentarzami pod patron-only video wymagają właściwego dostępu,
* guest nie może raportować ani reagować,
* legacy `pinned` PATCH hack został usunięty,
* R8 routes nie powinny importować bezpośrednio `@/lib/prisma`,
* R8 routes nie powinny importować legacy comment services,
* guardy R8 zostały zaktualizowane,
* R8 został oznaczony jako `[x certified]` po finalnym reconcile i certyfikacji.

Pozostające możliwe prace poza certyfikacją R8:

* frontend moderation UI może nadal wymagać osobnego passu,
* pełny moderation log UI może nadal wymagać osobnego passu,
* admin cockpit/moderation UX należy do R11.

Zasada trwała:

```txt
Komentarze dziedziczą dostęp z filmu.
Jeżeli użytkownik nie ma prawa zobaczyć patron-only video, nie powinien widzieć ani używać komentarzy pod tym filmem.
```

---

## R9 — Email

Cel:

* inbound email management,
* admin email responses,
* admin email templates,
* broadcast flows,
* Resend webhook,
* delivery state,
* idempotency,
* safety boundary: email module nie może modyfikować patron access.

Status:

```txt
[x certified]
```

Oznacza to:

* broadcast admin route używa modułowych use case’ów,
* admin email responses route używa modułowych use case’ów,
* Resend webhook używa modułowego use case’a,
* admin email templates route został refaktoryzowany do cienkiego adaptera,
* email template CRUD został przeniesiony do `lib/modules/email/**`,
* sanitization HTML dla templates zostało przeniesione do warstwy use case,
* audit logging `TEMPLATE_SAVED` i `TEMPLATE_DELETED` został przeniesiony do warstwy use case/module,
* R9 routes zostały usunięte z direct Prisma allowlist,
* dodane zostały testy dla email template use-case’ów,
* R9 jest certyfikowane dla aktualnego zakresu roadmapy.

Nie oznacza jeszcze:

* cały przyszły email cockpit UI jest gotowy,
* retry/outbox/advanced delivery UI jest gotowy,
* pełny admin email UX jest finalny,
* wszystkie przyszłe funkcje newslettera są zaimplementowane.

Zasada trwała:

```txt
Email module nie może nadawać, odbierać ani zmieniać patron access.
```

R9 nie może pisać do:

* `User.isPatron`,
* `PatronGrant`,
* `Payment`.

---

## R10 — Cleanup legacy fasad

Cel:

* inventory legacy services,
* inventory direct Prisma route’ów,
* usuwanie martwych fasad,
* uporządkowanie bridge/facade warstw,
* redukcja starych usług po zakończeniu domenowych migracji.

Status:

```txt
[~ preparation inventory / post-R9 reconcile needed]
```

Oznacza to:

* inventory R10 zostało przygotowane i zmergowane,
* część legacy services została sklasyfikowana,
* część direct Prisma route’ów została rozpoznana,
* R10 ma być cleanupem po stabilizacji R7/R8/R9,
* po merge R9 templates completion inventory R10 może zawierać stale wpisy dotyczące R9 i wymaga lekkiego reconcile.

Nie oznacza jeszcze:

* R10 jest ukończone,
* można zacząć masowy cleanup bez dodatkowego sprawdzenia,
* można usuwać serwisy bez sprawdzenia runtime usage,
* można reorganizować cały projekt,
* można przepisywać domeny przy okazji.

Zasada:

```txt
R10 nie może wyprzedzać R7/R8/R9.
```

Po certyfikacji R9 najbezpieczniejszy kolejny krok R10 to:

```txt
R10 Inventory Post-R9 Reconcile.
```

Dopiero potem:

```txt
R10 Dead Services Removal / Cleanup PRs.
```

---

## R11 — Frontend admina / kokpit operacyjny

Cel:

* admin cockpit,
* moderation UI,
* operational dashboard,
* lepszy frontend admina,
* narzędzia dla właściciela/twórcy.

Status:

```txt
[ ]
```

R11 jeszcze nie startuje.

Nie wolno zaczynać runtime R11, dopóki:

* R7/R8/R9 nie są wystarczająco stabilne,
* guardy i docs nie są uzgodnione,
* R10 nie ma jasnego zakresu,
* bieżące PR-y nie są rozliczone.

Dozwolone przed R11 runtime:

* docs-only Admin Operations Spec,
* docs-only Admin Action Policy Matrix,
* docs-only Admin Cockpit UX plan,
* docs-only Sidebar Playlist Product Spec.

---

# 8. Moduły domenowe

## Shared

Shared zawiera wspólne typy i helpery:

* `Actor`,
* `AppContext`,
* `UseCaseResult`,
* `AppError`,
* `ReadDb`,
* `WriteTx`,
* mapowanie błędów,
* helpery route/API.

Shared nie powinien zawierać logiki biznesowej konkretnej domeny.

---

## Audit

Audit odpowiada za zapisywanie zdarzeń.

Zasady:

* audyt używa `Actor`,
* audyt powinien działać z transakcją tam, gdzie operacja domenowa jest transakcyjna,
* audyt nie powinien samodzielnie rozstrzygać policy domenowych,
* audyt nie zastępuje testów ani guardów.

---

## Channel

Channel reprezentuje single-channel product invariant.

Zasady:

* jeden kanał,
* bez fallbacków creator,
* bez runtime auto-create,
* bez multi-creator SaaS behavior.

---

## Users

Users odpowiada za użytkowników, profile, role, admin user flows i subscription-related flows.

Zasady:

* Users nie może mylić subskrypcji z patronatem.
* Users może prezentować read model, ale source of truth patron access należy do domeny patron/access.
* Users route’y powinny być cienkie.

---

## Access

Access odpowiada za decyzje dostępu.

Zasady:

* access decision wynika z DB i polityki,
* Clerk metadata nie jest source of truth,
* patron-only content wymaga właściwego dostępu,
* comments dziedziczą access z video.

---

## Patron

Patron odpowiada za status patrona i granty dostępu.

Zasady:

* patron access musi być kontrolowany przez DB,
* docelowo aktywne `PatronGrant` są source of truth,
* `User.isPatron` może być read-model/cache, ale nie powinien być jedyną długoterminową prawdą.

---

## Payments

Payments odpowiada za Stripe, checkout, fulfillment, refunds i disputes.

Zasady:

* idempotency jest obowiązkowa,
* fulfillment musi być bezpieczny transakcyjnie,
* refund/dispute musi konsekwentnie cofać dostęp,
* payment module nie może polegać na optymistycznych metadanych Clerk.

---

## Video

Video odpowiada za publiczne i adminowe wideo.

Zasady:

* publiczne DTO nie wystawia `videoUrl`,
* route’y powinny używać modułowego public API,
* media/source delivery nie może przeciekać raw storage URL,
* playback event persistence musi być jawnie opisane, jeśli pozostaje mixed.

---

## Media

Media odpowiada za bezpieczeństwo URL, klasyfikację źródeł i docelowo delivery/proxy.

Zasady:

* blokowanie prywatnych hostów,
* allowlisty,
* brak raw URL leak,
* HLS/DASH detection nie oznacza HLS/DASH proxy.

---

## Comments

Comments odpowiada za komentarze, replies, reactions, reports, pin/unpin, context i admin moderation.

Zasady:

* komentarze dziedziczą dostęp z wideo,
* guest nie może raportować ani reagować,
* non-patron nie może widzieć/interagować z komentarzami pod patron-only video,
* route’y comments nie powinny importować `@/lib/prisma`,
* route’y comments nie powinny importować legacy comment services,
* admin permission behavior musi pozostać co najmniej tak silne jak przed migracją,
* pin/unpin musi iść przez dedykowane use case’y, nie przez legacy PATCH hack.

---

## Email

Email odpowiada za broadcast, inbound responses, webhook delivery, template management i admin email flows.

Zasady:

* email module nie modyfikuje patron access,
* status delivery nie powinien cofać terminalnych/zaawansowanych stanów,
* provider boundary powinien być jawny,
* webhook idempotency musi być bezpieczne,
* template CRUD nie powinien być wykonywany bezpośrednio w route,
* sanitization i audit dla templates należą do use-case/module layer.

---

# 9. Skrypty jakości

Najważniejsze komendy:

```bash
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
```

Pełniejsza walidacja:

```bash
npm run quality
```

E2E:

```bash
npm run e2e
npm run e2e:list
npm run e2e:install
```

Jeżeli agent nie uruchomi komendy, musi napisać:

```txt
NOT RUN — reason: ...
```

Nie wolno pisać, że testy przeszły, jeśli nie zostały uruchomione.

---

# 10. Guardy architektoniczne

Guardy mają pilnować granic.

Guard nie może być traktowany jako przeszkoda do obejścia.

Jeżeli guard krzyczy:

* sprawdź, czy kod łamie zasadę,
* sprawdź, czy allowlist jest stale,
* sprawdź, czy README/docs mówią prawdę,
* nie dodawaj allowlist bez powodu,
* nie usuwaj guardów, żeby PR przeszedł.

Allowlist musi mieć:

* konkretny plik,
* konkretny powód,
* fazę roadmapy,
* informację, czy to blocker, bridge, certified mixed route, czy legacy extension.

Szczególnie ważne:

* R8 comments routes nie powinny być direct Prisma blockers.
* R8 comments routes nie powinny importować legacy comment services.
* R9 email routes nie powinny być direct Prisma blockers po certyfikacji R9.
* Jeżeli R8 albo R9 pojawia się w direct Prisma allowlist, agent musi sprawdzić, czy allowlist nie jest stale.
* R7/R10/R11 allowlist nie wolno usuwać bez realnej migracji runtime.
* R10 inventory musi być zgodne z aktualnym main.

---

# 11. Standard raportu agenta

Każdy większy pass powinien zakończyć się raportem.

Format raportu:

```md
# Report

## Scope
Co było zakresem.

## Changed files
Lista głównych zmian.

## Architecture
Jak zmiana wpływa na route/use-case/policy/repository.

## Runtime behavior
Co zmienia się w zachowaniu aplikacji.

## Tests
Co uruchomiono.

## Validation
- npm run quality:architecture-boundaries:
- npm run typecheck:
- npm test -- --run:

## NOT RUN
Co nie zostało uruchomione i dlaczego.

## Remaining blockers
Co nadal zostaje.

## Merge recommendation
SAFE TO MERGE / NOT SAFE TO MERGE.
```

Nie wolno pisać „done” bez listy walidacji i znanych blockerów.

---

# 12. Czego nie robić

Nie rób:

* masowego rewrite,
* zmiany kilku faz naraz,
* R10 cleanup bez aktualnego inventory,
* R11 frontend przed stabilizacją domen,
* optymistycznego README,
* certyfikacji bez testów,
* usuwania legacy services bez inventory,
* dodawania fallback creator/channel,
* publicznego wystawiania raw media URL,
* traktowania PR body jako dowodu, że kod przeszedł walidację,
* traktowania otwartego PR jako source of truth,
* traktowania samego merge jako dowodu finalnego zielonego main,
* mergowania starych duplikatów PR po tym, jak ich zakres został zrealizowany nowszym PR-em.

---

# 13. Obecny najbezpieczniejszy proces

Aktualny proces po merge R9 Email Templates Completion:

```txt
1. R8 i R9 są [x certified].
2. R10 Inventory został uzgodniony po modularizacji subskrypcji (#797) i statystyk (#795).
3. Kolejny krok to R10 cleanup PR-y:
   - Admin subscribers resync / referrals (current target),
   - Playback-event route,
   - Admin videos [id] audit extension,
   - Media/[...path] delivery check,
   - Admin comments moderation leftovers,
   - Dead services scan/removal.
4. R11 tylko jako docs/spec przed runtime implementation.
```

Nie oznaczać R10 jako `[x]`, dopóki:

* cleanup nie jest faktycznie wykonany,
* dead services nie są potwierdzone jako martwe,
* direct Prisma inventory nie jest aktualne,
* guardy i README nie są spójne.

---

# 14. Krótki opis projektu

Polutek.pl jest prywatną platformą mediową jednego twórcy.

Produkt ma umożliwiać:

* publikację treści wideo,
* dostęp publiczny i patron-only,
* patronat i płatności,
* komentarze i społeczność,
* newsletter/e-mail,
* admin moderation,
* audyt działań,
* operacyjny kokpit dla właściciela.

Produkt nie ma być platformą dla wielu twórców.

---

# 15. Zasada końcowa

Najważniejsza zasada prowadzenia projektu:

```txt
Najpierw prawda o stanie systemu.
Potem mały zakres.
Potem walidacja.
Dopiero potem status.
```

Jeżeli agent nie wie, czy coś jest gotowe, ma założyć, że nie jest certyfikowane.
