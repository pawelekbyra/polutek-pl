# Polutek.pl — Product & Architecture Blueprint Notes for Future AI

## 0. Status tej notatki

Ta notatka opisuje docelową wizję produktu i architektury Polutek.pl.

Nie jest raportem wykonania.

Nie oznacza, że opisane rzeczy są już zaimplementowane.

Nie jest checklistą merge’ów.

Nie jest PR body.

Nie jest README.

Ta notatka jest strategicznym blueprintem: mówi, w którą stronę mają iść przyszłe decyzje produktowe, architektoniczne, prompty dla agentów, refaktory i roadmapa małych PR-ów.

README pozostaje operacyjnym źródłem prawdy o aktualnym stanie kodu, statusie faz, aktualnym main i najbliższych taskach.

Najważniejsza zasada:

```txt
Target architecture != current implementation.
```

Jeżeli README, kod i ta notatka się różnią, agent ma najpierw ustalić, czy wykonuje:

```txt
current-state cleanup
```

czy:

```txt
target-architecture implementation
```

Nie wolno po cichu wdrażać całego blueprintu przy okazji małego taska.

Nie wolno traktować tej notatki jako dowodu, że dany moduł już działa.

Jeżeli jakiś folder lub model istnieje w kodzie, to nie znaczy, że runtime rzeczywiście przez niego przechodzi.

Najważniejsze zdanie dla agentów:

```txt
Najpierw sprawdź kod. Potem porównaj z README. Dopiero potem użyj tej notatki jako targetu.
```

---

# 1. Cel projektu

Polutek.pl ma być prywatną, jednokanałową platformą VOD/patron-content dla jednego twórcy.

To nie jest:

* marketplace,
* multi-creator SaaS,
* mini-Patreon dla wielu twórców,
* white-label CMS,
* platforma z tenantami,
* publiczna wielokanałowa sieć społecznościowa,
* ogólny SaaS dla creatorów,
* projekt do nieskończonego dokładania funkcji.

To ma być:

* jedno miejsce,
* jeden twórca,
* jeden katalog filmów,
* jedna społeczność,
* jeden system patronów,
* jeden system mailingowy,
* jeden admin cockpit,
* jeden prosty produkt.

Decyzja właściciela produktu:

```txt
Polutek.pl zostaje platformą dla jednego twórcy i jednego katalogu.
Nie projektujemy multi-creator.
```

Najważniejsze zdanie produktowe:

```txt
Polutek.pl nie ma być platformą. Polutek.pl ma być miejscem.
```

Miejsce oznacza:

* jasny klimat,
* prosty dostęp,
* dobre filmy,
* dobre komentarze,
* szybki player,
* zaufany patronat,
* czytelny mailing,
* panel admina, który naprawdę pomaga właścicielowi.

---

# 2. Fundamentalne decyzje produktowe

## 2.1 Jeden twórca

Decyzja:

```txt
Jeden twórca.
Jeden oficjalny kanał.
Jeden katalog.
```

Nie robić:

* tenantów,
* creator onboardingu,
* wielu kanałów,
* marketplace,
* multi-provider creator billing,
* creator payoutów,
* podziału revenue między twórców.

Jeśli w bazie istnieje model `Creator`, należy traktować go jako historyczną/techniczną reprezentację głównego kanału, nie jako zaproszenie do budowania multi-creator SaaS.

Nie zmieniać `Creator -> Channel` bez osobnego migration planu.

## 2.2 Trzy poziomy dostępu do filmów

System ma mieć trzy poziomy dostępu:

```txt
PUBLIC
LOGGED_IN
PATRON
```

Decyzja właściciela:

```txt
LOGGED_IN zostaje.
```

Każdy film ma dokładnie jeden access tier.

Na start nie projektujemy bardziej złożonych reguł typu tag-based access, segmenty, kolekcje premium albo kilka poziomów patrona.

## 2.3 Subscription != Patron

Najważniejsze rozróżnienie:

```txt
Subscription != Patron
```

Subskrypcja / Sub / Subscribe oznacza:

```txt
mailing / follow / powiadomienia / zainteresowanie treściami
```

Nie oznacza:

* patrona,
* płatności,
* premium access,
* dostępu do filmów patron-only,
* donejtu,
* aktywnej usługi subskrypcyjnej.

Decyzja właściciela:

```txt
Subscription/Sub = mailing/follow/powiadomienia.
Patron access jest osobnym statusem.
Wypisanie się z newslettera nigdy nie wpływa na patron access.
```

## 2.4 Patronat jako nagroda za donejt

Patronat nie jest subskrypcją cykliczną.

Decyzja właściciela:

```txt
Patronat na start wynika z jednorazowego donejtu.
Donejt daje nagrodę/status patrona.
To nie jest usługa subskrypcyjna.
Patron access jest bezterminowy, bo jest nagrodą za wsparcie.
```

Produktowo używać języka:

* wesprzyj,
* donejt,
* zostań patronem,
* nagroda za wsparcie,
* status patrona,
* dostęp patrona.

Unikać przy patronacie:

* subskrypcja,
* abonament,
* opłać dostęp,
* miesięczna usługa,
* kup dostęp,
* renewal.

Główne CTA:

```txt
Wesprzyj twórcę i zostań patronem.
```

## 2.5 Patron access source of truth

Docelowy invariant:

```txt
Patron access = exists active PatronGrant.
```

Nie:

```txt
User.isPatron
Clerk metadata
Subscription
Payment alone
Stripe state alone
frontend state
```

`PatronGrant` jest techniczną podstawą dostępu.

Użytkownik jest patronem, jeśli ma co najmniej jeden aktywny `PatronGrant`.

---

# 3. Obecny etap: R10 / cleanup fundamentu

Obecnie najważniejsza praca to R10, czyli cleanup legacy fasad i pozostałości prototypu.

R10 nie jest momentem na wdrożenie całej wizji provider-agnostic video, finalnego PatronGrant modelu, nowego playera ani pełnego admin cockpit.

R10 ma przygotować grunt.

R10 ma usuwać:

* direct Prisma imports z route’ów,
* route’y mieszające HTTP, bazę i biznes,
* stare `lib/services/**`, jeśli są martwe albo zastąpione modułami,
* fałszywe allowlisty,
* niespójności README/docs/guardów,
* przepływy, w których route decyduje o access/patron/payment/subscription lokalnie.

R10 ma doprowadzić system do stanu, w którym kolejne fazy będą możliwe bez walki z lepionką.

Docelowy wzorzec architektury:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Route może:

* uwierzytelnić,
* sparsować input,
* stworzyć `AppContext`,
* wywołać publiczne API modułu,
* zmapować wynik na HTTP response.

Route nie może:

* importować `@/lib/prisma`,
* importować `@/lib/services/**`,
* importować wewnętrznych plików modułu zamiast publicznego `index.ts`,
* zawierać logiki biznesowej,
* podejmować lokalnie decyzji o patronie, płatności, dostępie, mailingach, komentarzach albo mediach.

Najważniejsza zasada R10:

```txt
Najpierw sprzątamy stół. Potem budujemy premium VOD.
```

Przed większą pracą po R10 trzeba zrobić truth reconciliation:

```txt
README
docs/audit
guardy
actual code
routes
modules
Prisma schema
```

Guardy nie mogą kłamać.

Allowlisty nie mogą być stale.

Jeśli allowlista zawiera naruszenie, którego już nie ma, guard powinien to zgłaszać.

---

# 4. Sposób pracy z AI i agentami

Projekt powinien być prowadzony jak praca kilku inżynierów pod kontrolą tech leada.

Właściciel projektu:

* ustala wizję,
* decyduje o priorytetach,
* akceptuje poziom ryzyka,
* podejmuje decyzje produktowe,
* pilnuje prostoty produktu,
* nie musi znać wszystkich szczegółów technicznych.

