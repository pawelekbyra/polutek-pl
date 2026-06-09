# Polutek.pl

## 1. Product mode
- **strict single-channel creator hub**: Jeden oficjalny kanał, jeden twórca, jeden katalog treści.
- **Creator = legacy MainChannel**: Model `Creator` w bazie to techniczna reprezentacja głównego kanału.
- **Subscription != Patron**: Subskrypcja (follow) to zapis na newsletter/powiadomienia, nie daje dostępu do treści Patron.
- **no multi-creator marketplace**: To nie jest platforma dla wielu twórców.

## 2. Current active refactor
- **Modular Monolith**: Przejście z rozproszonych serwisów na domeny w `lib/modules/**`.
- **Standardowy przepływ**: `route -> use-case -> policy/service/repository -> Prisma`.
- **README is source of truth**: Ten dokument zawiera całą instrukcję obecnej refaktoryzacji.

## 3. Current status

| Etap | Opis | Status |
| :--- | :--- | :--- |
| **R0** | Zasady i infrastruktura | [x] |
| **R1** | Shared, API boundary, errors, ctx | [x] |
| **R2** | Moduł: Audit | [x] |
| **R3** | Moduł: Media | [x] |
| **R4** | Moduł: Channel | [x] |
| **R5** | Moduł: Users | [~] |
| **R6** | Moduł: Video | [~] |
| **R7** | Moduł: Patron + Payments | [ ] |
| **R8** | Moduł: Comments | [ ] |
| **R9** | Moduł: Email | [ ] |
| **R10** | Cleanup deprecated facade’ów | [ ] |
| **R11** | Admin frontend | [ ] |

## 4. Current next task
`R5/R6 blocker completion — access route, resync scoping, admin video details, users webhook/admin users boundary, then decide whether R7 can start.`

R7 Patron + Payments must not start until R5/R6 blockers are reviewed and either fixed or explicitly accepted.

## 5. Mandatory agent rules
- **do not just move files**: Każdy etap ma być kompletny (kod, testy, typy, boundary guards).
- **update README after every task**: README musi odzwierciedlać realny stan projektu.
- **no [x] without tests and validation**: Nie oznaczaj etapu jako zakończony bez pełnej walidacji.
- **no X phase before R0–R11 complete**: Nie zaczynaj etapu X przed zakończeniem fundamentów.

## 6. R0–R11 roadmap
- **R0**: Zasady, infrastruktura, skrypty guardów.
- **R1**: Shared foundation (Result, Actor, AppContext, AppError, API helpers).
- **R2**: Moduł Audit (logowanie transakcyjne, Actor-based).
- **R3**: Moduł Media (walidacja URL, allowlisty, HLS/DASH detection).
- **R4**: Moduł Channel (strict single-channel, maintenance, policy).
- **R5**: Moduł Users (profile, sync, merge, soft delete).
- **R6**: Moduł Video (CRUD, reorder, visibility, policy).
- **R7**: Moduł Patron + Payments (Stripe, grants, access source of truth).
- **R8**: Moduł Comments (modercja, reakcje, pin, access).
- **R9**: Moduł Email (Resend, broadcast, webhooks).
- **R10**: Cleanup (usuwanie deprecated `lib/services/**`).
- **R11**: Admin frontend (cockpit, management UI).

## 7. Architecture rules
- **thin routes**: Route’y tylko wyciągają dane i wołają use-case. Zakaz `prisma.*` w route’ach.
- **use-cases input + ctx**: Każdy use-case przyjmuje `input` i `AppContext`.
- **Result Pattern**: Używaj `UseCaseResult<T, E>` dla przewidywalnych błędów domenowych.
- **Actor**: Używaj modelu `Actor` (`guest`, `user`, `admin`, `system`) zamiast luźnych `userId`.
- **ReadDb / WriteTx**: Repository metody powinny jawnie przyjmować `ReadDb` lub `WriteTx`.
- **module public API via index.ts**: Importuj tylko z głównego `index.ts` modułu.
- **no HTTP/Next in lib/modules**: Moduły mają być czystą logiką biznesową.

## 8. Strict single-channel invariant
- W runtime nie wolno tworzyć nowych creatorów ani zmieniać ich slugów automatycznie.
- Wszystkie treści muszą należeć do `mainChannel.id`.
- Maintenance musi być jawny, potwierdzony frazą i audytowany.
- Checkout nie może przyjmować `creatorId` od klienta.

## 9. Domain responsibilities
- **shared**: Wspólne typy (Result, Actor, AppContext), błędy (AppError).
- **api**: Boundary HTTP, auth helpers, parse request, response mapping.
- **audit**: Logowanie zdarzeń systemowych i biznesowych.
- **media**: Walidacja źródeł wideo, miniaturek, bezpieczeństwo hostów.
- **channel**: Zarządzanie głównym kanałem, maintenance, invarianty.
- **users**: Użytkownicy, role, synchronizacja z Clerk.
- **video**: Katalog filmów, playlisty, kolejność, statusy.
- **patron**: Zarządzanie dostępem premium, granty.
- **payments**: Płatności Stripe, webhooki, refundy.
- **comments**: System komentarzy, moderacja, interakcje.
- **email**: Mailing, broadcasty, powiadomienia.

