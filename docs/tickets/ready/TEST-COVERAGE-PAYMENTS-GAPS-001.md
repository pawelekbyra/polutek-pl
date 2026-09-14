# TEST-COVERAGE-PAYMENTS-GAPS-001 — Zero pokrycia na krytycznych ścieżkach płatności/admina

Status: READY_FOR_BUILDER
Priority: MEDIUM (brak testów na wysokokonsekwencyjnym kodzie, nie znany bug)

## Why

Audyt 2026-09-13 (runda 3) uruchomił realny pomiar pokrycia (`npm run
test:coverage`, wcześniej nikt tego nie zmierzył — wiadomo było tylko, że
brak wymuszonych progów, `KNOWN_LIMITATIONS.md`). Wynik ogólny: 57-63%
(statements/branches/functions/lines) w zakresie `app/api`, `lib/modules`,
`lib/services`, `lib/api`, `lib/webhooks`. Rdzeń use-case'ów płatności/
patrona jest nieźle pokryty (`fulfillPayment` 81%, `handle-stripe-webhook`
82%, `check-video-access` 84%, `revoke-patron` 88%), ale konkretne,
wysokokonsekwencyjne pliki mają **zero** testów:

- `app/api/payments/[paymentId]/route.ts` — 0% — backuje return-page fast
  path z `CLAUDE.md` §4.2 (może sam wywołać `fulfillPayment()` z pollingu
  klienta).
- `app/api/access/route.ts` — 0% — publiczny endpoint owijający
  `checkVideoAccess` (sam use-case ma 84%, ale warstwa HTTP/resolucji
  actora — nie).
- `lib/modules/payments/application/admin-refund.use-case.ts` — 3.6%.
- `lib/modules/payments/application/admin-dispute-sync.use-case.ts` — 0%.
- `app/api/admin/payments/route.ts`, `.../[id]/refund/route.ts`,
  `.../[id]/dispute-sync/route.ts` — 0% każdy — cała HTTP-warstwa
  refundów/sporów w adminie bez testów na poziomie route'a.
- `app/api/admin/payment-settings/route.ts`, `app/api/payment-settings/route.ts`
  — 0% każdy — endpointy zwracające trzy odrębne minima walutowe z
  `CLAUDE.md` §4.10 (checkout floor / patron threshold / patron-box
  minimum) bez testów na poziomie route'a.
- `lib/modules/users/application/sync-clerk-access.ts` — 0%.
- `app/api/admin/users/[userId]/patron/route.ts` — 51.6%.
- `lib/modules/playback/application/playback.service.ts` — 59.4% (główny
  plik resolvujący playable source, §4.3).
- `lib/modules/video/infrastructure/mux.client.ts`/`mux.provider.ts`/
  `cloudflare-stream.provider.ts` — 0% każdy.

Dodatkowo: `lib/api/auth.ts`/`lib/auth-utils.ts` (faktyczny gatekeeper
autoryzacji admina używany przez każdą trasę `/api/admin/*` i `/api/access`)
nie był w ogóle w zasięgu pomiaru coverage do tej pory — naprawione
osobno (patrz commit "Fix critical seed-script bug, coverage config gaps..."
z rundy 3), więc od teraz przynajmniej widać jego realną liczbę.

## Scope

1. Priorytet 1 (bezpośrednio dotyka pieniędzy/dostępu): testy dla
   `admin-refund.use-case.ts`, `admin-dispute-sync.use-case.ts`, i ich
   tras API (`app/api/admin/payments/[id]/refund`,
   `.../dispute-sync`) — mockowany Stripe, jak istniejące testy
   `handle-refund`/`handle-dispute`.
2. Priorytet 2: testy HTTP-warstwy dla `GET /api/payments/[paymentId]`
   (fast-path reconciliation) i `GET /api/access` — te use-case'y pod spodem
   są już przetestowane, brakuje tylko testu samego route handlera
   (auth resolution, response shaping, status codes).
3. Priorytet 3: `sync-clerk-access.ts`, `app/api/payment-settings/route.ts`,
   `app/api/admin/payment-settings/route.ts`.
4. Priorytet 4 (niżej, bo to zewnętrzne adaptery, mniej logiki własnej):
   `mux.client.ts`, `mux.provider.ts`, `cloudflare-stream.provider.ts`.

## Invariants that must survive

- Nowe testy nie mogą wymagać prawdziwego `DATABASE_URL`/Stripe/Clerk —
  całość musi być mockowana jak istniejący suite (`tests/unit/`), zgodnie
  z konwencją reszty testów płatności.
- Nie dodawać progów pokrycia w `vitest.config.ts` jako część tego ticketu
  — to osobna decyzja właściciela (dziś świadomie brak progów, patrz
  `KNOWN_LIMITATIONS.md`); ten ticket tylko podnosi realne pokrycie.

## Non-goals

- Testy E2E/Playwright dla tych ścieżek — poza zakresem, to unit/integration
  na poziomie use-case/route, jak reszta `tests/unit/`.
- Ustawianie wymuszonych progów CI — jeśli po zamknięciu tego ticketu
  właściciel zechce dodać progi, to osobna, świadoma decyzja/ticket.
