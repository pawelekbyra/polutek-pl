# Historical snapshot / superseded by DOCS-RECONCILE-001

This report is historical evidence from the original X0 activation period. Its statements that only X0 was active are superseded for current execution status by `docs/reports/reconciliation/DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`, root `README.md`, `docs/roadmap/Active-Execution-Roadmap.md` and `docs/roadmap/OWNER-TIMELINE.md`. Preserve the original findings below as historical validation, not current execution truth.

# X0-READY-001 — R-phase handoff inventory

## Status

GO

## Executive summary dla właściciela

Post-R AI Delivery Control Plane jest aktywny i źródła prawdy mówią spójnie, że trwa wyłącznie X0. R0-R11 są traktowane jako `HANDOFF_COMPLETE` dla dalszej pracy, ale nie jako dowód launch-ready. Pierwszy aktywny ticket to `docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md`; runtime X1-X7 pozostaje nieaktywny.

W aktualnym kodzie i guardach nie znaleziono blockerów dla kontynuacji X0. Guard architektury przechodzi: `app/api/**` nie importuje bezpośrednio `@/lib/prisma`, a pięć bezpośrednich importów `@/lib/services/**` w routach jest jawnie allowlistowane z powodami. Legacy istnieje i wymaga późniejszych ticketów, ale nie blokuje następnego kroku X0, bo ten ticket jest docs/inventory i nie wymaga zmian runtime.

Rekomendacja: **GO — można przejść do kolejnego ticketu X0 / control-plane reconciliation**. Ponieważ w `docs/tickets/ready/**` nie ma kolejnego ticketu X0 poza tym wykonanym, następny proponowany ticket powinien zostać utworzony osobno jako docs-only follow-up.

## Co zostało sprawdzone

- `README.md` — root owner control panel, status aktywacji, następny krok, zakazy runtime.
- `AGENTS.md` — aktywny kontrakt agentów, one-ticket rule, docs/runtime separation, inwarianty patron/access/video/comments/email.
- `docs/roadmap/OWNER-TIMELINE.md` — aktywny dashboard właściciela i fazy X0-X7.
- `docs/roadmap/Active-Execution-Roadmap.md` — aktywna roadmapa egzekucji i polityka ticketów.
- `docs/roadmap/Phase-Gates.md` — bramki faz i zasada certyfikacji.
- `docs/tickets/ready/**` — aktywna kolejka ready i dostępne tickety.
- `docs/audit/**` — R7/R10/R11 inventory, guard cleanup note, handoff readiness review, activation report.
- `scripts/check-architecture.ts` — reguły guardów: direct Prisma, route-service allowlist, closed modules, legacy AccessPolicy, UserProfileService.
- `app/api/**` — importy bezpośrednie `@/lib/prisma`, `@/lib/services/**` i bypassy internal module imports.
- `lib/services/**` i `lib/modules/**` — legacy bridges oraz status PatronGrant/User.isPatron, playback, comments, subscriptions.
- `prisma/schema.prisma` — tylko odczytowo, pod kątem obecności modeli/fieldów wymaganych przez inventory.

## R0-R11 handoff status

