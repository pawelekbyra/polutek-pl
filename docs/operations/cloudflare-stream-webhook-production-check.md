# Cloudflare Stream Webhook Production Check Runbook

## Purpose

Use this runbook to verify that Cloudflare Stream lifecycle events reach the Polutek.pl production app and update Cloudflare-backed `VideoAsset` state without exposing secrets.

This runbook is manual/ops-only. Do not call live Cloudflare APIs from repository code, do not add scripts, and do not commit secrets.

## Preconditions

- Owner-approved canonical production origin is known, for example `https://polutek.pl` if approved for launch.
- Operator has Vercel Production env access for the Polutek.pl project.
- Operator has Vercel Production logs access.
- Operator has Cloudflare dashboard access for the intended Stream account.
- Operator has access to an admin test video or a disposable production smoke-test video.
- Operator can upload/import/attach a safe test asset without exposing patron-only content.

## Secret redaction rules

- Never paste `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_WEBHOOK_SECRET` values into docs, PRs, tickets, screenshots, or chat.
- Record secrets as `present`, `missing`, `wrong scope`, `matches endpoint`, or `[REDACTED]` only.
- Treat `CLOUDFLARE_ACCOUNT_ID` as operationally sensitive; redact fully or show only the final 4 characters if owner policy permits.
- Redact asset UIDs and event IDs to final 4 characters unless owner explicitly approves full IDs for debugging.
- Remove query strings from URLs before committing screenshots or notes unless proven non-secret.

## Step 1 — Verify Vercel Production env

In Vercel Dashboard → Polutek.pl project → Settings → Environment Variables:

- Confirm `CLOUDFLARE_ACCOUNT_ID` exists in **Production**.
- Confirm `CLOUDFLARE_API_TOKEN` exists in **Production**.
- Confirm `CLOUDFLARE_WEBHOOK_SECRET` exists in **Production**.
- Confirm none of these variables are named with a `NEXT_PUBLIC_` prefix.
- Confirm values belong to the intended production Cloudflare account, not preview/staging/dev.
- If env was changed after the latest production deploy, redeploy production before continuing.

Optional repository-backed check:

- Run `scripts/validate-vercel-production-env.mjs` using the LAUNCH-FIX-001 process.
- Record only group-level output, e.g. `Cloudflare Stream: present`.
- Do not record env values.

Stop if any Cloudflare Production env is missing or wrong-scoped.

## Step 2 — Verify Cloudflare webhook endpoint

In Cloudflare dashboard, verify the Stream webhook configuration:

- Endpoint URL is `https://<canonical-production-domain>/api/webhooks/cloudflare-stream`.
- URL uses HTTPS.
- URL is not a Vercel preview URL, branch deployment URL, staging URL, localhost tunnel, or stale deployment URL.
- Webhook secret is configured and corresponds to Vercel Production `CLOUDFLARE_WEBHOOK_SECRET` without revealing either value.
- Lifecycle events needed by the app are enabled or observable: upload/processing, ready, and error/failure if available.

Stop if the dashboard endpoint cannot be verified or does not point to production.

## Step 3 — Verify route reachability is not blocked

Confirm production route accessibility for provider webhooks:

- Vercel Deployment Protection does not block `/api/webhooks/cloudflare-stream`.
- No password protection, SSO interstitial, bot challenge, or preview protection blocks Cloudflare.
- No browser-session auth is required; webhook trust comes from the configured webhook secret/signature.

Evidence to capture:

- Vercel settings note/screenshot showing production protection state, with unrelated sensitive project data cropped.
- Vercel log entry or request details once a real Cloudflare event is delivered.

## Step 4 — Trigger lifecycle event

Preferred safe path:

1. Open an admin test video record.
2. Generate a Cloudflare Stream direct upload URL or use the approved import/attach path if it is launch-scoped.
3. Upload a tiny safe test file or import a safe test source.
4. Watch the asset move through Cloudflare lifecycle states.
5. Wait for Cloudflare delivery to the production webhook endpoint.

Alternative path:

- Use a Cloudflare dashboard delivery/retry for a test asset if Cloudflare supports it and if the delivery payload does not expose secrets in captured evidence.

## Step 5 — Capture valid-event evidence

From Cloudflare dashboard, record:

- Endpoint URL: `https://<canonical-production-domain>/api/webhooks/cloudflare-stream`.
- Delivery timestamp with timezone.
- Delivery status code, expected `2xx` for accepted valid events.
- Lifecycle status/event type, e.g. processing/ready/error.
- Redacted asset UID/event id, e.g. `asset …abcd`, `event …7890`.
- Secret configured indicator, redacted.

From Vercel logs, record:

- Production request for `POST /api/webhooks/cloudflare-stream`.
- Timestamp matching Cloudflare delivery.
- Accepted status for valid event.
- Redacted request id/log id if useful.

From app/admin state, record:

- Test video identifier or title, redacted if needed.
- Cloudflare asset state observed in admin.
- `PROCESSING`/`UPLOADING` state evidence if visible.
- `READY` state evidence after successful processing.
- `FAILED` state/failure reason if intentionally testing a bad import/upload.
- `providerSyncedAt` or equivalent sync timestamp if visible.

## Step 6 — Capture invalid/unsigned evidence

Run a safe probe only after confirming it cannot mutate real state:

1. POST to `https://<canonical-production-domain>/api/webhooks/cloudflare-stream` without `cf-webhook-signature` and without any secret value.
2. Use a harmless minimal JSON body that does not include a real asset UID.
3. Expected result: `401` or equivalent unauthorized response.
4. Confirm no admin asset state changed.

Record only:

- Timestamp.
- Route path.
- Status code.
- Redacted request/log id.
- Confirmation that no asset mutation was observed.

Do not commit valid secrets, valid signatures, or real provider payloads.

## Step 7 — Acceptance checklist

Production Cloudflare Stream webhook readiness can be marked pass when all are true:

- [ ] `CLOUDFLARE_ACCOUNT_ID` present in Vercel Production, redacted.
- [ ] `CLOUDFLARE_API_TOKEN` present in Vercel Production, redacted.
- [ ] API token scoped to needed Cloudflare Stream account/workflows.
- [ ] `CLOUDFLARE_WEBHOOK_SECRET` present in Vercel Production, redacted.
- [ ] Cloudflare webhook URL uses canonical HTTPS production endpoint.
- [ ] Webhook URL is not preview/staging/local/stale.
- [ ] Deployment protection/auth does not block Cloudflare webhook POSTs.
- [ ] Valid lifecycle event receives `2xx` from production.
- [ ] Admin/app state reflects processing and ready transitions.
- [ ] Failed/unavailable path is evidenced if a safe failure test is available.
- [ ] Invalid/unsigned probe receives `401` or equivalent unauthorized response.
- [ ] No secrets are included in the evidence artifact.

## Failure handling

- Missing Vercel env: stop, add/fix env in Production, redeploy, rerun from Step 1.
- Wrong Cloudflare endpoint URL: stop, update dashboard to canonical production URL, rerun from Step 2.
- Delivery blocked by Vercel protection/auth: stop and fix production route reachability without weakening secret verification.
- Valid event returns non-2xx: inspect production logs, fix runtime in a separate runtime ticket if code behavior is wrong.
- Admin state does not update after accepted valid event: inspect asset UID matching and state mapping, then open a separate runtime/debug ticket.
- Invalid probe is accepted or mutates state: treat as launch-blocking security issue and open a runtime fix ticket immediately.