ChatGPT / architekt / tech lead:

* rozbija cele na małe, bezpieczne zadania,
* pisze prompty dla agentów,
* pilnuje scope’u,
* reviewuje PR-y,
* decyduje merge/no merge,
* wykrywa konflikty architektoniczne,
* aktualizuje strategię po każdym merge,
* nie pozwala agentom robić “przy okazji” dużych zmian.

Jules / agenci kodujący:

* dostają mały ticket,
* pracują na branchu,
* raportują changed files,
* raportują testy,
* nie zgadują produktu,
* nie rozszerzają scope’u,
* nie zmieniają README/docs, jeśli ticket tego nie mówi,
* nie dotykają płatności/patrona/video/admina przy okazji unrelated taska.

Zasady równoległości:

* maksymalnie dwa aktywne zadania kodujące naraz,
* zadania równoległe muszą być izolowane domenowo,
* nie odpalać dwóch agentów w tej samej domenie,
* zawsze zostawić rezerwę na rescue/closer,
* docs/README robić w osobnych, kontrolowanych PR-ach,
* po większych zmianach robić reconcile/certification.

Format pracy nad dużą domeną:

```txt
inventory
ideal spec
gap analysis
small PRs
review
merge
post-merge sanity
reconcile
certification
```

Nigdy:

```txt
"ulepsz projekt"
```

Zawsze:

```txt
mały cel
mały scope
zakazane pliki
warunki walidacji
raport
merge recommendation
```

---

# 5. Główna wizja produktu

Polutek.pl ma być maksymalnie zrozumiały.

Użytkownik ma rozumieć:

* co może oglądać,
* co jest dla zalogowanych,
* co jest dla patronów,
* dlaczego coś jest zablokowane,
* jak zostać patronem,
* co daje subskrypcja mailingu,
* kto może komentować,
* czemu player jest locked,
* czym różni się donejt od subskrypcji mailingu.

Produkt ma mieć proste fakty:

```txt
User exists
Video exists
Video has tier
User is logged in or not
Payment exists
PatronGrant exists
User subscribed to mailing
Comment exists
VideoAsset exists
Video asset is ready
Email was sent
Audit event exists
```

I proste polityki:

```txt
PUBLIC video can be watched by everyone.
LOGGED_IN video can be watched by logged-in users.
PATRON video can be watched by patrons/admins.

Comments are visible to everyone.
Commenting on PUBLIC requires login.
Commenting on LOGGED_IN requires login.
Commenting on PATRON requires patron/admin.

Subscription gives mailing eligibility.
Subscription never gives patron access.

Eligible donation/payment may create PatronGrant.
Admin may create PatronGrant with reason.
Referral may create PatronGrant if product policy says so.
PatronGrant gives patron access.
```

UI nie powinno samo wymyślać polityk.

UI renderuje wynik polityk.

---

# 6. Poziomy dostępu do filmów

System dostępu do filmów ma mieć trzy poziomy:

```txt
PUBLIC
LOGGED_IN
PATRON
```

Każdy film ma dokładnie jeden tier.

## 6.1 PUBLIC

Film publiczny:

* każdy może go zobaczyć,
* każdy może go odtworzyć,
* każdy może zobaczyć sekcję komentarzy,
* tylko zalogowany użytkownik może komentować,
* niezalogowany widzi komentarze i zachętę do logowania przy composerze.

## 6.2 LOGGED_IN

Film dla zalogowanych:

* każdy może zobaczyć, że film istnieje,
* gość może wejść na stronę filmu,
* gość widzi tytuł, opis, komentarze i CTA do logowania,
* gość nie może odtworzyć filmu,
* w miejscu filmu gość widzi locked placeholder typu `LOGIN_REQUIRED`,
* zalogowany użytkownik może odtworzyć film,
* zalogowany użytkownik może komentować.

## 6.3 PATRON

Film dla patronów:

* każdy może zobaczyć, że film istnieje,
* non-patron może wejść na stronę filmu,
* non-patron widzi tytuł, opis, komentarze, licznik komentarzy i CTA do patronatu,
* non-patron nie może odtworzyć filmu,
* w miejscu filmu non-patron widzi locked placeholder typu `PATRON_REQUIRED`,
* patron/admin może odtworzyć film,
* tylko patron/admin może komentować,
* komentarze są widoczne także dla non-patronów jako social proof / teaser.

Reguła komentarzy:

```txt
Comment visibility != Comment permission.
```

Tabela:

```txt
PUBLIC:
  comments visible: everyone
  can comment: logged-in user

LOGGED_IN:
  comments visible: everyone
  can comment: logged-in user

PATRON:
  comments visible: everyone
  can comment: patron/admin
```

To jest świadoma decyzja produktowa.

Komentarze pod PATRON video mogą zaciekawiać użytkownika i zachęcać do wsparcia.

Ryzyko: komentarze mogą spoilerować treść patron-only.

Mitigacja: moderacja, report abuse, hide/delete, pinning, admin audit.

---

# 7. Locked video rendering invariant

To jest bardzo ważny inwariant UI, performance i security.

Jeśli viewer nie może odtworzyć filmu, UI nie może montować prawdziwego playera pod nakładką.

Reguła:

```txt
Locked placeholder nie przykrywa filmu.
Locked placeholder zastępuje film.
```

Technicznie nie używać myślenia:

```txt
player + overlay
```

Używać myślenia:

```txt
allowed PlaybackPlan -> player
denied PlaybackPlan -> locked placeholder
```

Dla stanów:

```txt
LOGIN_REQUIRED
PATRON_REQUIRED
VIDEO_NOT_READY
NO_PRIMARY_ASSET
PROCESSING
UNAVAILABLE
ERROR
```

aplikacja powinna renderować osobny stan UI zamiast prawdziwego playera.

Nie wolno:

* pobierać streamu,
* requestować playback tokena,
* montować ciężkiego playera,
* ładować Mux/Cloudflare source,
* ładować provider player SDK bez potrzeby,
* ukrywać działającego playera pod kosmetyczną nakładką,
* liczyć view/playback eventów dla locked placeholdera jako realnego odtworzenia.

Locked state jest osobnym stanem renderowania wynikającym z `PlaybackPlan`, nie CSS-ową zasłoną na działającym video.

Dla locked state w miejscu głównego filmu nie pokazujemy prawdziwego video ani streamu.

Decyzja produktu:

```txt
Dla locked PATRON/LOGGED_IN w miejscu filmu pokazujemy locked placeholder.
Nie pokazujemy głównej miniatury filmu jako pseudo-playera.
```

Jeśli kiedyś pojawi się safe poster/thumbnail, musi to być osobna świadoma decyzja i nie może wymagać tokena/streamu.

Przykład:

```txt
Viewer: guest
Video tier: LOGGED_IN

Backend:
  returns PlaybackPlan:
    allowed=false
    reason=LOGIN_REQUIRED
    playbackUrl=null
    playbackToken=null

Frontend:
  renders LoginRequiredPlaceholder
  does not mount player
  does not fetch stream
  does not request token
```

Przykład:

```txt
Viewer: logged-in non-patron
Video tier: PATRON

Backend:
  returns PlaybackPlan:
    allowed=false
    reason=PATRON_REQUIRED
    playbackUrl=null
    playbackToken=null

Frontend:
  renders PatronRequiredPlaceholder
  does not mount player
  does not fetch stream
  does not request token
```

Najważniejsze zdanie:

```txt
Locked video is not a video with an overlay. Locked video is a different render state.
```

---

# 8. Access module

Access module jest jednym z najważniejszych modułów systemu.

Odpowiada za decyzje:

* czy user może obejrzeć film,
* czy user może komentować,
* czy user może dostać playback plan,
* czy admin może ominąć ograniczenia,
* jaki stan UI powinien dostać viewer,
* czy provider video może zostać zapytany o signed playback source.

