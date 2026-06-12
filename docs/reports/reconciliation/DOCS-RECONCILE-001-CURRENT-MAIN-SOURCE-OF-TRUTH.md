# DOCS-RECONCILE-001 — Current Main Source of Truth (SUPERSEDED)

**Status: SUPERSEDED by [DOCS-RECONCILE-002-CURRENT-MAIN.md](./DOCS-RECONCILE-002-CURRENT-MAIN.md)**

## 1. Executive summary

Current `main` is not the obsolete X0-only baseline. It contains substantial merged foundations for payments/patron access, PatronGrant-backed access truth, Cloudflare Stream provider foundation, signed patron playback, hardened comments, admin/operations support documentation, and Product Excellence / Launch Proof standards.

This reconciliation updates documentation to reflect implementation without declaring production certification or public-launch readiness.

Current public-launch classification: `NO_GO` because X6 evidence, X7 Launch Evidence Pack, production/manual provider/payment evidence, legal copy, alert thresholds and backup/restore proof remain incomplete.

## 2. Baseline main SHA and date

- Date: 2026-06-12.
- Working branch: `work`.
- Baseline HEAD: `abfb20aae5cf5efb5de0bda3a4a39ad298c08939`.
- HEAD subject: `Merge pull request #872 from pawelekbyra/codex/integrate-product-excellence-and-launch-proof`.
- Working tree before edits: clean.
- Remote shell API access: unavailable; `git remote -v` returned no remote and `curl` to GitHub API failed with proxy `403 Forbidden`.
- Public GitHub HTML access: available for PR #871 and PR #868 classification.

## 3. Recent merged PRs

Local git history shows:

- #872 merged: Product Excellence and Launch Proof standard.
- #870 merged: Cloudflare signed playback runtime.
- #869 merged: production monitoring checklist, incident runbook and postmortem guidance.
- #867/#866/#864/#863/#861/#860/#859/#858 and related PRs merged prior Cloudflare/admin/comment/payment smoke evidence and runtime hardening.

## 4. Open/unmerged PRs

- #871 `Hardened Stripe Refund and Dispute PatronGrant Lifecycle`: `OPEN / PENDING MERGE` from public GitHub HTML. It proposes dispute suspension/reactivation and extra tests, but it is not current-main truth while unmerged. It also has an automated review concern about won disputes reviving refunded grants.

## 5. Closed-unmerged PRs relevant to truth

- #868 `Stabilize Vercel build: fix fonts, sitemap, and Clerk build errors`: `CLOSED` in public GitHub HTML. Its changes were not cherry-picked or recreated in this task and are not treated as current-main implementation unless independently present.

## 6. Current implementation matrix

