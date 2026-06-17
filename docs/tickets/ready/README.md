# Ready Ticket Queue

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE
Launch status: NO_GO

This index is the sole source for the next executable ticket. Dashboards, roadmaps, timelines, reports and historical ticket files may link here, but they must not maintain an independent current-ticket pointer.

<!-- CONTROL_PLANE_CURRENT_TICKET_ID: SECURITY-DEPENDENCY-REMEDIATION-001 -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: docs/tickets/ready/SECURITY-DEPENDENCY-REMEDIATION-001.md -->

## Current Control-Plane Ticket

```txt
SECURITY-DEPENDENCY-REMEDIATION-001
```

| Role | Ticket | File | Status |
| --- | --- | --- | --- |
| Builder | SECURITY-DEPENDENCY-REMEDIATION-001 | `docs/tickets/ready/SECURITY-DEPENDENCY-REMEDIATION-001.md` | `READY_FOR_BUILDER` |

**Current Status:** Post-PR #931/#932 reconciliation records CI visibility as restored with strict-escapes historical baseline active. Public launch remains `NO_GO`; security dependency remediation is now the single executable ticket. This is not `FULL_CI_PASS`, `SECURITY_PASS`, `PRODUCTION_CERTIFIED`, or `LAUNCH_READY`.

Only the row above is the current-primary executable row. Priority: **URGENT**. Executable ticket count: **1**.

## Ordered repair queue

1. `SECURITY-DEPENDENCY-REMEDIATION-001` — `READY_FOR_BUILDER`
2. `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001` — `PLANNED`
3. `CLOUDFLARE-PRODUCTION-ASSET-PRIVACY-VERIFY-001` — `BLOCKED_OPERATOR_ACCESS`
4. `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001` — `PLANNED`
5. `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001` — `PLANNED`
6. `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001` — `PLANNED`
7. `ADMIN-VIDEO-POSTMERGE-VERIFY-001` — `PLANNED`
8. `ADMIN-AUTH-POSTMERGE-REVERIFY-001` — `PLANNED`
9. `LEGACY-ACCESS-POLICY-RETIREMENT-001` — `PLANNED`
10. `ADMIN-CHANNEL-ROOT-CAUSE-001` — `PLANNED`
11. `LEGACY-MEDIA-PROXY-RETIREMENT-001` — `PLANNED`
12. `CONTROL-PLANE-GUARD-HARDENING-001` — `NON_EXECUTABLE / PLANNED`
13. `BETA-SCOPE-GUARD-RECONCILIATION-001` — `NON_EXECUTABLE / PLANNED`

## Historical executable tickets

Detailed historical ticket/PR status, including PRs #902, #905, #912 and #916 with FIX_REQUIRED, MERGED_UNVERIFIED, verification PRs and merge SHAs, is preserved in `docs/tickets/HISTORICAL-LEDGER.md`.


| Ticket | Status | Evidence |
| --- | --- | --- |
| ADMIN-AUTH-ACTOR-CANONICALIZATION-001 | `IMPLEMENTATION_MERGED / PREVIOUS_POSTMERGE_PASS_INCOMPLETE / REVERIFICATION_REQUIRED / HISTORICAL_IMPLEMENTATION_EVIDENCE` | PR #922, PR #923, and later PR #929 legacy AccessPolicy repair. |
| ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001 | `PARTIAL_IMPLEMENTATION_MERGED_IN_PR_926 / PROVIDER_RUNTIME_NOT_VERIFIED / CORRECTIVE_WORK_REQUIRED / HISTORICAL_UMBRELLA_SPEC` | PR #926 merged part of the umbrella scope; corrective tickets are split below. |
| EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001 | `PASS / VERIFICATION_COMPLETE / MERGED / HISTORICAL` | Verification PR #920. |
| EMAIL-SIGNED-UNSUBSCRIBE-001 | `MERGED / IMPLEMENTATION_COMPLETE / VERIFIED_PASS / HISTORICAL` | PR #918; verified by PR #920. |
| EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001 | `MERGED / IMPLEMENTATION_COMPLETE / VERIFIED_PASS / HISTORICAL` | PR #914; verified by PR #916. |
| LAUNCH-EMAIL-003 | `MERGED / ACCEPTED` | PR #899. |

## Closed owner-decision blockers

Product decisions recorded on 2026-06-12 must not be reclassified as waiting for owner decision.

| Area | Current classification |
| --- | --- |
| Legal/privacy/cookies/support copy | `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING` |
| Email/content notifications runtime boundary | `IMPLEMENTATION_MISSING` |
| Partial refund runtime handling | `IMPLEMENTATION_MISSING` |
| RPO/RTO and alert channel evidence | `OPERATOR_PENDING` |
| Cloudflare originals/retention evidence | `OPERATOR_PENDING` |
| Reactions/hearts launch scope | `HISTORICAL / NOT_LAUNCH_CRITICAL` |
| Superseded legacy owner-question prompts | `SUPERSEDED / HISTORICAL` |

## Full backlog

Full non-executable launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`

## Guardrails

- Public launch remains `NO_GO`.
- Guard PASS means control-plane consistency only; it is not legal compliance or production/operator evidence.
- Runtime work must not start from any ticket other than the single current executable ticket declared above.
- Do not use production Upload, Generate Upload URL, or Attach UID paths until later verified containment/lifecycle work permits them.
