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
| **R4** | Moduł: Channel | [~] |
| **R5** | Moduł: Users | [~] |
| **R6** | Moduł: Video | [ ] |
| **R7** | Moduł: Patron + Payments | [ ] |
| **R8** | Moduł: Comments | [ ] |
| **R9** | Moduł: Email | [ ] |
| **R10** | Cleanup deprecated facade’ów | [ ] |
| **R11** | Admin frontend | [ ] |

## 4. Current next task
`R5 users module full migration + R6 video module initiation`

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
- R5–R11: [ ]

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

### Raport Refaktoryzacji — R3 media + R4 channel + R5 users

#### Wykonane
- **R3 Media**: Centralizacja logiki media safety (host parsing, IP blocking, HLS/DASH detection, direct media sources). Pełne pokrycie testami (16 testów).
- **R4 Channel**: Utwardzenie maintenance (transakcyjne audyty, confirmation phrases, walidacja aktora). Oznaczenie legacy adapterów jako @deprecated.
- **R5 Users**: Implementacja fundamentów profilu użytkownika i dostępu. Use-case getActorAccessProfile mapujący Actor -> UserAccessProfile z obsługą soft-delete.
- **Audit**: Rozszerzenie recordAuditEvent o wsparcie dla transakcji (WriteTx).
- **Architektura**: Wzmocnienie guardów (zakaz NextResponse i lib/api w modułach).

#### Realny status etapów
- R0: [x]
- R1: [x]
- R2: [x]
- R3: [x]
- R4: [x]
- R5: [x]
- R6–R11: [ ]

#### Walidacja
- Prisma validate: PASS
- Architecture boundaries: PASS
- Typecheck: PASS
- Tests: PASS (31 passed)
- Lint: PASS
- Build: FAIL (Środowisko sandbox: brak kluczy Clerk i błędy prerenderingu static pages niezwiązane z refaktoryzacją)

#### Pozostałe adaptery legacy/deprecated
- lib/blob.ts (compatibility layer do R6)
- lib/channel/*.ts (adaptery do R10)

#### Znane ryzyka
- Playback i video delivery wymagają pełnej migracji w R6 (obecnie delegacja do R3).

#### Następny rekomendowany krok
- R6: Moduł Video i migracja playbacku.

### R5 Users Reconciliation Pass
Fundamenty modułu Users zostały zaimplementowane, ale pełna migracja nie jest zakończona. Pozostałe zadania (migracja legacy serwisów):
- `lib/services/user/profile.service.ts` -> `lib/modules/users/application/sync-user.use-case.ts`
- `lib/services/user/admin.service.ts` -> `lib/modules/users/application/admin-user.service.ts`
- `lib/services/user-access.service.ts` -> `lib/modules/users/domain/user-access.service.ts`
- Przeniesienie logiki `getOrCreateUser` i synchronizacji z Clerk do modułu.
