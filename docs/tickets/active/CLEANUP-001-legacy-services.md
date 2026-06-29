# CLEANUP-001: Migracja legacy services do lib/modules

**Status:** PARTIAL  
**Priorytet:** P2 — dług techniczny, nie blokuje działania  
**Last reconciled:** 2026-06-30 after PR #1259

## Kontekst

Po PR #1224 i PR #1259 cleanup legacy services jest zawężony. Nie należy ponownie otwierać całej starej mapy refaktoru.

Z legacy service layer pozostają do migracji tylko dwa aktywne obszary:

| Plik | Stan | Uwagi |
|------|------|-------|
| `lib/services/email.service.ts` | `TODO` | przenieść do modułu email bez zmiany zachowania |
| `lib/services/user/profile.service.ts` | `TODO` | przenieść do modułu users bez zmiany zachowania |

Pliki już usunięte albo przeniesione z legacy service scope:

- `syncClerkAccess` ✅ → `lib/modules/users/application/sync-clerk-access` by PR #1224
- `user-access.service.ts` ✅ deleted by PR #1259
- `audit.service.ts` ✅ deleted by PR #1259

## Co naprawdę zostało

1. `email.service.ts` — średni slice.
2. `lib/services/user/profile.service.ts` — większy slice.

Nie zostało już: `user-access.service.ts`, legacy `audit.service.ts` ani osobna migracja `syncClerkAccess`.

## Plan migracji

### Krok 1: `user-access.service.ts` → `lib/modules/users`

**Status:** DONE by PR #1224 + PR #1259.

### Krok 2: `email.service.ts` → `lib/modules/email`

**Status:** TODO.

Przenieść zachowanie do `lib/modules/email/application/`, zaktualizować importy i testy.

### Krok 3: `lib/services/user/profile.service.ts` → `lib/modules/users`

**Status:** TODO.

To większy slice. Zacząć od testów obecnego zachowania i nie zmieniać logiki w tym samym PR.

## Kolejność

1. ✅ DTOs przeniesione.
2. ✅ `syncClerkAccess` przeniesiony.
3. ✅ `user-access.service.ts` usunięty.
4. ✅ `audit.service.ts` usunięty.
5. ⬜ `email.service.ts`.
6. ⬜ `lib/services/user/profile.service.ts`.

## Zasady dla agentów pracujących nad tym

- Jeden serwis = jeden PR.
- Przed migracją sprawdź wszystkich callerów.
- Po migracji uruchom adekwatne testy dla dotkniętych modułów.
- Nie zmieniaj logiki — tylko przenoś i aktualizuj importy.
- Zaktualizuj ten plik i `docs/tickets/ready/README.md` po każdym kroku.
