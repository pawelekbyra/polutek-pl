# EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001 — Independent verification report

## Summary

Verification verdict: PASS

Independent read-only review of `EMAIL-SIGNED-UNSUBSCRIBE-001` found that the merged implementation satisfies the signed logged-out unsubscribe requirements for token security, scanner-safe GET behavior, generic logged-out POST responses, application-code transaction grouping, consent reconciliation, recipient filtering, signed unsubscribe-link generation, and production environment validation. Authoritative PR #918 GitHub Actions run #575 evidence confirms `integration-postgres` passed, production environment validation and Prisma validation passed in the quality job before it reached the known `quality:strict-escapes` baseline, and the security job failed on the known `npm audit high` baseline. No ticket-specific blocker was found.

Public launch status: NO_GO

## Baseline verification

- Repository: `pawelekbyra/polutek-pl`
- Actual local branch at start: `work`
- Verification branch: `verify/email-signed-unsubscribe-postmerge-001`
- Remote synchronization: unavailable locally; `git fetch origin main` failed because no `origin` remote is configured in this workspace.
- Baseline mode used: available `HEAD` ancestry verification.
- Control-plane merge SHA: `a3fc7a913d9cc28e94bba9e643c941821f7b5e24`
- Implementation merge SHA verified: `5710d14f82f5951c13d8d77f6a8eb4d899068c4b`
- `git merge-base --is-ancestor a3fc7a913d9cc28e94bba9e643c941821f7b5e24 HEAD`: exit `0`
- `git merge-base --is-ancestor 5710d14f82f5951c13d8d77f6a8eb4d899068c4b HEAD`: exit `0`
- Starting `git status --short`: clean

## Inspected files

- `docs/tickets/ready/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md`
- `docs/tickets/ready/README.md`
- `app/unsubscribe/page.tsx`
- `app/api/subscriptions/unsubscribe/route.ts`
- `lib/modules/subscriptions/domain/signed-unsubscribe-token.ts`
- `lib/modules/subscriptions/application/signed-unsubscribe.use-case.ts`
- `lib/modules/subscriptions/infrastructure/email-preference.repository.ts`
- `lib/modules/email/domain/email.policy.ts`
- `lib/modules/email/application/send-admin-broadcast-email.use-case.ts`
- `lib/services/email.service.ts`
- `lib/env/validation.ts`
- `.github/workflows/ci.yml`
- `.env.example`
- `tests/unit/modules/subscriptions/signed-unsubscribe.test.ts`
- `tests/unit/modules/subscriptions/email-preference.repository.test.ts`
- `tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts`
- `tests/unit/modules/email/send-admin-broadcast-email.test.ts`
- `tests/unit/subscriptions-route.test.ts`
- `tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts`
- `tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts`
- `prisma/schema.prisma`
- `package.json`

## Token-security findings

PASS.

- A dedicated `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` is used by the token domain code; `RESEND_WEBHOOK_SECRET` is not referenced in that module.
- Runtime token code requires a trimmed secret length of at least 32 characters before creating or verifying tokens.
- Production validation includes `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` in required production variables and rejects configured values shorter than 32 characters.
- Tokens are HMAC-SHA256 over the encoded payload.
- Signature verification uses `timingSafeEqual` after checking buffer lengths.
- Payload is purpose-bound to `content-notification-unsubscribe`.
- Payload contains version `v`, purpose `p`, opaque subject `sub`, and expiration `exp`.
- Subject is the caller-provided opaque `User.id`; the payload type has no email field.
- `buildContentUnsubscribeUrl` writes only `/unsubscribe?token=<token>`.
- Missing secret returns `null` on token creation and `{ ok: false, reason: 'missing_secret' }` on verification; no unsafe fallback is present.
- Tests cover tampered, wrong-purpose, expired, malformed and missing-secret behavior returning generic/no-mutation outcomes.
- I found no logging of tokens, decoded payloads, signatures, or secrets in the token module or POST route. The POST route logs only `[SIGNED_UNSUBSCRIBE_POST_GENERIC_FAILURE]` on unexpected handler failure.

Decoded generated-token payload keys during verification, using a dummy secret and dummy subject only: `v,p,sub,exp`. The decoded dummy payload contained no email-like `@` value. No real user token or secret is published in this report.

## GET scanner-safety findings

PASS.

