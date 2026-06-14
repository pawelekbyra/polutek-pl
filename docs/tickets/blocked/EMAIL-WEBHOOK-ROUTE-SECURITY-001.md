# EMAIL-WEBHOOK-ROUTE-SECURITY-001 — Harden Resend webhook authentication and production contract

* **Status**: CONFIRMED_GAP
* **Ticket ID**: EMAIL-WEBHOOK-ROUTE-SECURITY-001
* **Role**: Builder
* **Launch impact**: BLOCKER

## Purpose
Enforce strict Svix HMAC signature verification in production and ensure the environment contract is strictly validated.

## Verified current behavior
`app/api/webhooks/resend/route.ts` contains a fallback that allows `x-resend-webhook-secret` to bypass Svix verification if headers are missing, even in production, as long as the secret matches.

## Root cause
The route code allows an `else if` branch for a legacy secret without checking the `NODE_ENV`.

## Risk
Unauthorized entities could spoof webhooks by obtaining the legacy secret, bypassing the more secure HMAC verification.

## Dependencies
- `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`

## Owner decisions required
- Confirmation that Svix is the ONLY allowed method for production.
- Decision on whether `x-resend-webhook-secret` should be deleted entirely or kept for local dev.

## Allowed paths
- `app/api/webhooks/resend/route.ts`
- `lib/env/validation.ts`
- `tests/unit/api/resend/resend-webhook-route.test.ts`

## Disallowed paths
- `lib/modules/email/application/**`
- `lib/modules/email/infrastructure/**`

## Target behavior
In `production`, the route MUST reject any request missing `svix-id`, `svix-timestamp`, or `svix-signature`. The legacy fallback MUST be restricted to `non-production`.

## Detailed acceptance criteria
1. Production environment REQUIRES Svix headers.
2. Missing Svix headers in production returns 401.
3. Signature verification failure in production returns 401.
4. Legacy fallback ONLY works if `process.env.NODE_ENV !== 'production'`.
5. `RESEND_WEBHOOK_SECRET` is added to `requiredProductionVars` in `env/validation.ts`.
6. Missing secret in production prevents route initialization or triggers a 500 "Webhook not configured".

## Required unit tests
- Request with missing Svix headers in production -> 401.
- Request with correct legacy secret in production -> 401.
- Request with invalid Svix signature -> 401.

## Required integration tests
- None (Route level).

## Required negative tests
- Signature bypass attempts.
- Malformed JSON body in legacy branch (if allowed in dev).

## Migration impact
None.

## Security/privacy impact
Critical hardening of the system entry point.

## Observability requirements
- Log warning for `[ResendWebhook] signature verification failed`.
- Log error for `[ResendWebhook] unauthorized legacy fallback attempt in production`.

## Rollout/rollback requirements
- Standard deploy.

## Non-goals
- Implementing locking.
- Fixing payload validation.

## Required evidence
- Unit tests proving rejection of legacy fallback in production mode.

## Exit state
`IMPLEMENTED_VERIFIED` after security audit.
