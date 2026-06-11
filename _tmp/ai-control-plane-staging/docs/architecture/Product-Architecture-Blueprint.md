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

## Payments and PatronGrant

Inwarianty domenowe:

```txt
Payment = money/support event
PatronGrant = access/right/status
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

Nie: `User.isPatron`, Clerk metadata, Subscription, Payment alone, Stripe state alone ani frontend state. `User.isPatron` może istnieć migracyjnie, ale docelowo jest legacy/mismatch diagnostic, nie backend source of truth.

Payment module zapisuje fakty finansowe. Patron module tworzy `PatronGrant`. Access module czyta aktywny `PatronGrant`. Stripe pozostaje źródłem finansowym, ale nie jest bezpośrednim źródłem access decision.

## Subscription/email separation

Subscription to consent na mailing/follow/newsletter. Marketing consent, unsubscribe, bounce i complaint handling nie mogą zmieniać patron access. Transactional emails są oddzielone od marketingu.

## Video provider architecture

Docelowy model:

```txt
Video = content metadata
VideoAsset = provider/media state
VideoProvider = thin abstraction
Cloudflare first
Mux optional
primary READY asset drives playback
```

Cloudflare Stream jest pierwszym providerem. Mux jest wspierany projektowo per `VideoAsset`, dla bogatszych funkcji/analytics/4K/DRM później. R2/S3/Vercel Blob nie są aktywnym prywatnym playback fallbackiem.

## PlaybackPlan/player

Inwarianty wideo/playera:

```txt
allowed PlaybackPlan -> mount player
denied PlaybackPlan -> locked placeholder
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

Frontend renderuje backendowy `PlaybackPlan`; frontend nie podejmuje decyzji access. Locked state to osobne drzewo renderowania, nie overlay na prawdziwym playerze.

## Comments/community

Komentarze pod opublikowanymi wideo są widoczne dla wszystkich. Uprawnienie do pisania zależy od tieru. Spoiler risk pod patron-only wymaga report reason. Moderacja jest audytowalna. Single-level replies na launch; edit/reactions mogą być później, chyba że runtime już je posiada i są certyfikowane.

## Admin cockpit

Admin cockpit jest support operations center. Priorytet: Access Diagnostics, potem patron/payment diagnostics, video/media/provider health, comments moderation, email/subscribers, audit log, system health, dopiero potem generic metrics. Owner ma móc obsłużyć paid-but-locked bez DB/Stripe/Clerk console.

## Observability/system health

System health pokazuje failed/stuck webhooks, payment/grant mismatches, access mismatches, provider upload/playback health, email delivery health, comment health i alerty krytyczne. Audit trail jest oddzielony od operational logs. Logi nie mogą zawierać sekretów, tokenów ani niepotrzebnego PII.

## Launch readiness

Public launch wymaga: brak access leak, brak payment fulfillment gap, privacy/legal/cookie/email consent, accessibility, mobile, performance, security review, backups/recovery, owner runbook, manual QA i X7 final certification.

## Security/privacy/legal/accessibility

Deny by default, backend access validation, raw body webhook verification, token redaction, signed/private playback po access check, unsubscribe/consent compliance, keyboard/mobile accessibility i jasne PL/EN copy są launch-critical.

## AI delivery workflow

Po aktywacji: one ticket = one task = one branch = one PR. Builderzy nie dotykają global docs bez ticketu. Reviewerzy wydają verdict. Integrator synchronizuje po batchu. Certifier zamyka phase gates.

## Do-not-build list

Nie budować: marketplace, white-label CMS, tenant onboarding, recurring patron subscription model, active R2/S3 private fallback playback, player hidden under overlay, provider call before access check, access on User.isPatron/Clerk/Subscription, generic admin dashboard before Access Diagnostics, AI mega-refactor.

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

Fazy X nie mogą stać się aktywne przed zatwierdzonym R-phase handoff albo jawną zgodą właściciela.