| Obszar | Status | Dowód | Ryzyko | Następna akcja |
| --- | --- | --- | --- | --- |
| R10 cleanup | GO | `docs/audit/R10-Direct-Prisma-Inventory.md` deklaruje brak direct Prisma w `app/api/**`; `rg -n "@/lib/prisma" app/api` nie zwrócił wyników; guard raportuje `Routes importing @/lib/prisma: 0`. | R10 nie usuwa całego legacy, tylko zamyka najważniejszy direct-Prisma problem w routach. | Kontynuować X0; później ticketować legacy bridges. |
| R10/R11 readiness audit | GO | `docs/audit/R10-R11-HANDOFF-READINESS-REVIEW.md` wskazywał `READY_WITH_MINOR_DOC_FIXES`; późniejszy activation report oznacza control plane jako `ACTIVE`. | Stary readiness review jest historyczny i wspomina problemy rozwiązane przez activation/guard cleanup. | Traktować readiness review jako audit historyczny, nie bieżącą roadmapę. |
| guard cleanup | GO | `docs/audit/R10-GUARD-CLEANUP-NOTE.md` ma status `READY_WITH_GUARD_ALLOWLIST`; `scripts/check-architecture.ts` ma pusty `PRISMA_ROUTES_ALLOWLIST` i jawną `ROUTE_SERVICE_IMPORT_ALLOWLIST`; `npm run quality:architecture-boundaries` przechodzi. | Guard dopuszcza znane route-service wyjątki; to conscious debt, nie kłamstwo. | Future ticket: redukcja allowlisty route-service po modułowej migracji. |
| activation report | GO | `docs/audit/POST-R-CONTROL-PLANE-ACTIVATION-REPORT.md` ma status `ACTIVE`, wymienia aktywowane docs/control plane i mówi, że X1-X7 runtime nie aktywowano. | Status starych PR-ów #817/#814 nie był automatycznie sprawdzony w tamtym raporcie. | Owner powinien ręcznie upewnić się, że stare PR-y nie są merge’owane. |
| owner dashboard | GO | `docs/roadmap/OWNER-TIMELINE.md` wskazuje pierwszy aktywny ticket X0 i opisuje X1-X7 jako staged/not runtime active. | Dashboard jest instrukcją operacyjną, nie certyfikatem implementacji. | Po merge tego raportu Integrator powinien zaktualizować dashboard/ticket status, jeśli proces tego wymaga. |
| AGENTS.md | GO | Root `AGENTS.md` jest aktywny, definiuje one-ticket rule, docs/runtime separation i inwarianty domenowe. | Builder musi nadal pilnować dozwolonych ścieżek; single-writer files są chronione. | Kontynuować tylko przez jeden wskazany ticket na PR. |
| aktywna kolejka ticketów | GO | `docs/tickets/ready/README.md` mówi: najpierw uruchom X0-READY-001; lista ready zawiera też X0.5/X1-X7 inventory/backlog tickets. | Po wykonaniu X0-READY-001 brak drugiego gotowego ticketu X0 w katalogu ready. | Utworzyć osobny docs-only follow-up X0 ticket albo decyzją właściciela przejść do X0.5-READY-001. |
| legacy service exceptions | GO_WITH_LEGACY | Guard allowlistuje 5 route-service importów: media-source playback service, channel sidebar layout service, admin patron user-access bridge, admin users/videos query parser. | Legacy services nadal istnieją i mogą utrzymywać stare zależności. | Future tickets per exception: playback provider boundary, channel read model, PatronGrant/UserAccess cleanup, admin query parser extraction. |
| route direct Prisma status | GO | `rg -n "@/lib/prisma" app/api` brak wyników; guard: 0 direct Prisma route imports. | Direct Prisma może istnieć poza `app/api/**` i w modules/services, ale ten guard dotyczy routów. | Utrzymać pusty `PRISMA_ROUTES_ALLOWLIST`; nowe routy przez modules/use cases. |
| route direct service allowlist | GO_WITH_LEGACY | `rg -n "@/lib/services/" app/api` pokazuje dokładnie 5 route imports i wszystkie są w `ROUTE_SERVICE_IMPORT_ALLOWLIST`. | Allowlista może stać się trwałym ukryciem długu, jeśli nie będzie ticketowana. | Każdy allowlistowany import powinien mieć follow-up cleanup ticket. |
| PatronGrant / User.isPatron legacy | GO_WITH_LEGACY | `lib/modules/patron` ma aktywne granty i recalculate; `lib/services/user-access.service.ts` nadal opisuje dostęp przez `User.isPatron`; `AGENTS.md` targetuje `exists ACTIVE PatronGrant`. | `User.isPatron` pozostaje legacy/read-model/drift risk; Access target nie jest jeszcze w pełni osiągnięty. | X1/X2: inventory i migracja Access truth do active PatronGrant. |
| PlaybackPlan denied-state invariants | GO_WITH_WATCH | `PlaybackService.createPlaybackPlanWithContext` przy `!decision.hasAccess` zwraca `canPlay: false`, `source: undefined`, `controls: false`, puste tracking; źródło jest pobierane dopiero po allow. | Typ `PlaybackPlan` jest stary (`canPlay/access/source`) i nie modeluje jeszcze docelowych stanów `READY/LOGIN_REQUIRED/PATRON_REQUIRED/...` jako formalnego discriminated union; komponent fetchuje `/api/media-source` z wrappera access. | X3/X4: provider foundation i formalny PlaybackPlan/Player simplification. |
| Comments visibility vs permission | GO_WITH_WATCH | Moduły comments listują komentarze przez use case, a create/react/report sprawdzają `checkVideoAccess` i policy; `AGENTS.md` wymaga publicznej widoczności komentarzy pod published videos oraz write/reaction/report gated. | Trzeba osobno zweryfikować w X0.5/X-domain specs, czy każdy endpoint mapuje guest-read/patron-write zgodnie z targetem. | Future comments inventory/spec ticket, jeśli X0.5 wykryje różnice UX/API. |
| Email Subscription != Patron | GO | Subscriptions use cases zwracają `purpose: "EMAIL_NOTIFICATIONS"`, subscribe/unsubscribe operują tylko na `subscription` i liczniku kanału; brak modyfikacji PatronGrant w unsubscribe. | Email module nadal używa `isPatron` w segmentacji/read modelach; to nie jest dowód grantowania access. | X0.5/X-email specs: utrwalić separation i bounce/complaint launch-critical follow-up. |

