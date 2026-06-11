# X1-READY-001 — Payment / Patron current-state inventory

## Status

GO

## Executive summary dla właściciela

Można przejść do planowania i pierwszych małych runtime fixów X1, ale nie do certyfikacji domeny payments/patron bez napraw launch-critical. Obecny runtime ma sensowny szkielet: jednorazowy Stripe PaymentIntent, raw-body signature verification, `StripeEvent` ledger/idempotency, lokalny `Payment`, `PatronGrant`, osobne `UserPaymentTotal`, admin-konfigurowalne minimalne kwoty per waluta oraz ścieżki refund/dispute. Największe ryzyka to: fulfillment nadal nadaje patronat dla każdej skutecznej płatności przy założeniu, że checkout wcześniej odciął kwoty poniżej minimum; target mówi, że grant ma powstawać przez explicit eligibility policy; access nadal czyta `User.isPatron`, nie aktywny `PatronGrant`; dispute opened tylko ustawia `Payment.DISPUTED`, ale nie zawiesza/revokes grant; dispute won nie odtwarza wcześniej cofniętego grantu; manual grant nie ma audytu pozytywnej akcji; brak kompletnej testowej osłony dispute i forbidden shortcuts.

## Źródła

Przeczytane pliki / obszary:

- `AGENTS.md`
- `README.md`
- `docs/tickets/ready/X1-READY-001-payment-patron-current-state-inventory.md`
- `docs/strategy/OWNER-DECISIONS.md`
- `docs/strategy/PRODUCT-STANDARD.md`
- `docs/strategy/MVP-TO-LAUNCH-SCOPE.md`
- `docs/strategy/DO-NOT-BUILD.md`
- `docs/strategy/DR-01-DR-10-RESEARCH-SYNTHESIS.md`
- `docs/specs/PAYMENTS-PATRON-SAFETY-SPEC.md`
- `docs/specs/ACCESS-PATRON-SPEC.md`
- `docs/reports/reconciliation/X0-READY-001-R-PHASE-HANDOFF-INVENTORY.md`
- `prisma/schema.prisma`
- `app/api/checkout/create-intent/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/webhooks/clerk/route.ts`
- `app/api/admin/payment-settings/route.ts`
- `app/api/payment-settings/route.ts`
- `app/api/admin/payments/route.ts`
- `app/api/admin/users/[userId]/patron/route.ts`
- `app/api/subscriptions/route.ts`
- `app/admin/payments/page.tsx`
- `app/admin/payments/PaymentSettingsForm.tsx`
- `app/admin/users/UserPatronActions.tsx`
- `app/admin/users/[userId]/page.tsx`
- `app/components/CheckoutForm.tsx`
- `app/components/playlist/CheckoutModal.tsx`
- `app/components/playlist/SupportBox.tsx`
- `app/components/Navbar.tsx`
- `app/page.tsx`
- `app/channel/[slug]/page.tsx`
- `lib/constants.ts`
- `lib/payments/checkout.schema.ts`
- `lib/payments/currency-settings.ts`
- `lib/modules/payments/**`
- `lib/modules/patron/**`
- `lib/modules/access/application/check-video-access.use-case.ts`
- `lib/access/access-policy.ts`
- `lib/access/comment-access.ts`
- `lib/services/payment.service.ts`
- `lib/services/payments/checkout.service.ts`
- `lib/services/payments/fulfillment.service.ts`
- `lib/services/payments/refund.service.ts`
- `lib/services/patron.service.ts`
- `lib/services/user-access.service.ts`
- `lib/modules/users/**`
- `lib/modules/subscriptions/**`
- `lib/modules/audit/**`
- `tests/unit/modules/payments/**`
- `tests/unit/modules/patron/**`
- `tests/unit/payments.test.ts`
- `tests/unit/refunds.test.ts`
- `tests/unit/stripe-webhook.test.ts`
- `tests/unit/subscription-patron-guard.test.ts`
- `tests/unit/user-access.service.test.ts`
- `tests/e2e/beta-smoke.spec.ts`

Repo search / walidacja inventory:

```bash
rg -n "Stripe|stripe|checkout|webhook|Payment|PatronGrant|isPatron|grantPatron|refund|dispute|minimum|threshold|currency|Clerk|metadata" app lib prisma tests docs
rg -l "Stripe|stripe|checkout|webhook|Payment|PatronGrant|isPatron|grantPatron|refund|dispute|Clerk|metadata" app lib prisma tests
rg -n "handleDispute|dispute|CHARGEBACK|DISPUTED|charge.dispute" tests app lib docs/specs docs/strategy
rg -n "isPatron|publicMetadata|privateMetadata|unsafeMetadata|role.*PATRON|PATRON" app lib
```