- `app/unsubscribe/page.tsx` is a server-rendered confirmation page that reads `searchParams.token` only to place it in a hidden POST form field.
- There is no use-case import, database import, repository call, mutation, token verification, token consumption, or token invalidation in the GET page.
- The page requires explicit form submission to `/api/subscriptions/unsubscribe` with `method="post"`.
- The visible copy is generic and explicitly says the page does not reveal whether a link or recipient is valid.
- Focused tests inspect the page source and assert no `SignedContentUnsubscribeUseCase` reference and no subscription/preference mutation calls during simulated repeated GET inspection.

## POST generic-response findings

PASS.

- `POST /api/subscriptions/unsubscribe` creates an app context with `actor: { type: 'guest' }`.
- The form token is normalized to a string or `null` and passed to `SignedContentUnsubscribeUseCase.execute` exactly once in the route body.
- The use case returns the same generic success shape for invalid, expired, malformed, unknown user, missing secret, and unexpected database/persistence errors.
- The route catch path also returns generic success and does not expose email, token, signature, payload, stack trace, or recipient-existence detail.
- Tests cover generic POST behavior and one route-level invocation.

## Transaction and consent-reconciliation findings

PASS for application-code atomicity; mock-only rollback evidence; no PostgreSQL rollback evidence claimed.

- The signed unsubscribe use case opens one `ctx.db.writeTransaction` for user lookup, main-creator lookup, main-creator `Subscription.deleteMany`, and `EmailPreferenceRepository.recordExplicitContentOptOut(user.id, user.email, tx)`.
- The use case does not call `emailPreference.upsert` directly.
- The repository method receives and uses the same transaction object when supplied.
- The implementation performs opaque `User.id` lookup from the verified token subject, then deletes only the main-creator subscription, then records content opt-out.
- The repository first resolves existing preference by `userId`, then safely checks/adopts by email when needed, supports old-email reconciliation, creates missing preferences with `systemEmails: true`, sets `marketingEmails: false`, and populates `unsubscribedAt`.
- Existing `systemEmails` is not overwritten by update paths.
- P2002 retry handling exists for update/adoption/create races.
- `PatronGrant` is not referenced by the signed unsubscribe use case or repository.
- Repeat unsubscribe is idempotent because subscription deletion is `deleteMany` and the preference is updated/adopted rather than duplicated.
- Focused unit tests exercise missing preference creation, existing preference update, old-email reconciliation, unowned email adoption, P2002 retry, generic unknown user, idempotent repeated unsubscribe, and non-use of `PatronGrant` mocks.

Evidence distinction:

- Application-code atomicity: verified directly from the single `writeTransaction` closure and same `tx` object usage.
- Mock-only rollback evidence: tests verify the preference failure path enters one transaction callback and the route/use case returns generic success; they do not simulate a real database rollback engine.
- Actual PostgreSQL evidence: not exercised by this verification; no claim is made that PostgreSQL rollback behavior was proven for this specific use case.

## Recipient-selection findings

PASS.

- Domain policy requires a non-empty `userId`, configured main creator, active main-creator `Subscription`, and `EmailPreference.marketingEmails === true`.
- Missing `EmailPreference` is not consent because the return condition is exactly `preference?.marketingEmails === true`.
- `EmailService.sendBroadcast` independently performs send-time filtering by pending recipient `userId`, active main-creator subscriptions, and email preference map.
- Missing `userId` or missing subscription is skipped with `NO_VERIFIABLE_CONTENT_OPT_IN`.
- Missing preference or `marketingEmails=false` is skipped with `CONTENT_NOTIFICATIONS_OPTED_OUT`.
- The admin broadcast use case also applies `EmailPolicy.canReceiveBroadcastEmail` before creating/sending non-test recipients, so manual/admin recipient creation cannot bypass the policy.
- Focused tests cover active subscription plus explicit preference, missing subscription, missing userId, marketing opt-out, missing preference, and manual audience without verifiable user subscription.

## Unsubscribe-link privacy findings

PASS.

- Content-broadcast delivery generates the unsubscribe link with `buildContentUnsubscribeUrl(recipient.userId, appUrl)`.
- The link path is `/unsubscribe` with only a `token` search parameter.
- Missing signing-secret configuration makes token creation return `null`; `EmailService.sendBroadcast` then skips the recipient as `UNSUBSCRIBE_LINK_UNAVAILABLE` instead of falling back to an email-address URL.
- Repository search found no `/unsubscribe?email=...` occurrence in `app`, `lib`, or `tests`.
- Remaining `unsubscribeLink` occurrences are template placeholders/editor previews and the signed-token builder/send-time path. I found no remaining legacy email-address unsubscribe link that can affect content-notification delivery.

Search run:

```bash
rg -n "/unsubscribe\\?email|unsubscribeLink|buildContentUnsubscribeUrl" app lib tests
```

