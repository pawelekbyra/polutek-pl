# DNA-EXCELLENCE-001 — Product Excellence and Launch Proof

Status: READY
Type: docs-only standard / Integrator Product Standards Planner

## Goal

Integrate a measurable `PRODUCT EXCELLENCE & LAUNCH PROOF` program into Product DNA so Polutek.pl has clear standards for safe baseline, launch readiness, excellence, X6 Product Excellence passes, X7 Launch Evidence Pack and post-launch stabilization.

This ticket does not certify runtime and does not implement application code.

## Context

Polutek.pl remains one official VOD place for one creator: one catalogue, one patron/access system, one community, one mailing list and one admin cockpit. The standard must preserve existing owner decisions: one-time patron support/donation, lifetime/no-expiry patron access by default, Cloudflare Stream first, active PatronGrant as backend access truth and no marketplace/multi-creator SaaS/tenant platform/recurring patron subscription/heavy enterprise provider framework.

Required truths:

```txt
Target architecture != current implementation.
Written standard != implemented runtime.
Merged code != production proof.
Green unit tests != production certification.
Launch-ready != permanently finished.
```

## Allowed paths

```txt
docs/tickets/ready/DNA-EXCELLENCE-001-product-excellence-and-launch-proof.md
docs/strategy/PRODUCT-STANDARD.md
docs/strategy/MVP-TO-LAUNCH-SCOPE.md
docs/roadmap/Phase-Gates.md
docs/specs/LAUNCH-READINESS-SPEC.md
docs/specs/OBSERVABILITY-SUPPORT-SPEC.md
docs/reports/reconciliation/DNA-EXCELLENCE-001-PRODUCT-EXCELLENCE-AND-LAUNCH-PROOF.md
```

## Forbidden paths

Do not edit runtime, tests, Prisma, migrations, package files, architecture guards, root `README.md`, `AGENTS.md`, `docs/strategy/OWNER-DECISIONS.md`, `docs/roadmap/Active-Execution-Roadmap.md`, `docs/roadmap/OWNER-TIMELINE.md` or existing tickets for other phases.

## Required changes

- Add Product Excellence DNA to Product Standard.
- Define `SAFE_BASELINE`, `LAUNCH_READY` and `EXCELLENT_AND_STABLE` as separate statuses.
- Define shared truth classification: `IMPLEMENTED_VERIFIED`, `IMPLEMENTED_UNVERIFIED`, `PARTIAL`, `MISSING`, `BLOCKED`, `OWNER_DECISION_REQUIRED`, `DEFERRED_POST_LAUNCH`, `NOT_APPLICABLE`.
- Define X6 as separate measurable passes X6.1-X6.8 with entry criteria, evidence, measurable exit criteria, launch blockers, should-have, post-launch items, owner questions and small-ticket candidates.
- Define X6 evidence matrix and prohibited weak evidence.
- Expand Phase Gates so X6 is a pass program and X7 is Launch Proof.
- Expand Launch Readiness Spec with a complete Launch Evidence Pack.
- Expand Observability Support Spec with health signal, audit event, operational log, alert, support diagnostic, correlation/redaction, failed/stuck events, alert ownership, acknowledgement, recovery and test-alert requirements.
- Expand MVP-to-Launch Scope with X6 mapping into launch-critical/should-have/post-launch/owner questions.
- Add Post-Launch Stabilization DNA with proposed 72h/14d/30d loop marked `OWNER_DECISION_REQUIRED` until owner approval.
- Create reconciliation report with consistency matrix, owner decisions, risks and 10-18 future ticket candidates.

## Required validations

```bash
git diff --check
git diff --name-only
git diff --name-only | grep -E '^(app|lib|components|tests|prisma|scripts)/|package(-lock)?\.json|AGENTS\.md|README\.md'
rg -n "Product Excellence|SAFE_BASELINE|LAUNCH_READY|EXCELLENT_AND_STABLE|IMPLEMENTED_VERIFIED|IMPLEMENTED_UNVERIFIED|OWNER_DECISION_REQUIRED|X6\.|Launch Evidence Pack|Post-Launch Stabilization" docs/strategy docs/roadmap/Phase-Gates.md docs/specs docs/reports/reconciliation
```

Expected forbidden-path grep result: no matches / command exits 1 because no forbidden files changed.

Optional:

```bash
npm run quality:architecture-boundaries
```

For this docs-only ticket, runtime tests are not required and must not be reported as passed unless run.

## Definition of Done

- Ticket file exists.
- Product DNA identity is preserved.
- Measurable excellence standard exists.
- `SAFE_BASELINE`, `LAUNCH_READY` and `EXCELLENT_AND_STABLE` are defined.
- Shared truth classification is defined.
- X6 is split into concrete passes and not treated as one rewrite.
- Each X6 pass has entry criteria, evidence and measurable exit criteria.
- X7 requires a complete Launch Evidence Pack.
- Launch cannot be certified by local tests/docs alone.
- Post-launch stabilization loop is documented as proposed default requiring owner acceptance.
- Owner decisions are identified but not resolved by the agent.
- 10-18 small follow-up ticket candidates are listed in reconciliation report.
- No runtime/schema/package/owner-decision files changed.
- Product is not marked launch-ready or excellent.
- Reconciliation report exists.
- `git diff --check` passes.
- Changed files are limited to allowed paths.
- PR report follows `AGENTS.md` and recommends the next single ticket.

## Risks

- Documentation can become too heavy unless future tickets stay small.
- Excellence can become infinite polish unless launch-critical, should-have and post-launch are separated.
- Production evidence cannot exist before production deployment and must be marked honestly.
- Automated tests can create false confidence without manual/production proof.
- X6 can produce oversized PRs if pass tickets are not kept narrow.
- Benchmarks may need updates as browsers, devices and Core Web Vitals evolve.
- Owner may accept explicit exceptions; they must remain recorded and not become hidden defaults.

## Owner decisions

Agents must not resolve open owner decisions. Missing choices must be marked `OWNER_DECISION_REQUIRED`, especially RPO/RTO, captions/subtitles scope, device matrix, stabilization period, usability testing/waiver, performance exceptions, alert channels/thresholds and security verification depth.

## Docs-only certification boundary

This ticket produces a written standard only. It does not certify X6, X7, production launch readiness, runtime behavior, security, accessibility, performance, backup/recovery or post-launch stability.
