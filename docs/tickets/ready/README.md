# Ready Ticket Queue

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE
Launch status: NO_GO

This index is the sole source for the next executable ticket. Dashboards, roadmaps, timelines, reports and historical ticket files may link here, but they must not maintain an independent current-ticket pointer.

<!-- CONTROL_PLANE_CURRENT_TICKET_ID: ADMIN-AUTH-ACTOR-CANONICALIZATION-001 -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: docs/tickets/ready/ADMIN-AUTH-ACTOR-CANONICALIZATION-001.md -->

## Current Execution Gate

The project is governed by the **Bolek Operating Model**. For state and risk details, see:
- [Technical Masterplan](../../MASTERPLAN.md)
- [Bolek Operating Model](../../governance/BOLEK-OPERATING-MODEL.md)

## Current Control-Plane Ticket

```txt
ADMIN-AUTH-ACTOR-CANONICALIZATION-001
```

| Role | Ticket | File | Status |
| --- | --- | --- | --- |
| Builder | ADMIN-AUTH-ACTOR-CANONICALIZATION-001 | `docs/tickets/ready/ADMIN-AUTH-ACTOR-CANONICALIZATION-001.md` | `READY_FOR_BUILDER` |

**Current Status:** Signed unsubscribe implementation and verification are complete: PR #918 implemented `EMAIL-SIGNED-UNSUBSCRIBE-001`, and PR #920 independently verified it `PASS` with verification merge SHA `77081b64073ec77bf1df13217622a0f88d118011`. Admin auth actor canonicalization is the urgent current repair in `ADMIN-AUTH-ACTOR-CANONICALIZATION-001`. The explicit sequence is auth canonicalization → admin video repair → bounce/complaint suppression. Admin video repair remains urgent but non-executable until auth is implemented, independently verified PASS and reconciled. Bounce/complaint suppression remains deferred and non-executable until video repair is implemented, independently verified PASS and reconciled. Public launch remains `NO_GO`.

Only the row above is the current-primary executable row. Priority: **URGENT**. Executable ticket count: **1**. Next planned ticket: `ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001`; then `EMAIL-BOUNCE-COMPLAINT-SUPPRESSION-001`.

## Historical executable tickets

| Ticket | Status | Evidence |
| --- | --- | --- |
| EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001 | `PASS / VERIFICATION_COMPLETE / MERGED / HISTORICAL` | Verification PR #920; verification merge SHA `77081b64073ec77bf1df13217622a0f88d118011`; report: `docs/reports/verification/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md` |
| EMAIL-SIGNED-UNSUBSCRIBE-001 | `MERGED / IMPLEMENTATION_COMPLETE / VERIFIED_PASS / HISTORICAL` | Implementation PR #918; implementation merge SHA `5710d14f82f5951c13d8d77f6a8eb4d899068c4b`; verified PASS by PR #920; verification merge SHA `77081b64073ec77bf1df13217622a0f88d118011`; report: `docs/reports/verification/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md` |
| EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001 | `PASS / VERIFICATION_COMPLETE / MERGED / HISTORICAL` | Verification PR: PR #916; verification merge SHA `62548c01cf2df66b88d608ebc751e68871b0ff3d`; report: `docs/reports/verification/EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001.md` |
| EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001 | `MERGED / IMPLEMENTATION_COMPLETE / VERIFIED_PASS / HISTORICAL` | PR #914; merge SHA `fe56413d6c97bf0b7bededb3d2e1bc173e3125c8`; verified by PR #916; verification merge SHA `62548c01cf2df66b88d608ebc751e68871b0ff3d`; report: `docs/reports/verification/EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001.md` |
| EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 | `FIX_REQUIRED / VERIFICATION_COMPLETE / HISTORICAL` | PR #912; merge SHA `844f0ffcf26f41aeacef4fde1c21edd0a544fb4a` |
| PAYMENT-WEBHOOK-RESULT-001 | `MERGED / HISTORICAL` | PR #902; merge SHA `2c2a0f01f71e177145336051e97680bcc489e2b9` |
| EMAIL-WEBHOOK-IDEMPOTENCY-001 | `MERGED / VERIFIED_FIX_REQUIRED` | PR #905; verification PR #912; merge SHA `36b57dec5c763ca29ff708c836dae0601125c49d` |
| LAUNCH-EMAIL-003 | `MERGED / ACCEPTED` | PR #899; merge SHA `f7fc603183120895359e9e52464de2d01e100980` |
| OWNER-LAUNCH-DECISIONS-001 | `MERGED / HISTORICAL` | PR #890; corrective PR #891 |

`docs/tickets/ready/EMAIL-SIGNED-UNSUBSCRIBE-001.md` is retained as non-executable historical verified implementation evidence only. It is not the current executable ticket. PR #918 implemented it under merge SHA `5710d14f82f5951c13d8d77f6a8eb4d899068c4b`; PR #920 independently verified it PASS under verification merge SHA `77081b64073ec77bf1df13217622a0f88d118011`.

`docs/tickets/ready/EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001.md` is retained as non-executable implementation evidence only. It is not the current executable ticket and has independent verification status `VERIFIED_PASS` from PR #916.

`docs/tickets/ready/PAYMENT-WEBHOOK-RESULT-001.md` is retained as historical evidence only. It is not the current executable ticket.

`docs/tickets/ready/EMAIL-WEBHOOK-POSTMERGE-VERIFY-001.md` is retained as historical verification evidence only. It is not the current executable ticket.

`docs/tickets/ready/OWNER-LAUNCH-DECISIONS-001-consolidate-launch-blocking-decisions.md` is retained as historical evidence only. It is not the current executable ticket.

## Closed owner-decision blockers

Product decisions recorded on 2026-06-12 must not be reclassified as waiting for owner decision. Follow-up work uses the correct status per file/workstream:

| Area | Current classification |
| --- | --- |
| Legal/privacy/cookies/support copy | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` |
| Email/content notifications runtime boundary | `IMPLEMENTATION_MISSING` |
| Partial refund runtime handling | `IMPLEMENTATION_MISSING` |
| RPO/RTO and alert channel evidence | `OPERATOR_PENDING` |
| Cloudflare originals/retention evidence | `OPERATOR_PENDING` |
| Reactions/hearts launch scope | `HISTORICAL / NOT_LAUNCH_CRITICAL` |
| Superseded legacy owner-question prompts | `SUPERSEDED / HISTORICAL` |

Do not mark older runtime tickets as READY without a later Integrator/queue reconciliation.

## Full backlog

Full non-executable launch backlog:
`docs/roadmap/Launch-Execution-Backlog.md`

## Guardrails

- Public launch remains `NO_GO`.
- Guard PASS means control-plane consistency only; it is not legal compliance or production/operator evidence.
- Runtime work must not start from any ticket other than the single current executable ticket declared above.