## Target lifecycle

Docelowy lifecycle wg aktywnych decyzji właściciela i specyfikacji:

1. User wybiera jednorazowe wsparcie/donację; patronat nie jest subskrypcją cykliczną.
2. Server tworzy payment/checkout po server-side walidacji kwoty, waluty i limitów.
3. Stripe webhook jest weryfikowany przez raw body signature.
4. Stripe event jest idempotentnie zapisany/przetworzony w ledgerze `StripeEvent`.
5. `Payment` jest faktem finansowym: amount/currency/status/refunded amount/provider identifiers.
6. `PatronGrant` powstaje tylko przez policy/use-case po spełnieniu progu kwalifikującego wsparcia per waluta.
7. Refund/dispute/manual action ma audyt i jasny skutek:
   - full refund cofa powiązany grant,
   - dispute opened zawiesza linked grant,
   - dispute won reactivates,
   - dispute lost/chargeback revokes,
   - manual grant/suspend/reactivate/revoke wymaga reason + audit + confirmation dla działań ryzykownych.
8. Access nie wynika z `Payment` alone, `User.isPatron`, Clerk metadata, `Subscription` ani frontend state. Docelowe backendowe źródło prawdy: istnieje aktywny `PatronGrant`.

## Current implementation map

| Obszar | Aktualne pliki / funkcje | Co robią | Ryzyko | Zgodność z targetem |
| --- | --- | --- | --- | --- |
| Checkout / support payment creation | `app/api/checkout/create-intent/route.ts`, `lib/modules/payments/application/create-checkout-intent.use-case.ts`, `lib/payments/checkout.schema.ts`, `lib/payments/currency-settings.ts` | Wymaga Clerk auth, rate limituje, tworzy/lazy-syncuje usera, waliduje `amountMinor` i walutę, sprawdza min/max z `PaymentCurrencySetting` albo defaultów, tworzy lokalny `Payment(PENDING)`, Stripe customer, Stripe PaymentIntent z metadata `userId/paymentId/creatorId/requestId`; requestId deduplikuje pending payment. | To PaymentIntent, nie Stripe Checkout Session; nazwa endpointu jest `checkout/create-intent`. Payment powstaje przed potwierdzonym Stripe sukcesem. Przy braku `STRIPE_SECRET_KEY` flow failuje. | Częściowo zgodne: jednorazowe wsparcie, server validation, local Payment fact. Do doprecyzowania nazewnictwo Checkout vs Intent. |
| Webhook raw body/signature | `app/api/webhooks/stripe/route.ts`, `lib/modules/payments/application/handle-stripe-webhook.use-case.ts` | Route czyta `req.text()`, wymaga `stripe-signature`, use case używa `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`. | Brak `STRIPE_WEBHOOK_SECRET` daje fail; route zwraca `handleApiError`, więc Stripe może retry. | Zgodne z targetem raw body signature. |
| StripeEvent / idempotency | `StripeEvent` model, `StripeEventLockService.acquireLock/releaseWithSuccess/releaseWithFailure`, `handleStripeWebhook` | Tworzy ledger eventu jako `PROCESSING`; duplicate `PROCESSED` short-circuit; `PROCESSING` conflict ack; `FAILED` lub stale `PROCESSING` może być ponownie przejęty; sukces ustawia `PROCESSED`. | Payload ledger jest minimalny, nie pełny event. Conflict jest ackowany bez przetwarzania; to redukuje retry, ale wymaga health/diagnostics dla stuck processing. | Częściowo zgodne: idempotency istnieje, ale diagnostics/stuck event handling są future X1/X5. |
| Payment model usage | `Payment` model, `PaymentRepository`, `createCheckoutIntent`, `fulfillPayment`, `handleRefund`, `handleDispute`, admin payments list | `Payment` ma statusy `PENDING/SUCCEEDED/FAILED/CANCELED/REFUNDED/PARTIALLY_REFUNDED/DISPUTED/CHARGEBACK_LOST`, amount/currency/refundedAmount, Stripe IDs, metadata; totals są w `UserPaymentTotal`. | `stripeSessionId` istnieje, ale current flow używa `stripeIntentId`. `Payment` nadal jest bezpośrednio sklejony z grantowaniem w fulfillment. | Częściowo zgodne: dobry financial fact, ale trzeba wydzielić eligibility policy i lifecycle side effects. |
| Successful payment fulfillment | `handleStripeWebhook` -> `fulfillPayment` | `payment_intent.succeeded` wywołuje `fulfillPayment`; CAS `PENDING -> SUCCEEDED`; weryfikuje amount/currency; inkrementuje `UserPaymentTotal`; wywołuje `grantPatron({ source: 'stripe_tip', paymentId })`; syncuje Clerk metadata; wysyła email patron/donation. | Komentarz i kod mówią „any successful one-time tip grants Patron status”. Zakłada, że min threshold został wymuszony tylko przy create intent. Nie ma osobnej eligibility policy przy webhooku i nie obsługuje scenariuszy paymentów utworzonych poza tą ścieżką albo zmienionych thresholdów. | Niezgodne z targetem w ważnym punkcie: grant powinien powstać tylko przez explicit policy check amount/currency/status. |
| PatronGrant model usage | `PatronGrant` model, `grantPatron`, `revokePatron`, `recalculatePatronStatus`, `PatronRepository` | Grant ma `source`, opcjonalny `paymentId/referralId`, `grantedById`, `reason`, `revokedAt`. `paymentId` i `referralId` są unikalne; aktywny grant to `revokedAt = null`. | Model nie ma statusu `SUSPENDED`, `REACTIVATED`, dedicated revoked reason/audit metadata ani linku do dispute/refund eventu. | Częściowo zgodne: aktywny grant istnieje, ale lifecycle refund/dispute/manual nie jest pełny. |
| grantPatron | `lib/modules/patron/application/grant-patron.use-case.ts` | Tylko admin/system może grantować; admin grant idempotentny per aktywny ADMIN grant; payment/referral grant idempotentny po `paymentId/referralId`; ustawia `User.isPatron=true`, `patronSince`, `patronSource`, tworzy `PatronGrant`. | Brak audytu dla udanego grantowania, zwłaszcza manual admin grant. Direct write do `User.isPatron` utrwala legacy truth. Brak eligibility threshold w tym use-case. | Częściowo zgodne jako use-case, niezgodne w audycie/manual i target access truth. |
| revokePatron | `lib/modules/patron/application/revoke-patron.use-case.ts` | Tylko admin/system; `revokeActiveGrants` ustawia `revokedAt` i reason dla wszystkich aktywnych grantów usera; ustawia `User.isPatron=false`; zapisuje audit `PATRON_REVOKED`. | Revoke jest globalny dla wszystkich grantów usera, nie tylko linked payment grant. Full refund jednego paymentu może odebrać także niezależny admin/referral grant, jeśli `handleRefund` używa `revokePatron`. | Częściowo zgodne: jest reason+audit dla revoke, ale granularity jest ryzykowne. |
| Recalculate / bridge | `recalculatePatronStatus`, `UserAccessService.recalculateUserPatronStatus` | Recalculate ustawia `User.isPatron` na podstawie pierwszego aktywnego `PatronGrant`; legacy bridge przekierowuje do use-case. | Recalculate robi z `User.isPatron` read-model/cache, ale access nadal go czyta jako truth. | Częściowo zgodne jako bridge, docelowo wymaga X2/X1 cleanup. |
| Refund handling | `handleRefund`, legacy `PaymentRefundService`, legacy `PaymentService.handleRefund` | `charge.refunded` znajduje payment po `paymentId` albo `stripeIntentId`; oblicza capped `refundedAmountMinor`, delta i status; CAS po `refundedAmountMinor`; decrementuje `UserPaymentTotal`; full refund w nowym use-case wywołuje `revokePatron`; partial refund recalculate; sync Clerk. | Full refund przez `revokePatron` odwołuje wszystkie aktywne granty usera, nie tylko linked grant. Partial refund policy jest zaimplementowana jako automatic recalculate, ale owner question jest nadal OPEN. Brak audytu refund correction poza ewentualnym `PATRON_REVOKED`; partial refund bez audytu. | Częściowo zgodne dla full refund intent, niezgodne/niepewne dla partial policy i linked-grant granularity. |
| Dispute handling | `handleDispute`, legacy `PaymentService.handleDispute`, legacy `PaymentRefundService.applyLostChargeback` | `charge.dispute.created/closed`: `lost` ustawia `CHARGEBACK_LOST`, decrementuje totals, revokes linked grant przez `updateMany({ paymentId, revokedAt: null })`, recalculate i sync Clerk. `won` ustawia payment `SUCCEEDED`, recalculate. Inne statusy ustawiają `Payment.DISPUTED` i alert. | Dispute opened nie zawiesza aktywnego linked grant, więc może zostawić access podczas sporu. Dispute won nie re-aktywuje grantu cofniętego na etapie sporu, bo nie ma suspend state. Brak dedicated audit dla dispute side effects. Brak testów `handleDispute`. | Niezgodne z targetem dla opened/won; częściowo zgodne dla lost/chargeback revoke. |
| Minimum threshold / currencies | `lib/constants.ts`, `PaymentCurrencySetting`, `getPaymentCurrencyLimits`, `validatePaymentAmountMinorAsync`, admin settings route/UI | Supported currencies: PLN/EUR/USD/CHF/GBP. Defaults current runtime: PLN 20, EUR 5, USD 5, CHF 5, GBP 5. DB override per currency przez `PaymentCurrencySetting`; admin PATCH audytuje `PAYMENT_SETTINGS_UPDATED`. | Target launch defaults: 10 PLN, 10 USD, 10 EUR, 10 CHF. Runtime ma inne defaulty i dodatkowy GBP. Grant eligibility nie jest ponownie sprawdzana w fulfillment, tylko checkout min. | Niezgodne z owner launch defaults; mechanizm admin config istnieje. |
| User.isPatron writes | `grantPatron`, `revokePatron`, `recalculatePatronStatus`, `SyncUserFromWebhookUseCase.softDelete`, legacy bridges | Grant/revoke/recalculate aktualizują `User.isPatron/patronSince/patronSource`; Clerk delete soft-delete revokes grants and sets `isPatron=false`; Clerk create/update zachowuje DB status. | `User.isPatron` to legacy cache/read model, ale runtime traktuje je jako access truth. | Niezgodne z target access truth; akceptowalne tylko jako tymczasowy bridge. |
| User.isPatron reads | `check-video-access.use-case.ts`, `lib/access/access-policy.ts`, comments access, admin users/details/export, pages/components | Backend access for PATRON video reads DB user and allows if `user.isPatron`; UI reads DB or Clerk metadata for badges/locked states; admin views display `isPatron`. | Sensitive access uses `User.isPatron`, not active `PatronGrant`. This is explicitly forbidden target state. | Niezgodne z targetem; likely X2 hard reset, but X1 must avoid strengthening this shortcut. |
| Clerk metadata patron cache | `UserAccessService.syncClerkAccess`, `Navbar`, `lib/api/auth`, `profile.service`, `language.service` | Sync writes Clerk public metadata `{ role: PATRON/USER, isPatron, totalPaid }`; auth actor can include metadata cache; frontend navbar uses metadata for patron badge; comments note it should not enforce paywall. | Cache drift risk; metadata can look like source of truth in UI. Existing comments say DB is source; target says active PatronGrant. | Częściowo acceptable as UI cache only; must not be backend access truth. |
| Manual grant/revoke admin | `app/api/admin/users/[userId]/patron/route.ts`, `UserPatronActions.tsx`, `grantPatron`, `revokePatron` | Admin PATCH requires reason; action grant/revoke; sync Clerk; UI uses prompt. | Only grant/revoke exist; no suspend/reactivate. Revoke has audit; grant has no audit. No strong confirmation UX beyond browser prompt/reason. | Częściowo zgodne; missing audit for grant and suspend/reactivate lifecycle. |
| Admin payments/actions/diagnostics | `app/api/admin/payments/route.ts`, `listAdminPayments`, `getAdminUserDetails`, admin user page | Admin can list/filter payments and per-user details include payment totals, payments, patron grants, subscriptions, audit logs. | Not full Access Diagnostics; payment/patron mismatch, StripeEvent failures, Clerk mismatch and final access decision not clearly unified. | Częściowo zgodne; fuller X5 diagnostics needed. |
| Audit trail | `recordAuditEvent`, `writeAuditLog`, `updatePaymentSettings`, `revokePatron`, email send failed, user soft delete | Payment settings update, revoke, user soft delete and some failures have audit. | Successful payment grant, successful manual grant, refund updates, dispute opened/lost/won, Clerk sync success/failure are inconsistent; `writeAuditLog` and `recordAuditEvent` both exist. | Częściowo zgodne; launch-critical manual/financial access actions need consistent audit. |
| Email unsubscribe | `app/api/subscriptions/route.ts`, `SubscribeUseCase`, `UnsubscribeUseCase`, `SubscriptionRepository` | Subscribe/unsubscribe only create/delete `Subscription` and adjust channel subscriber count; purpose returned as `EMAIL_NOTIFICATIONS`. | No PatronGrant mutation found in unsubscribe. | Zgodne with `Subscription/email != Patron` for this route. |
| Tests | `tests/unit/modules/payments/**`, `tests/unit/modules/patron/**`, `tests/unit/payments.test.ts`, `tests/unit/refunds.test.ts`, `tests/unit/stripe-webhook.test.ts`, `tests/unit/subscription-patron-guard.test.ts`, `tests/unit/user-access.service.test.ts`, e2e smoke | Covers checkout creation, webhook lock/duplicate, refund full/partial/idempotency/CAS, payment settings, grant/revoke auth, refund helper, legacy Stripe webhook, subscription-to-patron guard. | Brak direct `handleDispute` tests; brak negative test „successful payment below threshold does not grant” at fulfillment/policy level; brak tests for manual grant audit; target forbidden shortcut `User.isPatron` is still expected by current tests/access. | Częściowo zgodne; needs X1 test tickets. |

