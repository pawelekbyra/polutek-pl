# Launch-candidate critical-path rehearsal runbook

Status: `IMPLEMENTED_UNVERIFIED` until executed by the owner/operator against a named preview or production-like deployment.

This runbook is secret-safe and must use only test accounts, Stripe test mode unless explicitly owner-approved otherwise, redacted logs, and redacted screenshots.

## Preconditions

Record before starting:

| Field | Value |
| --- | --- |
| Date/time |  |
| Environment name |  |
| Deployment URL |  |
| Main SHA |  |
| Operator |  |
| Stripe mode | Test mode / approved production-safe procedure |
| Cloudflare asset | Redacted test asset reference |
| Non-patron test account | Redacted test account |
| Patron/test-support account | Redacted test account |
| READY Cloudflare test video | Redacted video slug/id |
| PROCESSING/non-ready test video | Redacted video slug/id, only if safe |
| Admin diagnostics access confirmed | Yes/No |
| Redacted log access confirmed | Yes/No |

Required setup:

- Deployment URL is reachable.
- `/api/health` is expected to return healthy status.
- One logged-out browser profile is available.
- One logged-in non-patron test account exists.
- One support account can make qualifying Stripe test support.
- One READY Cloudflare Stream test video exists and is patron-gated.
- One PROCESSING or intentionally non-ready test video exists where safe.
- Stripe webhook test delivery can be observed without exposing webhook signing secrets.
- Admin diagnostics can show redacted Payment, PatronGrant, cache and Subscription distinctions.

## Evidence fields for every step

For each step below, record:

| Field | Value |
| --- | --- |
| Date/time |  |
| Environment |  |
| Main SHA |  |
| Operator |  |
| Expected result |  |
| Actual result |  |
| Status | PASS / FAIL / BLOCKED |
| Redacted screenshot/log reference |  |
| Blocker/follow-up |  |

## Manual flow

1. Confirm deployment and `/api/health`.
2. Confirm guest locked state on patron video.
3. Confirm logged-in non-patron locked state on patron video.
4. Confirm browser network tools show no player/source/token request on denied path.
5. Execute qualifying Stripe test support using the approved test account.
6. Confirm verified Stripe webhook delivery in redacted Stripe/admin logs.
7. Confirm a Payment financial fact exists for the support event.
8. Confirm exactly one active linked PatronGrant exists for that Payment.
9. Confirm patron access derives from active PatronGrant truth.
10. Confirm READY Cloudflare signed playback resolves only after access is allowed.
11. Confirm no token, full signed playback URL, private provider ID or private media detail appears in visible UI or copied logs.
12. Confirm a real playback session/view is created only after playback starts and reaches the view-count boundary.
13. Confirm PROCESSING/non-ready video shows a safe blocked state and no source/token request.
14. Trigger a Stripe dispute-opened test transition and confirm linked access is suspended.
15. Trigger same-dispute won and confirm only the same temporary dispute suspension is cleared.
16. Trigger full refund and confirm the linked grant is revoked.
17. Confirm later dispute-won cannot revive refunded or manually revoked access.
18. Confirm paid-but-locked diagnostics distinguish Payment fact, PatronGrant truth, User cache and Subscription/newsletter signals.
19. Confirm admin grant/revoke dialog requires non-empty reason and explicit confirmation; cancel sends no request; pending state blocks duplicate submit; revoke is destructive.
20. Confirm rollback/escalation path: identify owner contact, deployment rollback option, Stripe/Cloudflare support escalation, and incident log destination.

## Secret-safe evidence rules

Never capture or commit:

- Stripe secret keys.
- Stripe webhook signing secrets.
- Cloudflare API tokens.
- Full signed playback URLs.
- Playback tokens/JWTs.
- Customer payment details.
- Full email addresses unless test-only and redacted.
- Private provider asset identifiers unless redacted.
- Database connection strings.

Allowed evidence examples:

- Redacted screenshots where tokens, IDs, emails and payment details are masked.
- Log excerpts with request IDs and status names but without secrets or private provider IDs.
- Admin diagnostics screenshots with test account names/emails redacted.
- Stripe test-mode event IDs only when redacted according to owner policy.

## Completion criteria

The runbook is complete only when every manual step has a status, evidence reference, and blocker/follow-up if not passing. Completion of this runbook does not by itself certify public launch; X7 launch evidence and owner certification remain separate.
