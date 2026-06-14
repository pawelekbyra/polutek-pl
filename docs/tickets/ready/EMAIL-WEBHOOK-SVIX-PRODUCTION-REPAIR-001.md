# EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001 — Repair Resend production Svix webhook authentication

Status: MERGED / IMPLEMENTATION_COMPLETE / VERIFICATION_PENDING / HISTORICAL
Ticket ID: EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001
Role: Builder / Historical implementation evidence
Launch status: NO_GO

## Executability

This ticket is non-executable implementation evidence after PR #914. It preserves the original requirements and acceptance criteria for historical traceability. Independent post-merge verification is pending and is queued separately as `EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001`.

## Control-plane provenance

- Created by post-PR-#912 control-plane reconciliation.
- Source verification ticket: `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001`.
- Source verification verdict: `FIX_REQUIRED`.
- Evidence report: `docs/reports/verification/EMAIL-WEBHOOK-POSTMERGE-VERIFY-001.md`.
- Verification PR: PR #912.
- Verification merge SHA: `844f0ffcf26f41aeacef4fde1c21edd0a544fb4a`.
- Implementation PR: PR #914.
- Implementation merge SHA: `fe56413d6c97bf0b7bededb3d2e1bc173e3125c8`.
- Independent verification: pending.
- Implementation status: `MERGED / IMPLEMENTATION_COMPLETE / VERIFICATION_PENDING / HISTORICAL`.
- Public launch remains `NO_GO`.

## Purpose

Repair the security defects identified by the independent verification merged in PR #912. The implementation must require valid Svix authentication for the Resend webhook in production and must prevent the legacy `x-resend-webhook-secret` compatibility path from authenticating production requests.

## Required runtime behavior

The Builder implementation must:

1. Require valid Svix authentication for the Resend webhook in production.
2. Ensure `x-resend-webhook-secret` cannot authenticate a production request, even when:
   - the legacy secret matches,
   - a forged `svix-id` is supplied,
   - Svix timestamp/signature headers are missing or invalid.
3. Keep any legacy compatibility path strictly outside production.
4. Do not fall back to legacy authentication when any incomplete or invalid Svix header set is supplied.
5. Handle malformed JSON on any permitted legacy non-production path with a controlled `400` response.
6. Ensure the webhook handler is not called for rejected requests.
7. Preserve valid Svix webhook processing and event-ID assignment.
8. Avoid exposing secrets, raw signatures or sensitive payloads in logs and responses.

## Expected implementation scope

Expected runtime paths:

```txt
app/api/webhooks/resend/route.ts
tests/unit/api/resend/resend-webhook-route.test.ts
```

Additional directly relevant test files may be used only when necessary.

## Required implementation tests

Add or update route tests proving:

- production + matching legacy secret + forged `svix-id` + no valid Svix signature → `401`,
- production + matching legacy secret without Svix authentication → `401`,
- production + partial Svix headers → `401`,
- production + invalid Svix signature → `401`,
- valid complete Svix signature → accepted and handler called once,
- malformed permitted non-production legacy JSON → controlled `400`,
- rejected requests never call `handleResendWebhook`,
- non-production legacy compatibility works only where explicitly permitted.

## Forbidden changes

The repair must not include database, Prisma migration or unrelated quality-baseline repairs.

Forbidden unrelated changes:

```txt
prisma/**
package.json
package-lock.json
.github/**
docs unrelated to this ticket
unrelated app/**
unrelated lib/**
```

## Acceptance criteria

- Production requests are accepted only after valid complete Svix authentication.
- Legacy `x-resend-webhook-secret` authentication cannot authenticate production requests.
- Incomplete or invalid Svix header sets fail closed and do not fall back to legacy authentication.
- Malformed JSON on any permitted non-production legacy path receives a controlled `400` response.
- Rejected requests do not call `handleResendWebhook`.
- Valid Svix webhook processing and event-ID assignment continue to work.
- Tests cover all required cases listed in this ticket.
- Public launch remains `NO_GO` unless a later owner-approved launch-certification process changes it.