| Domain / requirement | Current implementation evidence | Automated evidence | Manual/production evidence | Existing documentation claim | Correct status | Documentation action | Blocker/follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product identity | AGENTS/OWNER decisions single-place identity; no runtime platform evidence inspected. | Docs consistency searches. | Owner policy exists. | README implied only X0 active. | IMPLEMENTED_VERIFIED | README/AGENTS/roadmap updated. | None. |
| Payment eligibility | PaymentPolicy evaluates status/amount/currency/threshold; fulfillment uses currency limits. | currency-threshold/payment tests exist; rerun pending validation. | No production Stripe proof. | Older docs described inventory/fixes only. | IMPLEMENTED_VERIFIED | Roadmap/report updated. | Production payment proof. |
| Payment financial facts | Payment model/repository and Stripe webhook ledger exist. | Webhook/fulfillment tests exist. | No production ledger proof. | Stale docs understate current main. | IMPLEMENTED_VERIFIED | Roadmap/report updated. | Production webhook proof. |
| PatronGrant creation | fulfillPayment calls patron grant use case after eligibility. | Patron/payment tests exist. | No production proof. | Stale docs say X1 not started. | IMPLEMENTED_VERIFIED | README/roadmap updated. | Production smoke proof. |
| PatronGrant source of truth | checkVideoAccess uses getPatronStatus active grants for patron content. | Access/comment tests exist. | No production paid/locked proof. | Stale docs say X2 not started. | IMPLEMENTED_VERIFIED | README/roadmap updated. | Production diagnostics proof. |
| Refund lifecycle | Full refund revokes linked grant; partial recalculates and remains policy-sensitive. | handle-refund tests exist. | No production refund proof. | Docs mixed inventory/target. | PARTIAL | Report distinguishes current and target. | Partial refund owner policy; production proof. |
| Dispute lifecycle | Dispute lost revokes; open sets DISPUTED only; won recalculates but does not reactivate a revoked grant on current main. | No #871-only test claimed. | No production dispute proof. | Owner decision requires suspend/reactivate/revoke. | PARTIAL | PR #871 marked pending. | Review/merge/fix #871. |
| Manual grant/suspend/reactivate/revoke | Grant/revoke use cases exist; explicit suspend/reactivate model is not complete on current main. | Patron tests exist. | No owner/admin manual proof. | Target docs require reason/audit. | PARTIAL | Roadmap/timeline updated. | Manual action audit proof. |
| Access decision | Access module checks published state, tier and active PatronGrant. | Access tests exist. | No production evidence. | Stale roadmap says not started. | IMPLEMENTED_VERIFIED | Updated docs. | Production proof. |
| Identity/cache mismatch handling | User.isPatron/Clerk sync documented as cache/display; access reads grant. | User/access tests exist. | No production mismatch proof. | Mixed legacy docs. | IMPLEMENTED_VERIFIED | Updated docs. | Admin diagnostic proof. |
| VideoAsset foundation | VideoAsset model/repository and Cloudflare states exist. | Video tests exist. | No production asset proof. | Stale X3 not started. | IMPLEMENTED_VERIFIED | Updated docs. | Production asset smoke. |
| Cloudflare upload | Admin direct upload use case/client exists. | Video upload tests/reports exist. | Admin smoke runbook/report docs only. | Some launch docs already exist. | IMPLEMENTED_VERIFIED | Indexed. | Production proof. |
| Cloudflare import | Legacy import use case exists. | Import tests/reports exist. | Production import proof incomplete. | Already reported. | IMPLEMENTED_VERIFIED | Indexed. | Production proof. |
| Cloudflare webhook lifecycle | Webhook route/use case maps provider lifecycle to asset state. | Webhook tests/reports exist. | Production webhook proof incomplete. | Runbook exists. | IMPLEMENTED_VERIFIED | Indexed. | Production proof. |
| Legacy private fallback cutoff | Policy blocks private patron legacy fallback without READY provider asset. | Negative tests/reports exist. | No production proof. | Older tickets stale. | IMPLEMENTED_VERIFIED | Updated queue. | Production playback proof. |
| Signed patron playback | Cloudflare signed token/source resolution after access/READY asset is merged in PR #870. | media-source safety/route tests exist and rerun planned. | No production E2E proof. | LAUNCH-FIX-004 historical placeholder claim stale. | IMPLEMENTED_VERIFIED | Historical banner added; docs updated. | Production Cloudflare playback proof. |
| Denied playback safety | Denied plan returns no source/token/provider attempt/session. | media-source safety tests exist. | No production proof. | Some docs already state invariant. | IMPLEMENTED_VERIFIED | Updated docs. | Production negative proof. |
| Player mounting rules | PremiumWrapper/VideoPlayer mount only when access/playback plan permits; locked state uses overlay. | API/player tests partial. | No physical device proof. | Specs target. | IMPLEMENTED_VERIFIED | Updated docs. | X6/X7 device proof. |
| Playback session/view ordering | Session created only after Cloudflare token resolution; denied path empty tracking. | media-source tests exist. | No production proof. | Stale docs understate #870. | IMPLEMENTED_VERIFIED | Updated docs. | Production proof. |
| Public comment reads | listVideoComments allows public read on patron/login required published videos. | Comment smoke tests exist. | No production proof. | Historical X4 comments reports exist. | IMPLEMENTED_VERIFIED | Naming collision documented. | Production smoke. |
| Comment write/react/report authorization | Comment policy requires video access; guests cannot write/report; patron videos require PatronGrant/admin via access. | Comment negative tests exist. | No production proof. | Some stale queue entries. | IMPLEMENTED_VERIFIED | Updated queue/index. | Owner reaction launch scope open. |
| Comment moderation/audit | Admin delete/restore/report resolution audit events exist; states exist in schema. | Admin comment tests exist. | No owner moderation proof. | Specs target. | PARTIAL | Updated docs. | Moderation usability proof. |
| Admin diagnostics | Payment/video/comment/admin/health surfaces exist. | Admin tests exist. | Owner usability proof missing. | X5 previously not started. | PARTIAL | Roadmap/timeline updated. | X5 proof later. |
| Email/consent | Subscription and email modules separate from patron; unsubscribe does not grant/revoke patron. Suppression support target not fully proven. | Email/subscription tests exist. | No provider suppression proof. | Specs target. | PARTIAL | Snapshot added. | Bounce/complaint production proof. |
| Vercel/build/deployment | Local scripts exist; #868 closed unmerged; PR #871 preview showed Vercel failure in public HTML. | Validation attempted in this PR. | Current production deployment status not accessible via shell API. | Stale README had old PR closure notes. | PARTIAL | README/report updated. | Get current Vercel evidence for HEAD. |
| Production environment verification | Runbooks/reports exist, but no current production evidence in this task. | Docs only. | Incomplete. | Some reports historical. | PARTIAL | Updated docs. | Owner/operator evidence. |
| Provider webhook production verification | Cloudflare runbook exists; runtime exists. | Webhook tests exist. | Incomplete production proof. | Runbook current. | PARTIAL | Indexed. | Provider dashboard/Vercel proof. |
| Monitoring/incident response | PR #869 docs exist. | Docs validation. | Operational adoption not proven. | Stale roadmap omitted. | IMPLEMENTED_VERIFIED | README/roadmap updated. | Alert channel decisions. |
| Backup/restore | Ticket exists; no drill evidence found. | None. | Missing. | Backlog ticket exists. | MISSING | Queue updated. | Run backup/restore drill. |
| Legal/privacy/cookies/support | Owner questions/spec requirements exist. | Docs only. | Missing approved copy. | Open question exists. | OWNER_DECISION_REQUIRED | Preserved. | Owner legal copy. |
| Accessibility/mobile/performance | X6/X7 standards exist. | No pass executed. | Missing. | Standard exists. | MISSING | Next X6 ticket created. | Run X6 passes. |
| Cloudflare cost/retention | Owner question exists. | Docs only. | Missing decision. | Open question exists. | OWNER_DECISION_REQUIRED | Preserved. | Owner policy. |
| X6 evidence | Product Excellence standard exists; passes not executed. | Docs validation only. | Missing. | Some docs say standards exist. | MISSING | Roadmap/ticket updated. | Execute X6 tickets. |
| X7 Launch Evidence Pack | Launch Evidence Pack standard exists; pack incomplete. | Docs validation only. | Missing. | Some docs may imply readiness. | MISSING | Launch wording corrected. | Complete X7 evidence. |


