# LAUNCH-SECURITY-001 — Security boundary audit and regression pack

Status: PARTIAL
Verdict: MERGE

## 1. Executive summary

This audit mapped the current-main sensitive entry points that protect authentication, admin authorization, PatronGrant-backed access, provider webhooks, private playback, comments/community mutations, state-changing routes, rate limits and sensitive logging/error boundaries.

Focused regression evidence was added in `tests/unit/security/launch-security-boundaries.test.ts`. The tests verify high-value boundaries for admin patron mutations, Cloudflare webhook rejection, PatronGrant truth over stale cache data, comment mutation policy, denied/non-ready playback source contracts, Stripe webhook ordering and public error-response contracts.

No runtime fix was applied. The audit found no regression-backed defect small enough to fix safely within the allowed runtime scope without changing product policy or build-owned files. One narrow follow-up ticket was created for Cloudflare webhook authenticity hardening because the current route uses a shared-secret header equality check and the audit could not prove from code that it is an official Cloudflare Stream webhook-signature scheme.

This is not a penetration test, public-launch certification or statement that the product is fully secure.

## 2. Baseline main SHA

- Baseline branch at start: `work`.
- Baseline current-main SHA recorded before edits: `b0ad1dc20222d5b5bcd0920dcd5e3e7488930b2c`.
- Baseline latest visible commits included PR #880 legal readiness merge, PR #879 backup drill, PR #878 launch-candidate rehearsal, PR #877 playback state messaging and PR #876 admin patron confirmation workflow.
- Remote sync limitation: this checkout had no configured `origin`, so `git fetch origin main --prune` could not verify a newer remote `main`. Local status was clean before edits.
- Build-agent overlap check: local `git status --short` was clean and only the local `work` branch existed before the LAUNCH-SECURITY branch was created. No local build-owned file changes were present. External PR state could not be confirmed from this checkout because no remote was configured.

## 3. Scope and limitations

Status: PARTIAL

In scope:

- current code evidence only;
- deterministic local tests/mocks/source-contract assertions where route execution was not practical;
- read-only inspection of build/security-header files;
- no live provider calls;
- no real accounts, payments, webhooks or production attacks.

Limitations:

- no production or preview manual evidence was collected;
- no external remote/PR state was available from this checkout;
- no dependency scanner, DAST scanner or brute-force testing was run;
- no schema/migration/package/build/legal/global policy files were changed;
- provider-specific Cloudflare Stream webhook signing semantics were not verified against current provider documentation in this ticket.

## 4. Sensitive entry-point inventory

