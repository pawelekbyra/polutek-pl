# LAUNCH-FIX-002 — Cloudflare Webhook Production Check

## Status

Merge recommendation: **MERGE** for this docs-only / ops-evidence PR.

Production readiness recommendation: **BLOCKED until owner/operator captures live Cloudflare + Vercel production evidence** listed below.

Ticket/task: `LAUNCH-FIX-002-cloudflare-webhook-production-check`.

## Summary

This report documents the production-readiness checklist for Cloudflare Stream webhooks on Polutek.pl without exposing secrets and without changing runtime behavior. Repository evidence confirms that the application has a documented Cloudflare Stream webhook route, shared-secret verification expectations, asset lifecycle state mapping, and admin asset status surfaces. Live production evidence could not be captured from this environment because the agent does not have Cloudflare dashboard access, Vercel production environment access, production logs, or a test Cloudflare Stream asset.

The useful output of this ticket is therefore:

- a precise, secret-safe Cloudflare/Vercel production verification checklist;
- the exact evidence owner/operators must capture;
- the exact external blockers preventing production certification from this agent session;
- a reusable manual runbook for future checks.

## Intent

Verify and document Cloudflare Stream production webhook readiness for the single Polutek.pl VOD place. This task is docs-only / ops evidence and must not change app behavior.

## Sources inspected

Read-only documentation inspection only:

- `docs/tickets/ready/LAUNCH-FIX-002-cloudflare-webhook-production-check.md`
- `docs/reports/reconciliation/LAUNCH-OPS-001-PRODUCTION-ENV-AND-SMOKE-TEST-INVENTORY.md`
- `docs/reports/reconciliation/LAUNCH-FIX-001-VERCEL-PRODUCTION-ENV-VALIDATION.md`
- `docs/reports/reconciliation/X3-FIX-004-PROVIDER-WEBHOOK-ASSET-STATE.md`
- `docs/reports/reconciliation/X3-FIX-003-ADMIN-CLOUDFLARE-UPLOAD-AND-ASSET-STATUS.md`
- `docs/reports/reconciliation/X3-FIX-007-LEGACY-VIDEO-INVENTORY-ADMIN-DIAGNOSTICS.md`
- `docs/operations/**` index; no Cloudflare-specific operations runbook existed before this task.

## Reports/runbooks created

- Added `docs/reports/reconciliation/LAUNCH-FIX-002-CLOUDFLARE-WEBHOOK-PRODUCTION-CHECK.md`.
- Added `docs/operations/cloudflare-stream-webhook-production-check.md`.

## Cloudflare env checklist

| Item | Required production result | Evidence status in this PR | Secret-safety rule |
| --- | --- | --- | --- |
| Cloudflare account id | `CLOUDFLARE_ACCOUNT_ID` exists in Vercel **Production** for the Polutek.pl project. Record as `present` with a redacted tail only if owner policy allows, e.g. `present (acct …1234)`. | **External blocker:** no Vercel Production env access in this agent session. | Do not paste the full account id into docs, PRs, screenshots, or logs. |
| Cloudflare API token | `CLOUDFLARE_API_TOKEN` exists in Vercel **Production** and is server-only. | **External blocker:** no Vercel Production env access in this agent session. | Never print or screenshot token values. Record only `present`, `missing`, or `wrong scope`. |
| API token scope expectations | Token should be narrowly scoped to the Cloudflare account and Stream operations needed by launch workflows: direct upload URL creation, import if used, asset status/read, and webhook/lifecycle-related Stream administration if the operator configures webhooks with that token. It should not be an all-account global token unless explicitly accepted by the owner. | **Checklist documented; not verified live.** | Capture scope names/permissions as dashboard labels only; never expose token material. |
| Webhook secret | `CLOUDFLARE_WEBHOOK_SECRET` exists in Vercel **Production** and matches the Cloudflare Stream webhook endpoint secret/header value expected by the deployed app. | **External blocker:** no Vercel Production env or Cloudflare dashboard access in this agent session. Repository evidence says this env is required by the webhook handler. | Never reveal the secret. Record only `present`, `matches dashboard endpoint`, or `mismatch`. |
| Webhook URL | Cloudflare Stream webhook endpoint points to the canonical HTTPS production URL: `https://<canonical-production-domain>/api/webhooks/cloudflare-stream`. For owner-approved launch this should be the canonical Polutek.pl production origin, not a Vercel preview URL. | **External blocker:** no Cloudflare dashboard access in this agent session. Repository evidence documents the expected route and URL pattern. | Redact event IDs if needed; URL origin/path is non-secret but must be production-canonical. |

