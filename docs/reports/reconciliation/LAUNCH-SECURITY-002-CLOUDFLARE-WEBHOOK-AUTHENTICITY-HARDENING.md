# LAUNCH-SECURITY-002 — Cloudflare Stream webhook authenticity hardening

Status: IMPLEMENTED_VERIFIED

## 1. Summary

Implemented Cloudflare Stream webhook authenticity hardening for `POST /api/webhooks/cloudflare-stream`. The route now verifies the official `Webhook-Signature` HMAC contract over the exact raw request body before JSON parsing, application context creation, use-case execution, or Video/VideoAsset mutation.

## 2. Baseline main SHA

Baseline current-main/work SHA before this ticket branch: `01f6c6a` (`Merge pull request #882 from pawelekbyra/codex/execute-security-boundary-audit-ticket`).

## 3. Previous current-main behavior

Previous current-main behavior read `cf-webhook-signature` and compared the header value directly to `CLOUDFLARE_WEBHOOK_SECRET`. That was a shared-secret equality check, not the current Cloudflare Stream HMAC/timestamp signature contract. Previous code also parsed JSON with `req.json()` before payload validation and logged the full invalid payload when `uid` or `status` was missing.

## 4. Official Cloudflare evidence

Cloudflare Stream documentation for using webhooks states that Stream signs webhook requests and includes the signature in the `Webhook-Signature` HTTP header. The documented example format is `time=1230811200,sig1=<hex signature>`. The documentation describes building the signature source as `<time>.<body>` and computing HMAC-SHA256 using the webhook secret.

Evidence URL checked during this ticket: <https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/>

## 5. Header format

Implemented header name: `Webhook-Signature`.

Implemented accepted format:

```txt
time=<unix timestamp>,sig1=<64-character hex HMAC-SHA256 signature>
```

The obsolete `cf-webhook-signature` shared-secret header is not accepted.

## 6. Signature source format

Implemented source string:

```txt
<time>.<exact raw request body>
```

The route reads the body exactly once with `await req.text()` and passes that exact string to signature verification before `JSON.parse`.

## 7. HMAC algorithm and encoding

Implemented algorithm: HMAC-SHA256 via Node built-in `crypto.createHmac`.

Implemented key: `CLOUDFLARE_WEBHOOK_SECRET`.

Implemented encoding: hexadecimal, case-normalized before comparison.

No new dependency was added.

## 8. Raw-body handling

The route does not call `req.json()` before authentication. Raw body verification happens before payload parsing, application context creation, `handleCloudflareStreamWebhook`, or state mutation.

Tests prove that payload edits and whitespace/newline differences after signing fail verification.

## 9. Timestamp/replay policy

Implemented constant:

```ts
DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300
```

Requests are rejected when the absolute difference between the signature timestamp and verifier clock exceeds 300 seconds. The verification helper accepts an optional deterministic clock value for tests; the production route uses `Date.now()` through the helper default.

This provides bounded replay protection for this task. No event ledger or schema change was introduced.

## 10. Constant-time comparison

Implemented comparison uses `timingSafeEqual` after validating signature hex length and checking buffer lengths. Invalid length, malformed hex, and mismatched HMAC values are rejected before side effects.

## 11. Payload validation

Payload validation now occurs only after successful authentication. The route validates and sanitizes the minimal current payload contract:

- payload must be an object;
- `uid` must be a non-empty string;
- `status` must be an object;
- `status.state` must be one of the currently supported Stream states: `pendingupload`, `downloading`, `queued`, `processing`, `ready`, or `error`.

The route passes a sanitized payload object to the use case instead of forwarding arbitrary provider payload fields.

## 12. Logging and response redaction

Public responses remain generic:

- `401` for unauthorized webhook verification failures;
- `400` for authenticated invalid JSON or invalid payload shape;
- `500` for production verification configuration failure;
- existing safe application error mapping after verified payload reaches the use case.

