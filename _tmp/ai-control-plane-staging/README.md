# Post-R AI Delivery Control Plane — staged draft

Status aktywacji:

```txt
STAGED ONLY — NIEAKTYWNE
```

Ten folder nie jest aktywnym źródłem prawdy, dopóki Integrator activation PR nie przeniesie/skopiuje go do docelowych ścieżek i nie zaktualizuje root `README.md`. Do tego czasu aktywnym źródłem prawdy pozostaje root `README.md` R-phase.

## Cel

Ten staged README opisuje przyszły system pracy po R-phase. Po aktywacji root README ma stać się krótkim panelem sterowania, a szczegółowa egzekucja ma iść przez roadmapę, timeline właściciela, tickety i protokoły agentów.

## Produkt

Polutek.pl jest jednokanałowym miejscem VOD twórcy: jeden oficjalny kanał, jeden katalog wideo, jeden system patronów/dostępu, jedna społeczność, jedna lista mailingowa i jeden kokpit admina. Polutek.pl nie jest marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.

Zdanie rdzeniowe:

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## Decyzje właściciela

Decyzje właściciela, wiążące dopóki właściciel jawnie ich nie zmieni:

- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony lub cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta; domyślne wartości launch: 10 PLN, 10 USD, 10 EUR, 10 CHF.
- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma być wspierany projektowo per `VideoAsset`, bez budowania ciężkiego enterprise multi-provider frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Komentarze pod patron-only wideo są widoczne dla wszystkich; komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Launch jest publiczny, nie prywatna beta.
- Cel jakości: produkt excellent, nie szybkie minimum; excellence osiągane fazami i ticketami, nie jednym wielkim PR-em.

## Inwarianty domenowe

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

## Inwarianty wideo/playera

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

## Jak właściciel ma pracować po aktywacji

```txt
1. Sprawdź docs/roadmap/OWNER-TIMELINE.md.
2. Zapytaj Plannera: jaki jest następny bezpieczny batch?
3. Wybierz ticket z docs/tickets/ready/.
4. Uruchom jednego Buildera z dokładnie jednym ticketem.
5. Dla równoległości użyj maksymalnie 2 Builderów, chyba że matrix pozwala na 3 izolowane taski.
6. Uruchom Reviewera dla PR-a.
7. Merge tylko po verdict MERGE i decyzji właściciela.
8. Po batchu uruchom Integratora.
9. Przy bramkach faz uruchom Certifiera.
10. Powtarzaj do X7.
```

## Czego nie wolno robić

Nie wolno prosić agenta: `continue`, `improve everything`, `build the app`, `do next phase`. Każda praca Buildera musi mieć jeden ticket, jeden branch i jeden PR.

## Fazy

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

## Najważniejsze pliki po aktywacji

- `AGENTS.template.md` — staged template przyszłego obowiązkowego kontraktu agentów; podczas aktywacji zostanie skopiowany/zmieniony na root `AGENTS.md`.
- `docs/roadmap/Active-Execution-Roadmap.md` — aktywna kolejka i status faz.
- `docs/roadmap/OWNER-TIMELINE.md` — dashboard właściciela.
- `docs/roadmap/CODEX-WORKFLOW.md` — instrukcja pracy z Codex Cloud.
- `docs/tickets/ready/` — jedyne źródło zadań Builderów.
- `docs/templates/CODEX_TASK_PROMPT.md` — szkielet promptu dla Buildera.
- `docs/operations/**` — protokoły review, merge, integracji i certyfikacji.

## Aktywacja

Aktywacja następuje tylko przez Integrator activation PR po R10/R11 handoff/certification lub jawnej zgodzie właściciela. Podczas przyszłego Integrator activation PR należy skopiować/zmienić nazwę:

```txt
_tmp/ai-control-plane-staging/AGENTS.template.md
-> AGENTS.md
```

Do tego czasu staged control plane jest planem przyszłym, nie obowiązującą instrukcją runtime.
