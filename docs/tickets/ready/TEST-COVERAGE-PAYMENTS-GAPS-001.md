# TEST-COVERAGE-PAYMENTS-GAPS-001 — Zero pokrycia na krytycznych ścieżkach płatności/admina

Status: READY_FOR_BUILDER (Priorytety 1-3 zamknięte 2026-09-20; zostaje tylko Priorytet 4)
Priority: LOW (pozostały zakres to zewnętrzne adaptery providerów, mniej własnej logiki)

## Why

Audyt 2026-09-13 (runda 3) uruchomił realny pomiar pokrycia (`npm run
test:coverage`, wcześniej nikt tego nie zmierzył — wiadomo było tylko, że
brak wymuszonych progów, `KNOWN_LIMITATIONS.md`). Wynik ogólny: 57-63%
(statements/branches/functions/lines) w zakresie `app/api`, `lib/modules`,
`lib/services`, `lib/api`, `lib/webhooks`. Rdzeń use-case'ów płatności/
patrona jest nieźle pokryty, ale kilka konkretnych, wysokokonsekwencyjnych
plików miało **zero** testów.

**Zrobione 2026-09-20 (Priorytety 1-3, 59 nowych testów):**

- `admin-refund.use-case.ts` — z 3.6% do ~91% (`tests/unit/modules/payments/admin-refund.use-case.test.ts`).
- `admin-dispute-sync.use-case.ts` — z 0% do 100% (`tests/unit/modules/payments/admin-dispute-sync.use-case.test.ts`).
- `app/api/admin/payments/[id]/refund/route.ts` — z 0% do ~88% (`tests/unit/api/admin/payments-refund-route.test.ts`).
- `app/api/admin/payments/[id]/dispute-sync/route.ts` — z 0% do ~87% (`tests/unit/api/admin/payments-dispute-sync-route.test.ts`).
- `app/api/payments/[paymentId]/route.ts` (return-page fast path, CLAUDE.md §4.2) — testy warstwy HTTP (`tests/unit/api/payments/payment-status-route.test.ts`).
- `app/api/access/route.ts` — z 0% do ~95% (`tests/unit/api/access-route.test.ts`).
- `lib/modules/users/application/sync-clerk-access.ts` — z 0% (`tests/unit/modules/users/sync-clerk-access.test.ts`, w tym retry/backoff i ścieżkę `CLERK_SYNC_FAILED`).
- `app/api/payment-settings/route.ts` — z 0% (`tests/unit/api/payment-settings-route.test.ts`).
- `app/api/admin/payment-settings/route.ts` — z 0% (`tests/unit/api/admin/payment-settings-route.test.ts`, GET+PATCH, walidacja zod).

## Scope (pozostałe — Priorytet 4)

Zewnętrzne adaptery providerów, niżej priorytetowe bo to głównie cienkie
wrappery nad SDK, mniej własnej logiki biznesowej:

- `lib/modules/video/infrastructure/mux.client.ts` (161 linii) — 0%.
- `lib/modules/video/infrastructure/mux.provider.ts` (62 linie) — 0%.
- `lib/modules/video/infrastructure/cloudflare-stream.provider.ts` (46 linii) — 0%.

## Invariants that must survive

- Nowe testy nie mogą wymagać prawdziwego `DATABASE_URL`/Stripe/Clerk/Mux/
  Cloudflare — całość musi być mockowana jak istniejący suite (`tests/unit/`),
  zgodnie z konwencją reszty testów płatności (patrz przykłady z Priorytetów
  1-3: mock `PaymentRepository`/`getStripeClient`/`getClerkClient` przez
  `vi.mock` na poziomie modułu infrastruktury).
- Nie dodawać progów pokrycia w `vitest.config.ts` jako część tego ticketu
  — to osobna decyzja właściciela (dziś świadomie brak progów, patrz
  `KNOWN_LIMITATIONS.md`); ten ticket tylko podnosi realne pokrycie.

## Non-goals

- Testy E2E/Playwright dla tych ścieżek — poza zakresem, to unit/integration
  na poziomie use-case/route, jak reszta `tests/unit/`.
- Ustawianie wymuszonych progów CI — jeśli po zamknięciu tego ticketu
  właściciel zechce dodać progi, to osobna, świadoma decyzja/ticket.
