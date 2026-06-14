# EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001 — Verify PR #914 Resend Svix production repair

Status: READY_FOR_INDEPENDENT_REVIEW
Ticket ID: EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001
Role: Reviewer / Certifier
Launch status: NO_GO

## Scope boundary

This is a read-only verification ticket.

The Reviewer / Certifier must perform:

```txt
read-only verification
no implementation
no repair
no production configuration changes
```

The Reviewer / Certifier must not commit runtime changes. A temporary uncommitted verification harness may be used when useful, but runtime, test, configuration, package, schema and production settings changes must not be committed as part of this ticket.

## Source implementation under review

- Source implementation ticket: `EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001`.
- Implementation PR: PR #914.
- Implementation merge SHA: `fe56413d6c97bf0b7bededb3d2e1bc173e3125c8`.
- Bolek implementation verdict: `MERGE`.
- Independent post-merge verification: pending.
- Public launch remains `NO_GO`.

The Reviewer / Certifier must not trust the Builder summary alone. The merged route and tests must be inspected directly on `main` at or after merge SHA `fe56413d6c97bf0b7bededb3d2e1bc173e3125c8`.

## Required verification scope

The Reviewer / Certifier must independently verify that:

1. `main` contains the reviewed PR #914 implementation.
2. Production accepts a Resend webhook only with a complete and successfully verified Svix header set:

   ```txt
   svix-id
   svix-timestamp
   svix-signature
   ```

3. Verification uses the raw request body with:

   ```txt
   Webhook.verify(...)
   ```

4. A valid Svix request assigns:

   ```txt
   payload.eventId = svix-id
   ```

5. `x-resend-webhook-secret` cannot authenticate a production request.
6. Matching legacy secret plus forged `svix-id` cannot bypass Svix authentication.
7. Partial Svix headers fail closed.
8. A Svix header present with an empty value fails closed.
9. Invalid complete Svix headers fail closed.
10. No incomplete or invalid Svix request falls back to legacy authentication in any environment.
11. The permitted non-production legacy path works only when:

    ```txt
    NODE_ENV is not production
    no Svix headers are present
    legacy secret matches
    ```

12. Malformed JSON on the permitted legacy path returns controlled `400`.
13. Rejected requests do not call:

    ```txt
    handleResendWebhook
    ```

14. Valid accepted requests call the handler exactly once.
15. Logs and responses do not expose:

    ```txt
    secrets
    raw signatures
    sensitive payloads
    verification exception contents
    ```

16. Existing targeted route tests pass.

## Required command

Run the targeted route test command:

```bash
npx vitest run tests/unit/api/resend/resend-webhook-route.test.ts
```

Expected current test count:

```txt
10 passed
```

Known unrelated repository baseline failures must be reported separately and must not be repaired or silently attributed to PR #914:

```txt
npm audit high
quality:strict-escapes
```

## Required verdict

The final evidence report must use exactly one verdict:

```txt
PASS
FIX_REQUIRED
BLOCKED
```

## Required evidence report

Create the verification evidence report at:

```txt
docs/reports/verification/EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001.md
```

The report must include:

- summary,
- inspected files and relevant findings,
- validation commands with results,
- explicit verdict from the required vocabulary,
- separation of PR #914 findings from unrelated baseline failures,
- confirmation that public launch remains `NO_GO`,
- any follow-up tickets required by the verdict.