| Boundary | Route/action | Authentication | Authorization | Validation | Rate limiting | Secret/signature check | Sensitive response risk | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth/identity | Clerk sign-in/sign-up integration in `ClerkLocalizationProvider` | ClerkProvider requires publishable key | Redirect configuration only | N/A | Clerk-managed | N/A | publishable key only | IMPLEMENTED_UNVERIFIED |
| Auth/identity | `app/api/webhooks/clerk/route.ts` | Svix signature | system actor after verification | event type/data extraction | idempotency lock | `CLERK_WEBHOOK_SECRET`, raw body, Svix headers | logs user IDs and safe event IDs; error message redaction exists | IMPLEMENTED_VERIFIED locally/source |
| Auth/identity | `app/api/user/sync/route.ts` | Clerk auth through route/use case | current user only | route/use-case validation | not confirmed | N/A | user profile response | IMPLEMENTED_UNVERIFIED |
| Auth/identity | `lib/api/auth.ts`, `lib/auth-utils.ts` | Clerk `auth()` | DB role/admin config check | role values | N/A | N/A | unauthorized responses generic in API helper | IMPLEMENTED_VERIFIED locally/source |
| Auth/identity | `app/api/user/language/route.ts` | actor from auth | current actor | language enum | not confirmed | N/A | low | IMPLEMENTED_UNVERIFIED |
| Auth/identity | `app/api/user/profile/route.ts` | actor/current user | current actor | service validation | not confirmed | N/A | profile data | IMPLEMENTED_UNVERIFIED |
| Payments | `app/api/checkout/create-intent/route.ts` and `app/api/checkout/route.ts` | Clerk auth required | current user only | `checkoutSchema`, currency/amount limit | `checkout:{userId}` | Stripe server-side create path | returns client secret/paymentId to owner only | IMPLEMENTED_UNVERIFIED |
| Payments | `app/api/webhooks/stripe/route.ts` | provider signature | system context after verification | Stripe constructEvent | Stripe event lock | `STRIPE_WEBHOOK_SECRET`, raw body | route delegates errors through handler; signature suffix used as fallback request ID | IMPLEMENTED_VERIFIED locally/source |
| Payments | refund/dispute fulfillment | system from verified Stripe event | linked payment/grant in use cases | provider object metadata/intent ID | event idempotency | Stripe signature before side effects | logs event IDs/errors; no raw body observed | IMPLEMENTED_VERIFIED via existing suites + source |
| Payments | `app/api/admin/users/[userId]/patron/route.ts` | admin API helper | DB admin before mutation | action + non-empty reason | not route-local | N/A | returns status fields only | IMPLEMENTED_VERIFIED locally |
| Payments | `app/api/admin/payment-settings/route.ts` | context from auth | use-case admin policy | zod currency/min amount | not confirmed | N/A | validation details returned | IMPLEMENTED_UNVERIFIED |
| Payments | `app/api/admin/payments/route.ts` | context from auth | use-case admin policy | query parser | not confirmed | N/A | admin payment data; denied through use case | IMPLEMENTED_UNVERIFIED |
| Payments | `app/api/payment-settings/route.ts` | public read | public read | use-case | N/A | N/A | configured thresholds only | IMPLEMENTED_UNVERIFIED |
| Video/playback | `app/api/media-source/[videoId]/route.ts` | actor from auth, guest allowed | `PlaybackService` + access use case | videoId presence | `media-source:*` | provider signing only after allowed plan | denied response contract tested for no source/session/provider token contract | IMPLEMENTED_VERIFIED locally/source |
| Video/playback | `app/api/media/[...path]/route.ts` | route-specific media proxy | path policy | path parsing | media limits | storage signing/proxy where used | private path risk bounded by policy; not fully executed here | IMPLEMENTED_UNVERIFIED |
| Video/playback | `app/api/videos/[id]/playback-event/route.ts` | actor from auth | record use case | body passed to use case | `playback-event:*` | N/A | public errors through handler | IMPLEMENTED_UNVERIFIED |
| Video/admin | `app/api/admin/videos/**` | `requireAdminForApi` on mutation routes inspected | server-side admin before mutation | action/body validation varies | not confirmed | Cloudflare upload uses server credentials | admin-only data | IMPLEMENTED_UNVERIFIED |
| Video/webhook | `app/api/webhooks/cloudflare-stream/route.ts` | shared secret header if configured | system context after header check | `uid` + `status` presence | not confirmed | `CLOUDFLARE_WEBHOOK_SECRET` equality check | invalid signature no mutation tested; payload logging risk noted | PARTIAL |
| Comments | `app/api/videos/[id]/comments/route.ts` GET | public/actor optional | public read | sort/cursor/limit | N/A | N/A | comment DTO | IMPLEMENTED_UNVERIFIED |
| Comments | `app/api/videos/[id]/comments/route.ts` POST | authenticated actor required | `createVideoComment` + access policy | zod text/image URL | `comments:{userId}` | N/A | validation details only | IMPLEMENTED_VERIFIED policy/source |
| Comments | `app/api/comments/[commentId]/route.ts` PATCH/DELETE | authenticated actor required | ownership/admin in use case | zod text/comment ID presence | not route-local | N/A | use-case messages | IMPLEMENTED_VERIFIED policy/source |
| Comments | reactions/reports/pin | actor from auth | access/ownership/admin policy in use cases | report zod enum/note | reports rate-limited | N/A | use-case messages | IMPLEMENTED_VERIFIED policy/source |
| Comments/admin | `app/api/admin/comments/**` | `requireAdminForApi` | admin before moderation | action/status validation varies | not confirmed | N/A | moderation errors can include use-case messages | IMPLEMENTED_UNVERIFIED |
| Email | `app/api/admin/emails/**` | `requireAdminForApi` | admin before broadcast/template mutation | zod schemas | not confirmed | Resend API on server | admin email data; operational logging includes email addresses | PARTIAL |
| Email webhook | `app/api/webhooks/resend/route.ts` | Svix or legacy secret | system context | raw body then parsed | not confirmed | `RESEND_WEBHOOK_SECRET`/legacy header | error message from use case returned on 500 | PARTIAL |
| Operations | `app/api/health/route.ts` | public | public health only | N/A | N/A | N/A | health details require review | IMPLEMENTED_UNVERIFIED |
| Operations | backup verifier scripts | CLI/operator only | shell access | script-specific | N/A | env presence only in validator | some scripts print IDs/emails in dev DB verifier | PARTIAL |
| Operations | security headers | `middleware.ts`, `next.config.mjs` | N/A | N/A | N/A | N/A | CSP generated in middleware; baseline headers configured | IMPLEMENTED_UNVERIFIED |

