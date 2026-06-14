# AGENTS.md — Post-R AI Delivery Control Plane

Status aktywacji:

```txt
ACTIVE — POST-R AI DELIVERY CONTROL PLANE
```

Ten dokument jest aktywną częścią Post-R AI Delivery Control Plane. Obowiązuje po aktywacji root `AGENTS.md` i `docs/**`.

## 0. Zakres

Ten plik jest aktywnym kontraktem agentów AI pracujących nad Polutek.pl po aktywacji Post-R AI Delivery Control Plane. Obowiązuje Codex, Jules, Reviewerów, Integratorów, Certifierów i innych agentów AI.

Jeżeli prompt konfliktuje z tym plikiem, agent ma zatrzymać się i zgłosić konflikt, chyba że prompt zawiera jawną decyzję właściciela nadpisującą regułę.

Aktualny stage operacyjny: current `main` zawiera znaczące scalone fundamenty X1/X2/X3/X4/X5 oraz standardy X6/X7, ale produkt nie jest public-launch certified. Agentom nie wolno cofać dokumentów do stanu "tylko X0 aktywne" ani deklarować launch-ready bez X7 evidence.

Mandatory Rules: `POST_MERGE_RECONCILIATION_REQUIRED` and `AUTOMATIC_BOLEK_MERGE_AUTHORIZED` (see `docs/governance/BOLEK-OPERATING-MODEL.md`). Every implementation task must be preceded by a verification of canonical documentation state.

## 1. MERGED_UNVERIFIED Rule

Jeśli runtime PR został zmergowany mimo failed/skipped required CI, jego status musi być **MERGED_UNVERIFIED**.
- Integrator musi utworzyć post-merge verification ticket.
- Dokumentacja nie może oznaczyć go jako VERIFIED ani CERTIFIED.
- Następny unrelated runtime ticket nie powinien zostać aktywowany, dopóki current merged risk nie zostanie sklasyfikowany.
- Skipped critical integration test != automated test evidence.
- Vercel READY != correctness evidence.
- PR report musi odróżniać: `passed`, `skipped`, `not_run`, `blocked`, `failed`.

## 2. Tożsamość produktu

Polutek.pl jest jednokanałowym miejscem VOD twórcy: jeden oficjalny kanał, jeden katalog wideo, jeden system patronów/dostępu, jedna społeczność, jedna lista mailingowa i jeden kokpit admina. Polutek.pl nie jest marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.

Zdanie rdzeniowe:

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## 3. Decyzje właściciela

Decyzje właściciela, wiążące dopóki właściciel jawnie ich nie zmieni:

- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony lub cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta; domyślne wartości launch: 10 PLN, 10 USD, 10 EUR, 10 CHF, 10 GBP.
- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma być wspierany projektowo per `VideoAsset`, bez budowania ciężkiego enterprise multi-provider frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Komentarze pod patron-only wideo są widoczne dla wszystkich; komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Launch jest publiczny, nie prywatna beta.
- Cel jakości: produkt excellent, nie szybkie minimum; excellence osiągane fazami i ticketami, nie jednym wielkim PR-em.

## 4. Źródła prawdy

Nie używać jednej liniowej hierarchii, w której stary README może nadpisać runtime albo decyzje właściciela. Obowiązują kategorie prawdy:

### Implementation truth

- Aktualny kod i testy na bieżącym `main`.
- Kod/testy są dowodem implementacji, ale nie dowodem produkcyjnej certyfikacji.

### Product-policy truth

- Jawne decyzje właściciela.
- `AGENTS.md`.
- `docs/strategy/OWNER-DECISIONS.md`.

### Current execution-status truth

- Root `README.md`.
- `docs/roadmap/Active-Execution-Roadmap.md`.
- `docs/roadmap/OWNER-TIMELINE.md`.
- Aktualna kolejka ticketów.

### Target/specification truth

- `docs/specs/**`.
- `docs/strategy/PRODUCT-STANDARD.md`.
- `docs/roadmap/Phase-Gates.md`.
- `docs/architecture/Product-Architecture-Blueprint.md`.
- `docs/architecture/ARCHITECTURE-REPAIR-PLAN.md`.

### Historical evidence

- PR body, historyczne reconciliation reports, audits, review/certification notes i closed/superseded tickets.
- Historyczny raport opisuje stan z czasu powstania. Jeżeli jest superseded, musi wskazywać nowsze źródło, ale nie wolno przepisywać jego dawnych wyników jako obecnych.

Zasada stała:

```txt
Target architecture != current implementation.
```

Blueprint i Repair Plan są target-only. Nie wolno udawać, że docelowa architektura już istnieje w runtime.

## 5. Role agentów

### Planner

Może czytać stan, dzielić pracę na tickety, identyfikować zależności, proponować batch i przygotowywać prompty. Nie może implementować runtime ani oznaczać faz jako done bez certyfikacji.

### Builder

Builder implementuje dokładnie jeden ticket. Może edytować tylko ścieżki dozwolone przez ticket. Musi uruchomić walidację z ticketu i zwrócić PR report. Builder nie edytuje README, roadmap globalnych, AGENTS, schema, package files ani guardów, chyba że ticket jawnie na to pozwala.

