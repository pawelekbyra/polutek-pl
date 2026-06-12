# Owner Decisions

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Obowiązujące decyzje właściciela

Decyzje obowiązujące dopóki właściciel jawnie ich nie zmieni. Szczegóły techniczne i operacyjne dotyczące launchu zostały skonsolidowane w: [docs/strategy/OWNER-LAUNCH-DECISIONS-001.md](OWNER-LAUNCH-DECISIONS-001.md). Ten plik pozostaje krótkim, obowiązującym indeksem decyzji i inwariantów; konsolidacja launchowa nie usuwa wcześniejszych guardrails z `AGENTS.md` ani z historycznego pre-PR #890 `OWNER-DECISIONS.md`.

### Product identity

- Polutek.pl nie jest platformą, marketplace, multi-creator SaaS, mini-Patreonem, white-label CMS, tenant platformą ani generyczną siecią społecznościową.
- Polutek.pl jest osobistym serwisem jednego twórcy i jednej społeczności: Paweł Perfect.
- Polutek.pl jest jednym oficjalnym miejscem VOD twórcy: jeden oficjalny kanał, jeden katalog wideo, jeden system patronów/dostępu, jedna społeczność, jedna lista mailingowa i jeden kokpit admina.
- Nie budować marketplace, mini-Patreon, multi-creator SaaS, white-label CMS, generic social network ani tenant platformy.
- Zdanie rdzeniowe: `Polutek.pl is not a platform. Polutek.pl is a place.`

### Patronat / payments / access

- Patronat nie jest subskrypcją cykliczną; jest nagrodą za dobrowolne, kwalifikujące jednorazowe wsparcie/napiwek.
- Skutecznie przyjęty kwalifikujący napiwek tworzy uprawnienie przez `PatronGrant`; sama płatność jest faktem finansowym, a nie źródłem prawdy dostępu.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie i nie wymaga kolejnych wpłat, chyba że zostanie zawieszony albo cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta; domyślne progi launch: 10 PLN, 10 USD, 10 EUR, 10 CHF, 10 GBP.
- `Payment != PatronGrant`.
- `Subscription/email != Patron`.
- Active `PatronGrant` jest backendowym źródłem prawdy dla dostępu.
- `User.isPatron`, Clerk metadata, `Subscription`, `Payment` alone, Stripe state alone i frontend state nie są backendowym źródłem prawdy dla patron access.
- Pełny refund cofa powiązany grant; dispute zawiesza; dispute won reactivates; dispute lost/chargeback revokes.
- Brak standardowych częściowych zwrotów (unexpected partial refund wymaga manual review).
- Manual grant/suspend/reactivate/revoke wymaga powodu i audytu.

### Video / playback

- Cloudflare Stream jest pierwszym i aktywnym providerem playbacku.
- Mux ma być wspierany projektowo per `VideoAsset` później, bez budowania ciężkiego enterprise multi-provider frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Prywatne oryginały muszą istnieć poza Cloudflare; Cloudflare nie jest jedyną kopią.
- Dla denied/locked playback: nie montować realnego playera, nie pobierać streamu, nie żądać tokenu, nie wywoływać Cloudflare/Mux po źródło playbacku, nie liczyć view event i nie ujawniać playback URL/tokenu.
- Provider call następuje dopiero po backendowej zgodzie Access.

### Comments / community

- Strefa Patrona jest moderowaną społecznością.
- Komentarze pod patron-only video są widoczne publicznie.
- Widoczność komentarzy nie jest tym samym co uprawnienie do komentowania.
- PUBLIC/LOGGED_IN: komentowanie wymaga loginu.
- PATRON: komentowanie/reagowanie/pisanie wymaga patrona albo admina.
- Goście mogą czytać opublikowane komentarze, ale nie pisać, reagować ani reportować.
- Moderation states: `VISIBLE`, `HELD_FOR_REVIEW`, `HIDDEN`, `DELETED`.
- No shadow bans.
- Hide/delete/restore/dismiss wymagają audytu.
- Właściciel może usuwać komentarze lub cofać dostęp z ważnej przyczyny (spam, nękanie, treści bezprawne).
- Reakcje/hearts nie są launch-critical i mogą zostać odłożone.

### Email / subscriptions

- Trzy klasy maili: System/Transactional, Content Notifications, Referral Notifications.
- Systemowy mail nie może automatycznie dodawać do Resend Audience ani włączać subskrypcji treści.
- Każdy wspierany mail systemowy ma edytowalny szablon PL/EN w panelu admina.
- Content notifications wymagają osobnego, świadomego opt-in; decyzja właściciela nie narzuca konkretnego kontrolnego UI, ale jeśli użyty jest checkbox, nie może być domyślnie zaznaczony.
- Link unsubscribe musi być bezpieczny (podpisany token) i nie zawierać e-maila w query string.
- Newsletter/content subscription jest zgodą mailingową wyłącznie; nie daje patron access.
- Unsubscribe z emaila nigdy nie cofa `PatronGrant`.
- Patron nie oznacza automatycznej zgody marketingowej.
- Transactional emails są oddzielone od marketingu.
- Broadcast wymaga preview/test-send i audytu.
- Bounce/complaint suppression jest launch-critical.

### Launch / quality

- Launch jest publiczny, nie private beta.
- Launch PL i EN (główny UX, płatności, Patron Zone, komentarze, kontakt, dokumenty).
- Minimalna macierz urządzeń i przeglądarek (X6) jest wymagana.
- Przed startem wymagany profesjonalny przegląd prawny (LEGAL_REVIEW_REQUIRED).
- Cel jakości: excellent product przez fazy i tickety, nie szybkie minimum.
- Excellence osiągane jest przez aktywne tickety, walidację, review, reconciliation i certyfikację faz; roadmapa sama w sobie nie jest dowodem implementacji.
- Nie uruchamiać runtime work bez aktywnego ticketu.
- Publiczny launch pozostaje: `NO_GO` do czasu certyfikacji X7.