## 5. Admin authorization matrix

Status: PARTIAL

| Admin surface | Server-side authorization evidence | Side-effect ordering | Identifier validation | Denial data exposure | Status |
| --- | --- | --- | --- | --- | --- |
| `/api/admin/users/[userId]/patron` | `requireAdminForApi("PATCH_ADMIN_USER_PATRON")` before body mutation; test covers 401/403 before grant/revoke | auth before `grantPatron`/`revokePatron` | `userId` passed to use case; action/reason checked | generic 401/403 | IMPLEMENTED_VERIFIED |
| `/api/admin/videos/[id]/actions` | `requireAdminForApi` at start of PATCH/POST | before action switch/provider calls | `id` from params; action switch | use-case result | IMPLEMENTED_UNVERIFIED |
| `/api/admin/videos`, reorder/resync | `requireAdminForApi` present | before use cases | varies by route/use case | use-case result | IMPLEMENTED_UNVERIFIED |
| `/api/admin/comments/**` | `requireAdminForApi` present | before moderation use cases | comment/report params | use-case message on error | IMPLEMENTED_UNVERIFIED |
| `/api/admin/channel` and deprecated `/api/admin/creator` | canonical channel route uses `requireAdminForApi`; creator delegates to canonical route | before patch | zod schema | validation details | IMPLEMENTED_UNVERIFIED |
| `/api/admin/payment-settings` | no direct `requireAdminForApi`; uses context actor and `PaymentPolicy.canManagePaymentSettings` in use case | use-case checks before writes | zod currency/min amount | `Forbidden`/validation details | IMPLEMENTED_UNVERIFIED |
| `/api/admin/payments` | no direct `requireAdminForApi`; use-case policy before query | policy before admin payment list | query parser | may return forbidden from use case | IMPLEMENTED_UNVERIFIED |
| `/api/admin/users/export` | context actor admin check before export | before export query | parser + CSV field sanitization | generic forbidden | IMPLEMENTED_UNVERIFIED |
| `/api/admin/emails/**` | `requireAdminForApi` present | before broadcast/template/list mutations | zod schemas | validation details/use-case messages | IMPLEMENTED_UNVERIFIED |
| `/api/admin/maintenance/main-channel/**` | `requireAdminForApi` present | before preview/apply | confirmation phrase for apply | validation details | IMPLEMENTED_UNVERIFIED |

No admin route was changed. Routes that rely on use-case authorization rather than direct route-level `requireAdminForApi` remain marked `IMPLEMENTED_UNVERIFIED` because this ticket did not execute all use cases behaviorally.

## 6. Webhook verification matrix

