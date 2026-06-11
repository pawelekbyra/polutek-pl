# Owner Decisions

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Obowiązujące decyzje właściciela

Decyzje obowiązujące dopóki właściciel jawnie ich nie zmieni.

### Product identity

- Polutek.pl nie jest platformą, marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.
- Polutek.pl jest jednym oficjalnym miejscem VOD twórcy: jeden oficjalny kanał, jeden katalog wideo, jeden system patronów/dostępu, jedna społeczność, jedna lista mailingowa i jeden kokpit admina.
- Zdanie rdzeniowe: `Polutek.pl is not a platform. Polutek.pl is a place.`
- Nie budować marketplace, mini-Patreon, multi-creator SaaS, white-label CMS, generic social network ani tenant platformy.

### Patronat / payments / access

- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony lub cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta.
- Domyślne progi launch: 10 PLN, 10 USD, 10 EUR, 10 CHF.
- `Payment != PatronGrant`.
- `Subscription/email != Patron`.
- Active `PatronGrant` jest docelowym backendowym źródłem prawdy dla patron access.
- `User.isPatron`, Clerk metadata, `Subscription`, `Payment` alone i frontend state nie są docelowym backendowym źródłem prawdy dla patron access.
- Pełny refund cofa powiązany grant; dispute zawiesza; dispute won reactivates; dispute lost/chargeback revokes.
- Manual grant/suspend/reactivate/revoke wymaga powodu i audytu.

### Video / playback

- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma być wspierany projektowo per `VideoAsset` później.
- Nie budować ciężkiego enterprise video frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Dla denied/locked playback: nie montować realnego playera, nie pobierać streamu, nie żądać tokenu, nie wywoływać Cloudflare/Mux po źródło playbacku, nie liczyć view event i nie ujawniać playback URL/tokenu.
- Provider call następuje dopiero po backendowej zgodzie Access.

### Comments / community

- Komentarze pod patron-only video są widoczne publicznie.
- Komentowanie/reagowanie/pisanie przy treści patron-only wymaga patrona albo admina.
- Widoczność komentarzy nie jest tym samym co uprawnienie do komentowania.
- Goście mogą czytać opublikowane komentarze, ale nie pisać, reagować ani reportować.
- Nie budować generic social network.

### Email / subscriptions

- Newsletter subscription nie daje patron access.
- Unsubscribe z emaila nie cofa `PatronGrant`.
- Patron nie oznacza automatycznej zgody marketingowej.
- Transactional emails są oddzielone od marketingu.
- Broadcast wymaga preview/test-send i audytu.
- Bounce/complaint suppression jest launch-critical.

### Launch / quality

- Launch jest publiczny, nie private beta.
- Cel jakości: excellent product przez fazy i tickety, nie szybkie minimum.
- Excellence osiągane jest przez aktywne tickety, walidację, review, reconciliation i certyfikację faz; roadmapa sama w sobie nie jest dowodem implementacji.
- Nie uruchamiać runtime work bez aktywnego ticketu.

## Otwarte pytania właściciela

Pytania wymagające decyzji. Nie są jeszcze obowiązującymi decyzjami.

| ID | Status | Pytanie | Obszar | Dlaczego ważne | Najpóźniej przed |
| --- | --- | --- | --- | --- | --- |
| OQ-001 | OPEN | Polityka partial refund: czy częściowy refund redukuje/oznacza grant, czy pozostaje manual review? | Payments / patron access | Wpływa na lifecycle `Payment` -> `PatronGrant`, admin support, audyt i edge-case access. | X1 Payments / Patron Safety |
| OQ-002 | OPEN | Czy reakcje/hearts w komentarzach są launch-critical, jeśli obecny runtime je posiada? | Comments / community | Decyduje, czy reakcje muszą wejść do launch-critical scope, testów i moderacji, czy mogą zostać ograniczone/odłożone. | X6 Product Excellence Passes |
| OQ-003 | OPEN | Jakie dokładnie PL/EN legal/cookie copy ma być użyte przed X7? | Legal / privacy / UX copy | Public launch wymaga spójnego legal, privacy, cookies i consent copy w językach launchu. | X7 Launch Readiness |
| OQ-004 | OPEN | Jakie limity rate limiting dla komentarzy i broadcastów są akceptowalne na launch? | Comments / email / abuse prevention | Limity wpływają na UX, ochronę przed spamem, deliverability i operacje supportowe. | X6/X7 Launch Readiness |
| OQ-005 | OPEN | Jakie dokładne alert channels i thresholds są akceptowalne na launch dla billing/access/video/email failures? | Observability / support | Owner musi widzieć awarie krytyczne bez przecieku sekretów/tokenów i z jasnymi progami eskalacji. | X7 Launch Readiness |
| OQ-006 | OPEN | Czy owner wymaga dodatkowej polityki preservation/migration dla oryginalnych plików wideo poza aktywną specyfikacją Video Provider? | Video / storage / migration | Decyduje o polityce przechowywania oryginałów, migracji legacy storage i przyszłym koszcie operacyjnym. | X3 Video Provider Foundation |
| OQ-007 | OPEN | Czy istnieją dodatkowe wymogi prawne/UX/accessibility, których nie ma jeszcze w aktywnych specs? | Legal / UX / accessibility | Pozwala zamknąć launch scope bez ukrytych wymagań certyfikacyjnych. | X7 Launch Readiness |

## Decision log rules

- Builder nie może zmienić product policy ani rozwiązywać otwartych pytań właściciela samodzielnie.
- Planner może zaproponować pytanie do właściciela, ale musi oznaczyć je jako otwarte, dopóki właściciel nie podejmie decyzji.
- Integrator zapisuje zaakceptowaną decyzję jako osobny owner-decision entry i przenosi powiązane pytanie z tabeli otwartej do sekcji obowiązujących decyzji.
- Certifier sprawdza, czy specs, tickety i implementacja respektują obowiązujące decyzje oraz nie traktują otwartych pytań jako rozstrzygniętych.
- Każda zmiana obowiązującej decyzji wymaga jawnej decyzji właściciela albo ticketu, który jednoznacznie taką decyzję zawiera.