Publiczne API może wyglądać tak:

```txt
canViewVideo(ctx, { userId, videoId })
canCommentOnVideo(ctx, { userId, videoId })
getViewerAccess(ctx, { userId })
getVideoPlaybackPlan(ctx, { userId, videoId })
requireVideoAccess(ctx, { userId, videoId })
```

Access module korzysta z:

* video tier,
* viewer identity,
* login state,
* active PatronGrant/effective patron status,
* admin role,
* video status,
* primary VideoAsset readiness.

Access module nie korzysta bezpośrednio z:

* Stripe jako source of truth access,
* subscription/mailing jako dostępu,
* UI state,
* Clerk metadata jako source of truth,
* `User.isPatron`.

Docelowa decyzja:

```txt
User.isPatron jest do usunięcia.
Nie jest source of truth.
Nie jest docelowym read model/cache.
```

W okresie migracji `User.isPatron` może jeszcze istnieć w bazie lub kodzie legacy, ale target architecture mówi:

```txt
Backend access decisions must ignore User.isPatron.
```

Zasady:

```txt
deny by default
validate access on every request
server decides access
client only renders result
```

Access check musi być wykonywany przy każdym requestcie, który zwraca:

* wrażliwy zasób,
* playback token,
* signed playback URL,
* stream source,
* comment action permission,
* admin data,
* user-specific patron/payment data.

Nie wolno zakładać:

```txt
Skoro UI ukrywa przycisk, backend nie musi sprawdzać dostępu.
```

Backend zawsze sprawdza.

---

# 9. PlaybackPlan

Player i UI nie powinny zgadywać stanu dostępu.

Backend powinien zwracać `PlaybackPlan`.

Przykładowe stany/reasons:

```txt
READY
LOGIN_REQUIRED
PATRON_REQUIRED
VIDEO_NOT_READY
NO_PRIMARY_ASSET
PROCESSING
UNAVAILABLE
ERROR
```

`PlaybackPlan` może zawierać:

```txt
videoId
tier
allowed
reason
cta
title
description
canComment
commentPermissionReason
streamProvider
playbackUrl
playbackToken
expiresAt
assetStatus
debugInfoForAdmin
```

Reguła:

```txt
playbackToken / playbackUrl istnieje tylko dla allowed=true.
```

Dla locked states nie wolno zwracać tokena ani stream URL.

Przykładowo:

```txt
READY:
  allowed: true
  reason: null
  playbackToken: present
  playbackUrl: present

LOGIN_REQUIRED:
  allowed: false
  reason: LOGIN_REQUIRED
  playbackToken: null
  playbackUrl: null
  cta: "Zaloguj się"

PATRON_REQUIRED:
  allowed: false
  reason: PATRON_REQUIRED
  playbackToken: null
  playbackUrl: null
  cta: "Wesprzyj twórcę i zostań patronem"
```

Player renderuje:

* video dla `allowed=true`,
* login placeholder dla `LOGIN_REQUIRED`,
* patron placeholder dla `PATRON_REQUIRED`,
* processing state dla `PROCESSING`,
* unavailable/error state dla `UNAVAILABLE` / `ERROR`.

Player nie decyduje:

* czy user jest patronem,
* czy płatność się kwalifikuje,
* czy subscription daje dostęp,
* czy provider token jest valid,
* czy user może komentować,
* czy video jest ready.

Player jest święty:

```txt
Player receives a PlaybackPlan. Player does not invent access.
```

Frontend może mieć UI hint, ale finalna decyzja access/playback należy do backendu.

Jeśli Clerk/UI sugeruje, że user jest patronem, ale backendowy `PlaybackPlan` mówi locked, UI pokazuje locked.

---

# 10. Patron nie może być nadawany bezpośrednio przez Stripe

Jedna z najważniejszych decyzji architektonicznych:

```txt
Stripe nigdy nie nadaje patrona bezpośrednio.
```

Stripe mówi tylko, że zaszło zdarzenie finansowe.

Poprawny model:

```txt
Payment
  jest faktem finansowym

PatronGrant
  jest faktem dostępu

AccessDecision
  jest wynikiem polityki
```

Błędny model:

```txt
Stripe webhook
  -> user.isPatron = true
```

Poprawny model:

```txt
Stripe webhook
  -> Payments module records event/payment
  -> payment becomes SUCCEEDED
  -> PatronEligibilityPolicy evaluates payment
  -> Patron module creates PatronGrant(source=PAYMENT)
  -> Access module sees active PatronGrant
```

Płatność może być jednym ze źródeł patrona, ale nie powinna być technicznie tym samym co patron.

Webhook nie może oznaczyć eventu jako skutecznie processed, jeśli fulfillment patron grant/revoke/suspend się nie udał.

Retry/idempotency są wymagane.

---

# 11. PatronGrant jako źródło prawdy

Docelowe źródło prawdy dla patron access:

```txt
PatronGrant
```

Patronem można zostać przez:

* kwalifikującą się wpłatę/donejt,
* ręczne nadanie przez admina,
* nagrodę referral, jeśli produkt tego używa,
* migrację/legacy import.

Źródła patrona:

```txt
PAYMENT
ADMIN
REFERRAL
MIGRATION
LEGACY
SYSTEM
```

Statusy PatronGrant:

```txt
ACTIVE
SUSPENDED
REVOKED
EXPIRED
```

Reguła access:

```txt
User is patron if exists PatronGrant where status=ACTIVE and expiresAt is null or in future.
```

Na start patron access jest bezterminowy, ale model ma wspierać `expiresAt` na przyszłość.

`User.isPatron`:

```txt
docelowo usuwamy
nie jest source of truth
nie jest docelowym cache
nie jest docelowym read model
```

`Clerk metadata`:

```txt
cache/UI hint only
never backend access source
```

Reguła:

```txt
Patron access is granted only through PatronGrant.
Payments, admin actions, and referrals may create PatronGrants through explicit use-cases.
Stripe, Clerk metadata, Subscriptions, User.isPatron, and UI components must never directly decide patron access.
```

Patron module public API może wyglądać tak:

```txt
grantPatronAccess(ctx, { userId, source, sourceId, paymentId, grantedById, reason, expiresAt })
suspendPatronGrant(ctx, { grantId, suspendedById, reason })
reactivateSuspendedPatronGrant(ctx, { grantId, reactivatedById, reason })
revokePatronGrant(ctx, { grantId, revokedById, reason })
getPatronStatus(ctx, { userId })
listUserPatronGrants(ctx, { userId })
listPatrons(ctx)
```

Każdy grant, suspend, reactivate i revoke powinien być audytowalny.

PatronGrant może mieć:

```txt
id
userId
status
source
sourceId
paymentId
referralId
grantedById
reason
createdAt
expiresAt
suspendedAt
suspendedById
suspendedReason
reactivatedAt
reactivatedById
reactivatedReason
revokedAt
revokedById
revokedReason
metadata
```

Ważne:

```txt
REVOKED grantów nie reanimujemy.
Jeśli po revoke trzeba nadać dostęp ponownie, tworzymy nowy PatronGrant.
SUSPENDED może zostać przywrócony z reason + audit log.
```

---

# 12. Jednorazowa wpłata i patron

Decyzja biznesowa:

```txt
Jednorazowa kwalifikująca się wpłata przyznaje status patrona jako nagrodę.
```

To nie jest subskrypcja cykliczna.

To nie jest abonament.

To nie jest aktywnie opłacany okres usługi.

To jest nagroda za wsparcie.

Reguła:

```txt
Any successful eligible donation/support payment creates a PatronGrant.
```

Słowo `eligible` jest ważne, bo zostawia miejsce na:

* test payments,
* cancelled payments,
* failed payments,
* pending payments,
* refunded payments,
* disputes,
* chargebacks,
* fraud,
* payments poniżej minimum,
* payments niebędące wsparciem.

