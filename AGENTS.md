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

## 1. Tożsamość produktu

Polutek.pl jest jednokanałowym miejscem VOD twórcy: jeden oficjalny kanał, jeden katalog wideo, jeden system patronów/dostępu, jedna społeczność, jedna lista mailingowa i jeden kokpit admina. Polutek.pl nie jest marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.

Zdanie rdzeniowe:

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## 2. Decyzje właściciela

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

## 3. Źródła prawdy

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

### Historical evidence

- PR body, historyczne reconciliation reports, audits, review/certification notes i closed/superseded tickets.
- Historyczny raport opisuje stan z czasu powstania. Jeżeli jest superseded, musi wskazywać nowsze źródło, ale nie wolno przepisywać jego dawnych wyników jako obecnych.

Zasada stała:

```txt
Target architecture != current implementation.
```

Blueprint jest target-only. Nie wolno udawać, że docelowa architektura już istnieje w runtime.

## 4. Role agentów

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

## 5. One ticket rule

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

## 6. Docs vs runtime

- Docs-only ticket nie może zmieniać runtime.
- Runtime ticket nie może aktualizować globalnych docs poza własnym raportem, chyba że ticket pozwala.
- Schema, migrations, package files i architecture guard są single-writer/serial-only.
- Roadmapa nie jest dowodem implementacji. Kod i testy są dowodem implementacji.
- Merged code/local tests nie oznaczają public-launch certification; X7 wymaga production/manual evidence.

## 7. Single-writer files

Serial-only, chyba że ticket jawnie pozwala:

- `README.md`
- `AGENTS.md`
- `docs/roadmap/Active-Execution-Roadmap.md`
- `docs/roadmap/OWNER-TIMELINE.md`
- `docs/roadmap/Phase-Gates.md`
- `docs/architecture/Product-Architecture-Blueprint.md`
- `docs/strategy/OWNER-DECISIONS.md`
- `scripts/check-architecture.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `package.json`
- `package-lock.json`

## 8. Parallel work rules

Domyślnie maksymalnie 2 Builderów. Do 3 tylko po stabilizacji control plane i tylko dla izolowanych docs/inventory/UI tasków. Nigdy nie równoleglić ticketów dotykających tej samej rodziny route'ów, modułu, modelu Prisma, test suite, global doc, guard file, package files lub migrations.

## 9. Inwarianty płatności/access/patron

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

Dodatkowo: pełny refund cofa powiązany grant; dispute zawiesza; dispute won reactivates; dispute lost/chargeback revokes; manual grant/suspend/reactivate/revoke wymaga powodu i audytu. Jeżeli current main nie spełnia pełnego lifecycle, dokumentować jako blocker/follow-up, a nie jako zmianę polityki.

## 10. Inwarianty wideo/playera

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

## 11. Inwarianty komentarzy

- Widoczność komentarzy != uprawnienie do komentowania.
- Komentarze pod opublikowanymi wideo są widoczne dla wszystkich.
- PUBLIC/LOGGED_IN: komentowanie wymaga loginu.
- PATRON: komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Goście mogą czytać, ale nie pisać ani reportować.
- Moderation states: `VISIBLE`, `HELD_FOR_REVIEW`, `HIDDEN`, `DELETED`.
- No shadow bans.
- Hide/delete/restore/dismiss wymagają audytu.

## 12. Inwarianty email/subscription

- Subscription = mailing consent only.
- Patron != newsletter subscriber.
- Unsubscribe nigdy nie usuwa PatronGrant.
- Patron nie oznacza automatycznej zgody marketingowej.
- Transactional emails są oddzielone od marketingu.
- Broadcast wymaga preview/test-send i audytu.
- Bounce/complaint suppression jest launch-critical.

## 13. Admin/action/audit

Admin cockpit jest support operations center, nie vanity dashboard. Access Diagnostics ma pierwszeństwo przed generic dashboard. Każda manualna akcja wpływająca na dostęp wymaga reason + audit + confirmation dla działań niebezpiecznych.

## 14. Walidacja i raportowanie

Każdy PR musi zawierać:

- summary,
- intent,
- changed files,
- validation commands with result,
- scope confirmation,
- what did not change,
- risks,
- follow-ups,
- ticket status.

Nie wolno twierdzić, że testy przeszły, jeśli nie zostały uruchomione.

## 15. Portable handoff and decision precision

### Portable workspace baseline

Agent must not assume that every execution environment contains a local
`main` branch or a configured Git remote.

Preferred baseline verification:

1. verify the expected merge commit is an ancestor of `HEAD`;
2. if history is unavailable, verify the required structural snapshot;
3. require a clean working tree;
4. report the actual branch and verification mode.

Absence of `main` or `origin` alone is not a blocker in an isolated
Codex workspace.

A task may return `BLOCKED` only when neither commit ancestry nor
structural verification can prove the required baseline.

### Product-policy supersession

A newer, shorter or consolidated document does not automatically supersede
an older, more precise invariant.

A normative statement may be removed or weakened only when:

- an explicit owner-approved record identifies the exact superseded rule;
- the record includes owner provenance;
- the replacement is at least equally precise;
- the PR report lists the supersession.

When `Supersedes: none`, all earlier non-conflicting invariants remain binding.

### Owner-decision provenance

New or updated owner-decision records must state these fields when they record
a new decision or materially update an existing one:

```txt
Decision source
Approved by
Approval date
Recorded by
Supersedes
Does not supersede
Implementation status
Legal status
Operator-evidence status
Launch status
```

Without explicit owner provenance, a new decision is PROPOSED, not DECIDED.

This rule does not require retroactive rebuilding of every historical decision
record; it applies to new or updated records going forward.

### Current-ticket source of truth

`docs/tickets/ready/README.md` is the sole canonical pointer to the current
executable agent ticket.

README, roadmaps, owner timelines, reports and individual historical ticket
files may link to the queue, but must not maintain an independent current
ticket pointer.

If another document disagrees with the queue, stop runtime assignment and
reconcile the control plane first.

### Backlog versus executable queue

`docs/roadmap/Launch-Execution-Backlog.md` describes the full remaining path,
dependencies and ownership.

It is not an executable queue.

The backlog may contain many planned items, but only the ready-ticket index
may designate exactly one current executable ticket.

### Precision contract

For owner-decided behavior:

- `MUST` / `musi` means mandatory;
- `MUST NOT` / `nie może` means prohibited;
- `SHOULD` requires documented justification for deviation;
- `MAY` means optional.

Do not use `may`, `może`, `should` or `powinno` when the owner has made the
behavior mandatory.

Do not convert an owner-required result into a specific UI component unless
the owner selected that component.

For example: explicit confirmation does not automatically mean checkbox.

## 16. Blocked behavior

Jeżeli ticket wymaga niedozwolonej ścieżki, decyzji właściciela, schema change, package update, global doc bez zgody lub konfliktuje z innym PR-em, agent ma zatrzymać się i zwrócić `BLOCKED` z opisem unblock condition.
