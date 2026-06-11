# Product Standard

Status: STAGED ONLY — NIEAKTYWNE.

## Standard jakości

Polutek.pl ma być produktem public launch quality. To nie jest quick MVP. Jednocześnie excellence powstaje przez kontrolowane fazy i tickety, nie przez jeden mega-refactor.

## Must be true at launch

- Użytkownik nie może dostać patron playback bez backend access.
- Denied PlaybackPlan nie ma URL/tokenu i nie wywołuje providera.
- Kwalifikujące wsparcie tworzy właściwy PatronGrant przez domain use-case.
- Full refund/dispute lifecycle jest bezpieczny.
- Owner może zdiagnozować paid-but-locked.
- Subscription/unsubscribe nie dotyka PatronGrant.
- Komentarze są widoczne zgodnie z polityką, a pisanie jest gated.
- Email consent i unsubscribe działają.
- Mobile, accessibility i performance są sprawdzone.
- Logi nie ujawniają sekretów/tokenów.
- Manual QA i owner runbook są gotowe.

## Product invariants

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

## Excellent, but controlled

Każda poprawa UX, admin, player, comments, email, observability i launch readiness musi być ticketem z allowed paths, validation i definition of done.