Decyzje właściciela:

```txt
Na start: jednorazowe wpłaty.
Użytkownik sam wybiera kwotę.
Każda skuteczna wpłata powyżej minimum daje patron access.
Patron access jest bezterminowy.
Jedna wpłata = jeden techniczny PatronGrant.
User jest patronem, jeśli ma co najmniej jeden ACTIVE PatronGrant.
```

Kolejne wpłaty aktywnego patrona:

```txt
tworzą kolejne Payment
mogą tworzyć kolejne PatronGrant
nie tworzą nowego statusu w UI
nie oznaczają kilku poziomów patrona
```

UI pokazuje:

```txt
Patron
```

Nie:

```txt
Patron x3
3 granty = 3 statusy
```

Technicznie:

```txt
Payment #1 -> PatronGrant #1 ACTIVE
Payment #2 -> PatronGrant #2 ACTIVE

User has patron access because exists ACTIVE PatronGrant.
```

Jeśli jeden grant zostanie revoked/suspended, access zostaje, jeśli istnieje inny ACTIVE grant.

---

# 13. Minimum donejtu

Istnieje minimalna kwota donejtu, która daje patron access.

Decyzja:

```txt
Minimum ustawia admin w payment settings.
Zmiana minimum wymaga audit log.
Zmiana minimum działa tylko na przyszłe wpłaty.
Stare PatronGranty pozostają ważne.
```

Przykład:

```txt
2026-01-01 minimum = 20 zł
User wpłaca 20 zł
PatronGrant ACTIVE

2026-03-01 admin zmienia minimum na 50 zł
Stary PatronGrant za 20 zł pozostaje ACTIVE
```

To jest uczciwe wobec użytkownika.

UI/API powinno nie pozwalać świadomie wpłacić poniżej minimum dla patron access.

Webhook safety:

```txt
Jeśli mimo wszystko payment poniżej minimum dotrze do systemu,
Payments module może zapisać payment jako donejt/support,
ale PatronEligibilityPolicy nie tworzy PatronGrant.
```

---

# 14. Refunds, disputes, chargebacks

Refund/dispute/chargeback działa per payment/grant.

Nie działa globalnie na całego usera.

Reguła:

```txt
Refund/dispute affects the PatronGrant linked to that payment.
User loses patron access only if no ACTIVE PatronGrant remains.
```

## 14.1 Full refund

Full refund:

```txt
revoke related PatronGrant
```

Jeśli user ma inne aktywne granty, nadal jest patronem.

## 14.2 Partial refund

Partial refund:

```txt
does not automatically revoke PatronGrant
```

Decyzja właściciela:

```txt
Liczy się kwota i warunki w momencie wpłaty.
Partial refund nie odbiera automatycznie dostępu.
Może trafić do admin review.
```

## 14.3 Dispute / chargeback

Dispute created / chargeback:

```txt
related PatronGrant -> SUSPENDED
```

Jeśli dispute zostanie wygrany:

```txt
SUSPENDED -> ACTIVE
```

Jeśli dispute zostanie przegrany / chargeback confirmed:

```txt
SUSPENDED -> REVOKED
```

Jeśli user ma inne ACTIVE PatronGranty, nadal ma patron access.

## 14.4 Idempotency

Każdy webhook musi być idempotentny.

Nie wolno stworzyć dwóch grantów przez duplicate webhook.

Dla payment-based grantów:

```txt
paymentId should be unique on PatronGrant when present
```

Webhook duplicate:

```txt
no-op or return existing outcome
```

---

# 15. Admin jako źródło patrona

Admin może ręcznie nadać patrona tylko jako wyjątkowy grant z powodem.

Decyzja:

```txt
Admin grant requires reason.
Admin revoke requires reason.
Admin suspend requires reason.
Admin reactivate requires reason.
Every admin access-affecting action creates audit log.
```

Flow:

```txt
Admin action
  -> Patron module creates/suspends/reactivates/revokes PatronGrant
  -> AuditLog records actor, target, reason
  -> Access reads active PatronGrants
```

Nie wolno:

```txt
user.isPatron = true
```

Admin powinien podać powód dla:

* ręcznego grant,
* specjalnego przypadku,
* korekty,
* support issue,
* nagrody,
* migracji,
* błędu płatności,
* decyzji właściciela,
* suspend,
* revoke,
* reactivation.

Admin nie powinien być zmuszony do grzebania w bazie, Clerk metadata albo Stripe, żeby naprawić dostęp użytkownika.

REVOKED PatronGrant nie jest przywracany.

Jeśli trzeba przywrócić dostęp po revoke:

```txt
create new PatronGrant
```

---

# 16. Referral jako źródło patrona

System referencyjny może przyznawać patrona po spełnieniu warunku, jeśli właściciel produktu tego chce.

Flow:

```txt
Referral task completed
  -> Referrals module marks reward as eligible
  -> PatronEligibilityPolicy evaluates reward
  -> Patron module creates PatronGrant(source=REFERRAL)
  -> AuditLog records event
```

Nie wolno, żeby referral route bezpośrednio modyfikował:

```txt
User.isPatron
PatronGrant without Patron module
Payment
Clerk metadata as truth
```

Referral jest źródłem zdarzenia.

Patron module jest źródłem dostępu.

---

# 17. Subscription / Sub button oznacza mailing, nie patrona

Bardzo ważne rozróżnienie:

```txt
Subscription != Patron
```

Przycisk `Sub` / `Subscribe` nie oznacza patrona, płatności ani premium access.

Subskrypcja oznacza:

```txt
Użytkownik zgadza się otrzymywać maile / aktualizacje / powiadomienia.
```

Reguły:

* subskrybować może zalogowany użytkownik,
* subskrypcja daje zgodę na mailing,
* subskrypcja nie daje dostępu do filmów patron-only,
* subskrypcja nie tworzy PatronGrant,
* unsubscribe usuwa zgodę na mailing,
* unsubscribe nigdy nie odbiera patron access,
* admin może wysłać email do subscriberów,
* admin może wysłać email do patronów,
* subscriber i patron to różne segmenty.

Publiczne API modułu subscriptions:

```txt
subscribeToChannel(ctx, { userId })
unsubscribeFromChannel(ctx, { userId })
getSubscriptionStatus(ctx, { userId })
listSubscribers(ctx)
```

Subscriptions module nie może być używany do access decisions.

Najważniejsze zdanie:

```txt
Subscription gives mailing eligibility, not video access.
```

---

# 18. Email i broadcasty

Email module powinien obsługiwać:

* templates,
* broadcasty,
* recipient groups,
* delivery events,
* unsubscribe/preferences,
* inbound/replies,
* systemowe maile,
* payment/patron/referral-related notifications.

Segmenty:

```txt
SUBSCRIBERS
  osoby, które kliknęły Sub / zgodziły się na mailing

PATRONS
  osoby z aktywnym PatronGrant

ALL_USERS
  wszyscy użytkownicy, jeśli prawnie i produktowo dopuszczalne

MANUAL
  ręczna lista
```

Subscriber i patron mogą być tą samą osobą, ale to są różne statusy.

Decyzje:

```txt
Subscriber i patron to osobne segmenty mailingowe.
Patron może dostawać komunikaty transakcyjne/systemowe jako patron.
Marketing do patronów wymaga osobnej zgody mailingowej.
Subscriber może dostawać CTA do patronatu, ale bez agresywnego marketingu.
Wypisanie się z newslettera nigdy nie wpływa na patron access.
```

Email module nie nadaje patron access.

Email module może pytać Patron/Access module o listę patronów, ale nie powinien sam decydować, kto jest patronem.

Zasada:

```txt
Email sends messages. Email does not grant access.
```

---

# 19. Video provider architecture

Poprzednia wersja blueprintu zakładała Cloudflare Stream jako jedyny docelowy provider.