| Webhook | Authenticity | Raw/provider payload | Verification before side effects | Missing secret behavior | Invalid signature behavior | Idempotency | Logging/error observations | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stripe | Stripe `constructEvent(body, signature, endpointSecret)` | `req.text()` preserved | yes, before lock and fulfillment | use case fails if `STRIPE_WEBHOOK_SECRET` missing | no mutation before constructEvent succeeds | `StripeEventLockService` | no raw body observed; errors delegated | IMPLEMENTED_VERIFIED locally/source |
| Clerk | Svix `Webhook.verify` | `req.text()` preserved | yes, before sync | currently throws if `CLERK_WEBHOOK_SECRET` missing | returns generic error and no sync | `acquireClerkEventLock` + finalize | `safeErrorMessage` redacts common secrets | IMPLEMENTED_UNVERIFIED |
| Cloudflare Stream | custom `cf-webhook-signature` equals `CLOUDFLARE_WEBHOOK_SECRET` | `req.json()` after header check | yes for configured secret | production fails closed; non-production without secret accepts payload | test verifies invalid signature returns 401 and no use-case call | use-case has redundant transition handling, no event ledger | logs invalid signature generically; invalid payload logs payload object | PARTIAL |
| Resend | Svix headers with raw body, plus legacy shared-secret fallback | `req.text()` preserved | yes | production fails closed | 401 and no use-case | payload eventId if Svix; use-case behavior not fully inspected | verification failure logs error object; use-case error message returned on 500 | PARTIAL |

## 7. Patron/payment access-truth evidence

Status: IMPLEMENTED_VERIFIED locally/source

Evidence reviewed:

- `checkVideoAccess` uses `getPatronStatus` for PATRON video access and does not trust `actor.isPatron`.
- `getPatronStatus` computes patron status from active grants.
- `buildPatronDiagnosticsReadModel` reports final status from active grants and marks cache/truth mismatch when `User.isPatron` is stale.
- Existing Stripe lifecycle tests cover refund/dispute grant transitions.
- New regression confirms stale cache saying patron does not become final patron status without active grants.

Current conclusions:

- Payment alone does not unlock through the playback access use case.
- `User.isPatron` is display/cache information in the inspected path.
- Clerk metadata is not used as backend patron truth in `checkVideoAccess`.
- Subscription/newsletter modules remain separate from patron access in inspected paths.

## 8. Private playback security evidence

Status: IMPLEMENTED_VERIFIED locally/source

Evidence reviewed:

- `PlaybackService.createPlaybackPlanWithContext` runs `checkVideoAccess` before provider token creation.
- Denied plans return `unavailablePlan` before Cloudflare signing and before session creation.
- Non-ready asset states return `unavailablePlan` before signing and session creation.
- `toSafeAssetContract` redacts provider asset/playback IDs in public plans.
- Media-source route redacts likely raw media URLs and maps raw URL warnings to `[REDACTED]`.
- Existing media-source safety tests and integrated critical-path tests were run.

Known limitation:

- Cloudflare provider exceptions are logged by `console.error` inside playback service. The public response is generic, but production log redaction around provider exception objects still requires manual evidence.

## 9. Comments/community authorization evidence

Status: IMPLEMENTED_VERIFIED locally/source

Evidence reviewed:

- Public comment read remains available through GET routes.
- POST comment requires non-guest actor and route-level rate limiting.
- Comment creation/reaction/report uses video-access inheritance through comment policy/use cases.
- Edit/delete checks ownership/admin/moderator rules in use cases.
- Report route validates reason/note and rate limits per user.
- New regression covers guest denied, non-access actor denied, owner/admin update/delete policy and guest report denial.

Known limitation:

- HTML/script rendering was not exhaustively executed. Source review found zod text validation and image URL host validation; final rendering/sanitization path should remain part of manual UI verification.

## 10. State-changing request review

Status: PARTIAL

Reviewed state-changing surfaces:

- admin POST/PATCH/DELETE routes;
- checkout POST;
- user language/profile/referrals POST/PATCH;
- comments POST/PATCH/PUT/DELETE/report/pin;
- subscriptions POST/DELETE;
- playback-event POST;
- webhook POST routes.