## Side-effect map

| Event / akcja | Tworzy Payment? | Tworzy/zmienia PatronGrant? | Zmienia User.isPatron? | Zmienia Clerk metadata? | Audit? | Uwagi |
| --- | --- | --- | --- | --- | --- | --- |
| User creates checkout intent | Tak: `Payment(PENDING)` przed Stripe success | Nie | Nie | Nie | Nie | Server waliduje amount/currency; Stripe PaymentIntent created; payment metadata includes requestId/userId/paymentId/creatorId. |
| Successful checkout / `payment_intent.succeeded` | Nie tworzy nowego; aktualizuje `PENDING -> SUCCEEDED` | Tak: `grantPatron(source=stripe_tip, paymentId)` | Tak: `isPatron=true`, `patronSince`, `patronSource` | Tak: `syncClerkAccess` | Brak dla grantu; email failure audit only | Każda skuteczna płatność przechodząca fulfillment grantuje patrona; brak explicit eligibility check w fulfillment. |
| Webhook duplicate already processed | Nie | Nie | Nie | Nie | Nie | `StripeEventLockService` returns `ALREADY_PROCESSED`, handler returns `{ received: true }`. |
| Webhook conflict / processing | Nie | Nie | Nie | Nie | Alert metric | Handler ackuje Stripe bez przetwarzania. Wymaga health/diagnostics dla stuck processing. |
| Payment below threshold | Przy public route: nie, bo create-intent zwraca 400 przed Payment. Jeśli Payment powstał poza route: możliwe | Jeśli mimo to nadejdzie successful webhook z existing payment: tak, bo fulfillment nie sprawdza threshold | Tak, przez grant | Tak | Brak | To launch-critical gap: eligibility policy powinna być przy fulfillment, nie tylko checkout validation. |
| Full refund | Nie; update `Payment.REFUNDED`, `refundedAmountMinor` | Tak: new use-case wywołuje `revokePatron`, co revokuje wszystkie aktywne granty usera; legacy service revokuje linked grant | Tak: `false` po revoke/recalculate | Tak | `PATRON_REVOKED` w new `revokePatron`; brak dedicated refund audit | Target mówi linked grant; current new flow jest zbyt szeroki. |
| Partial refund | Nie; update `Payment.PARTIALLY_REFUNDED`, decrement totals | Recalculate active grants, bez direct revoke jeśli grant nadal active | Może zmienić przez recalculate, ale przy active grant zwykle pozostaje true | Tak | Brak | Owner OQ-001 nadal open; current runtime automatycznie recalculates. |
| Dispute opened / non-lost/non-won | Nie; update `Payment.DISPUTED` | Nie zawiesza/revoke linked grant | Nie | Nie | Alert metric only | Niezgodne z targetem „dispute suspends”. |
| Dispute lost / chargeback | Nie; update `Payment.CHARGEBACK_LOST`, decrement net totals | Tak: revokes active grant linked by `paymentId` | Tak przez recalculate | Tak | Alert metric; brak dedicated audit | Najbliżej targetu dla lost, ale bez formalnego audit eventu. |
| Dispute won | Nie; update `Payment.SUCCEEDED` | Nie tworzy/reaktywuje previously revoked/suspended grant; tylko recalculate existing active grants | Może pozostać false, jeśli grant został wcześniej revoked | Tak jeśli syncData | Brak dedicated audit | Niezgodne z targetem „reactivates”. |
| Manual grant | Nie | Tak: ADMIN grant | Tak: true | Tak | Brak w `grantPatron` | Route wymaga reason, ale use-case nie zapisuje `PATRON_GRANTED` audit. |
| Manual revoke | Nie | Tak: revokuje wszystkie active grants | Tak: false | Tak | Tak: `PATRON_REVOKED` | Route wymaga reason. Brak suspend/reactivate actions. |
| Manual suspend | Nie | Nie istnieje | Nie istnieje | Nie istnieje | Nie istnieje | Brak modelu/statusu suspend. |
| Email unsubscribe | Nie | Nie | Nie | Nie | Nie | DELETE `/api/subscriptions` usuwa tylko `Subscription` i zmniejsza subscriber count. |
| Clerk user.created/user.updated | Nie | Nie | Existing user: preserve status; new user: `isPatron=false` | Nie grantuje patron metadata | Event ledger/audit indirect | Clerk metadata nie grantuje patrona. |
| Clerk user.deleted | Nie | Tak: revokes active grants with reason `User deleted` | Tak: false | Nie | Tak: `USER_SOFT_DELETED` | Dodatkowy lifecycle edge poza Stripe. |