Aktualna decyzja właściciela jest inna:

```txt
Video architecture ma być provider-agnostic.
Na start rozważane providery: Mux i Cloudflare Stream.
R2/S3 może istnieć jako legacy/migration storage, ale nie jako aktywny playback fallback.
```

Nie oznacza to budowania wielkiego multi-provider SaaS.

Oznacza to cienką abstrakcję nad providerem video.

Minimalne API:

```txt
VideoProvider.createUploadSession()
VideoProvider.handleWebhook()
VideoProvider.createPlaybackSource()
```

Candidate providers:

```txt
MUX
CLOUDFLARE_STREAM
R2_LEGACY
S3_LEGACY
```

R2/S3 legacy:

```txt
migration/legacy only
not active playback fallback
not security escape hatch
```

Najważniejszy invariant:

```txt
Access decision nie należy do Mux, Cloudflare ani R2.
Access decision należy do aplikacji.
```

Provider może dać signed playback source tylko po tym, jak backend zdecyduje:

```txt
PlaybackPlan.allowed = true
```

Flow:

```txt
User asks for playback
  -> App checks Access/PatronGrant
  -> App checks primary READY VideoAsset
  -> If allowed, App asks provider for signed playback source
  -> App returns PlaybackPlan
  -> Player renders
```

Locked flow:

```txt
User asks for playback
  -> App checks Access/PatronGrant
  -> App decides denied
  -> App does not call provider
  -> App returns PlaybackPlan allowed=false
  -> UI renders locked placeholder
```

---

# 20. Upload flow

Decyzja:

```txt
Upload ma iść direct browser -> video provider.
Nie przez backend aplikacji jako ciężki upload.
```

Docelowy upload flow:

```txt
Admin opens upload
  -> backend creates provider upload session
  -> browser uploads directly to Mux/Cloudflare
  -> provider processes video
  -> provider webhook informs app
  -> app updates VideoAsset status
```

Upload ma od razu wspierać duże pliki / resumable upload.

Decyzja:

```txt
Upload foundation should support resumable upload/tus or provider equivalent from the start.
```

Powód:

* VOD pliki mogą mieć setki MB albo kilka GB,
* browser upload przez backend jest zły kosztowo i technicznie,
* resumable upload zmniejsza ryzyko porzuconych uploadów.

Nie mieszać uploadu z access logic.

Upload tworzy/aktualizuje `VideoAsset`.

Access do oglądania nadal wynika z `PlaybackPlan`.

---

# 21. Video model i media-stream model

Video module odpowiada za:

* tytuł,
* opis,
* slug,
* status,
* tier dostępu,
* kolejność w playliście/sidebarze,
* featured video,
* publikację,
* admin CRUD.

VideoAsset / Media module odpowiada za:

* provider,
* provider-specific IDs,
* upload,
* processing status,
* playback source creation,
* thumbnail/poster metadata, jeśli używane,
* duration,
* deletion/sync,
* provider webhook handling.

Model logiczny:

```txt
Video
  id
  title
  description
  slug
  tier: PUBLIC | LOGGED_IN | PATRON
  status: DRAFT | PUBLISHED | UNLISTED | ARCHIVED
  publishedAt
  sidebarOrder
  isMainFeatured

VideoAsset
  id
  videoId
  provider: MUX | CLOUDFLARE_STREAM | R2_LEGACY | S3_LEGACY
  role: PRIMARY | FALLBACK | TRAILER | LEGACY
  isPrimary: boolean
  status: UPLOAD_SESSION_CREATED | UPLOADING | PROCESSING | READY | ERROR | DELETED
  providerAssetId
  providerPlaybackId
  providerStreamUid
  durationSeconds
  thumbnailUrl
  metadata
  createdAt
  updatedAt
```

Decyzje:

```txt
Każde video może mieć własnego providera na poziomie VideoAsset.provider.
Jedno video może mieć wiele assetów.
Tylko jeden asset powinien być primary dla playback.
Provider-specific IDs mieszkają w VideoAsset, nie w Video.
Runtime używa primary READY asset.
```

Nie projektować aktywnego fallback playback na R2/S3 na start.

To komplikuje security, signed URLs, player i access.

---

# 22. Provider webhooki

Provider webhooki powinny być obsługiwane przez wspólny moduł video/media, ale provider-specific parsing zostaje osobno.

Model:

```txt
Mux webhook
  -> parse Mux event
  -> map to internal VideoAsset event
  -> update VideoAsset via use-case

Cloudflare webhook
  -> parse Cloudflare event
  -> map to internal VideoAsset event
  -> update VideoAsset via use-case
```

Wspólne statusy:

```txt
UPLOADING
PROCESSING
READY
ERROR
DELETED
```

Webhook rules:

* verify provider signature if available,
* idempotency,
* no direct Prisma in route,
* no UI logic,
* no access decisions,
* no patron/payment logic,
* event log/audit where useful.

---

# 23. Signed playback source

Signed playback URL/token jest tworzony na żądanie.

Decyzja:

```txt
Signed playback URL/token nie jest zapisywany na stałe jako source of truth.
```

Flow:

```txt
Client asks for PlaybackPlan
  -> backend checks access
  -> backend checks asset readiness
  -> backend asks provider for signed playback source
  -> backend returns PlaybackPlan with playback source
```

Dla denied/locked:

```txt
backend does not ask provider
backend returns no token
backend returns no playback URL
```

Cache krótkoterminowy może być kiedyś optymalizacją, ale nie source of truth.

Nie wolno:

* zapisywać permanent signed URL w DB,
* zwracać raw private playback ID w publicznym UI bez potrzeby,
* generować tokenów dla locked content,
* pozwolić playerowi samemu tworzyć provider URL.

---

# 24. Player

Player powinien być prosty i święty.

Player nie powinien decydować:

* czy user jest patronem,
* czy payment się kwalifikuje,
* czy subscription daje dostęp,
* czy provider token jest valid,
* czy user może komentować,
* czy video jest ready.

Player powinien dostać `PlaybackPlan`.

Player renderuje:

* video dla `allowed=true`,
* locked login state dla `LOGIN_REQUIRED`,
* locked patron state dla `PATRON_REQUIRED`,
* processing state dla `PROCESSING`,
* unavailable state,
* error/retry,
* admin debug info, jeśli admin,
* tracking events tylko wtedy, gdy playback naprawdę istnieje.

Player tracking powinien być osobnym hookiem/usługą:

* play started,
* pause,
* heartbeat,
* watched 10s,
* watched 25/50/75/90%,
* error,
* ended.

Nie wolno mieszać tracking persistence z UI.

Nie wolno odpalać tracking dla locked placeholdera jako realnego playbacku.

Nie wolno montować playera dla locked state.

---

# 25. Playback events i analytics

Playback events są potrzebne, ale muszą być kontrolowane.

Zasady:

* event endpoint nie importuje Prisma bezpośrednio,
* tracking idzie przez use-case/repository,
* nie liczyć view wielokrotnie bez reguł,
* rozróżnić heartbeat, event i counted view,
* admin preview nie powinien zawyżać statystyk,
* patron locked attempts mogą być analizowane oddzielnie,
* błędy playera powinny być widoczne w admin/system health,
* locked state render nie jest playbackiem,
* token issued może być osobnym faktem od view counted.

Docelowe pojęcia:

```txt
VideoPlaybackSession
VideoPlaybackEvent
VideoView / counted view
PlaybackTokenIssued
LockedPlaybackAttempt
```

Counted view powinien być faktem domenowym, nie przypadkiem wynikającym z tego, że komponent się zamontował.

---

# 26. Komentarze

Sekcja komentarzy jest widoczna dla wszystkich.

To jest świadoma decyzja produktowa.

Komentarze pod PATRON video działają jako social proof / teaser.

Komentowanie:

```txt
PUBLIC: logged-in user
LOGGED_IN: logged-in user
PATRON: patron/admin
```