Findings:

- Most state-changing routes use Clerk actor resolution, route-level admin helper or use-case policy.
- Several routes rely on same-site session assumptions and Clerk middleware rather than explicit CSRF token/origin checks.
- This ticket did not add a repository-wide CSRF framework by instruction.
- No route-local high-risk CSRF fix was applied because no focused failing regression was introduced and product/session policy was not redesigned.

## 11. Input-validation and IDOR review

Status: PARTIAL

Evidence:

- Checkout uses `checkoutSchema` plus async currency amount limits.
- Payment settings use zod-supported currencies and positive/max amount checks.
- Comments use zod for text, report reason and allowed image URL host.
- Admin video actions use action switch and use-case DTOs, but body validation depth varies by action.
- Admin user export sanitizes CSV fields to reduce spreadsheet formula injection.
- Playback access resolves video through main-channel and access use cases rather than trusting frontend state.

Remaining risks:

- Some admin routes pass route/body identifiers directly into use cases and rely on use-case validation.
- Some validation error responses include flattened zod details; acceptable for many admin APIs but should be reviewed for sensitive internal field names before production evidence.
- No open redirect issue was confirmed in inspected sign-in/sign-up fallback URLs because they are fixed to `/`.

## 12. Logging/error/secret review

Status: PARTIAL

Search terms reviewed included `process.env`, `authorization`, `cookie`, `webhook-signature`, `stripe-signature`, `svix`, `token`, `secret`, `DATABASE_URL`, `signed`, `playbackUrl`, `customer` and `email` across app/lib/scripts/tests.

Observations:

- Vercel env validator prints group presence only and states it never prints env values.
- Stripe webhook stores a reduced event payload and does not store raw event body in the lock payload.
- Clerk webhook uses `safeErrorMessage` for persisted failure errors.
- Media-source route redacts raw media URL warnings.
- Cloudflare webhook invalid payload logging includes the payload object. Cloudflare payload may contain playback fields; this is a redaction risk for production logs.
- Email service logs recipient email addresses and Resend audience IDs for operations. This may be operationally useful but requires production log retention/access review.
- Some scripts intended for local/operator use print test user/video/subscription IDs/emails. Do not run those against production unless the operator accepts the data exposure and captures redacted evidence.

No logging changes were applied because this ticket did not prove a small regression-backed defect in allowed runtime scope that could be fixed without broader logging policy decisions.

## 13. Rate-limiting review

Status: PARTIAL

Observed route-level rate limits:

- checkout intent creation: `checkout:{userId}`;
- media-source: `media-source:*` with user/IP/media key;
- comments: `comments:{userId}`;
- reports: `reports:{userId}`;
- subscriptions: read/write helper;
- referrals claim: per actor/IP path;
- playback-event: user/IP hash.

Gaps/limitations:

- Webhook endpoints do not show route-level rate limits; provider signature/idempotency is the primary control.
- Many admin routes do not have explicit route-level rate limits; admin authentication and auditability are primary controls.
- Production rate-limit store semantics were not verified.

## 14. Security header/config observations

Status: IMPLEMENTED_UNVERIFIED

Read-only observations only; build-owned files were not modified.

- `next.config.mjs` configures baseline headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, HSTS and `Permissions-Policy`.
- `middleware.ts` attaches `x-request-id` and `Content-Security-Policy` from `generateCSP()`.
- `vercel.json` delegates build to `npm run vercel-build`.
- No build task files were changed in this ticket.

Production evidence remains required because header behavior depends on deployment path, middleware execution and CDN/Vercel response handling.

## 15. Confirmed defects

Status: PARTIAL

No runtime defect was fixed in this ticket.

Confirmed audit gaps/risks:

1. Cloudflare Stream webhook authenticity is only proven as a configured shared-secret header equality check in code, not as provider-documented signed webhook verification. Status: PARTIAL.
2. Cloudflare webhook invalid payload logging may include provider payload fields. Status: PARTIAL.
3. Production/manual evidence for logs, headers, denied playback network behavior and webhook idempotency is not present. Status: PRODUCTION_EVIDENCE_REQUIRED.

