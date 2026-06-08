# Polutek.pl

## 1. Product mode
- strict single-channel creator hub
- Creator = legacy MainChannel
- Subscription != Patron (Subscription is for email follow only)
- no multi-creator marketplace

## 2. Current active refactor
- Modular Monolith transition
- Pattern: route -> use-case -> policy/service/repository -> Prisma
- README is the sole source of truth for the process

## 3. Current status
| Etap | Opis | Status |
| :--- | :--- | :--- |
| **R0** | Zasady i infrastruktura | [x] |
| **R1** | Shared, API boundary, errors, ctx | [x] |
| **R2** | Moduł: Audit | [x] |
| **R3** | Moduł: Media | [x] |
| **R4** | Moduł: Channel | [~] |
| **R5** | Moduł: Users | [ ] |
| **R6** | Moduł: Video | [ ] |
| **R7** | Moduł: Patron + Payments | [ ] |
| **R8** | Moduł: Comments | [ ] |
| **R9** | Moduł: Email | [ ] |
| **R10** | Cleanup deprecated facade’ów | [ ] |
| **R11** | Admin frontend | [ ] |

## 4. Current next task
- R1/R2/R4 hardening and R3 Media complete.

## 5. Mandatory agent rules
- Do not just move files; ensure complete logic, tests, and types.
- Update README status after every major task.
- No `[x]` without passing tests and full validation.
- Do not start Phase X before R0–R11 is complete.
- Logic inside `lib/modules/**` must be HTTP/Next.js agnostic.

## 6. R0–R11 roadmap
- **R0** — zasady i infrastruktura
- **R1** — shared, api boundary, errors, ctx
- **R2** — audit
- **R3** — media
- **R4** — channel
- **R5** — users
- **R6** — video
- **R7** — patron + payments
- **R8** — comments
- **R9** — email
- **R10** — cleanup deprecated facade’ów
- **R11** — admin frontend

## 7. Architecture rules
- **Thin Routes**: Entry points only extract data and delegate to use-cases.
- **Use Cases**: Accept typed input and `AppContext`.
- **Result Pattern**: Use `UseCaseResult<T, E>` for returning data or errors.
- **Actor**: Use `Actor` type to identify the caller (guest, user, admin, system).
- **ReadDb / WriteTx**: Differentiate between read-only and transactional database access.
- **Public API**: Modules expose functionality only through `index.ts`.
- **No HTTP/Next in Modules**: `lib/modules/**` must not import from `next/*` or `@clerk/nextjs`.

## 8. Strict single-channel invariant
- Polutek.pl is a strict single-channel VOD app.
- Legacy `Creator` model represents the single `MainChannel`.
- All public content must be scoped to the main channel ID.
- No auto-repair of channel state during normal runtime.
- Maintenance (setup/repair) is explicit, confirmed, and auditable.

## 9. Domain responsibilities
- **shared**: Common types (Actor, Result, Context), base errors.
- **api**: HTTP helpers, auth session extraction, Result-to-HTTP mapping.
- **audit**: Business event logging.
- **media**: Media host validation, URL parsing, detection (HLS/DASH/YT).
- **channel**: Main channel lifecycle and access rules.
- **users**: User profile, sync, and language management.
- **video**: Video metadata, visibility, and listing.
- **patron**: Patron status and eligibility logic.
- **payments**: Checkout, Stripe integration, and payment history.
- **comments**: Commenting system, reactions, and moderation.
- **email**: Email templates and broadcasting.

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
Strategic goals for Architecture Excellence:
- **X1**: Access Matrix (fine-grained permissions).
- **X2**: Actor reasons (auditing system actions).
- **X3**: Transactional Outbox (reliable side effects).
- **X4**: Idempotency layer (for critical operations).
- **X5**: Full Observability (metrics and tracing).
- **X6**: Quality gates (strict CI/CD checks).
- **X7**: Scenario tests (complex business flows).
- **X8**: Admin cockpit (unified management UI).
- **X9**: Production Runbooks.
- **X10**: Release readiness audit.
- **X11**: Semantic schema cleanup.

## 12. Agent report template
```md
### Raport Refaktoryzacji — [Tytuł Tury]

#### Wykonane
- ...

#### README
- czy README jest głównym źródłem prawdy: [TAK/NIE]
- czy usunięto archi* documents: [TAK/NIE]
- czy masterplan X jest w README: [TAK/NIE]

#### Realny status etapów
- R0: [x/~/!]
- ...

#### Walidacja
- Prisma validate: [PASS/FAIL]
- Architecture boundaries: [PASS/FAIL]
- Typecheck: [PASS/FAIL]
- Tests: [PASS/FAIL]
- Lint: [PASS/FAIL]
- Build: [PASS/FAIL]

#### Pozostałe adaptery legacy/deprecated
- ...

#### Znane ryzyka
- ...

#### Następny rekomendowany krok
- ...
```