## 7. Current automated evidence

Evidence found in current main includes focused reports and test files for:

- `tests/unit/modules/payments/**`, `tests/unit/refunds.test.ts`, `tests/unit/stripe-webhook.test.ts`.
- `tests/unit/modules/access/check-video-access.use-case.test.ts`.
- `tests/unit/media-source-safety.test.ts`, `tests/unit/api/media-source-route.test.ts`, `tests/unit/api/media-proxy-route.test.ts`, `tests/unit/modules/video/**`.
- `tests/unit/modules/comments/**`, `tests/unit/comments-route.test.ts`, `tests/unit/comment-reactions-route.test.ts`.
- Admin, health, email and architecture tests listed in the repository.

This PR's validation results are recorded in section 23 after commands were run.

## 8. Missing manual/production evidence

- Current Vercel deployment status for this exact HEAD could not be retrieved from shell API; public PR HTML exposed a failing preview on #871, not current-main production certification.
- Production Stripe webhook/fulfillment/refund/dispute proof is incomplete.
- Production Cloudflare upload/import/webhook/signed playback proof is incomplete.
- Owner/admin support-diagnostics usability proof is incomplete.
- Backup/restore drill evidence is missing.
- Legal/privacy/cookie/support copy approval is missing.
- Alert channels/thresholds/RPO/RTO are not owner-approved.
- X6.1-X6.8 evidence is not executed.
- X7 Launch Evidence Pack is incomplete.

