# Ready Ticket Queue

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE
Launch status: NO_GO

This index is the sole source for the next executable ticket. Dashboards, roadmaps, timelines, reports and historical ticket files may link here, but they must not maintain an independent current-ticket pointer.

<!-- CONTROL_PLANE_CURRENT_TICKET_ID: X3-FIX-003 -->
<!-- CONTROL_PLANE_CURRENT_TICKET_FILE: docs/tickets/ready/X3-FIX-003-admin-cloudflare-upload-and-asset-status.md -->

## Current Control-Plane Ticket

```txt
X3-FIX-003
```

| Role | Ticket | File | Status |
| --- | --- | --- | --- |
| Builder | X3-FIX-003 | `docs/tickets/ready/X3-FIX-003-admin-cloudflare-upload-and-asset-status.md` | `READY` |

**Current Status:** Public launch remains `NO_GO`. Launch diagnostics/operator evidence remains tracked separately by #951/#956/#960, but the current single executable runtime ticket is now the admin Cloudflare upload and asset-status repair. This owner-directed control-plane move unblocks product-critical video creation work needed to populate homepage/channel/sidebar inventory.

Only the row above is the current-primary executable row. Priority: **Launch-critical**. Executable ticket count: **1**.

## Ordered repair queue

1. `X3-FIX-003` — `READY`
2. `LAUNCH-CERTIFICATION-AFTER-CI-DEBT-CLOSURE-001` — `READY_FOR_INDEPENDENT_REVIEW / OPERATOR_EVIDENCE_PENDING`
3. `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001` — `PLANNED`
4. `CLOUDFLARE-PRODUCTION-ASSET-PRIVACY-VERIFY-001` — `BLOCKED_OPERATOR_ACCESS`
5. `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001` — `PLANNED`
6. `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001` — `PLANNED`
7. `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001` — `PLANNED`
8. `ADMIN-VIDEO-POSTMERGE-VERIFY-001` — `PLANNED`
9. `ADMIN-AUTH-POSTMERGE-REVERIFY-001` — `PLANNED`
10. `LEGACY-ACCESS-POLICY-RETIREMENT-001` — `PLANNED`
11. `ADMIN-CHANNEL-ROOT-CAUSE-001` — `PLANNED`
12. `LEGACY-MEDIA-PROXY-RETIREMENT-001` — `PLANNED`
13. `CONTROL-PLANE-GUARD-HARDENING-001` — `NON_EXECUTABLE / PLANNED`
14. `BETA-SCOPE-GUARD-RECONCILIATION-001` — `NON_EXECUTABLE / PLANNED`

## Historical executable tickets

Detailed historical ticket/PR status is preserved in `docs/tickets/HISTORICAL-LEDGER.md`.

| Ticket | Status | Evidence |
| --- | --- | --- |
| SECURITY-DEPENDENCY-REMEDIATION-001 | `IMPLEMENTATION_MERGED / HIGH_AUDIT_FINDINGS_ZERO / HISTORICAL` | PR #946; later CI/security checks also passed during #953. |
| COVERAGE-BASELINE-DEBT | `IMPLEMENTATION_MERGED / HISTORICAL` | PR #953, merge `50697d2bdc62f9eb1acc7e635fe3053c332726e8`. |
| HOTSPOT-CI-DEBT | `IMPLEMENTATION_MERGED / HISTORICAL` | PR #950, merge `14aedd4818970611365ad941764d775b7727ec37`. |
| EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001 | `PASS / VERIFICATION_COMPLETE / MERGED / HISTORICAL` | Verification PR #920. |

## Closed owner-decision blockers

| Area | Current classification |
| --- | --- |
| Legal/privacy/cookies/support copy | `LEGAL_REVIEW_REQUIRED` |

## Full backlog

Full non-executable launch backlog: `docs/roadmap/Launch-Execution-Backlog.md`

## Guardrails

- Public launch remains `NO_GO`.
- Guard PASS means control-plane consistency only; it is not compliance or production/operator evidence.
- Runtime work must not start from any ticket other than the single current executable ticket declared above.
- `ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001` is a historical umbrella specification and may be used only as background evidence, not as a second concurrent executable ticket.