## Gaps vs Product Standard

| Gap | Severity | Dlaczego | Czy blokuje X1 runtime? | Sugerowany ticket |
| --- | --- | --- | --- | --- |
| Fulfillment grantuje patrona dla każdej successful payment bez explicit eligibility policy przy webhooku | BLOCKER | Product standard: Payment != PatronGrant; PatronGrant tylko po kwalifikującej jednorazowej wpłacie i progu per waluta. Checkout validation alone nie chroni przed out-of-band/manual/stale payment scenarios. | Blokuje certyfikację X1; nie blokuje rozpoczęcia małego runtime fixu. | `X1-FIX-001-payment-eligibility-policy-before-patron-grant` |
| Runtime default thresholds nie zgadzają się z owner launch defaults | HIGH | Current defaults: PLN 20, EUR/USD/CHF/GBP 5; target launch: 10 PLN/USD/EUR/CHF. | Tak dla runtime threshold ticketu. | `X1-FIX-002-align-launch-payment-threshold-defaults` |
| GBP jest supported, ale owner default list wymienia tylko PLN/USD/EUR/CHF | MEDIUM | Może być świadoma nadwyżka lub legacy; wymaga decyzji czy GBP zostaje launch-supported i jaki próg. | Nie dla pierwszego X1 fixu, ale wymaga owner/product decyzji przed launch. | `X1-FIX-003-supported-currencies-launch-scope` |
| Access backend nadal używa `User.isPatron` jako truth | BLOCKER | Target: active `PatronGrant` jest backend access truth; `User.isPatron` legacy/read-model/diagnostic. | Częściowo X2, ale X1 musi nie pogłębiać tego skrótu; blokuje final access cert. | `X1-FIX-004-patron-read-model-cache-contract` + X2 hard reset ticket |
| Full refund new flow revokuje wszystkie active grants usera, nie tylko linked grant | HIGH | Refund konkretnej płatności powinien cofnąć powiązany grant; admin/referral/other grant nie powinien być przypadkowo utracony bez policy. | Tak dla refund runtime ticketu. | `X1-FIX-005-full-refund-revokes-linked-payment-grant-only` |
| Dispute opened nie zawiesza linked grant | BLOCKER | Owner decision: dispute suspends; current runtime zostawia active grant/access w sporze. | Tak. | `X1-FIX-006-dispute-opened-suspends-linked-grant` |
| Dispute won nie reactivates grant | HIGH | Brak suspend/reactivate state powoduje, że won nie ma czego bezpiecznie reaktywować. | Tak dla dispute lifecycle. | `X1-FIX-007-dispute-won-reactivates-suspended-grant` |
| Manual grant nie zapisuje audytu | HIGH | Manual access-affecting actions require reason + audit. Reason jest w route, ale brak `PATRON_GRANTED` audit. | Tak dla manual actions. | `X1-FIX-008-manual-patron-grant-audit` |
| Brak manual suspend/reactivate route/use-case | MEDIUM | Target lifecycle wymaga suspend/reactivate dla dispute/manual support. | Nie musi blokować pierwszy fix, blokuje pełny lifecycle. | `X1-FIX-009-patron-grant-suspend-reactivate-use-cases` |
| Partial refund policy jest zaimplementowana, ale owner question pozostaje open | HIGH | Current automatic recalculate może być sprzeczne z przyszłą decyzją właściciela; spec wymaga explicit policy lub manual review. | Blokuje partial-refund runtime cert, ale nie blokuje inventory. | `X1-FIX-010-partial-refund-policy-owner-decision-and-runtime` |
| Brak dedicated audit dla refund/dispute financial access side effects | HIGH | Financial/access corrections muszą być diagnozowalne; obecnie są metrics/alerts i czasem revoke audit. | Tak dla X1 cert. | `X1-FIX-011-payment-patron-side-effect-audit-events` |
| Brak testów `handleDispute` i negative threshold-at-fulfillment | HIGH | Launch-critical lifecycle bez testów może regressować. | Tak dla X1 cert. | `X1-TEST-001-payment-patron-lifecycle-negative-tests` |
| `StripeEvent` conflict/stale diagnostics nie są widoczne w admin support center | MEDIUM | Paid-but-locked / webhook stuck wymaga diagnostyki bez DB/Stripe console. | Raczej X5, ale X1 może emitować better status. | `X1-FIX-012-stripe-event-health-surface-for-admin-diagnostics` |
| Mixed legacy modules still duplicate payment/patron logic | MEDIUM | `lib/services/payment.service.ts`, `fulfillment.service.ts`, `checkout.service.ts`, `refund.service.ts` są deprecated, ale obecne; risk drift. | Nie blokuje pierwszych small fixes, wymaga cleanup/guard. | `X1-FIX-013-deprecate-or-route-legacy-payment-services` |

