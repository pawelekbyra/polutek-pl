# CLEANUP-001: Migracja legacy services do lib/modules

**Status:** IN_PROGRESS  
**Priorytet:** P2 — dług techniczny, nie blokuje działania

## Kontekst

W `lib/services/` zostały 3 pliki aktywnie używane, które wymagają refaktoru (nie prostego przeniesienia):

| Plik | Linie | Callerzy | Co robi |
|------|-------|----------|---------|
| `user-access.service.ts` | 101 | ~15 plików (3 payment modules, API route, skrypt) | `syncClerkAccess` — sync metadanych patrona do Clerk; `recalculateUserPatronStatus` — legacy bridge do modules/patron |
| `profile.service.ts` | 393 | ~10 plików (głównie testy, 1 module) | tworzenie/sync użytkownika z Clerk przy auth; bridge dla `get-or-create-current-user` |
| `email.service.ts` | 361 | ~16 plików (3 modules, testy) | emaile transakcyjne (welcome, patron, deletion, donation); broadcast przez Resend |

Pliki już usunięte z `lib/services/`:
- `user.service.ts` ✅
- `user/subscription.service.ts` ✅
- `admin/payments-admin.service.ts` ✅
- `admin/payments-admin.dto.ts` ✅ → `lib/modules/payments/domain/admin-payment.dto.ts`
- `admin/videos-admin.dto.ts` ✅ → `lib/modules/video/domain/admin-video-list.dto.ts`
- `comments/comment.dto.ts` ✅ → `lib/modules/comments/domain/comment-frontend.dto.ts`
- `audit.service.ts` — zostaje (używany przez `user-access.service.ts`)

## Plan migracji

### Krok 1: `user-access.service.ts` → `lib/modules/users`

**Co przenieść:**
- `syncClerkAccess` → `lib/modules/users/application/sync-clerk-access.ts` jako standalone function
- `recalculateUserPatronStatus` — już deleguje do modules/patron; po migracji callerów można usunąć
- `normalizePaymentTotals` — już istnieje w `lib/modules/users/domain/payment-totals.ts`; usunąć duplikat

**Callerzy `syncClerkAccess`:**
- `lib/modules/payments/application/fulfill-payment.use-case.ts`
- `lib/modules/payments/application/handle-refund.use-case.ts`
- `lib/modules/payments/application/handle-dispute.use-case.ts`
- `app/api/admin/users/[userId]/patron/route.ts`
- `scripts/resync-clerk-access.ts`

**Callerzy `recalculateUserPatronStatus`:**
- `lib/services/payment.service.ts` (legacy webhook handler)

**Uwagi implementacyjne:**
- `syncClerkAccess` używa `writeAuditLog` bez ctx → zamienić na `createAppContext({ type: 'system', reason: 'clerk_sync' })` + `recordAuditEvent`
- Po migracji: usunąć `user-access.service.ts`, usunąć `audit.service.ts` (ostatni caller)
- Testy mockujące `@/lib/services/user-access.service` → zaktualizować na nowy path

### Krok 2: `email.service.ts` → `lib/modules/email`

**Sytuacja:**
- `LegacyEmailServiceProvider` już opakowuje `EmailService` dla broadcastów
- Moduły bezpośrednio importują `EmailService` dla emaili transakcyjnych (welcome, patron, deletion, donation)

**Co przenieść:**
- Metody transakcyjne: `sendWelcomeEmail`, `sendPasswordChangedEmail`, `sendAccountDeletedEmail`, `sendBecomePatronEmail`, `sendDonationThankYouEmail`
- Docelowo: `lib/modules/email/application/send-transactional-email.use-case.ts` lub osobne use-casy
- `sendBroadcast` — już w email module przez `LegacyEmailServiceProvider`

**Callerzy w modules:**
- `lib/modules/users/application/sync-user-from-webhook.use-case.ts` — welcome, password-changed
- `lib/modules/users/application/account-deletion-cleanup.use-case.ts` — account-deleted
- `lib/modules/payments/application/fulfill-payment.use-case.ts` — become-patron, donation-thank-you

**Uwagi:**
- `EmailService` używa `prisma` bezpośrednio i Resend — przy migracji zachować tę logikę, tylko przenieść
- Testy mockujące `@/lib/services/email.service` → zaktualizować

### Krok 3: `profile.service.ts` → `lib/modules/users`

**Sytuacja:**
- `get-or-create-current-user.use-case.ts` jest już w modules ale deleguje do `UserProfileService`
- `profile.service.ts` to 393 linii obsługujące tworzenie/sync użytkownika z Clerk claims

**Co przenieść:**
- `getOrCreateUser` + `getOrCreateUserFromAuth` → rozbudować `GetOrCreateUserUseCase` / `SyncCurrentUserUseCase`
- Logika parsowania Clerk claims → helper w `lib/modules/users/domain/`

**Uwagi:**
- Najtrudniejszy krok — wiele logiki związanej z Clerk session claims
- Wymaga dokładnego pokrycia testami przed migracją
- Zacząć od dodania testów do obecnej logiki, potem przenosić

## Kolejność

1. ✅ DTOs przeniesione
2. ✅ **user-access.service.ts** — usunięty; `recalculateUserPatronStatus` wyinlinowany do `payment.service.ts` jako bezpośrednie wywołanie `recalculatePatronStatus`; `audit.service.ts` usunięty (brak callerów); testy zaktualizowane
3. ✅ email.service.ts — usunięty; `sendBroadcast` przeniesiony do `LegacyEmailServiceProvider`; testy zaktualizowane
4. ⬜ profile.service.ts — największy, Clerk claims, zacząć od testów

## Zasady dla agentów pracujących nad tym

- Jeden serwis = jeden PR
- Przed migracją sprawdź wszystkich callerów: `grep -r "NazwaService" --include="*.ts" -l`
- Po migracji uruchom testy: `pnpm vitest run`
- Nie zmieniaj logiki — tylko przenoś i aktualizuj importy
- Zaktualizuj ten plik po każdym kroku
