# Active Execution Roadmap — Current Main Reconciled

Status: `ACTIVE — CURRENT-MAIN RECONCILED`

This roadmap describes current execution status after `DOCS-RECONCILE-001`. It separates merged implementation, automated verification, production/manual verification and formal certification.

## Status vocabulary

Use only these shared truth statuses in current-state summaries:

- `IMPLEMENTED_VERIFIED`: implementation exists and relevant automated/local evidence was found or rerun.
- `IMPLEMENTED_UNVERIFIED`: implementation exists, but current task did not rerun enough proof or production/manual proof is missing.
- `PARTIAL`: some scope exists, but material gaps remain.
- `MISSING`: required scope/evidence is absent.
- `BLOCKED`: cannot proceed without merge/access/fix.
- `OWNER_DECISION_REQUIRED`: owner must decide before implementation/certification.
- `DEFERRED_POST_LAUNCH`: explicitly not launch-critical.
- `NOT_APPLICABLE`: not relevant to this phase/domain.

`DONE`, `CERTIFIED`, `LAUNCH_READY`, and similar labels are not used unless a certification report proves them.

## Current source-of-truth rule

- Implementation truth: current code/tests on current main.
- Product-policy truth: `AGENTS.md` and `docs/strategy/OWNER-DECISIONS.md`.
- Execution-status truth: this roadmap, root `README.md`, `docs/roadmap/OWNER-TIMELINE.md`, and ticket queue indexes.
- Target/specification truth: specs, Product Standard, Phase Gates, Blueprint.
- Historical evidence: PR bodies, reports and audits from their original point in time.

```txt
Target architecture != current implementation.
```

## Canonical phase/domain mapping

| Current phase | Canonical domain | Notes / aliases |
| --- | --- | --- |
| X0 | Control plane and source-of-truth reconciliation | Historical activation/inventory work is superseded by current reconciliation. |
| X0.5 | Product standard and owner decisions | Product Standard exists; owner questions remain open. |
| X1 | Payments / patron lifecycle | Includes payment eligibility, `Payment`, `PatronGrant`, refunds/disputes and audit. |
| X2 | Access / PatronGrant truth | Active `PatronGrant` is backend access truth; cache mismatch handling remains diagnostic. |
| X3 | Video provider foundation | Cloudflare Stream foundation, upload/import/webhook lifecycle and legacy cutoff. |
| X4 | PlaybackPlan / player safety | Current canonical X4 is playback/player. Historical `X4-*` comments reports are historical lane IDs. |
| X5 | Admin cockpit / diagnostics | Support diagnostics, not a vanity dashboard. |
| X6 | Product Excellence passes | Standard exists; passes not executed/certified. |
| X7 | Launch Evidence Pack / final certification | Evidence pack incomplete; public launch not certified. |

Future tickets must use the canonical domain in the title, for example `X4-PLAYBACK-*` for playback/player and `COMMENTS-*` or a lane-qualified ID for comments work, to avoid the historical X4 collision.

## Phase status dashboard

| Phase | Correct status | Merged implementation evidence | Automated evidence | Production/manual evidence | Formal certification | Next executable ticket |
| --- | --- | --- | --- | --- | --- | --- |
| X0 | `IMPLEMENTED_VERIFIED` | Control plane docs, ticket/report structure and reconciliation report exist. | `git diff --check`, docs searches in `DOCS-RECONCILE-001`. | Not applicable beyond owner review. | Not certified as a phase; current docs reconciled. | None; historical X0 tickets are superseded. |
| X0.5 | `IMPLEMENTED_VERIFIED` with open questions | Product Standard and owner decisions exist. | Docs consistency searches. | Owner questions remain. | Not certified. | Owner decisions only as needed. |
| X1 | `PARTIAL` | Payment fulfillment, eligibility policy, Stripe ledger, full refund handling and dispute-lost revocation exist on main. PR #871 remains open for dispute suspension/reactivation hardening. | Payment/access smoke reports and focused tests exist; current reconciliation did not claim #871-only tests. | Production Stripe lifecycle proof incomplete. | Not certified. | Resolve/merge/fix PR #871 or create a follow-up if it is rejected. |
| X2 | `IMPLEMENTED_VERIFIED` for core access truth; `IMPLEMENTED_UNVERIFIED` for production proof | `checkVideoAccess` reads active `PatronGrant`; cache/Clerk are diagnostics. | Access tests and PatronGrant-backed comments/access tests exist. | Production paid/locked diagnostics proof incomplete. | Not certified. | Production access diagnostic proof after X1 lifecycle is stable. |
| X3 | `IMPLEMENTED_VERIFIED` for local foundation; `IMPLEMENTED_UNVERIFIED` for production provider proof | `VideoAsset`, Cloudflare upload/import/webhook lifecycle, legacy private fallback cutoff and signed playback runtime are merged. | Video and media-source tests plus reports through PR #870. | Production Cloudflare upload/import/webhook/playback proof incomplete. | Not certified. | Production Cloudflare E2E evidence after environment access. |
| X4 | `IMPLEMENTED_VERIFIED` for playback safety; comments aliases historical | PlaybackPlan/player fail-closed behavior and session-after-resolution ordering are merged. | Media-source route and safety tests exist. | Production playback proof incomplete. | Not certified. | Production playback evidence, not a rewrite. |
| X5 | `PARTIAL` | Admin payment/video/comment/health surfaces and runbooks exist. | Admin and module tests exist. | Owner support usability proof incomplete. | Not certified. | Admin diagnostics usability inventory/proof after X6 inventory. |
| X6 | `MISSING` execution / `IMPLEMENTED_VERIFIED` standard | Product Excellence standard and phase gates exist. | Docs validation only. | X6.1-X6.8 evidence not executed. | Not certified. | `docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md`. |
| X7 | `MISSING` evidence pack | Launch readiness spec and evidence-pack standard exist. | Docs validation only. | X7 Launch Evidence Pack incomplete. | Public launch not certified. | After X6 and production evidence blockers. |

## Active blockers and owner decisions

| Area | Status | Blocker / owner action |
| --- | --- | --- |
| PR #871 | `BLOCKED` | Open/pending merge; do not claim its runtime changes on main. |
| Partial refund policy | `OWNER_DECISION_REQUIRED` | Preserve existing open question; do not resolve by agent. |
| Legal/privacy/cookies/support copy | `OWNER_DECISION_REQUIRED` | Required before X7. |
| Alert channels/thresholds/RPO/RTO | `OWNER_DECISION_REQUIRED` | Required before production certification. |
| Cloudflare cost/retention/original preservation | `OWNER_DECISION_REQUIRED` | Required before launch operations signoff. |
| Production environment/provider proof | `PARTIAL` | Requires owner/operator access and redacted evidence. |
| Backup/restore | `MISSING` | Ticket exists; drill evidence required. |

## Current recommended next ticket

```txt
docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md
```

Reason: current main has enough merged payments/access/video/comments foundations to begin a docs/inventory-only X6.1 UI consistency pass, while PR #871 remains tracked separately as the payment lifecycle blocker and no new runtime work should be hidden inside a reconciliation PR.