### Ops / privacy

- RPO: 24h, RTO: 48h (cele wewnętrzne).
- Kanał alertów: `support@polutek.pl`.
- Brak modelu reklamowego, brak sprzedaży danych, brak profilowania.
- Admin cockpit jest support operations center, nie vanity dashboard.
- Access Diagnostics ma pierwszeństwo przed generic dashboard.
- Każda manualna akcja wpływająca na dostęp wymaga reason + audit + confirmation dla działań niebezpiecznych.
- Kontakt: `support@polutek.pl`, adres do korespondencji: Złota 75A/7, 00-819 Warszawa.

## Semantic preservation matrix

This matrix records why this file deliberately preserves both the pre-PR #890 invariants and the launch decisions consolidated in `OWNER-LAUNCH-DECISIONS-001`. It is a control-plane guardrail, not runtime evidence.

| Area | Preserved invariant / decision | Provenance | Current launch implication |
| --- | --- | --- | --- |
| Product identity | One official creator VOD place; never marketplace, tenant platform, mini-Patreon, white-label CMS or generic social network. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`; `OWNER-LAUNCH-DECISIONS-001` section A. | Feature proposals that imply multi-tenant/platform behavior are out of scope unless owner explicitly changes the decision. |
| Payment/access | Qualifying one-time tip/support may create `PatronGrant`; payment alone is only a financial fact. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`; `OWNER-LAUNCH-DECISIONS-001` sections A-B. | Runtime work must preserve Payment -> eligibility policy -> PatronGrant -> Access reads active PatronGrant. |
| Patron truth | Active `PatronGrant` is backend access truth; not `User.isPatron`, Clerk metadata, Subscription, Payment, Stripe state or frontend state. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`. | Any legacy mismatch must be treated as diagnostic/follow-up, not a policy change. |
| Lifecycle/audit | Full refund revokes, dispute suspends, dispute won reactivates, dispute lost/chargeback revokes; manual access actions need reason and audit. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`; `OWNER-LAUNCH-DECISIONS-001` section B. | Missing lifecycle edges remain blockers/follow-ups until implemented and validated. |
| Playback safety | Denied/locked playback must not mount player, fetch stream, request token, call provider, count views or leak playback URL/token. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`; active playback/video specs. | Provider source lookup only after backend Access allows playback. |
| Comments | Comment visibility is separate from write permission; guests may read published comments, patron/admin required for patron-only writes/reactions. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`; `OWNER-LAUNCH-DECISIONS-001` section C. | Public read must not imply public write/report permission. |
| Email/subscription | Subscription/content notifications are mailing consent only; unsubscribe never revokes PatronGrant; transactional and marketing/content emails are separate. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`; `OWNER-LAUNCH-DECISIONS-001` sections F-H. | System emails must not auto-add to Resend Audience or reset an opt-out. |
| Admin/audit | Admin cockpit is support operations; dangerous/manual access actions require reason, audit and confirmation. | `AGENTS.md`; pre-PR #890 `OWNER-DECISIONS.md`. | Access Diagnostics and auditability outrank vanity dashboard work. |
| Launch/tickets | Public launch remains `NO_GO`; one ticket = one agent task = one branch = one PR; queue index is the sole source for next executable ticket. | `AGENTS.md`; current queue index; `OWNER-LAUNCH-DECISIONS-001`. | Merged docs/local tests do not certify X7; next work must come from `docs/tickets/ready/README.md`. |

## Resolved owner questions

| ID | Status | Decyzja |
| --- | --- | --- |
| OQ-001 | DECIDED | Brak standardowych partial refunds; unexpected partial refund -> manual review; full refund cofa grant. |
| OQ-002 | DECIDED | Reactions/hearts nie są launch-critical. |
| OQ-003 | OWNER_DIRECTION_DECIDED / LEGAL_COPY_PENDING | Filozofia i dane robocze ustalone; dokładne PL/EN legal copy wymaga profesjonalnego przeglądu i późniejszego ticketu. |
| OQ-004 | DECIDED / DELEGATED_TECHNICAL_THRESHOLD | Bezpieczne limity rate limiting dobiera implementacja w celu ochrony przed nadużyciem bez blokowania normalnego UX. |
| OQ-005 | DECIDED | Alert channel `support@polutek.pl`, RPO 24h, RTO 48h, progi techniczne delegowane do implementacji. |
| OQ-006 | DECIDED | Prywatne oryginały muszą istnieć poza Cloudflare; Cloudflare nie jest jedyną kopią. |
| OQ-007 | DECIDED_WITH_LEGAL_REVIEW_REQUIRED | PL+EN launch, minimalna macierz X6, brak reklam/profilowania; profesjonalny legal review pozostaje blockerem. |

## Decision log rules

- Builder nie może zmienić product policy ani rozwiązywać otwartych pytań właściciela samodzielnie.
- Planner może zaproponować pytanie do właściciela, ale musi oznaczyć je jako otwarte, dopóki właściciel nie podejmie decyzji.
- Integrator zapisuje zaakceptowaną decyzję jako osobny owner-decision entry i przenosi powiązane pytanie z tabeli otwartej do sekcji obowiązujących decyzji.
- Certifier sprawdza, czy specs, tickety i implementacja respektują obowiązujące decyzje oraz nie traktują otwartych pytań jako rozstrzygniętych.
- Każda zmiana obowiązującej decyzji wymaga jawnej decyzji właściciela albo ticketu, który jednoznacznie taką decyzję zawiera.