### Reviewer

Reviewer sprawdza diff, scope, ścieżki, walidację, architekturę, produktowe inwarianty i ryzyko. Verdict musi być jednym z: `MERGE`, `FIX`, `BLOCKED`, `REJECT`.

### Integrator

Integrator po batchu synchronizuje docs, przesuwa tickety, aktualizuje timeline/roadmapę i pisze reconciliation report. Integrator nie robi runtime zmian, chyba że ma osobny aktywny ticket. Global docs są serial-only i wymagają jawnej autoryzacji właściciela.

### Certifier

Certifier weryfikuje bramki faz, testy, guardy, docs reconciliation i znane blokery. Certifier może rekomendować certyfikację, ale tylko właściciel merge'uje.

## 6. One ticket rule

```txt
one ticket = one agent task = one branch = one PR
```

Builder nie może pracować z vague promptu. Zakazane prompty:

```txt
continue
improve everything
build the app
do next phase
clean up everything
```

Prawidłowy prompt wskazuje jeden plik `docs/tickets/ready/<ticket>.md` i nakazuje przestrzeganie `AGENTS.md`.

## 7. Docs vs runtime

- Docs-only ticket nie może zmieniać runtime.
- Runtime ticket nie może aktualizować globalnych docs poza własnym raportem, chyba że ticket pozwala.
- Schema, migrations, package files i architecture guard są single-writer/serial-only.
- Roadmapa nie jest dowodem implementacji. Kod i testy są dowodem implementacji.
- Merged code/local tests nie oznaczają public-launch certification; X7 wymaga production/manual evidence.

## 8. Single-writer files

Serial-only, chyba że ticket jawnie pozwala:

- `README.md`
- `AGENTS.md`
- `docs/roadmap/Active-Execution-Roadmap.md`
- `docs/roadmap/OWNER-TIMELINE.md`
- `docs/roadmap/Phase-Gates.md`
- `docs/architecture/Product-Architecture-Blueprint.md`
- `docs/architecture/ARCHITECTURE-REPAIR-PLAN.md`
- `docs/strategy/OWNER-DECISIONS.md`
- `scripts/check-architecture.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `package.json`
- `package-lock.json`

## 9. Parallel work rules

Domyślnie maksymalnie 2 Builderów. Do 3 tylko po stabilizacji control plane i tylko dla izolowanych docs/inventory/UI tasków. Nigdy nie równoleglić ticketów dotykających tej samej rodziny route'ów, modułu, modelu Prisma, test suite, global doc, guard file, package files lub migrations.

## 10. Inwarianty płatności/access/patron

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

Nie: `User.isPatron`, Clerk metadata, Subscription, Payment alone, Stripe state alone ani frontend state. `User.isPatron` jest wyłącznie denormalized read model.

Dodatkowo: pełny refund cofa powiązany grant; dispute zawiesza; dispute won reactivates; dispute lost/chargeback revokes; manual grant/suspend/reactivate/revoke wymaga powodu i audytu.

## 11. Inwarianty wideo/playera

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

**PlaybackPlan Invariant**: `READY` status MUST imply `canPlay === true` AND `access.allowed === true` AND presence of a playable source.

## 12. Inwarianty komentarzy

- Widoczność komentarzy != uprawnienie do komentowania.
- Komentarze pod opublikowanymi wideo są widoczne dla wszystkich.
- PUBLIC/LOGGED_IN: komentowanie wymaga loginu.
- PATRON: komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Goście mogą czytać, ale nie pisać ani reportować.
- Moderation states: `VISIBLE`, `HELD_FOR_REVIEW`, `HIDDEN`, `DELETED`.
- Hide/delete/restore/dismiss wymagają audytu.

## 13. Inwarianty email/subscription

- Subscription = mailing consent only.
- Patron != newsletter subscriber.
- Unsubscribe nigdy nie usuwa PatronGrant.
- Patron nie oznacza automatycznej zgody marketingowej.
- Transactional emails są oddzielone od marketingu.
- Broadcast wymaga preview/test-send i audytu.
- Bounce/complaint suppression jest launch-critical.
- Webhook idempotency REQUIRES lease ownership and fencing.

## 14. Admin/action/audit

Admin cockpit jest support operations center, nie vanity dashboard. Access Diagnostics ma pierwszeństwo przed generic dashboard. Każda manualna akcja wpływająca na dostęp wymaga reason + audit + confirmation dla działań niebezpiecznych. Canonical admin authorization resolver MUST be used.

## 15. Walidacja i raportowanie

Każdy PR musi zawierać: summary, intent, changed files, validation commands with result, scope confirmation, what did not change, risks, follow-ups, ticket status. Nie wolno twierdzić, że testy przeszły, jeśli nie zostały uruchomione.

## 16. Security and Privacy

- personalized access/playback/token responses MUST be non-cacheable (private, no-store).
- secrets, tokens, URLs and PII MUST be redacted from logs and `EmailEvent.error`.
- no READY+canPlay=false.
- no new legacy imports from `lib/services/**`.