## Zgodność źródeł prawdy

Źródła prawdy są spójne na poziomie procesu:

- `README.md` mówi, że Post-R AI Delivery Control Plane jest aktywny, R0-R11 są `HANDOFF_COMPLETE`, X0 jest pierwszym aktywnym etapem, X1-X7 nie są aktywne runtime’owo i nie wolno zmieniać runtime bez osobnego ticketu.
- `AGENTS.md` potwierdza aktywację control plane, kolejność źródeł prawdy, one-ticket rule, separation docs/runtime oraz produktowe inwarianty.
- `docs/roadmap/OWNER-TIMELINE.md` działa jako dashboard właściciela: wskazuje pierwszy aktywny ticket X0 i ostrzega przed `continue`/szerokimi promptami.
- `docs/roadmap/Active-Execution-Roadmap.md` mówi, że aktywny jest wyłącznie X0, a X1-X7 pozostają nieuruchomione runtime’owo do czasu bramek X0/X0.5 i osobnego ticketu.
- `docs/audit/POST-R-CONTROL-PLANE-ACTIVATION-REPORT.md` potwierdza aktywację docs/process i brak aktywacji runtime/features/Prisma/package changes.
- `docs/tickets/ready/README.md` i ticket `X0-READY-001` mówią, że pierwszy ticket to inventory/handoff i nie wolno ruszać runtime.

Wniosek: źródła prawdy mówią spójnie, że:

- control plane jest aktywny,
- X0 jest aktywne,
- X1-X7 nie są aktywne runtime’owo,
- pierwszy ticket to `docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md`,
- runtime nie powinien być ruszany w tym tickecie.

Jedyna praktyczna luka procesowa: po wykonaniu X0-READY-001 w `docs/tickets/ready/**` nie ma kolejnego `X0-READY-*` ticketu. To nie blokuje tego PR, ale wymaga decyzji właściciela/Integratora: utworzyć mały X0 follow-up czy przejść do X0.5.

## Guardy i architektura

### Direct Prisma imports w `app/api/**`

- Komenda: `rg -n "@/lib/prisma" app/api || true`.
- Wynik: brak wyników.
- Guard: `Routes importing @/lib/prisma: 0 (0 allowlisted)`.
- `PRISMA_ROUTES_ALLOWLIST` w `scripts/check-architecture.ts` jest pusty.

Ocena: **spójne / guard nie kłamie**. Current app/api direct-Prisma status jest czysty.

### Direct service imports w `app/api/**`

Komenda `rg -n "@/lib/services/" app/api || true` wykazała dokładnie 5 importów:

| Route | Import | Guard status | Ocena |
| --- | --- | --- | --- |
| `app/api/media-source/[videoId]/route.ts` | `@/lib/services/playback/playback.service` | allowlisted | Legacy bridge; nie blokuje X0. |
| `app/api/channel/sidebar/route.ts` | `@/lib/services/channel/channel-layout.service` | allowlisted | Read-side bridge; nie blokuje X0. |
| `app/api/admin/users/[userId]/patron/route.ts` | `@/lib/services/user-access.service` | allowlisted | Patron/UserAccess bridge; ważny future cleanup. |
| `app/api/admin/users/route.ts` | `@/lib/services/admin/admin-query-parser` | allowlisted | Query parser helper; cleanup do route/module DTO parser. |
| `app/api/admin/videos/route.ts` | `@/lib/services/admin/admin-query-parser` | allowlisted | Query parser helper; cleanup do route/module DTO parser. |

Ocena: **spójne z jawną allowlistą**. Guard nie udaje, że importów nie ma; wypisuje ostrzeżenia i failowałby na nowym nieallowlistowanym route-service imporcie.

### Allowlisty route-service

`ROUTE_SERVICE_IMPORT_ALLOWLIST` zawiera dokładnie 5 powyższych route exceptions. `KNOWN_ROUTE_VIOLATIONS_ALLOWLIST` jest pusty. `LEGACY_ACCESS_POLICY_ALLOWLIST` dopuszcza tylko `lib/services/content/video.service.ts`. `USER_PROFILE_SERVICE_ALLOWLIST` nadal zawiera production bridge i test usages.

Ocena: **spójne, ale wymaga dyscypliny**. Allowlisty są świadomym rejestrem długu, nie blockerem X0. Każdy wpis powinien mieć późniejszy cleanup ticket.

### Closed module violations

- Guard sprawdza `CLOSED_MODULES = ['video', 'users', 'channel', 'audit', 'media', 'access', 'comments', 'subscriptions']`.
- Guard wykrywa mieszanie closed module importów z direct Prisma/direct unapproved services w routach.
- Guard report: `Routes with internal module imports: 0`.
- Komenda `rg --pcre2` dla internal module route bypassów nie zwróciła wyników.

Ocena: **spójne / brak bieżących closed-module route bypass violations**.

### Czy guardy kłamią?

Nie. Guardy są spójne z aktualnym kodem:

- direct Prisma w `app/api/**`: 0,
- direct route-service imports: 5 i wszystkie jawnie allowlistowane,
- route internal module bypasses: 0,
- legacy AccessPolicy production usage: 1 i jawnie allowlistowany bridge,
- UserProfileService usage: obecne tylko w allowlistowanych miejscach/testach według guard output.

Guardy nie są kompletnym certyfikatem target architecture. To boundary check dla bieżącej fazy. Nie zastępują X1-X7 inventory/migracji.

## Legacy / ryzyka techniczne

| Legacy / ryzyko | Czy blokuje X0? | Dlaczego | Future ticket |
| --- | --- | --- | --- |
| `app/api/media-source/[videoId]/route.ts` → legacy `PlaybackService` | Nie | Jawnie allowlistowane; denied path nie zwraca source. | `X3-READY-001-video-provider-current-state-inventory.md` / X4 PlaybackPlan follow-up. |
| `PlaybackService` używa `StorageService`/R2-style signing po allow | Nie | X0 jest inventory; owner decyzja mówi Cloudflare first, R2/S3/Blob legacy/migracja. | Video provider foundation / Cloudflare Stream source planning. |
| `app/api/channel/sidebar/route.ts` → `ChannelLayoutService` | Nie | Jawnie allowlistowany read-side bridge. | Channel read model/module cleanup ticket. |
| `app/api/admin/users/[userId]/patron/route.ts` → `UserAccessService` | Nie | Jawnie allowlistowany bridge, ale dotyka Patron/User.isPatron risk. | X1/X2 PatronGrant/UserAccess source-of-truth cleanup. |
| Admin users/videos list routes → `admin-query-parser` | Nie | Query parsing helper, nie runtime domain mutation. | Admin query DTO parser cleanup. |
| `User.isPatron` jako legacy/read model | Nie dla X0 | AGENTS targetuje active PatronGrant; code nadal ma bridge/recalculate i Clerk cache. | X1 payment/patron inventory, X2 access truth inventory/migration. |
| Clerk metadata `isPatron` | Nie dla X0 | `UserAccessService` opisuje Clerk jako quick frontend/cache; AGENTS zabrania traktować Clerk jako backend truth. | X2 access truth reset. |
| `lib/services/content/video.service.ts` imports legacy `AccessPolicy` | Nie | Jedyny production AccessPolicy bridge jest jawnie allowlistowany. | Content/media cleanup after X3/X4. |
| `R10-Legacy-Service-Inventory.md` ma historycznie niespójny wpis `referral.service.ts` jako ACTIVE, choć plik nie istnieje | Nie | To dokument historyczny z końcowym summary o usunięciu; brak runtime pliku/importów. | Docs reconciliation cleanup ticket, jeśli Integrator chce domknąć audit wording. |
| Comments guest-read/patron-write target wymaga pełnej endpoint-by-endpoint spec w Post-R | Nie | Bieżący kod ma policy/use-case checks; X0 nie zmienia runtime. | Comments permissions inventory/spec follow-up, jeśli dodany do X0.5/X-domain backlog. |
| Email broadcast/suppression launch-critical | Nie | Subscribe/unsubscribe są mailing-only; launch-critical bounce/complaint suppression pozostaje future. | Email/launch readiness ticket before X7. |
| Stare PR-y #817/#814 | Nie technicznie w repo | Activation report mówi, że statusu nie udało się sprawdzić automatycznie. | Owner manual PR hygiene: zamknąć/nie merge’ować. |