## 9. Documentation inconsistencies found

- Root README and active roadmap claimed only X0 was active and X1-X7 were not started.
- Owner timeline instructed the owner to run the original X0 inventory.
- AGENTS omitted GBP from accepted launch threshold defaults.
- Source-of-truth hierarchy allowed a stale README to appear above product-policy truth.
- Historical X4 comment reports collided with current X4 playback/player naming.
- LAUNCH-FIX-004 described READY Cloudflare assets as non-playable placeholders, superseded by X3-FIX-011 / PR #870.
- Ready-ticket index still presented historical/completed tickets as the current queue.

## 10. Documentation corrections made

- Rewrote root README as a concise current owner control panel.
- Updated AGENTS only as needed: current stage, GBP, source-of-truth categories and historical evidence rules.
- Rewrote Active Execution Roadmap and Owner Timeline to distinguish implementation, automated evidence, production/manual proof and certification.
- Expanded reconciliation report index and ready-ticket queue index.
- Created this reconciliation report and a docs-only X6 next ticket.
- Added historical/superseded banner to LAUNCH-FIX-004.
- Added small current implementation snapshot references to priority specs.

## 11. Source-of-truth hierarchy

Categories now used consistently:

1. Implementation truth: current code and tests on current main.
2. Product-policy truth: owner decisions, AGENTS, OWNER-DECISIONS.
3. Current execution-status truth: README, Active Execution Roadmap, Owner Timeline and ticket queue.
4. Target/specification truth: specs, Product Standard, Phase Gates and Blueprint.
5. Historical evidence: PR bodies, reports, audits and superseded tickets.

`Target architecture != current implementation` remains preserved.

## 12. Phase/domain naming reconciliation

Canonical mapping:

- X1 = payments/patron lifecycle.
- X2 = access / PatronGrant truth.
- X3 = video provider foundation.
- X4 = PlaybackPlan / player safety.
- Comments are a domain/lane with historical `X4-*` report IDs.
- X5 = admin/support diagnostics.
- X6 = Product Excellence.
- X7 = Launch Evidence Pack.

Future comments tickets should not use bare `X4-*` unless explicitly labelled historical; future playback/player tickets should include `X4-PLAYBACK-*` or a similarly unambiguous title.

## 13. Ticket reconciliation

- Original X0/X0.5 tickets are historical/superseded by merged control-plane/product-standard work and this reconciliation.
- Many X1/X2/X3/X4/LAUNCH-FIX tickets in `docs/tickets/ready/**` are represented by merged reports and must not be treated as the current next action.
- Blocked owner-decision tickets remain blocked.
- Exactly one primary next executable ticket was created: `docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md`.

## 14. Owner decisions preserved

Preserved invariants include: single-creator place, patronat is one-time support reward, lifetime/no-expiry default access unless suspended/revoked, `Payment != PatronGrant != Subscription`, active PatronGrant access truth, Cloudflare first provider, no active legacy private fallback, public comment reads, patron/admin write under patron videos, and public launch requiring production/manual evidence.

## 15. Owner decisions still required

- Partial refund policy.
- Legal/privacy/cookie/support copy.
- Cloudflare cost/retention/original preservation.
- RPO/RTO.
- Captions/subtitles scope.
- Physical device baseline.
- Alert channels and thresholds.
- Representative user validation waiver.
- Security-review depth.
- Post-launch stabilization timing.

## 16. Historical/superseded report handling

Historical reports remain historical evidence. This PR marks LAUNCH-FIX-004 as superseded for signed Cloudflare playback by X3-FIX-011 / PR #870 while preserving its original conclusions.

