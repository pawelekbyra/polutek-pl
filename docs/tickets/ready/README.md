# Ready Ticket Queue

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE
Launch status: NO_GO

This index is the sole source for the next executable ticket. Dashboards, roadmaps, timelines, reports and historical ticket files may link here, but they must not maintain an independent current-ticket pointer.

<!-- CONTROL_PLANE_CURRENT_TICKET_ID: LAUNCH-EMAIL-003 -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md -->

## Current Execution Gate

The project is governed by the **Bolek Operating Model**. For state and risk details, see:
- [Technical Masterplan](../../MASTERPLAN.md)
- [Bolek Operating Model](../governance/BOLEK-OPERATING-MODEL.md)

## Current executable ticket

```txt
LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior
```

| Role | Ticket | File | Status |
| --- | --- | --- | --- |
| Builder | LAUNCH-EMAIL-003 — Harden email consent boundary and Resend Audience runtime behavior | `docs/tickets/ready/LAUNCH-EMAIL-003-email-consent-boundary-runtime-hardening.md` | `NOT_ACCEPTED` |

**Status Note:** Implementation exists in branch `launch-email-003-corrective-17820333385633550787` but remains `NOT_ACCEPTED` pending independent review by Bolek.

Only the row above is the current-primary executable row.

## Historical owner-decision consolidation

| Ticket | Status | Evidence |
| --- | --- | --- |
| OWNER-LAUNCH-DECISIONS-001 | `MERGED / HISTORICAL` | PR #890; corrective PR #891 |

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
