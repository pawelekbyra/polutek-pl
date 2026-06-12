# Active Execution Roadmap — Current Main Reconciled

Status: `ACTIVE — CURRENT-MAIN RECONCILED`

This roadmap describes current execution status after `DOCS-RECONCILE-002`. It separates merged implementation, automated verification, production/manual verification and formal certification.

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

| Phase | Correct status | Merged implementation evidence | Automated/Local evidence | Production/operator evidence | Formal certification | Next executable ticket |
| --- | --- | --- | --- | --- | --- | --- |
| X0 | `IMPLEMENTED_VERIFIED` | Control plane docs, ticket/report structure and reconciliation reports exist. | `git diff --check`, docs searches. | Not applicable beyond owner review. | Not certified as a phase; current docs reconciled. | None; historical X0 tickets are superseded. |
| X0.5 | `IMPLEMENTED_VERIFIED` | Product Standard and owner decisions exist. | Docs consistency searches. | Owner questions remain. | Not certified. | OWNER-LAUNCH-DECISIONS-001. |
| X1 | `PARTIAL` | Payment fulfillment, eligibility policy, Stripe ledger, full refund handling and dispute suspension/reactivation exist on main. | Payment/access smoke reports and focused tests exist. | Production Stripe lifecycle proof incomplete. | Not certified. | Production Stripe smoke test. |
| X2 | `PARTIAL` | `checkVideoAccess` reads active `PatronGrant`; cache/Clerk are diagnostics. | Access tests and PatronGrant-backed comments/access tests exist. | Production paid/locked diagnostics proof incomplete. | Not certified. | Production access diagnostic proof. |
| X3 | `PARTIAL` | `VideoAsset`, Cloudflare upload/import/webhook lifecycle, signature hardening and signed playback runtime are merged. | Video and media-source tests and security checks. | Production Cloudflare upload/import/webhook/playback proof incomplete. | Not certified. | Production Cloudflare E2E evidence. |
| X4 | `PARTIAL` | PlaybackPlan/player fail-closed behavior, clear state messaging, and session-after-resolution ordering are merged. | Media-source route and safety tests exist. | Production playback proof incomplete. | Not certified. | Production playback evidence. |
| X5 | `PARTIAL` | Admin payment/video/comment/health surfaces and support diagnostics exist. | Admin and module tests exist. | Owner support usability proof incomplete. | Not certified. | Admin diagnostics usability inventory. |
| X6 | `PARTIAL` | X6.1 inventory complete; admin action confirmation and safety hardening merged. | Docs validation and UI tests. | X6.2-X6.8 passes not executed/certified. | Not certified. | OWNER-LAUNCH-DECISIONS-001. |
| X7 | `MISSING` | Launch readiness spec and evidence-pack standard exist. | Docs validation only. | X7 Launch Evidence Pack incomplete; legal/email gaps documented. | Public launch not certified. | After production evidence blockers. |

## Legal and Email Gaps (Launch Blockers)

The following areas are currently unaddressed and represent significant risks for public launch:

- **Privacy Policy**: Missing full list of actual providers (Stripe, Clerk, Cloudflare, Resend, etc.).
- **Unsubscribe**: Lack of a public, secure, token-based unsubscribe landing page for emails.
- **Suppression**: Global bounce/complaint suppression not yet proven in production.
- **Marketing Consent**: Risk of re-enabling marketing emails without explicit user preference record.
- **Partial Refund Policy**: Owner decision required on whether partial refunds affect PatronGrant status.
- **Terms of Service**: Discrepancy between current `PatronGrant` policy (permanent) and public terms (subscription-like wording).

## Active blockers and owner decisions

| Area | Status | Blocker / owner action |
| --- | --- | --- |
| Partial refund policy | `OWNER_DECISION_REQUIRED` | Preserve existing open question; do not resolve by agent. |
| Legal/privacy/cookies/support copy | `OWNER_DECISION_REQUIRED` | Required before X7. |
| Email unsubscribe/suppression | `OWNER_DECISION_REQUIRED` | Compliance/compliance blocker. |
| Alert channels/thresholds/RPO/RTO | `OWNER_DECISION_REQUIRED` | Required before production certification. |
| Cloudflare cost/retention/original preservation | `OWNER_DECISION_REQUIRED` | Required before launch operations signoff. |
| Production environment/provider proof | `OPERATOR_PENDING` | Requires owner/operator access and redacted evidence. |
| Backup/restore drill | `OPERATOR_PENDING` | Tooling exists; operator drill evidence required. |

## Current recommended next ticket

```txt
OWNER-LAUNCH-DECISIONS-001 — Consolidate launch-blocking owner decisions
```

Reason: foundations for payments, access, video, and admin safety are merged. Work now moves toward consolidating launch-blocking owner decisions and collecting production evidence.