Result: only signed-token builder/test references, template placeholder/editor preview references, and `EmailService.sendBroadcast` signed-token usage.

## Environment and CI findings

PASS with authoritative PR #918 CI evidence recorded.

- `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` is required by production validation.
- `.env.example` documents `EMAIL_UNSUBSCRIBE_SIGNING_SECRET=replace-with-at-least-32-random-characters`.
- CI quality job sets deterministic CI-only `EMAIL_UNSUBSCRIBE_SIGNING_SECRET: ci-email-unsubscribe-signing-secret-0001`; this is not treated as a production secret.
- CI triggers remain limited to `pull_request` and push to `main`, `master`, and `work`; no workflow permissions block was broadened.
- The CI workflow includes `npm run env:validate:prod`, `npx prisma validate`, `npx prisma generate`, `npm run quality:strict-escapes`, typecheck, coverage, lint, build, an `integration-postgres` job, and `npm audit --audit-level=high`.
- Authoritative implementation CI evidence: PR #918, implementation GitHub head `be4062d83f6f005f12d376498f17cc2ca22fa7ce`, CI workflow run #575, GitHub Actions run ID `27510171601`.
- PR #918 GitHub Actions run #575 provided authoritative evidence that `integration-postgres` passed, production environment validation and Prisma validation passed, and the remaining failures were the known unrelated `quality:strict-escapes` and `npm audit high` baselines.
- Authoritative job results: `integration-postgres` — PASS; `quality` — FAIL; `security` — FAIL. The overall workflow conclusion was failure due to the two known baseline jobs; this report does not claim the entire workflow passed.
- Authoritative `integration-postgres` steps: `npm ci` — PASS; `prisma migrate deploy` — PASS; `prisma generate` — PASS; `db:smoke` — PASS; final job conclusion — SUCCESS. This proves repository migration/smoke integration, but it does not prove signed-unsubscribe transaction rollback against PostgreSQL.
- Authoritative `quality` steps: `npm ci` — PASS; `env:validate:prod` — PASS; `prisma validate` — PASS; `prisma generate` — PASS; `quality:strict-escapes` — FAIL; later quality steps were skipped because of the known baseline failure.
- Authoritative `security` steps: `npm ci` — PASS; `npm audit high` — FAIL.

## Commands and exact results