## Vercel env relationship

### Envs that must exist in Production

Cloudflare Stream production readiness requires these Vercel **Production** variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_WEBHOOK_SECRET`

They must be set for the production deployment that receives Cloudflare webhook traffic. If variables are added after the latest production deployment, owner/operators should redeploy production so the live function receives the current env set.

### Envs that must never be public

The following must remain server-only and must never use a `NEXT_PUBLIC_` prefix:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_WEBHOOK_SECRET`

Screenshots, logs, and PR text must redact values. Acceptable evidence language is `present`, `missing`, `wrong scope`, `matches endpoint`, or `redacted`.

### Relationship with `scripts/validate-vercel-production-env.mjs`

`LAUNCH-FIX-001` added a non-secret production env validator and documented that it should report env groups only, never env values. For Cloudflare Stream, the expected relationship is:

1. Owner/operator runs the validator against an exported or otherwise supplied production env snapshot.
2. The Cloudflare Stream group must report present for production.
3. If the validator reports missing Cloudflare keys, stop the Cloudflare webhook smoke test and fix Vercel Production env first.
4. Passing validator output is necessary but not sufficient: it proves env presence by name, not token scope, dashboard webhook URL, delivery success, or asset state transitions.

## Webhook routing checklist

| Routing item | Required result | Evidence status |
| --- | --- | --- |
| Production endpoint path | `/api/webhooks/cloudflare-stream` | Repository docs identify the route as `app/api/webhooks/cloudflare-stream/route.ts`; live route not probed by this agent. |
| Canonical HTTPS domain | `https://<canonical-production-domain>/api/webhooks/cloudflare-stream` | External blocker: no Cloudflare dashboard access to confirm configured URL. |
| No preview URL | Cloudflare dashboard must not point at `*.vercel.app` preview deployments, branch URLs, local tunnels, staging domains, or stale deployment URLs unless owner explicitly approves a separate staging endpoint. | External blocker: no Cloudflare dashboard access. |
| No Deployment Protection blocking route | Vercel Production must allow Cloudflare to POST to `/api/webhooks/cloudflare-stream` without password protection, preview protection, SSO, or a challenge page. | External blocker: no Vercel dashboard/log access. |
| No auth/middleware blocking route | The route must be reachable as a provider webhook; authentication is via the Cloudflare webhook secret/signature check, not a browser session. Existing repository evidence says invalid/missing secrets return 401 and do not mutate data. | Automated/repo evidence exists from X3-FIX-004; production reachability not verified live. |

## Lifecycle event evidence

### How to trigger or observe a Stream lifecycle event

Preferred safe production smoke path:

1. Use a non-public or disposable admin test video record.
2. From the admin Cloudflare workflow, generate a Cloudflare Stream direct upload URL or attach/import a test asset if that workflow is launch-scoped.
3. Upload a tiny safe test video or trigger an approved Cloudflare Stream import.
4. Observe lifecycle status in Cloudflare Stream as it moves through upload/processing to ready, or capture a failure/unavailable state if intentionally using a bad test import.
5. Confirm Vercel receives the webhook POST at `/api/webhooks/cloudflare-stream`.
6. Confirm the admin video details surface shows the associated `VideoAsset` transition.

If no new upload is allowed, use an existing test Stream asset and observe/replay a dashboard delivery if Cloudflare provides safe delivery details without exposing secrets.

### Evidence to capture from Cloudflare dashboard

Capture screenshots or notes showing only redacted/non-secret fields:

- Stream webhook endpoint URL, proving canonical HTTPS production domain and `/api/webhooks/cloudflare-stream` path.
- Webhook delivery timestamp in UTC or local time with timezone.
- Delivery result/status code, expected success `2xx` for valid events.
- Event type/status, e.g. processing/queued/ready/error lifecycle information.
- Redacted asset UID or event id, e.g. `uid …abcd`, `event …7890`.
- Webhook secret configured/present indicator, if the dashboard shows one, without revealing the secret.

### Evidence to capture from Vercel logs/app/admin state

Capture only non-secret evidence:

- Production function log line/timestamp for `POST /api/webhooks/cloudflare-stream`.
- HTTP status for valid event delivery, expected `2xx` if accepted.
- HTTP status for invalid/unsigned probe, expected `401` and no mutation.
- Admin video details showing the Cloudflare Stream asset state and sync timestamps.
- Database/admin state evidence for `VideoAsset` processing fields if available via admin UI: `processingState`, `providerSyncedAt`, `processingStartedAt`, `processingEndedAt`, and failure reason for error cases.

### Safe redaction rules

- Secrets: redact fully as `[REDACTED]`; do not show prefixes/suffixes.
- API tokens: redact fully as `[REDACTED]`.
- Account id: treat as operationally sensitive; either redact fully or show at most last 4 characters if owner policy permits.
- Asset UID/event IDs: show at most the final 4 characters, e.g. `…abcd`, unless owner approves full non-secret IDs for operational debugging.
- URLs: production origin and route path are acceptable to show; query strings should be removed unless proven non-secret.

## Invalid signature / unsigned webhook evidence

Existing repository evidence from `X3-FIX-004` states that the Cloudflare Stream webhook handler uses `CLOUDFLARE_WEBHOOK_SECRET`, checks the `cf-webhook-signature` header, returns `401` for missing/invalid secrets, and does not mutate data for unauthorized requests. That report also states unit tests cover signature verification.

Production evidence is still required before launch. Safe manual probe requirement:

1. Send a POST to `https://<canonical-production-domain>/api/webhooks/cloudflare-stream` without `cf-webhook-signature` and without any secret value in the request.
2. Use a harmless minimal JSON body that cannot match a real asset UID.
3. Expected response: `401` or equivalent unauthorized response.
4. Confirm no `VideoAsset` state changed in admin/database evidence.
5. Record only timestamp, route, status code, and redacted request id/log id.

Do **not** commit the body if it contains a real asset UID. Do **not** include any valid webhook secret in a manual probe captured in docs.

## Asset state evidence

| State/path | Expected app/admin evidence | Evidence status in this PR |
| --- | --- | --- |
| Processing | Valid Cloudflare lifecycle events mapped from `pendingupload`, `downloading`, `queued`, or `processing` should update asset state to `UPLOADING` or `PROCESSING` with sync timestamp. | Repository evidence from X3-FIX-004 documents state mapping; no live production event captured. |
| Ready | Valid `ready` lifecycle event should update the matching Cloudflare Stream `VideoAsset` to `READY`, set `processingEndedAt`, and update `providerSyncedAt`. Admin video details should show ready status. | Repository evidence from X3-FIX-004/X3-FIX-003 documents mapping and admin status surfaces; no live production event captured. |
| Failed/unavailable | Valid `error` lifecycle event should update the matching asset to `FAILED`, set `processingEndedAt`, update `providerSyncedAt`, and capture failure reason when present. Admin diagnostics from X3-FIX-007 recognize `FAILED` as a migration/status signal. | Repository evidence documents expected behavior; no live failed/unavailable event captured. |

## Blockers

Production certification is blocked by external access/evidence gaps in this agent session:

- No Cloudflare dashboard access to verify account id, API token scope, webhook secret presence, endpoint URL, selected lifecycle events, or delivery attempts.
- No Vercel Production environment access to verify `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, or `CLOUDFLARE_WEBHOOK_SECRET` presence/scope without revealing values.
- No Vercel Production logs access to verify webhook delivery status or invalid/unsigned probe responses.
- No confirmed canonical production webhook URL from a live dashboard screenshot/export.
- No disposable production test asset available to trigger Stream lifecycle events.
- No operator ability in this session to trigger a Cloudflare Stream upload/import/lifecycle event.

## Exact owner/operator actions required

1. Confirm canonical production origin for launch, e.g. `https://polutek.pl` if owner-approved.
2. In Vercel Dashboard → Polutek.pl project → Settings → Environment Variables, verify Production has `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_WEBHOOK_SECRET`.
3. Confirm none of the Cloudflare variables are public `NEXT_PUBLIC_` variables.
4. Run or otherwise use `scripts/validate-vercel-production-env.mjs` per LAUNCH-FIX-001 process and record only group-level present/missing output.
5. In Cloudflare dashboard, confirm the Stream webhook URL is `https://<canonical-production-domain>/api/webhooks/cloudflare-stream`.
6. Confirm the Cloudflare webhook secret configured in the dashboard corresponds to Vercel Production `CLOUDFLARE_WEBHOOK_SECRET` without exposing the value.
7. Confirm the API token is account-scoped and Stream-scoped for upload/import/status workflows required at launch.
8. Confirm Vercel Deployment Protection or preview protection does not block provider webhook calls to the production endpoint.
9. Trigger a disposable Stream asset lifecycle event through admin upload/import/attach workflow or Cloudflare dashboard.
10. Capture Cloudflare delivery evidence: timestamp, event type/status, redacted asset/event id, endpoint URL, and delivery status code.
11. Capture Vercel evidence: production function log for the webhook POST and accepted status.
12. Capture app/admin evidence: the matching asset enters processing and then ready, or failed if intentionally tested.
13. Send one safe unsigned/invalid probe without secrets and confirm `401` with no asset mutation.
14. Store evidence in a follow-up reconciliation report or append operator notes to this report according to repo workflow.

## What did not change

- No runtime code changed.
- No webhook route changed.
- No middleware changed.
- No environment variable names changed.
- No scripts added or modified.
- No tests, schema, package files, roadmap, strategy docs, README, or AGENTS.md changed.
- No live Cloudflare API calls were made by code or by this agent.
- No secrets were printed or committed.

## Risks/gaps

- Production env presence is not enough: Cloudflare dashboard URL, token scope, secret matching, and delivery success still need live evidence.
- Repository test evidence does not prove Vercel Deployment Protection, auth middleware, DNS, provider dashboard configuration, or current production env values.
- A production deployment may need redeploy after env changes before webhook functions see current values.
- Manual probes must be careful not to include valid secrets or real asset identifiers in committed logs.
- X3-FIX-008 is parallel work for importing/attaching existing legacy video and was not touched by this ticket.

## Recommended next execution order

1. Complete this docs-only PR merge after review if the owner accepts the external blocker documentation.
2. Owner/operator performs the runbook using Cloudflare and Vercel dashboard access.
3. If production evidence passes, run `LAUNCH-FIX-006-admin-cloudflare-upload-import-smoke-test` to prove end-to-end admin upload/import behavior.
4. After Cloudflare webhook readiness is evidenced, run `LAUNCH-FIX-004-video-access-and-token-leak-smoke-test` to prove allowed/denied playback behavior in production.
5. Continue payment/access/comment production smoke tickets in the order documented by launch ops inventory.

## Scope confirmation

Allowed paths touched:

- `docs/reports/reconciliation/**`
- `docs/operations/**`

Forbidden paths untouched:

- `lib/**`
- `app/**`
- `components/**`
- `tests/**`
- `prisma/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `AGENTS.md`
- `scripts/**`
- `docs/roadmap/**`
- `docs/strategy/**`

## Validation results

- `git diff --cached --check`: Passed.
- `git diff --cached --name-only` forbidden-path review: Passed; only `docs/reports/reconciliation/**` and `docs/operations/**` changed.

No runtime tests were required or run for this docs-only ticket.

## Merge recommendation

**MERGE** for the docs-only PR because it creates precise, secret-safe production verification artifacts and documents exact external blockers.

**Production launch remains BLOCKED for Cloudflare Stream webhook readiness** until an owner/operator with Cloudflare dashboard, Vercel production env, production logs, and a test asset captures the live evidence listed above.
