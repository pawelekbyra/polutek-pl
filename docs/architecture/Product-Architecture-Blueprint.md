# Product Architecture Blueprint — target-only

```txt
Target architecture != current implementation.
```

Ten dokument opisuje docelową architekturę Polutek.pl po R-phase i podczas faz X. Nie jest dowodem, że runtime już tak działa.

## Product identity

Polutek.pl jest jednokanałowym miejscem VOD twórcy: jeden oficjalny kanał, jeden katalog wideo, jeden system patronów/dostępu, jedna społeczność, jedna lista mailingowa i jeden kokpit admina. Polutek.pl nie jest marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.

Zdanie rdzeniowe:

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## Business model

Patronat jest reward za kwalifikujące jednorazowe wsparcie/donację. Nie jest recurring subscription. Domyślny próg kwalifikacji jest admin-konfigurowalny per waluta: 10 PLN, 10 USD, 10 EUR, 10 CHF. Dostęp patrona jest permanentny domyślnie, chyba że zostanie zawieszony/cofnięty polityką.

## Access tiers

- `PUBLIC`: każdy może oglądać, komentarze widoczne dla wszystkich, komentowanie wymaga loginu.
- `LOGGED_IN`: gość widzi istnienie wideo i komentarze, playback/komentowanie wymaga loginu.
- `PATRON`: każdy widzi istnienie wideo i komentarze, playback i komentowanie wymagają patrona/admina.

## AccessDecision Contract
Wszystkie decyzje autoryzacyjne bazują na kanonicznym kontrakcie `AccessDecision`, który zawiera `allowed`, `reason`, `decisionSource` oraz flagę `adminOverride`.

## Payments and PatronGrant Lifecycle

Inwarianty domenowe:

```txt
Payment = financial fact
PatronGrant = access right and lifecycle state
Subscription = mailing/follow/newsletter consent
```

Zakazane modele:

```txt
Stripe webhook -> User.isPatron = true
Subscription -> patron access
Clerk metadata -> backend access truth
Payment alone -> patron access
frontend state -> patron access
```

Poprawny model docelowy:

```txt
Stripe webhook
  -> verify signature/raw body
  -> record StripeEvent / webhook ledger
  -> record Payment as financial fact
  -> Patron eligibility policy checks amount/currency/status
  -> Patron module creates PatronGrant
  -> Access module reads active PatronGrant
```

Źródło prawdy dostępu patrona:

```txt
exists ACTIVE PatronGrant
```

Lifecycle:
- ACTIVE: normalny dostęp.
- SUSPENDED: wstrzymany (np. podczas dispute).
- REVOKED: cofnięty permanentnie (np. po refundzie).

Każda zmiana stanu musi być audytowalna (domain audit events).

## Subscription/email separation

Subscription to consent na mailing/follow/newsletter. Marketing consent, unsubscribe, bounce i complaint handling nie mogą zmieniać patron access. Transactional emails są oddzielone od marketingu.

## Video provider architecture

Docelowy model:

```txt
Video = content metadata
VideoAsset = provider/media state
VideoProvider = thin abstraction (dependency injection)
Cloudflare first
Mux optional
primary READY asset drives playback
```

Cloudflare Stream jest pierwszym providerem. Mux jest wspierany projektowo per `VideoAsset`. R2/S3/Vercel Blob nie są aktywnym prywatnym playback fallbackiem.

## PlaybackPlan/player

Inwarianty wideo/playera:

```txt
READY iff (canPlay === true AND access.allowed === true AND playable source exists)
```

Dla denied/locked:

```txt
do not mount real player
do not fetch stream
do not request playback token
do not call Cloudflare/Mux for playback source
do not count playback/view event
do not leak playbackUrl
do not leak playbackToken
```

Docelowe stany `PlaybackPlan`: `READY`, `LOGIN_REQUIRED`, `PATRON_REQUIRED`, `VIDEO_NOT_READY`, `NO_PRIMARY_ASSET`, `PROCESSING`, `UNAVAILABLE`, `ERROR`. Denied plan nie zawiera playable URL ani tokenu. Provider call następuje dopiero po backendowej zgodzie Access.

Personalizowane odpowiedzi playback/token muszą być non-cacheable (`private, no-store`).

## Comments/community

Komentarze pod opublikowanymi wideo są widoczne dla wszystkich. Uprawnienie do pisania zależy od tieru i integruje się z modułem Access. Moderacja jest audytowalna.

## Admin cockpit

Admin cockpit jest support operations center. Priorytet: Access Diagnostics (pokazujące Identity, Patron truth, Cache drift, Financial facts, Audit). Jeden kanoniczny administrator authorization resolver. Admin override jest jawny i logowany.

## Dependency and AppContext Boundary
Zalecany kierunek: `route -> use case -> domain ports -> infrastructure adapters`. Zakaz bezpośredniego importu Prisma w warstwie aplikacji.

## Architecture Guard
Obowiązkowy strażnik w CI (`npm run quality:architecture-boundaries`) pilnujący granic modułów i zakazanych źródeł autoryzacji.

## AI delivery workflow

Po aktywacji: one ticket = one task = one branch = one PR. Builderzy nie dotykają global docs bez ticketu. Reviewerzy wydają verdict. Integrator synchronizuje po batchu. Certifier zamyka phase gates.

## Phase order

Model faz:

- R0-R11 — aktualna era refaktoru/fundamentów, aktywna do zakończenia i certyfikacji.
- X0 — Control Plane & Truth Reconciliation.
- X0.5 — Product Standard & Research Synthesis.
- X1 — Payments / Patron Safety.
- X2 — Access / Patron Hard Reset.
- X3 — Video Provider Foundation.
- X4 — PlaybackPlan / Player Simplification.
- X5 — Admin Cockpit Foundation.
- X6 — Product Excellence Passes.
- X7 — Launch Readiness / Final Certification.
