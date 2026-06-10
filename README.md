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

Nie wolno oznaczać fazy jako ukończonej tylko dlatego, że powstał folder modułu, pojedynczy use case albo code-only pass.

1. Tryb produktu

Polutek.pl to ścisły, jednokanałowy hub twórcy.

Inwarianty produktu:

jeden oficjalny kanał,
jeden twórca,
jeden katalog treści,
jeden system patronów/dostępu,
jedna społeczność,
jedna prywatna platforma mediowa dla właściciela/twórcy.

To NIE jest:

marketplace dla wielu twórców,
platforma do onboardingu twórców,
mini-Patreon dla wielu twórców,
publiczna wielokanałowa sieć społecznościowa,
ogólny SaaS dla wielu creatorów,
white-label CMS,
multi-tenant creator platform.

Ważne mapowanie modeli:

Creator w bazie danych to legacy techniczna reprezentacja MainChannel.
Nie zmieniaj nazwy Creator -> Channel w Prismie bez osobnego, certyfikowanego migration plan.
Subscription != Patron.
Subskrypcja/obserwowanie oznacza zainteresowanie e-mailami/newsletterem/powiadomieniami.
Dostęp patrona jest kontrolowany przez stan bazy danych.
Aktualny read-model dostępu nadal może korzystać z User.isPatron.
Docelowo źródłem prawdy dla patrona mają być aktywne PatronGrant.
Metadane Clerk to cache/sync, a nie źródło prawdy dla dostępu.
2. Architektura

Aktywny kierunek architektoniczny to modułowy monolit.

Docelowy przepływ:

route -> use-case -> policy/service/repository -> Prisma

Route’y powinny być cienkie.

Route może:

uwierzytelniać,
parsować wejście,
tworzyć AppContext,
wywołać publiczne API modułu,
zamapować wynik na HTTP.

Route nie powinien:

zawierać logiki biznesowej,
importować bezpośrednio @/lib/prisma,
importować bezpośrednio @/lib/services/**,
importować wnętrzności modułu,
wykonywać dużych mapowań DTO,
samodzielnie rozstrzygać polityk dostępu.

Use case powinien zawierać realny przepływ biznesowy.

Policy powinno zawierać reguły biznesowe.

Repository powinno zawierać dostęp do bazy danych.

DTO powinno chronić API/UI przed surowymi modelami Prisma.

Moduły muszą wystawiać publiczne API przez index.ts.

Dozwolone z route’a:

import { handleStripeWebhook } from "@/lib/modules/payments";

Zabronione z route’a:

import { HandleStripeWebhookUseCase } from "@/lib/modules/payments/application/handle-stripe-webhook.use-case";
3. Słownik statusów

Znaczenie statusów:

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

Ważna zasada:

Uznane za gotowe != certyfikowane jako gotowe.

Faza może zostać oznaczona jako certyfikowana tylko wtedy, gdy:

kod działa w runtime,
testy są aktualne,
guardy są aktualne,
README mówi prawdę,
znane blokery są jawnie opisane,
walidacja została uruchomiona albo uczciwie oznaczona jako NOT RUN,
finalny stan main jest zgodny z raportem PR-a.
4. Aktualny status roadmapy R0–R11
Faza	Opis	Status
R0	Zasady, infrastruktura, bariery projektowe	[x]
R1	Shared, Result, błędy, Actor, AppContext	[x]
R2	Audit	[x foundation]
R3	Media	[x safety foundation]
R4	Channel / ścisły single-channel	[x single-channel foundation]
R5	Users	[x stronger foundation]
R6	Video	[x stronger foundation]
R6.5	Access Foundation	[x certified]
R7	Patron + Payments	[~ stronger foundation / certification candidate]
R8	Comments	[~ validated candidate / pending final main deploy]
R9	Email	[~ code-only pass / pending docs+guard reconcile]
R10	Cleanup legacy fasad	[~ preparation inventory / needs reconcile with main]
R11	Frontend admina / kokpit operacyjny	[ ]

Aktualna interpretacja:

R0/R1 są ukończone jako fundament pracy agentów.
R2/R3/R4 są certyfikowanymi foundation, nie pełnym usunięciem każdego legacy.
R5/R6 są mocno zaawansowane i po ostatnich passach mają mocniejszą ochronę, ale nadal mogą mieć jawne legacy extensions.
R6.5 certyfikuje access foundation dla wideo.
R7 core runtime został przesunięty do modułów, ale nie jest jeszcze pełnym [x certified].
R8 Comments przeszedł finalny reconcile / validation pass w PR #787.
R8 ma mocne sygnały walidacji: guardy, typecheck i testy domenowe zostały zadeklarowane jako przechodzące w PR #787.
R8 nie jest jeszcze oznaczone jako [x certified], dopóki finalny deploy/status main nie jest jednoznacznie zielony i README/guardy nie zostaną potwierdzone po merge.
R9 ma code-only preparation pass w main, ale wymaga dokumentacyjnego i guardowego reconcile przed zmianą statusu.
R10 inventory istnieje, ale musi być okresowo uzgadniane z aktualnym main po większych zmianach modułowych.
R11 jeszcze nie wystartowało.
5. Bieżące zadanie
Najbliższe zadanie:
Post-merge verification po PR #787 — R8 Comments Final Reconcile / Certification Candidate Validation.

Cel:
Potwierdzić, że stan main po merge PR #787 jest zgodny z raportem walidacji i że można bezpiecznie rozważyć zmianę R8 z validated candidate na [x certified].

Warunki przed zmianą R8 na [x certified]:
- finalny deploy/status main musi być zielony,
- README musi mówić prawdę o PR #787,
- guardy architektoniczne muszą przechodzić,
- typecheck musi przechodzić,
- testy comments/access/BOLA muszą przechodzić,
- R9 musi pozostać ostrożnie oznaczone jako [~ code-only pass / pending docs+guard reconcile],
- R7 nie może zostać podbite do [x certified] bez osobnego passu,
- nie zaczynać dużego R10 cleanup,
- nie zaczynać R11.

Następny dobry prompt dla agenta kodowania:

Wykonaj post-merge verification po PR #787 — R8 Comments Final Reconcile.

Zakres:
- Sprawdź aktualny main po merge PR #787.
- Nie zmieniaj runtime poza naprawą ewentualnych błędów wykrytych przez walidację.
- Zweryfikuj, czy R8 comments routes nie importują bezpośrednio @/lib/prisma ani legacy comment services.
- Zweryfikuj, czy admin comments routes używają właściwego admin auth boundary.
- Zweryfikuj, czy comments dziedziczą access z video dla patron-only content.
- Zweryfikuj, czy guardy i R10 inventory nie cofają stanu R8.
- R8 ustaw najwyżej jako [x certified] tylko jeśli walidacja main jest zielona.
- R9 zostaw jako [~ code-only pass / pending docs+guard reconcile].
- Nie oznaczaj R7/R9 jako certified.
- Nie zaczynaj R10 cleanup.
- Nie zaczynaj R11.

Na końcu uruchom:
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run

Jeżeli coś nie zostało uruchomione, oznacz jako NOT RUN i podaj powód.
6. Obowiązkowe zasady agentów

Agent musi przestrzegać tych zasad:

Nie przenoś tylko plików.
Nie twórz folderów, nazywając fazę ukończoną.
Nie oznaczaj [x] bez testów i walidacji.
Nie aktualizuj README na bardziej optymistyczne niż rzeczywistość kodu.
Nie zaczynaj nowych faz roadmapy, gdy obecna faza ma znane blokery.
Nie importuj wnętrzności modułów z route’ów.
Nie mieszaj zamkniętych modułów z bezpośrednią Prismą/serwisami w tym samym route, chyba że jest to jawnie allowlisted i opisane.
Nigdy nie wystawiaj surowego videoUrl do publicznego UI/API.
Nie traktuj metadanych Clerk jako źródła prawdy dla dostępu patrona.
Nie wprowadzaj fallbacków twórcy typu polutek, demo-creator, default-creator.
Nie uruchamiaj maintenance/repair z normalnego runtime’u.
Nie zaczynaj Fazy X jako osobnej roadmapy przed ukończeniem R0–R11.
Nie oznaczaj PR-a jako merged tylko dlatego, że istnieje.
Otwarty PR to pending state, nie source of truth main.
Code-only pass nie wystarcza do certyfikacji fazy.
Docs-only pass nie wystarcza do certyfikacji fazy.
Guardy nie mogą kłamać o stanie route’ów.
PR body jest ważnym raportem, ale nie zastępuje post-merge verification na main.

Kluczowe doprecyzowanie:

Faza X nie może wystartować jako osobna roadmapa przed ukończeniem R0–R11.

Ale R7–R11 muszą zawierać minimalne elementy Fazy X naturalne dla swojej domeny, żeby Faza X nie stała się drugim masowym refaktorem.

7. Roadmapa R0–R11
R0 — Zasady i infrastruktura

Cel:

zasady projektu,
README jako źródło prawdy,
skrypty walidacyjne,
bariery architektoniczne,
standard raportów agentów.

Status:

[x]

R0 jest ukończone dla obecnego zakresu.

R1 — Shared, Result, błędy, Actor, AppContext

Cel:

Actor,
AppContext,
UseCaseResult,
AppError,
ReadDb,
WriteTx,
helpery API,
mapowanie odpowiedzi,
brak przestarzałych ctx.userId / ctx.role.

Status:

[x]

R1 jest ukończone jako fundament dla dalszych faz.

R2 — Audit

Cel:

współdzielony moduł audytu,
zdarzenia audytu oparte na aktorze,
logowanie audytu świadome transakcji,
użycie przez zmigrowane moduły.

Status:

[x foundation]

Oznacza to:

lib/modules/audit/** istnieje,
publiczne API przechodzi przez lib/modules/audit/index.ts,
audyt używa AppContext / Actor,
wsparcie dla transakcji istnieje tam, gdzie jest potrzebne,
zmigrowane domeny mogą rejestrować zdarzenia przez moduł audytu.

Nie oznacza jeszcze:

każda akcja legacy w komentarzach/płatnościach/e-mailach/szczegółach admina jest w pełni zmigrowana do modułu audytu.

Pozostałe pokrycie audytem dla komentarzy, płatności, e-maila i szczegółów admina należy do ich własnych przejść domenowych.

R3 — Media

Cel:

bezpieczeństwo mediów,
allowlisty URL,
blokowanie prywatnych hostów,
walidacja miniatur/wideo/awatarów/obrazków w komentarzach,
wykrywanie źródeł HLS/DASH/bezpośrednich,
gwarancje braku wycieku danych w publicznych DTO.

Status:

[x safety foundation]

Oznacza to:

warstwa bezpieczeństwa MediaPolicy istnieje,
bezpieczeństwo URL i blokowanie prywatnych hostów są przetestowane,
publiczne DTO wideo nie wystawia surowego videoUrl,
wykrywanie HLS/DASH istnieje jako klasyfikacja.

Nie oznacza jeszcze:

pełna migracja dostarczania mediów/proxy jest ukończona,
przepisywanie manifestów istnieje,
proxy segmentów istnieje,
app/api/media/**, app/api/media-source/** oraz lib/blob.ts są w pełni zmodularyzowane.

Ważne zastrzeżenie dot. HLS/DASH:

Wykrywanie HLS/DASH istnieje wyłącznie do celów walidacji/klasyfikacji.
Nie oznacza to, że przepisywanie manifestów lub dostarczanie przez proxy segmentów jest zaimplementowane.

Pełne dostarczanie mediów przez proxy to osobny pass, nie warunek obecnej certyfikacji R3.

R4 — Channel / ścisły single-channel

Cel:

jeden kanał,
brak fallbacków creator,
brak fake creator slug,
brak automatycznego tworzenia creatorów w runtime,
Creator traktowany jako legacy reprezentacja MainChannel.

Status:

[x single-channel foundation]

Oznacza to:

inwariant single-channel jest jawny,
fallbacki typu polutek, demo-creator, default-creator są zabronione,
runtime nie powinien tworzyć domyślnego creatora,
nowe prace muszą respektować jeden kanał.

Nie oznacza jeszcze:

model Prisma Creator został przemianowany na Channel,
wszystkie historyczne nazwy i helpery zostały usunięte.

Zmiana nazwy modelu to osobna migracja i nie wolno jej robić przy okazji innej fazy.

R5 — Users

Cel:

uporządkowanie użytkowników,
admin user flows,
role,
profile,
eksport admina,
subscriber/subscription flows,
ochrona przed mieszaniem Subscription i Patron.

Status:

[x stronger foundation]

Oznacza to:

moduł Users istnieje,
część admin/user flows została przesunięta w stronę use case’ów,
admin users export został przesunięty z route’a do modułowego use case’a,
obecny stan jest mocniejszy niż pierwotny legacy.

Nie oznacza jeszcze:

wszystkie user/subscription/referral flows są w pełni certyfikowane,
każdy route użytkowników jest czysty,
wszystkie stare serwisy users są martwe.

Zasada:

Subscription != Patron.

Subskrypcje i patronat nie mogą być traktowane jako to samo.

R6 — Video

Cel:

DTO publicznego wideo,
ochrona przed wyciekiem videoUrl,
publiczne API wideo,
admin video flows,
media-source safety,
playback event safety.

Status:

[x stronger foundation]

Oznacza to:

publiczne DTO wideo zostało wzmocnione,
publiczne API nie powinno wystawiać surowego videoUrl,
runtime publiczny ma silniejsze zabezpieczenia,
raw media URL leak safety jest jawnie chronione.

Nie oznacza jeszcze:

każdy admin video route jest w pełni certyfikowany,
cała analityka/playback jest w pełni zmodularyzowana,
każdy fragment media delivery przeszedł pełną migrację.

Zasada trwała:

Nigdy nie wystawiaj surowego videoUrl do publicznego UI/API.
R6.5 — Access Foundation

Cel:

ujednolicony access foundation,
sprawdzanie dostępu do wideo,
odróżnienie public/patron-only/deleted/not-found,
podstawa dla R7/R8/R9.

Status:

[x certified]

Oznacza to:

access foundation jest certyfikowany dla aktualnego zakresu,
nowe domeny powinny korzystać z modułowego access,
R8 Comments musi dziedziczyć dostęp z filmu,
R7 Patron/Payments musi respektować DB jako źródło prawdy.

Zasada:

Access decision ma wynikać z bazy danych i polityki domenowej, nie z luźnych metadanych Clerk.
R7 — Patron + Payments

Cel:

moduł Patron,
moduł Payments,
checkout,
Stripe webhook,
fulfillment,
refunds,
disputes,
patron grants,
spójność transakcyjna payment -> patron access.

Status:

[~ stronger foundation / certification candidate]

Oznacza to:

core runtime płatności został przesunięty do modułów,
Stripe webhook orchestration został przesunięty w stronę use case’a,
refund/revoke patron flow został wzmocniony,
payment admin flows zostały częściowo zmodularyzowane,
idempotency i transakcyjność są wyraźnie ważne.

Nie oznacza jeszcze:

R7 jest pełnym [x certified],
wszystkie edge-case’y płatności zostały ręcznie zweryfikowane,
każdy admin/payment route jest ostatecznie certyfikowany,
każda ścieżka patron access została przepisana do docelowego PatronGrant.

Warunki certyfikacji R7:

zielone guardy,
zielony typecheck,
zielone testy,
jasny raport transakcyjności,
brak mieszania Clerk metadata jako source of truth,
brak regresji w refund/dispute/fulfillment,
README i docs/audit zgodne z aktualnym kodem.

Zasada trwała:

Payment fulfillment i dostęp patrona muszą być spójne transakcyjnie.
R8 — Comments

Cel:

moduł Comments,
list/create/update/delete,
replies,
reactions,
reports,
pin/unpin,
context,
admin comments,
admin video comments,
moderation,
access control dla patron-only videos,
audyt operacji moderacyjnych.

Status:

[~ validated candidate / pending final main deploy]

Co jest aktualnie interpretowane jako zrobione:

moduł comments istnieje,
core comment flows są zmigrowane do modułu,
publiczne list/create/update/delete/replies/reactions/report działają przez modularne use case’y,
context route został przesunięty w stronę modularnego getCommentContext,
pin/unpin zostały przesunięte w stronę modularnych use case’ów,
admin/comments został przesunięty w stronę modularnego listAdminComments,
admin/videos/[id]/comments korzysta z modularnego listowania komentarzy,
admin comments routes używają mocniejszej granicy admin auth,
komentarze dziedziczą dostęp z filmu,
interakcje z komentarzami pod patron-only video wymagają właściwego dostępu,
guest nie może raportować ani reagować,
legacy pinned PATCH hack został usunięty,
R8 routes nie powinny już importować bezpośrednio @/lib/prisma,
R8 routes nie powinny już importować legacy comment services,
guardy R8 zostały zaktualizowane w kierunku usunięcia R8 z Prisma allowlist,
PR #787 wykonał final reconcile / validation pass dla R8.

R8 nie jest jeszcze automatycznie [x certified].

Warunki certyfikacji R8:

finalny deploy/status main zielony,
npm run quality:architecture-boundaries zielone,
npm run typecheck zielone,
npm test -- --run zielone albo jawnie rozdzielone domain/full validation,
README nie cofa aktualnego source of truth,
guardy nie zawierają stale allowlist dla R8,
route’y R8 nie importują bezpośrednio @/lib/prisma,
route’y R8 nie importują legacy comment services,
admin permission behavior nie został osłabiony przy migracji,
znane pozostałe braki są jawnie opisane.

Pozostające możliwe ryzyka R8:

frontend moderation UI może nadal wymagać osobnego passu,
pełny moderation log UI może nadal wymagać osobnego passu,
finalny status main/deploy musi zostać potwierdzony po merge,
R8 validated candidate nie oznacza jeszcze pełnej certyfikacji.

Zasada trwała:

Komentarze dziedziczą dostęp z filmu.
Jeżeli użytkownik nie ma prawa zobaczyć patron-only video, nie powinien widzieć ani używać komentarzy pod tym filmem.

Następny bezpieczny krok:

R8 post-merge verification na main.

Dopiero po tym można rozważyć zmianę statusu R8 na [x certified].

R9 — Email

Cel:

inbound email management,
admin email responses,
broadcast flows,
Resend webhook,
delivery state,
idempotency,
safety boundary: email module nie może modyfikować patron access.

Status:

[~ code-only pass / pending docs+guard reconcile]

Oznacza to:

istnieje code-only preparation pass w main,
część inbound email management została przesunięta do modułu,
admin email responses route został przesunięty w stronę modularnych use case’ów,
webhook delivery status ma silniejsze zasady status priority,
istnieją testy chroniące przed tym, aby email module modyfikował patron/payment domains.

Nie oznacza jeszcze:

R9 jest certyfikowane,
wszystkie docs/guardy zostały uzgodnione,
broadcast flows są w pełni certyfikowane,
wszystkie admin email route’y są czyste,
R9 można oznaczyć jako [x certified].

Zasada trwała:

Email module nie może nadawać, odbierać ani zmieniać patron access.

R9 nie może pisać do:

User.isPatron,
PatronGrant,
Payment.
R10 — Cleanup legacy fasad

Cel:

inventory legacy services,
inventory direct Prisma route’ów,
usuwanie martwych fasad,
uporządkowanie bridge/facade warstw,
redukcja starych usług po zakończeniu domenowych migracji.

Status:

[~ preparation inventory / needs reconcile with main]

Oznacza to:

istnieje przygotowawcze inventory,
część legacy services została sklasyfikowana,
część direct Prisma route’ów została rozpoznana,
R10 ma być cleanupem po stabilizacji R7/R8/R9.

Nie oznacza jeszcze:

można zacząć masowy cleanup,
można usuwać serwisy bez sprawdzenia runtime usage,
można reorganizować cały projekt,
można przepisywać domeny przy okazji.

Zasada:

R10 nie może wyprzedzać R7/R8/R9.

Najpierw trzeba domknąć i uzgodnić domeny wysokiego ryzyka.

R11 — Frontend admina / kokpit operacyjny

Cel:

admin cockpit,
moderation UI,
operational dashboard,
lepszy frontend admina,
narzędzia dla właściciela/twórcy.

Status:

[ ]

R11 jeszcze nie startuje.

Nie wolno zaczynać R11, dopóki:

R7/R8/R9 nie są wystarczająco stabilne,
guardy i docs nie są uzgodnione,
R10 nie ma jasnego zakresu,
bieżące PR-y nie są rozliczone.
8. Moduły domenowe
Shared

Shared zawiera wspólne typy i helpery:

Actor,
AppContext,
UseCaseResult,
AppError,
ReadDb,
WriteTx,
mapowanie błędów,
helpery route/API.

Shared nie powinien zawierać logiki biznesowej konkretnej domeny.

Audit

Audit odpowiada za zapisywanie zdarzeń.

Zasady:

audyt używa Actor,
audyt powinien działać z transakcją tam, gdzie operacja domenowa jest transakcyjna,
audyt nie powinien samodzielnie rozstrzygać policy domenowych,
audyt nie zastępuje testów ani guardów.
Channel

Channel reprezentuje single-channel product invariant.

Zasady:

jeden kanał,
bez fallbacków creator,
bez runtime auto-create,
bez multi-creator SaaS behavior.
Users

Users odpowiada za użytkowników, profile, role, admin user flows i subscription-related flows.

Zasady:

Users nie może mylić subskrypcji z patronatem.
Users może prezentować read model, ale source of truth patron access należy do domeny patron/access.
Users route’y powinny być cienkie.
Access

Access odpowiada za decyzje dostępu.

Zasady:

access decision wynika z DB i polityki,
Clerk metadata nie jest source of truth,
patron-only content wymaga właściwego dostępu,
comments dziedziczą access z video.
Patron

Patron odpowiada za status patrona i granty dostępu.

Zasady:

patron access musi być kontrolowany przez DB,
docelowo aktywne PatronGrant są source of truth,
User.isPatron może być read-model/cache, ale nie powinien być jedyną długoterminową prawdą.
Payments

Payments odpowiada za Stripe, checkout, fulfillment, refunds i disputes.

Zasady:

idempotency jest obowiązkowa,
fulfillment musi być bezpieczny transakcyjnie,
refund/dispute musi konsekwentnie cofać dostęp,
payment module nie może polegać na optymistycznych metadanych Clerk.
Video

Video odpowiada za publiczne i adminowe wideo.

Zasady:

publiczne DTO nie wystawia videoUrl,
route’y powinny używać modułowego public API,
media/source delivery nie może przeciekać raw storage URL,
playback event persistence musi być jawnie opisane, jeśli pozostaje mixed.
Media

Media odpowiada za bezpieczeństwo URL, klasyfikację źródeł i docelowo delivery/proxy.

Zasady:

blokowanie prywatnych hostów,
allowlisty,
brak raw URL leak,
HLS/DASH detection nie oznacza HLS/DASH proxy.
Comments

Comments odpowiada za komentarze, replies, reactions, reports, pin/unpin, context i admin moderation.

Zasady:

komentarze dziedziczą dostęp z wideo,
guest nie może raportować ani reagować,
non-patron nie może widzieć/interagować z komentarzami pod patron-only video,
route’y comments nie powinny importować @/lib/prisma,
route’y comments nie powinny importować legacy comment services,
admin permission behavior musi pozostać co najmniej tak silne jak przed migracją,
pin/unpin musi iść przez dedykowane use case’y, nie przez legacy PATCH hack.
Email

Email odpowiada za broadcast, inbound responses, webhook delivery i admin email flows.

Zasady:

email module nie modyfikuje patron access,
status delivery nie powinien cofać terminalnych/zaawansowanych stanów,
provider boundary powinien być jawny,
webhook idempotency musi być bezpieczne.
9. Skrypty jakości

Najważniejsze komendy:

npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run

Pełniejsza walidacja:

npm run quality

E2E:

npm run e2e
npm run e2e:list
npm run e2e:install

Jeżeli agent nie uruchomi komendy, musi napisać:

NOT RUN — reason: ...

Nie wolno pisać, że testy przeszły, jeśli nie zostały uruchomione.

10. Guardy architektoniczne

Guardy mają pilnować granic.

Guard nie może być traktowany jako przeszkoda do obejścia.

Jeżeli guard krzyczy:

sprawdź, czy kod łamie zasadę,
sprawdź, czy allowlist jest stale,
sprawdź, czy README/docs mówią prawdę,
nie dodawaj allowlist bez powodu,
nie usuwaj guardów, żeby PR przeszedł.

Allowlist musi mieć:

konkretny plik,
konkretny powód,
fazę roadmapy,
informację, czy to blocker, bridge, certified mixed route, czy legacy extension.

Szczególnie ważne:

R8 comments routes nie powinny być direct Prisma blockers.
R8 comments routes nie powinny importować legacy comment services.
Jeżeli R8 pojawia się w allowlist, agent musi sprawdzić, czy allowlist nie jest stale.
R7/R9/R10 allowlist nie wolno usuwać bez realnej migracji runtime.
R10 inventory musi być zgodne z aktualnym main.
11. Standard raportu agenta

Każdy większy pass powinien zakończyć się raportem.

Format raportu:

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

Nie wolno pisać „done” bez listy walidacji i znanych blockerów.

12. Czego nie robić

Nie rób:

masowego rewrite,
zmiany kilku faz naraz,
R10 cleanup przed stabilizacją R7/R8/R9,
R11 frontend przed stabilizacją domen,
optymistycznego README,
certyfikacji bez testów,
usuwania legacy services bez inventory,
dodawania fallback creator/channel,
publicznego wystawiania raw media URL,
traktowania PR body jako dowodu, że kod przeszedł walidację,
traktowania otwartego PR jako source of truth,
traktowania samego merge jako dowodu finalnego zielonego main,
podbijania R8 do [x certified] bez post-merge verification.
13. Obecny najbezpieczniejszy proces

Aktualny proces po PR #787:

1. Sprawdzić finalny status deploy/status checks dla merge commit na main.
2. Uruchomić albo potwierdzić:
   - npm run quality:architecture-boundaries
   - npm run typecheck
   - npm test -- --run
3. Zweryfikować, czy README mówi prawdę o R8/R9/R10.
4. Zweryfikować, czy R8 nie wróciło do direct Prisma ani legacy comments services.
5. Zweryfikować, czy admin comments auth boundary nie został osłabiony.
6. Jeżeli wszystko zielone, zrobić mały docs/status pass dla R8.
7. Dopiero wtedy rozważyć zmianę R8 na [x certified].

Nie oznaczać R8 jako [x certified], dopóki:

finalny main/deploy nie jest zielony,
full validation albo jawnie opisany validation matrix nie jest dostępny,
README/guardy/docs nie są spójne,
R9 nie pozostaje ostrożnie oznaczone jako code-only/pending reconcile.
14. Krótki opis projektu

Polutek.pl jest prywatną platformą mediową jednego twórcy.

Produkt ma umożliwiać:

publikację treści wideo,
dostęp publiczny i patron-only,
patronat i płatności,
komentarze i społeczność,
newsletter/e-mail,
admin moderation,
audyt działań,
operacyjny kokpit dla właściciela.

Produkt nie ma być platformą dla wielu twórców.

15. Zasada końcowa

Najważniejsza zasada prowadzenia projektu:

Najpierw prawda o stanie systemu.
Potem mały zakres.
Potem walidacja.
Dopiero potem status.

Jeżeli agent nie wie, czy coś jest gotowe, ma założyć, że nie jest certyfikowane.