## Legacy classification

| Legacy | Typ | Ryzyko | Czy akceptowalne tymczasowo? | Future cleanup |
| --- | --- | --- | --- | --- |
| `User.isPatron` | Legacy read-model/cache + current backend access truth | Access truth mismatch; stale cache can allow/deny incorrectly; forbidden target shortcut. | Tylko jako tymczasowy read model/diagnostic podczas X1/X2, nie jako final truth. | X2 Access hard reset to active `PatronGrant`; X1 keep in sync but mark cache. |
| `patronSince` / `patronSource` on `User` | Legacy denormalized status fields | Same drift risk; source may hide multiple active grants. | Tymczasowo acceptable for admin display. | Derive from grant history or store only diagnostic snapshot. |
| Clerk public metadata `isPatron/role/totalPaid` | UI cache / badge metadata | Drift and accidental backend trust risk; frontend could display patron badge despite DB mismatch. | Acceptable only for UI hints/badges and not sensitive access. | Add mismatch diagnostics and tests ensuring backend ignores Clerk metadata. |
| Legacy payment services (`lib/services/payment.service.ts`, `lib/services/payments/*`) | Deprecated compatibility bridge / duplicate orchestration | Duplicate lifecycle code can diverge from modules; old `PaymentService` has slightly different refund behavior. | Acceptable if unused by active routes and covered by guard/reconciliation. | Route all active paths to `lib/modules/payments`; remove or freeze legacy services. |
| `PaymentFulfillmentService` / `PaymentRefundService` bridge | Deprecated helper bridge | Old helpers may bypass new policy/audit if imported later. | Acceptable short term for tests/legacy, but not for new runtime tickets. | Replace with module use cases and add forbidden imports guard if feasible. |
| Admin patron route bridge | Route uses module use-cases + `UserAccessService.syncClerkAccess` | No grant audit; only grant/revoke, no suspend/reactivate; sync cache side-effect in route. | Acceptable for current admin tools with reason requirement, not launch-complete. | Move side effects/audit into domain/app use-cases; add suspend/reactivate. |
| Direct `Payment -> grantPatron` shortcut in `fulfillPayment` | Runtime shortcut | Missing explicit eligibility policy; creates access side-effect directly after successful payment. | Not acceptable for X1 certification; can remain until first X1 runtime fix. | Introduce `evaluatePaymentPatronEligibility` and grant only if qualified. |
| `Subscription` schema comment says `User.isPatron` is source of truth | Documentation-in-schema legacy mismatch | Conflicts with active control plane target: active `PatronGrant` truth. | Read-only noted; schema edit forbidden in this ticket. | Future schema/comment cleanup under explicit schema ticket. |