Logs include only route name, request/correlation ID, and generic failure category. Logs do not include the secret, full signature, raw body, calculated HMAC, full Cloudflare payload, playback URLs, thumbnail URLs, provider tokens, signed URLs, or customer/creator metadata.

The previous full invalid-payload log was removed.

## 13. Idempotency assessment

Current webhook handling remains safe for repeated valid identical status events under the existing use-case semantics:

- unknown assets return an ignored success without update;
- redundant transitions return `no-change` without updating the asset or writing an audit entry;
- an already `READY` asset is not moved backward;
- a repeated identical event after the first successful sequential update becomes redundant because current state matches the mapped target state.

No unsafe repeated-valid-event mutation was proven in this ticket, so no blocked schema/event-ledger follow-up ticket was created.

## 14. Files changed

- `app/api/webhooks/cloudflare-stream/route.ts`
- `lib/security/cloudflare-stream-webhook.ts`
- `tests/unit/api/webhooks/cloudflare-stream.test.ts`
- `tests/unit/security/launch-security-boundaries.test.ts`
- `docs/tickets/ready/LAUNCH-SECURITY-002-cloudflare-webhook-authenticity-hardening.md`
- `docs/reports/reconciliation/LAUNCH-SECURITY-002-CLOUDFLARE-WEBHOOK-AUTHENTICITY-HARDENING.md`

## 15. Tests and exact results

- `git diff --check` — passed.
- `npm test -- --run tests/unit/api/webhooks/cloudflare-stream.test.ts tests/unit/security/launch-security-boundaries.test.ts` — passed: 2 files, 33 tests.
- `npm test -- --run tests/unit/media-source-safety.test.ts tests/integration/launch-candidate-critical-path.test.ts` — passed: 2 files, 19 tests.
- `npm run typecheck` — passed.
- `npm run quality:architecture-boundaries` — passed with existing allowlisted temporary route-service import warnings.
- `npm run lint` — passed with existing `app/admin/videos/page.tsx` React hook dependency warning.
- `git diff | rg -n "CLOUDFLARE_WEBHOOK_SECRET=|Webhook-Signature:|cf-webhook-signature|api[_-]?token|Bearer |signed.*url" || true` — reviewed manually; matches were documentation/tests/source references to the intended header/legacy-header rejection and no committed real secret or production signature.

## 16. What did not change

- No email, subscription, Resend, legal, global roadmap/strategy/spec, schema, migration, package, build, payment, PatronGrant, access, or playback policy files were changed.
- No live Cloudflare API call was made.
- No new dependency was added.
- No database webhook event ledger or schema change was introduced.

## 17. Environment requirement

Keep environment variable name: `CLOUDFLARE_WEBHOOK_SECRET`.

The value must be the webhook signing secret returned by the Cloudflare Stream webhook API, not a Cloudflare API token and not an arbitrary shared password.

No committed environment file was changed.

## 18. Production evidence status

PRODUCTION_EVIDENCE_REQUIRED.

This ticket verifies implementation with deterministic local unit/regression tests only. No authorized real Cloudflare webhook delivery was observed in production during this task.

## 19. Risks

- Operators must ensure `CLOUDFLARE_WEBHOOK_SECRET` is populated with the Cloudflare Stream webhook signing secret. A stale arbitrary shared password will now fail, as intended.
- Clock skew greater than 300 seconds between Cloudflare delivery time and application verification time will reject the webhook.
- There is no event ledger in this task; replay protection is bounded by timestamp tolerance and existing idempotent use-case behavior.

## 20. Remaining blocker

PRODUCTION_EVIDENCE_REQUIRED: verify at least one authorized real Cloudflare Stream webhook delivery against the deployed environment with the real Stream webhook signing secret configured.

## 21. Exactly one next recommendation

Run a controlled production or staging Cloudflare Stream webhook delivery test and archive evidence that the deployed route accepts a valid signed Stream webhook while rejecting an intentionally invalid signature.

## 22. Verdict

IMPLEMENTED_VERIFIED for local implementation and required focused validations.

Production launch certification remains PRODUCTION_EVIDENCE_REQUIRED.