Comments module powinien obsługiwać:

* listę komentarzy,
* composer permission,
* replies,
* delete,
* reports,
* moderation,
* statusy: visible/held/hidden/deleted,
* pagination,
* empty/loading/error states,
* rate limiting/anti-spam.

Na start:

```txt
User cannot edit own comment.
User can delete own comment.
Deleted comment disappears from public UI.
Admin/moderation UI sees deleted/tombstone state for audit.
Report abuse exists from start.
Admin hide/delete always creates audit log.
```

Comments module powinien pytać Access module:

```txt
canCommentOnVideo(ctx, { userId, videoId })
```

Nie powinien sam zgadywać po:

* `User.isPatron`,
* Clerk metadata,
* subscription,
* UI state,
* payment state.

UI komentarzy może pokazać:

* komentarze wszystkim,
* composer tylko tym, którzy mogą komentować,
* login-required message dla niezalogowanych,
* patron-required message dla nie-patronów pod PATRON video,
* badge “Patron” przy komentarzu patrona.

Publiczny profil:

```txt
Na start komentarz pokazuje display name/avatar.
Nie ma publicznej strony profilu.
Patron ma widoczną odznakę “Patron”.
```

Ważna zmiana docelowa wobec starego myślenia:

```txt
Komentarze mogą być widoczne wszystkim, nawet gdy film jest patron-only.
Pisanie pod patron-only wymaga patron/admin.
```

Jeśli obecny kod robi inaczej, ta zmiana wymaga osobnego, świadomego PR-a.

---

# 27. Admin cockpit

Admin panel ma być centrum dowodzenia, nie losową listą CRUD-ów.

Docelowe sekcje:

* Dashboard,
* Videos,
* Upload,
* Media/Video Provider Health,
* Comments moderation,
* Patrons,
* Subscribers,
* Emails/Broadcasts,
* Payments,
* Referrals,
* Access Diagnostics,
* Settings,
* Audit Log,
* System Health.

Admin powinien móc:

* dodać film,
* utworzyć upload session u providera,
* sprawdzić processing/ready/error,
* ustawić tier filmu,
* zmienić tier filmu z audit log,
* ustawić featured/main video,
* ustawić kolejność playlisty,
* moderować komentarze,
* zobaczyć patronów,
* nadać/zawiesić/cofnąć patrona,
* zobaczyć pełną historię grantów użytkownika,
* zobaczyć subscriberów mailingowych,
* wysłać mail do subscriberów,
* wysłać mail do patronów,
* zobaczyć płatności,
* zobaczyć referrals,
* zdiagnozować, czemu user ma albo nie ma dostępu.

Decyzja:

```txt
Admin Cockpit powinien mieć dashboard i Access Diagnostics,
ale Access Diagnostics jest ważniejsze niż zwykły dashboard.
```

Najważniejsza funkcja:

```txt
Access Diagnostics
```

Admin wpisuje usera i/lub video i widzi:

* user id/email,
* full PatronGrant history,
* active/suspended/revoked/expired grants,
* source grantów,
* payment-linked grants,
* admin grants,
* referral grants,
* mailing subscription status,
* ostatnie płatności,
* refund/dispute status,
* referral status,
* Clerk metadata/cache snapshot,
* legacy `User.isPatron`, jeśli jeszcze istnieje w okresie migracji,
* final access decision,
* czy user może oglądać PATRON video,
* czy user może komentować PATRON video,
* czemu może/nie może,
* potencjalne niespójności,
* ostatnie audit events.

Access Diagnostics jest narzędziem do rozwiązywania prawdziwych problemów użytkowników:

```txt
"Zapłaciłem, ale nie widzę filmu."
"Jestem patronem, ale mam locked."
"Dlaczego ten user ma patron access?"
"Dlaczego Clerk/UI pokazuje coś innego niż backend?"
```

Admin diagnostics pokazuje rozjazd między DB a Clerk cache.

Backend access i tak ufa DB/PatronGrant, nie Clerk.

---

# 28. Payments module

Payments module robi pieniądze.

Odpowiada za:

* checkout,
* Stripe webhook,
* payment lifecycle,
* idempotency,
* refunds,
* disputes,
* chargebacks,
* payment totals,
* payment audit.

Nie odpowiada za:

* docelową decyzję access,
* mailing subscription,
* komentarze,
* UI player,
* bezpośrednie `isPatron = true`.

Webhook rules:

* weryfikować Stripe signature,
* używać raw request body,
* nie parsować/mutować body przed verification,
* mieć idempotency/event lock,
* obsłużyć retry,
* nie wykonywać chaotycznych side-effectów bez kontroli,
* zapisywać event/payment jako fakt,
* dopiero potem uruchamiać explicit domain use-case.

Po udanej płatności Payments module może wywołać explicit use-case:

```txt
evaluatePaymentForPatronGrant
```

Ten use-case może stworzyć PatronGrant przez Patron module.

Payment states mogą obejmować:

```txt
PENDING
SUCCEEDED
FAILED
REFUNDED
PARTIALLY_REFUNDED
DISPUTED
CHARGEBACK
```

Patron fulfillment matrix:

```txt
payment pending:
  no PatronGrant

payment succeeded and amount >= minimum at payment time:
  create PatronGrant(source=PAYMENT, status=ACTIVE)

payment succeeded but amount < minimum:
  record Payment
  no PatronGrant

full refund:
  related PatronGrant -> REVOKED

partial refund:
  keep PatronGrant
  optional admin review

dispute created:
  related PatronGrant -> SUSPENDED

dispute won:
  related PatronGrant -> ACTIVE

dispute lost / chargeback confirmed:
  related PatronGrant -> REVOKED
```

Zasada:

```txt
Payment is money. PatronGrant is access.
```

---

# 29. Referrals module

Referrals module obsługuje:

* linki referencyjne,
* rejestrację przez referral,
* status referral,
* warunki nagrody,
* claim/reward,
* audyt.

Nie powinien bezpośrednio ustawiać patrona.

Jeśli referral daje patrona:

```txt
Referral reward completed
  -> Patron module creates PatronGrant(source=REFERRAL)
```

Referral module może powiedzieć:

```txt
reward is eligible
```

Patron module tworzy dostęp.

Nie wolno, żeby referral route obchodził Patron module.

---

# 30. Audit

Audit ma być pamięcią systemu.

Audit powinien zapisywać:

* admin grant patron,
* admin suspend patron,
* admin reactivate patron,
* admin revoke patron,
* payment fulfilled,
* refund,
* partial refund review,
* dispute,
* chargeback,
* referral reward,
* video tier changed,
* minimum donation amount changed,
* video published/unpublished,
* provider asset status critical transitions,
* email broadcast sent,
* comment hidden/deleted/pinned,
* access diagnostics corrective actions.

Audit nie zastępuje polityk.

Audit nie decyduje.

Audit zapisuje, kto zrobił co, kiedy i dlaczego.

Zasada:

```txt
Every manual access-affecting action must be auditable.
```

Manual access-affecting actions require reason.

---

# 31. Clerk, auth i metadata

Clerk odpowiada za auth i identity.

Clerk metadata może być użyte jako:

```txt
UI hint
cache
display optimization
sync target
```

Clerk metadata nie może być użyte jako backend source of truth dla patron access.

Decyzje:

```txt
Clerk metadata nie decyduje o backend access.
Backend access opiera się na DB i aktywnych PatronGrantach.
Jeśli UI/Clerk mówi patron, ale backend PlaybackPlan mówi locked, UI pokazuje locked.
Admin diagnostics pokazuje rozjazd między DB a Clerk cache.
```

Nie wolno:

* dawać PATRON playback tylko dlatego, że session claim mówi patron,
* generować signed playback token tylko z Clerk metadata,
* traktować Clerk publicMetadata jako access database,
* naprawiać patron access przez ręczną zmianę Clerk metadata.