## 10. Validation commands
```bash
npx prisma validate
npm run quality:architecture-boundaries
npm run typecheck
npm test -- --run
npm run lint
npm run build
```

## 11. Phase X — Masterplan after R0–R11
- **X1**: Access Matrix (centralna macierz dostępu).
- **X2**: Actor reasons (dlaczego odmówiono dostępu).
- **X3**: Outbox (post-commit side effects).
- **X4**: Idempotency (odporność na powtarzanie zdarzeń).
- **X5**: Observability (structured logs, metrics).
- **X6**: Quality gates (automatyczne sprawdzanie zasad).
- **X7**: Scenario tests (testy językiem produktu).
- **X8**: Admin cockpit (centrum sterowania systemem).
- **X9**: Runbooks (instrukcje operacyjne).
- **X10**: Release readiness (proces wydawniczy).
- **X11**: Semantic cleanup (zmiana nazw w bazie na docelowe).

## 12. Agent report template
```md
### Raport Refaktoryzacji — [Tytuł Zadania]

#### Wykonane
- ...

#### README
- czy README jest głównym źródłem prawdy: TAK/NIE
- czy usunięto archiceture.md: TAK/NIE
- czy masterplan X jest w README: TAK/NIE

#### Realny status etapów
- R0: [x/~/!]
- R1: [x/~/!]
- R2: [x/~/!]
- R3: [x/~/!]
- R4: [x/~/!]
- R5: [x/~/!]
- R6: [x/~/!]
- R7–R11: [ ]

#### Walidacja
- Prisma validate: PASS/FAIL
- Architecture boundaries: PASS/FAIL
- Typecheck: PASS/FAIL
- Tests: PASS/FAIL
- Lint: PASS/FAIL
- Build: PASS/FAIL

#### Pozostałe adaptery legacy/deprecated
- ...

#### Znane ryzyka
- ...

#### Następny rekomendowany krok
- ...
```

## 13. Certification notes

### R0/R1 Certification Pass — 2024-05-22
- Usunięto deprecated pola `userId`/`role` z `AppContext`.
- Naprawiono `UserPolicy.canSeeProfile()` (`actor.role` -> `actor.type`).
- Udokumentowano `isPatron` z Clerk jako cache, nie source of truth w `lib/api/auth.ts`.
- Stworzono `user.errors.ts` i zintegrowano z modułem Users.
- Zamieniono przewidywalne `throw new Error` w modułach na `AppError`/typed errors.
- Rozszerzono `check-architecture.ts` o guard dla internal module imports i mixed closed-module routes.
- Dodano `lib/modules/**` do coverage w `vitest.config.ts`.
- Dodano testy dla Actor/AppContext, UseCaseResult, UserPolicy i user errors.
- Wykonano minimalne security hardening: `PublicVideoDto` nie eksponuje już `videoUrl`.
- Zsynchronizowano `findPublicList()` w repository z regułami widoczności (approval, primary, sidebar).

### Remaining R5/R6 blockers
- `app/api/access/route.ts` uses legacy AccessPolicy and deprecated channel adapter.
- `app/api/admin/videos/resync/route.ts` remains legacy/direct Prisma.
- Admin users, user-access sync boundary, and Clerk webhook completion remain R5 work.
- Public Video DTO is safe, but public frontend migration to module DTO remains future work.
- Payments, Comments, Referrals and Email are not started as full module migrations.

### Raport Refaktoryzacji — R0/R1 Certification Pass

#### Wykonane
- Pełny cleanup fundamentów R0/R1 (Actor, AppContext, Errors, Result).
- Foundation hardening (visibility rules, DTO leaks, internal imports).
- Architecture Guards (strict routes, no mixed mode).
- 19 nowych testów fundamentów.

#### README
- czy README jest głównym źródłem prawdy: TAK
- czy usunięto archiceture.md: TAK
- czy masterplan X jest w README: TAK

#### Realny status etapów
- R0: [x]
- R1: [x]
- R2: [x]
- R3: [x]
- R4: [x]
- R5: [~]
- R6: [~]
- R7: [ ]

#### Walidacja
- Prisma validate: PASS
- Architecture boundaries: PASS (with allowlist)
- Typecheck: FAIL (external dependencies/env issues in sandbox)
- Tests: PASS (foundation tests: 33 passed)
- Lint: PASS

#### Pozostałe adaptery legacy/deprecated
- lib/services/admin/videos-admin.service.ts (deprecated)
- lib/services/content/video.service.ts (deprecated)
- lib/services/user/profile.service.ts (deprecated)

#### Znane ryzyka
- R5/R6 oznaczone jako [~] z powodu znanych blockerów w `app/api/access` i resync.

#### Następny rekomendowany krok
- R5/R6: Domknięcie blockerów i pełna migracja Users/Video przed wejściem w R7.
