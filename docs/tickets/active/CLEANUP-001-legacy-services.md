# CLEANUP-001: Migracja legacy services do lib/modules

**Status:** PARTIAL / NEXT_SLICE_READY  
**Priorytet:** P2 — dług techniczny, nie blokuje działania  
**Ostatnia synchronizacja:** 2026-06-28 po merge PR #1224

## Kontekst

Ten ticket jest aktualną mapą pozostałego długu w `lib/services/`. Po PR #1224 **nie migruj ponownie `syncClerkAccess`** — ta praca jest zakończona i eksportowana z `lib/modules/users`.

Pozostały dług to małe, osobne slice'y:

| Plik | Stan po PR #1224 | Co robi | Następna akcja |
|------|------------------|---------|----------------|
| `lib/services/user-access.service.ts` | legacy bridge only | `UserAccessService.recalculateUserPatronStatus` deleguje do `lib/modules/patron` | przepiąć ostatni legacy caller w `lib/services/payment.service.ts`, potem usunąć plik |
| `lib/services/user/profile.service.ts` | aktywny legacy service | tworzenie/sync użytkownika z Clerk przy auth; bridge dla `get-or-create-current-user` | osobny PR: najpierw testy obecnej logiki, potem migracja do `lib/modules/users` |
| `lib/services/email.service.ts` | aktywny legacy service | emaile transakcyjne i broadcast przez Resend | osobny PR: przenieść transactional email use-cases do `lib/modules/email` |
| `lib/services/audit.service.ts` | deletion candidate | stary helper `writeAuditLog`; obecny `syncClerkAccess` już używa modułowego audit flow | końcowy grep i usunięcie, jeśli nie ma runtime callerów |

Pliki już usunięte lub przeniesione z `lib/services/`:
- `user.service.ts` ✅
- `user/subscription.service.ts` ✅
- `admin/payments-admin.service.ts` ✅
- `admin/payments-admin.dto.ts` ✅ → `lib/modules/payments/domain/admin-payment.dto.ts`
- `admin/videos-admin.dto.ts` ✅ → `lib/modules/video/domain/admin-video-list.dto.ts`
- `comments/comment.dto.ts` ✅ → `lib/modules/comments/domain/comment-frontend.dto.ts`
- `syncClerkAccess` ✅ → `lib/modules/users/application/sync-clerk-access.ts`, exported from `lib/modules/users`

## Completed by PR #1224

### `syncClerkAccess` migration — DONE

- `syncClerkAccess` lives in `lib/modules/users/application/sync-clerk-access.ts`.
- `lib/modules/users/index.ts` exports `syncClerkAccess`.
- Payment use cases import `syncClerkAccess` from the users module barrel instead of `lib/services/user-access.service`.
- Admin patron route and `scripts/resync-clerk-access.ts` use the module path.
- CI after PR #1224 passed: tests/coverage, typecheck, lint, build, integration-postgres, Prisma, security and quality jobs.

Do **not** create another broad `syncClerkAccess` migration PR. The next PR should only remove the remaining bridge or migrate another service.

## Plan migracji

### Krok 1A: `syncClerkAccess` → `lib/modules/users` — DONE

**Status:** DONE by PR #1224.

**Evidence:**
- `lib/modules/users/application/sync-clerk-access.ts`
- `lib/modules/users/index.ts`
- callers in payment modules, admin patron route and resync script updated

### Krok 1B: remove `user-access.service.ts` bridge — TODO / NEXT

**Current remaining bridge:**
- `UserAccessService.recalculateUserPatronStatus(userId, tx?)`

**Known runtime caller:**
- `lib/services/payment.service.ts` legacy webhook refund/dispute paths

**Target:**
- Replace `UserAccessService.recalculateUserPatronStatus(...)` with direct `recalculatePatronStatus(...)` from `lib/modules/patron` using `createAppContext({ type: 'system', reason: 'legacy_bridge_recalculation' })`.
- Remove `lib/services/user-access.service.ts` once no runtime callers remain.
- Run tests touching legacy `PaymentService` refund/dispute and patron recalculation.

### Krok 1C: delete `audit.service.ts` if unused — TODO

`syncClerkAccess` no longer needs legacy `writeAuditLog`. Before deletion, run a final code search for:

```bash
grep -R "writeAuditLog\|audit.service" --include="*.ts" --include="*.tsx" .
```

If only historical docs/tests remain, delete `lib/services/audit.service.ts` and update historical inventories if needed.

### Krok 2: `email.service.ts` → `lib/modules/email` — TODO

**Sytuacja:**
- `LegacyEmailServiceProvider` already wraps `EmailService` for broadcast paths.
- Modules still import `EmailService` directly for transactional emails.

**Co przenieść:**
- `sendWelcomeEmail`
- `sendPasswordChangedEmail`
- `sendAccountDeletedEmail`
- `sendBecomePatronEmail`
- `sendDonationThankYouEmail`

**Docelowo:**
- `lib/modules/email/application/send-transactional-email.use-case.ts` or one small use case per transactional email.
- Keep Resend/template behavior unchanged; this is a move/refactor, not a behavior rewrite.

**Known module callers:**
- `lib/modules/users/application/sync-user-from-webhook.use-case.ts`
- `lib/modules/users/application/account-deletion-cleanup.use-case.ts`
- `lib/modules/payments/application/fulfill-payment.use-case.ts`

### Krok 3: `user/profile.service.ts` → `lib/modules/users` — TODO

**Sytuacja:**
- `get-or-create-current-user.use-case.ts` is already in modules but still delegates to `UserProfileService`.
- This is the riskiest remaining service because it handles Clerk session/user claim parsing and profile synchronization.

**Co przenieść:**
- `getOrCreateUser`
- `getOrCreateUserFromAuth`
- Clerk claims parsing helpers → `lib/modules/users/domain/`

**Rule:** add/keep regression tests before moving behavior.

## Kolejność

1. ✅ DTOs moved.
2. ✅ `syncClerkAccess` moved to `lib/modules/users` by PR #1224.
3. 🔄 **NEXT:** remove `user-access.service.ts` bridge and stale `audit.service.ts` if unused.
4. ⬜ `email.service.ts` transactional email migration.
5. ⬜ `user/profile.service.ts` migration after regression coverage.

## Zasady dla agentów pracujących nad tym

- Jeden serwis albo jeden bridge = jeden PR.
- Przed migracją sprawdź wszystkich callerów: `grep -R "NazwaService" --include="*.ts" --include="*.tsx" .`.
- Po migracji uruchom przynajmniej targeted tests plus `npm run typecheck`; jeśli dotykasz płatności/emaili, uruchom odpowiedni subset Vitest.
- Nie zmieniaj logiki biznesowej — przenoś i aktualizuj importy.
- Zaktualizuj ten plik oraz `docs/tickets/ready/README.md` po każdym kroku.