## Required future tickets

| Ticket | Cel | Scope | Ryzyko | Kolejność |
| ------ | --- | ----- | ------ | --------- |
| `X1-FIX-001-payment-eligibility-policy-before-patron-grant` | Dodać explicit patron eligibility policy at fulfillment: status succeeded, amount/currency meets current threshold, no below-min grant. | `lib/modules/payments`, `lib/modules/patron` tests; no schema unless approved. | High: payment/access side effects. | 1 |
| `X1-FIX-002-align-launch-payment-threshold-defaults` | Ustawić runtime defaults na owner launch values albo jawnie seed/admin config flow. | Constants/settings/tests only; package/schema no. | Medium: UX/payment minimum changes. | 2 |
| `X1-FIX-003-supported-currencies-launch-scope` | Rozstrzygnąć i wdrożyć launch supported currencies, zwłaszcza GBP. | Constants/settings/UI copy/tests; owner decision if GBP removed/kept. | Medium. | 3 |
| `X1-FIX-004-patron-read-model-cache-contract` | Oznaczyć `User.isPatron` as cache/read model in code comments/tests and prevent new backend truth usage in X1. | Tests/guards/docs report or small code comments under explicit ticket. | Medium; overlaps X2. | 4 |
| `X1-FIX-005-full-refund-revokes-linked-payment-grant-only` | Full refund cofa only grant linked to refunded payment and recalculates remaining active grants. | `handleRefund`, patron repository/use-case, tests. | High: access revocation granularity. | 5 |
| `X1-FIX-006-dispute-opened-suspends-linked-grant` | Implementować suspend semantics for dispute opened without losing grant history. | PatronGrant lifecycle; may require schema/status decision. | High; possible schema blocker. | 6 |
| `X1-FIX-007-dispute-won-reactivates-suspended-grant` | Reactivate suspended linked grant when Stripe dispute won. | PatronGrant lifecycle/dispute use-case/tests. | High; depends on suspend model. | 7 |
| `X1-FIX-008-manual-patron-grant-audit` | Zapisać `PATRON_GRANTED` audit for manual/admin grants with reason and actor. | `grantPatron`, admin route tests. | Medium. | 8 |
| `X1-FIX-009-patron-grant-suspend-reactivate-use-cases` | Dodać manual suspend/reactivate/revoke semantics with reason + audit. | Patron module + admin route/UI; likely schema/status. | High; may need owner-approved schema ticket. | 9 |
| `X1-FIX-010-partial-refund-policy-owner-decision-and-runtime` | Po decyzji właściciela: manual review / no effect / automatic revoke or threshold recalc. | Refund handler, admin diagnostics, tests. | High; blocked by OQ-001. | After owner decision |
| `X1-FIX-011-payment-patron-side-effect-audit-events` | Consistent audit for successful grant, refund, dispute opened/won/lost, Clerk sync failure, manual actions. | Audit module + payment/patron use-cases/tests. | Medium. | After 5-7 or in slices |
| `X1-TEST-001-payment-patron-lifecycle-negative-tests` | Testy: no below-threshold grant, duplicate webhook no duplicate grant, full refund linked only, dispute opened/won/lost. | Unit tests for modules; no runtime behavior unless failures documented. | Medium. | After/alongside fixes |
| `X1-TEST-002-forbidden-shortcuts-payments-patron-guards` | Negative/architecture tests: no Subscription -> Patron, no Clerk metadata backend access, no new `Payment -> User.isPatron` direct writes outside patron module. | Tests/guards only. | Medium. | After X1-FIX-001 |
| `X1-CERT-001-payments-patron-safety-certification` | Certify X1 lifecycle after fixes/tests and owner decisions. | Docs/report only; no runtime. | Low; depends on all X1 blockers. | Last |