## 17. Current X1-X7 status

- X1: `PARTIAL`; PR #871 pending.
- X2: `IMPLEMENTED_VERIFIED` locally; production proof pending.
- X3: `IMPLEMENTED_VERIFIED` locally; production provider proof pending.
- X4: `IMPLEMENTED_VERIFIED` locally for playback safety; naming collision documented.
- X5: `PARTIAL`; owner usability proof pending.
- X6: `MISSING` execution; standard exists.
- X7: `MISSING` evidence pack; public launch not certified.

## 18. Current launch-readiness classification

```txt
NO_GO
```

Reason: implementation foundation is substantially present and automated evidence exists for many slices, but production/manual evidence, owner decisions, X6 passes and X7 Launch Evidence Pack are incomplete.

## 19. Active blockers

- PR #871 pending review/merge and not current-main truth.
- Production Stripe lifecycle proof.
- Production Cloudflare proof.
- Legal/privacy/cookie/support owner decisions.
- Alert thresholds/channels/RPO/RTO owner decisions.
- Backup/restore drill.
- X6/X7 evidence execution.

## 20. Recommended next ticket

`docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md`.

## 21. Files changed

Documentation-only files under allowed paths: README, AGENTS, roadmap/timeline, strategy/spec references, reconciliation reports and ticket indexes/next ticket.

## 22. What did not change

No runtime code, tests, schema, migrations, package files, build config, provider implementation, public assets, GitHub workflows or generated files were intentionally modified.

## 23. Validation results

- PASS: `git diff --check`.
- PASS: `git status --short` and `git diff --name-only` reviewed; changed files are documentation-only allowed paths.
- PASS with intentional historical/superseded matches: stale-phrase search for X0-only language. Remaining matches are in historical/superseded reports/tickets or this reconciliation explaining the stale state.
- PASS: threshold search now shows GBP in active owner/strategy/spec/roadmap copied defaults.
- PASS with intentional historical/invariant matches: Cloudflare placeholder/provider-gating search. `LAUNCH-FIX-004` is now marked historical/superseded by signed playback; other placeholder matches are denied-state invariants or search commands.
- PASS with intentional historical/alias matches: X4 comments/playback collision search. Roadmap/index define canonical current mapping and historical comments aliases.
- PASS with intentional standard-definition matches: launch-status terms search. Remaining `LAUNCH_READY`, `SAFE_BASELINE` and `EXCELLENT_AND_STABLE` references define standards or warn against misuse.
- PASS: `npm run db:generate`. Prisma generated successfully; npm warned about unknown `http-proxy` env config and deprecated `package.json#prisma`.
- PASS: `npm run typecheck`.
- PASS: `npm run quality:architecture-boundaries`. Architecture check passed with existing allowed temporary imports.
- PASS: `npm test -- --run tests/unit/media-source-safety.test.ts tests/unit/api/media-source-route.test.ts tests/unit/api/media-proxy-route.test.ts tests/unit/modules/video tests/unit/modules/comments tests/unit/modules/access` — 28 files / 182 tests passed.
- WARNING: `npm run vercel-build` failed because the environment could not fetch Google fonts through `next/font` (`Gluten`, `Inter`, `Outfit`, `Plus Jakarta Sans`, `Space Grotesk`). No runtime/build files were changed to work around this docs-only task.
- PASS: changed-doc path references checked by script; no missing path references found in the core changed dashboard/report/ticket files.
- PR #871 final check: public GitHub HTML still shows `Open` / pending merge, with a Vercel preview failure and an automated review concern.

## 24. Risks

- GitHub API/Vercel status could not be queried from shell due proxy restrictions; public GitHub HTML provided only partial PR/Vercel evidence.
- Some historical tickets remain in `docs/tickets/ready/**` by repository convention; the queue index now marks them as historical/superseded instead of moving files.
- PR #871 may merge after this PR is prepared; if so, documentation must be updated from latest main before merge.

## 25. Merge recommendation

`MERGE`, assuming validation passes and PR #871 remains open/unmerged at final check. If #871 merges before this PR, update from latest main and reconcile once.