## Blokery

Brak blockerów dla kontynuacji X0.

## Rekomendacja

GO — można przejść do kolejnego ticketu X0.

Uzasadnienie: ten ticket miał wyłącznie zinwentaryzować handoff i sprawdzić spójność źródeł prawdy, guardów i aktualnego kodu. Spójność jest wystarczająca dla kontynuacji procesu. Legacy jest jawne i powinno zostać ticketowane w późniejszych fazach, ale nie wymaga runtime-free fix przed merge tego raportu.

## Następny proponowany ticket

W `docs/tickets/ready/**` nie istnieje kolejny gotowy ticket `X0-READY-*` poza wykonanym:

- `docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md`

Istnieją gotowe tickety późniejszych faz, m.in.:

- `docs/tickets/ready/X0.5-READY-001-research-synthesis.md`
- `docs/tickets/ready/X0.5-READY-002-owner-decisions-lock.md`
- `docs/tickets/ready/X0.5-READY-003-product-standard.md`
- `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md`
- `docs/tickets/ready/X2-READY-001-access-truth-inventory.md`
- `docs/tickets/ready/X3-READY-001-video-provider-current-state-inventory.md`
- `docs/tickets/ready/X4-READY-001-playbackplan-current-state-inventory.md`
- `docs/tickets/ready/X5-READY-001-admin-cockpit-current-state-inventory.md`
- `docs/tickets/ready/X7-READY-001-launch-readiness-gap-analysis.md`

Rekomendowany nowy ticket, jeśli owner/Integrator chce utrzymać X0 przed X0.5:

```txt
docs/tickets/ready/X0-READY-002-control-plane-follow-up-ticket-plan.md
```

Zakres sugerowany: docs-only plan kolejnych cleanup/follow-up ticketów na podstawie tego raportu, bez runtime changes. Nie tworzę tego ticketu, bo obecny zakres pozwala edytować tylko `docs/reports/reconciliation/**`.

Jeśli owner uzna X0 inventory za wystarczające, następnym istniejącym ready ticketem jest:

```txt
docs/tickets/ready/X0.5-READY-001-research-synthesis.md
```

ale powinien zostać uruchomiony dopiero decyzją właściciela/Integratora po merge i ewentualnej reconciliation.

## Walidacja

- `git diff --check`: PASS.
- `npm run quality:architecture-boundaries`: PASS. Komenda zgłosiła ostrzeżenia o 5 jawnie allowlistowanych tymczasowych route-service imports oraz zakończyła się `✅ Architecture check passed.`.

Nie uruchamiałem szerokich testów runtime, bo ticket jest docs/inventory i walidacja wymaga tylko `git diff --check` oraz `npm run quality:architecture-boundaries`.

## Czego nie zmieniono

- runtime code,
- `app/**`,
- `lib/**`,
- `components/**`,
- `tests/**`,
- `prisma/**`,
- package files,
- `AGENTS.md`,
- `README.md`,
- roadmap/tickets,
- guardy.