## Blockers

Brak blockerów dla ukończenia X1-READY-001.

Blockery dla pełnej runtime certyfikacji X1 są wymienione w `Gaps vs Product Standard`, zwłaszcza eligibility policy, dispute opened/won lifecycle, full-refund linked-grant granularity, manual grant audit i owner decision OQ-001 dla partial refund.

## Owner questions

1. Partial refund policy: czy częściowy refund redukuje/cofa grant automatycznie, oznacza manual review, czy nie wpływa na grant?
2. Czy GBP ma być walutą launch-supported? Jeśli tak, jaki jest domyślny próg kwalifikującego wsparcia dla GBP?
3. Czy runtime default thresholds mają zostać natychmiast zmienione na 10 PLN / 10 USD / 10 EUR / 10 CHF, czy owner zakłada konfigurację w admin UI przed launch?
4. Czy full refund jednego paymentu ma cofać wyłącznie `PatronGrant.paymentId = payment.id`, nawet jeśli user ma aktywny admin/referral/migration grant?
5. Jak ma wyglądać suspend state technicznie: `PatronGrant.status`, osobny `PatronGrantSuspension`, czy `revokedAt` + re-create/reactivate event? To prawdopodobnie wymaga osobnego owner-approved schema ticketu.
6. Czy manual revoke ma cofać wszystkie active grants usera, czy tylko grant wybrany przez admina?
7. Czy Clerk metadata `role: PATRON` ma zostać zachowane jako UI badge, czy uprościć do `isPatron`/diagnostic cache, żeby nie sugerować backend truth?
8. Jak szczegółowy audit jest wymagany dla automatic webhook side effects: osobny event dla `PAYMENT_SUCCEEDED`, `PATRON_GRANTED_FROM_PAYMENT`, `PAYMENT_REFUNDED`, `PATRON_GRANT_SUSPENDED`, `PATRON_GRANT_REACTIVATED`, `PATRON_GRANT_REVOKED_BY_CHARGEBACK`?

## Rekomendacja

GO — można przejść do pierwszego małego runtime ticketu X1.

Rekomendowany pierwszy runtime ticket: `X1-FIX-001-payment-eligibility-policy-before-patron-grant`, ponieważ zmniejsza największe ryzyko `Payment -> PatronGrant` bez explicit policy i może być wykonany bez rozstrzygania partial refund policy oraz bez schema change. Równolegle należy uzyskać decyzję właściciela dla partial refund i GBP/default thresholds przed ticketami, które je zmieniają.

## Walidacja

- `git diff --check`: PASS.
- `npm run quality:architecture-boundaries`: PASS; command emitted expected allowlist warnings for existing temporary route-service imports and ended with `✅ Architecture check passed.`

## Czego nie zmieniono

* runtime code,
* app/**,
* lib/**,
* components/**,
* tests/**,
* prisma/**,
* scripts/**,
* package files,
* README.md,
* AGENTS.md,
* strategy/specs/audit/roadmap/tickets.