| Command | Result |
| --- | --- |
| `git fetch origin main` | FAIL / ENV LIMITATION: `fatal: 'origin' does not appear to be a git repository`; no `origin` remote configured. |
| `git merge-base --is-ancestor a3fc7a913d9cc28e94bba9e643c941821f7b5e24 HEAD` | PASS, exit `0`. |
| `git merge-base --is-ancestor 5710d14f82f5951c13d8d77f6a8eb4d899068c4b HEAD` | PASS, exit `0`. |
| `git status --short --branch` | PASS: `## work` before creating verification branch; working tree clean. |
| `git switch -c verify/email-signed-unsubscribe-postmerge-001` | PASS: branch created. |
| `npx vitest run tests/unit/modules/subscriptions/signed-unsubscribe.test.ts tests/unit/modules/subscriptions/email-preference.repository.test.ts tests/unit/modules/email/email-service-broadcast-consent-boundary.test.ts tests/unit/modules/email/send-admin-broadcast-email.test.ts` | PASS: 4 files passed, 39 tests passed. npm printed warning: `Unknown env config "http-proxy"`. |
| `npx vitest run tests/unit/subscriptions-route.test.ts tests/unit/modules/subscriptions/subscriptions-route-boundary.test.ts tests/unit/modules/subscriptions/subscriptions.use-cases.test.ts tests/unit/modules/subscriptions/signed-unsubscribe.test.ts` | PASS: 4 files passed, 41 tests passed. npm printed warning: `Unknown env config "http-proxy"`. |
| `node scripts/check-control-plane-docs.mjs` | PASS: `CONTROL_PLANE_CHECK: PASS`, exit `0`. |
| `npx prisma generate` | PASS, exit `0`; Prisma Client generated. Warning: package.json Prisma config deprecated for Prisma 7. |
| `npm run typecheck` | PASS, exit `0`. |
| `npm run lint` | PASS, exit `0`; existing warning in `app/admin/videos/page.tsx` about missing `migrationStatusFilter` dependency. |
| `git diff --check` | PASS, exit `0`. |
| `DATABASE_URL='postgresql://user:pass@localhost:5432/db' DATABASE_URL_UNPOOLED='postgresql://user:pass@localhost:5432/db' npx prisma validate` | PASS, exit `0`; schema valid. Warning: package.json Prisma config deprecated for Prisma 7. |
| `NODE_ENV=production NEXT_PUBLIC_APP_URL='https://polutek.example' DATABASE_URL='postgresql://user:pass@localhost:5432/db' DATABASE_URL_UNPOOLED='postgresql://user:pass@localhost:5432/db' CLERK_SECRET_KEY='sk_test_dummy' CLERK_WEBHOOK_SECRET='whsec_dummy' NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_dummy' STRIPE_SECRET_KEY='sk_test_dummy' STRIPE_WEBHOOK_SECRET='whsec_dummy' NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_test_dummy' RESEND_API_KEY='re_dummy' RESEND_WEBHOOK_SECRET='whsec_resend_dummy' EMAIL_FROM='Polutek <noreply@example.com>' ADMIN_CLERK_USER_IDS='admin_1' MAIN_CREATOR_SLUG='polutek' PATRON_MIN_TIP_AMOUNT='10' PATRON_MIN_TIP_CURRENCY='PLN' REFERRAL_PATRON_THRESHOLD='10' HEALTHCHECK_TOKEN='health_dummy' MEDIA_BUCKET_HOST='media.example.com' UPSTASH_REDIS_REST_URL='https://redis.example.com' UPSTASH_REDIS_REST_TOKEN='redis_token' DISPLAY_EUR_TO_PLN_RATE='4' DISPLAY_USD_TO_PLN_RATE='4' EMAIL_UNSUBSCRIBE_SIGNING_SECRET='abcdefghijklmnopqrstuvwxyz1234567890' npm run env:validate:prod` | PASS, exit `0`; `ENV validation passed.` |
| `rg -n "/unsubscribe\\?email|unsubscribeLink|buildContentUnsubscribeUrl" app lib tests` | PASS: no `/unsubscribe?email` matches; only signed-token/template-placeholder occurrences. |
| Dummy token decode using local `node` script | PASS: payload keys `v,p,sub,exp`; no email-like `@` in decoded dummy payload. |
| `npm run quality:strict-escapes` | FAIL / KNOWN UNRELATED BASELINE: exit `1`; repository-wide explicit `any` findings reproduced. |
| `npm audit --audit-level=high` | FAIL / ENV LIMITATION: exit `1`; registry returned `403 Forbidden` for audit endpoint, so high-advisory status could not be independently refreshed locally. |
| PR #918 GitHub Actions run #575 / run ID `27510171601` / `integration-postgres` | PASS: `npm ci`, `prisma migrate deploy`, `prisma generate`, and `db:smoke` passed; final job conclusion `SUCCESS`. |
| PR #918 GitHub Actions run #575 / run ID `27510171601` / `quality` | FAIL / KNOWN UNRELATED BASELINE: `npm ci`, `env:validate:prod`, `prisma validate`, and `prisma generate` passed; `quality:strict-escapes` failed; later quality steps skipped. |
| PR #918 GitHub Actions run #575 / run ID `27510171601` / `security` | FAIL / KNOWN UNRELATED BASELINE: `npm ci` passed; `npm audit high` failed. |

## Known unrelated baseline failures

- `quality:strict-escapes`: reproduced locally as failing repository-wide with many explicit `any` findings, and authoritative PR #918 quality job reached the same known baseline after `npm ci`, `env:validate:prod`, `prisma validate`, and `prisma generate` passed. This ticket did not repair it.
- `npm audit high`: authoritative PR #918 security job failed on `npm audit high` after `npm ci` passed. Local refresh was blocked by registry `403 Forbidden`, but the authoritative PR #918 CI result classifies this as the known unrelated baseline. This ticket did not repair it.

## Follow-up tickets required

- Keep existing repository-wide `quality:strict-escapes` remediation outside this verification ticket.
- Keep existing `npm audit high` remediation outside this verification ticket.
- If release certification requires database rollback proof for signed unsubscribe specifically, add a future integration test against PostgreSQL. PR #918 `integration-postgres` proves repository migration/smoke integration only; this report verifies application-code atomicity and mock rollback evidence only.

## Delivery footer

branch: `verify/email-signed-unsubscribe-postmerge-001`

verification PR: PR #920

verification PR URL: https://github.com/pawelekbyra/polutek-pl/pull/920

report commit: recorded in PR #920 commit history

changed files: `docs/reports/verification/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md`

implementation SHA verified: `5710d14f82f5951c13d8d77f6a8eb4d899068c4b`

commands and exact results: see table above

verification verdict: PASS

known unrelated baseline failures: `quality:strict-escapes`; `npm audit high`

public launch status: NO_GO

READY_FOR_BOLEK_REVIEW