## 16. Fixes applied

Status: NOT_APPLICABLE

No runtime fixes were applied. Changes were limited to the allowed test and documentation paths plus one narrow follow-up ticket.

## 17. Focused regression evidence

Status: IMPLEMENTED_VERIFIED locally

New test file: `tests/unit/security/launch-security-boundaries.test.ts`.

Covered assertions:

- unauthenticated admin patron mutation is denied before grant/revoke/Clerk sync;
- non-admin admin patron mutation is denied before grant/revoke;
- manual patron action requires valid action and non-empty reason;
- invalid Cloudflare Stream webhook signature causes zero use-case side effects;
- missing Cloudflare webhook secret fails closed in production;
- stale `User.isPatron` cache does not create final patron access without active grant;
- active grant drives final patron status;
- guest/non-access comment interactions are denied and owner/admin rules hold;
- denied/non-ready playback source contracts contain no provider calls, signed token creation or playback sessions;
- Stripe webhook verification and event lock precede fulfillment/refund/dispute side effects;
- public route contracts avoid stack traces and use redaction/handler boundaries.

## 18. Integrated critical-path regression

Status: IMPLEMENTED_VERIFIED locally

The integrated launch candidate critical-path regression was run after the focused unit pack. It passed locally in this checkout. This remains local evidence only and is not production/manual launch evidence.

## 19. Manual/production evidence status

Status: PRODUCTION_EVIDENCE_REQUIRED

No preview/production-like manual evidence was gathered. The new operator checklist defines redacted evidence checks for admin denial, webhook rejection/idempotency, denied playback network behavior, patron playback network behavior, token/provider redaction, comments authorization, rate-limit responses, health/diagnostic exposure, error/log redaction and rollback/escalation.

## 20. Files changed

- `docs/tickets/ready/LAUNCH-SECURITY-001-security-boundary-audit-and-regression-pack.md`
- `docs/tickets/ready/LAUNCH-SECURITY-002-cloudflare-webhook-authenticity-hardening.md`
- `tests/unit/security/launch-security-boundaries.test.ts`
- `docs/operations/security-launch-verification-checklist.md`
- `docs/reports/reconciliation/LAUNCH-SECURITY-001-SECURITY-BOUNDARY-AUDIT.md`

## 21. What did not change

- No runtime code changed.
- No build-owned files changed.
- No schema or migration changed.
- No package file changed.
- No legal/global roadmap/strategy/spec file changed.
- No owner product/access policy changed.
- No live provider call, real payment, production attack or destructive database command was performed.

## 22. Risks and limitations

- This was an audit/regression pack, not a full penetration test.
- Cloudflare provider-signature semantics need a dedicated hardening task.
- Production logging redaction requires manual evidence.
- Admin routes that rely on use-case policy rather than direct route-level admin helper should remain in future regression coverage.
- CSRF/origin strategy was not redesigned.
- Email operational logs and DB verifier scripts may expose personal data if used carelessly in production-like environments.

## 23. Remaining blockers

- PRODUCTION_EVIDENCE_REQUIRED for manual checklist execution.
- PARTIAL Cloudflare webhook authenticity proof.
- PARTIAL production log redaction proof for provider payloads, signed playback errors and email operations.
- IMPLEMENTED_UNVERIFIED deployment header/CSP behavior.

## 24. Exactly one next recommended ticket

`docs/tickets/ready/LAUNCH-SECURITY-002-cloudflare-webhook-authenticity-hardening.md`

Recommended next action: verify current Cloudflare Stream webhook authenticity requirements against official Cloudflare documentation and replace/augment the shared-secret equality check only if Cloudflare documents a stronger provider signing scheme.

## 25. Verdict

MERGE

Rationale: The ticket delivered the required audit artifacts, focused regression evidence and a narrow follow-up for the main launch-critical gap. No runtime change was needed for the verified local regressions. This verdict is not a public-launch certification.