---

# 32. User.isPatron migration

Docelowa decyzja:

```txt
User.isPatron do usunięcia.
```

Nie jest:

* source of truth,
* docelowym cache,
* docelowym read model,
* częścią target architecture.

Bezpieczna kolejność:

```txt
1. PatronGrant becomes source of truth in Access module.
2. Tests prove User.isPatron is ignored by backend access decisions.
3. Remove runtime reads/writes of User.isPatron.
4. Remove Clerk metadata dependency for backend access if any.
5. Add diagnostics for legacy mismatch during migration.
6. Run migration/reconciliation.
7. Remove User.isPatron from Prisma schema.
8. Remove stale docs/guards mentioning User.isPatron as read model.
```

Nie usuwać pola pierwszym PR-em, jeśli current runtime jeszcze go używa.

Najpierw przestawić access.

Potem usunąć pole.

---

# 33. Security and access principles

Najważniejsze zasady bezpieczeństwa:

```txt
deny by default
server-side access checks
validate permissions on every request
no client-only authorization
no raw private media URLs
no token for locked content
no provider call for locked content
no player mount for locked content
no direct route Prisma for business decisions
```

Nie wolno ufać:

* ukrytemu buttonowi,
* CSS overlayowi,
* frontend route guard,
* Clerk metadata jako prawdzie,
* Stripe eventowi bez signature verification,
* raw video URL w UI,
* temu, że user “nie zna linka”.

Access musi być decydowany po stronie backendu.

Dla prywatnych mediów:

* nie zwracać playback tokenów bez access check,
* nie generować signed URL dla nieuprawnionych,
* nie pytać providera o signed source dla nieuprawnionych,
* nie mountować playera dla locked states,
* nie liczyć locked render jako playback.

---

# 34. README i dokumenty jako źródło prawdy

README powinno być szybkim operacyjnym źródłem prawdy.

Ta notatka powinna docelowo trafić do:

```txt
docs/architecture/Product-Architecture-Blueprint.md
```

README powinno mieć tylko skrót:

```txt
Target Product Architecture Decisions
```

Przykładowy skrót do README:

```txt
- Polutek.pl is a single-creator VOD/patron platform, not a marketplace or multi-creator SaaS.
- Video access tiers are PUBLIC, LOGGED_IN, and PATRON.
- LOGGED_IN tier stays.
- Subscription means mailing/follow consent, not patron access.
- Patron access comes only from active PatronGrant.
- User.isPatron is target-deprecated and should be removed after safe migration.
- Clerk metadata is UI/cache only, not backend access source.
- One-time eligible donation gives lifetime patron reward.
- Each eligible payment may create a separate PatronGrant.
- User is patron if at least one PatronGrant is ACTIVE.
- Refund/dispute affects the PatronGrant linked to the payment, not global user status.
- Comments are visible to everyone.
- Commenting on PUBLIC/LOGGED_IN requires login.
- Commenting on PATRON requires patron/admin.
- Locked videos render placeholders/cards instead of mounting real players underneath overlays.
- Locked state must not fetch stream, token, or provider playback source.
- Player receives PlaybackPlan. Player does not invent access.
- Video architecture is provider-agnostic with Mux and Cloudflare Stream as initial candidates.
- R2/S3 may remain only as legacy/migration storage, not active playback fallback.
- Access decisions must go through access/patron modules, not route-local checks.
- Admin Access Diagnostics is more important than a generic dashboard.
```

Nie oznaczać tych rzeczy jako wykonanych, jeśli nie są wykonane.

To są target decisions.

---

# 35. Co usuwać docelowo

Po inventory, testach i migracji można usuwać:

* direct Prisma imports from routes,
* `@/lib/services/**` z runtime route’ów,
* legacy services dublujące moduły,
* Stripe jako bezpośrednie źródło patrona,
* Subscription jako access,
* Clerk metadata jako backend source of truth,
* `User.isPatron`,
* UI components podejmujące decyzje biznesowe,
* player mount under locked overlay,
* raw private media URLs,
* stale allowlisty,
* docs mówiące nieprawdę.

Nie usuwać wszystkiego naraz.

Każde usunięcie powinno mieć:

* inventory,
* scope,
* tests,
* architecture guard,
* post-merge sanity.

Nie usuwać provider abstraction tylko dlatego, że pierwszy provider działa.

Target mówi:

```txt
thin provider abstraction
```

Nie:

```txt
provider chaos
```

I nie:

```txt
giant multi-provider framework
```

---

# 36. Kolejność strategiczna

Najpierw kończymy R10 i truth reconciliation.

## Faza 0 — R10 truth reconciliation

Docs/guards only where possible:

* odświeżyć inventory direct Prisma in routes,
* odświeżyć inventory legacy services in routes,
* sprawdzić stale allowlisty,
* sprawdzić README vs actual code,
* dopisać guardy, które wykrywają stale allowlisty,
* nie ruszać runtime behavior.

## Faza 1 — Payments/Patron safety

Kod/testy:

* Stripe webhook signature/raw body,
* idempotency,
* duplicate webhook no-op,
* payment success creates PatronGrant through Patron module,
* payment pending no grant,
* payment below minimum no grant,
* full refund revokes related grant,
* dispute suspends related grant,
* dispute won reactivates,
* dispute lost/chargeback revokes,
* webhook does not mark event processed if fulfillment failed.

To jest safety blocker przed pełnym Access/Patron hard reset.

## Faza 2 — R10 route cleanup

Małe PR-y:

* subscriptions route -> use-case/repository,
* admin users route -> module API,
* admin subscribers route -> module API,
* media-source route -> playback module,
* playback-event route -> analytics use-case,
* admin comments routes -> comments module,
* payment settings/admin payments -> payments module,
* no direct Prisma in routes,
* no `@/lib/services/**` in routes.

Nie robić jednego mega-refaktoru.

## Faza 3 — Product Architecture Blueprint docs-only

Docs-only:

* przenieść tę notatkę do `docs/architecture/Product-Architecture-Blueprint.md`,
* dodać krótki skrót do README,
* oznaczyć jako target architecture,
* jasno opisać current vs target,
* nie zmieniać runtime.

## Faza 4 — Access/Patron Hard Reset

Kod:

* PatronGrant jako centrum,
* AccessPolicy jako jedyne miejsce decyzji,
* `User.isPatron` ignorowane przez access,
* testy PUBLIC/LOGGED_IN/PATRON,
* testy comments visibility/permission,
* admin grant przez Patron module,
* payment grant przez Patron module,
* referral grant przez Patron module,
* migration plan do usunięcia `User.isPatron`.

## Faza 5 — Video Provider Foundation

Kod:

* thin VideoProvider interface,
* Mux/Cloudflare candidate implementation strategy,
* VideoAsset provider/status model,
* direct upload session,
* resumable upload support,
* provider webhook handling,
* primary READY asset,
* no active R2/S3 playback fallback.

## Faza 6 — PlaybackPlan / Player Simplification

Kod/UI:

* jeden PlaybackPlan,
* jeden player flow,
* locked states,
* locked placeholders instead of mounted player,
* no token/source for locked,
* processing states,
* error/retry states,
* tracking hook,
* admin debug.

## Faza 7 — Admin Cockpit Foundation

Kod/UI:

* Access Diagnostics first,
* patron grant history,
* DB vs Clerk cache mismatch,
* payments/refunds/disputes,
* comments moderation,
* subscribers,
* emails,
* video provider health,
* audit log.

## Faza 8 — Product Excellence Passes

Dopiero potem dopieszczanie:

* najlepszy player,
* najlepsze komentarze,
* najlepsza playlista,
* najlepszy admin,
* najlepsze maile,
* UX/mobile/performance/accessibility.

---

# 37. Guard and test strategy

Guardy powinny pilnować:

```txt
no direct @/lib/prisma imports in app/api/**/route.ts
no @/lib/services/** imports in app/api/**/route.ts
no route-local patron/access/payment/subscription decisions
no Subscription used for patron access
no Stripe route directly setting patron access
no User.isPatron in access decision code
no Clerk metadata as backend access source
no playback token/source for denied PlaybackPlan
no player mounted for locked states
no provider createPlaybackSource call before access allow
```

Test matrix dla access:

```txt
PUBLIC guest:
  can view video
  can list comments
  cannot comment

PUBLIC logged-in:
  can view video
  can list comments
  can comment

LOGGED_IN guest:
  cannot play
  gets LOGIN_REQUIRED
  can list comments
  cannot comment

LOGGED_IN logged-in:
  can play
  can list comments
  can comment

PATRON guest:
  cannot play
  gets PATRON_REQUIRED or login/patron CTA depending UX
  can list comments
  cannot comment

PATRON logged-in non-patron:
  cannot play
  gets PATRON_REQUIRED
  can list comments
  cannot comment

PATRON patron:
  can play
  can list comments
  can comment

PATRON admin:
  can play
  can list comments
  can comment/moderate
```

Payment/patron tests:

```txt
pending payment -> no grant
succeeded eligible payment -> PatronGrant ACTIVE
duplicate webhook -> no duplicate grant
below-minimum payment -> no grant
full refund -> related grant REVOKED
partial refund -> grant unchanged + optional review
dispute created -> related grant SUSPENDED
dispute won -> grant ACTIVE
dispute lost -> grant REVOKED
multiple grants -> user remains patron while at least one ACTIVE
```

Player tests:

```txt
denied PlaybackPlan has no playbackUrl
denied PlaybackPlan has no token
locked component does not mount player
locked component does not request media-source/provider token
provider createPlaybackSource is not called for denied access
```

---

# 38. Zasady przyszłych promptów

Nie pytać AI:

```txt
Ulepsz projekt.
```

Pytać:

```txt
Jesteś senior product engineerem VOD.
Zaprojektuj idealny Player UX dla single-creator patron VOD.
Nie pisz kodu.
Najpierw daj specyfikację i decyzje produktowe.
Uwzględnij PUBLIC / LOGGED_IN / PATRON, locked states, provider-agnostic video, analytics, admin preview, mobile.
```

Potem:

```txt
Porównaj obecną implementację z tą specyfikacją.
Daj gap analysis.
Nie zmieniaj kodu.
```

Potem:

```txt
Zaimplementuj tylko Pass 1.
Scope: locked states rendering.
Nie dotykaj tracking, access, payments, comments ani admina.
```

Dla każdego kodującego agenta:

```txt
Start from current main.

Task:
...

Scope:
Only:
...

Do not touch:
...

Required:
...

Validation:
...

Output:
...
```

Dla agentów pracujących nad payments/patron:

```txt
Nie wolno bezpośrednio ustawiać User.isPatron.
Nie wolno traktować Stripe jako source of truth access.
Payment records money.
PatronGrant grants access.
```

Dla agentów pracujących nad player/video:

```txt
Nie wolno montować playera dla locked state.
Nie wolno generować tokena/source dla denied PlaybackPlan.
Nie wolno pytać providera przed access check.
```

Dla agentów pracujących nad comments:

```txt
Comment visibility != comment permission.
Komentarze są widoczne wszystkim.
Pisanie zależy od login/patron/admin.
```

---

# 39. Definicja dobrego kodu w Polutek.pl

Dobry kod oznacza:

* mały route,
* jasny use-case,
* repository do bazy,
* policy do reguł,
* publiczne API modułu,
* brak direct Prisma w route,
* brak legacy services w route,
* brak biznesu w komponencie React,
* brak Stripe logic poza payments,
* brak patron logic poza patron/access,
* brak mailing logic poza subscriptions/email,
* brak provider details poza video/media provider module,
* brak realnego playera pod locked placeholderem,
* testy tam, gdzie decyzje są ważne,
* guardy, które blokują regresje.

Dobry UX oznacza:

* user wie, co może zrobić,
* locked state mówi dlaczego coś jest locked,
* są różne placeholdery dla login i patron,
* nie ma fałszywych playerów,
* nie ma ciężkiego ładowania bez prawa dostępu,
* komentarze są zrozumiałe,
* patronat jest jasny,
* subskrypcja mailingu nie udaje premium,
* CTA nie brzmi jak abonament, jeśli produkt nim nie jest.

Dobry admin oznacza:

* admin rozumie stan systemu,
* admin może naprawić dostęp,
* admin widzi powody decyzji,
* admin widzi historię grantów,
* admin widzi payment/refund/dispute lifecycle,
* admin widzi DB vs Clerk cache mismatch,
* admin nie musi grzebać w bazie,
* admin ma audit trail.

---

# 40. Things not to do

Nie robić:

* nie projektować multi-creator,
* nie robić marketplace,
* nie mieszać Subscription z Patron,
* nie nazywać patronatu subskrypcją,
* nie dawać dostępu patrona z newslettera,
* nie dawać dostępu patrona z Clerk metadata,
* nie dawać dostępu patrona z `User.isPatron`,
* nie ustawiać `User.isPatron = true` jako fulfillment Stripe,
* nie generować playback tokena dla locked,
* nie pytać providera video dla locked,
* nie montować playera pod overlayem,
* nie robić aktywnego R2/S3 fallback playback na start,
* nie robić jednego wielkiego multi-provider frameworka,
* nie robić jednego wielkiego R10 mega-refactor,
* nie mieszać docs PR z runtime PR,
* nie zmieniać comments visibility bez testów,
* nie usuwać `User.isPatron` przed migracją accessu,
* nie ufać stale allowlistom,
* nie wierzyć, że folder modułu oznacza runtime migration.

---

# 41. Najważniejsze zdania do zapamiętania

```txt
To jest prototyp, z którego budujemy solidny dom.
```

```txt
Prostota produktu jest przewagą: jeden twórca, jeden katalog, trzy poziomy dostępu.
```

```txt
Polutek.pl nie jest platformą. Polutek.pl jest miejscem.
```

```txt
Subscription to mailing/follow consent, nie patron.
```

```txt
Patronat to nagroda za jednorazowe wsparcie, nie subskrypcja cykliczna.
```

```txt
Payment is money. PatronGrant is access.
```

```txt
Stripe nie nadaje patrona. Stripe zapisuje płatność. PatronGrant nadaje dostęp.
```

```txt
Patron access comes only from active PatronGrant.
```

```txt
User.isPatron is target-deprecated and should be removed.
```

```txt
Clerk metadata is cache/UI hint only, not backend access source.
```

```txt
Comment visibility != comment permission.
```

```txt
Sekcja komentarzy jest widoczna dla wszystkich, ale pisanie zależy od login/patron/admin.
```

```txt
Locked placeholder nie przykrywa filmu. Locked placeholder zastępuje film.
```

```txt
Locked video is not a video with an overlay. Locked video is a different render state.
```

```txt
Player receives PlaybackPlan. Player does not invent access.
```

```txt
Denied PlaybackPlan has no token and no playback URL.
```

```txt
Provider is called only after access is allowed.
```

```txt
Video architecture is provider-agnostic: Mux and Cloudflare are candidates.
```

```txt
R2/S3 is legacy/migration storage, not active playback fallback.
```

```txt
Admin Access Diagnostics is more important than a generic dashboard.
```

```txt
README i docs są instrukcją dla AI, nie ozdobą projektu.
```

```txt
Najpierw R10 truth. Potem payments/patron safety. Potem Blueprint. Potem Access/Patron. Potem Video Provider. Potem Player/Admin excellence.
```

```txt
Nie dokładamy funkcji do lepionki. Najpierw porządkujemy fundament, potem budujemy premium VOD.
```
